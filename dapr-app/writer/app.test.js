const assert = require('node:assert/strict');
const test = require('node:test');
const { createApp } = require('./app');

function listen(app) {
    return new Promise((resolve) => {
        const server = app.listen(0, () => resolve(server));
    });
}

function close(server) {
    return new Promise((resolve, reject) => {
        server.close((err) => err ? reject(err) : resolve());
    });
}

function url(server, path) {
    const { port } = server.address();
    return `http://127.0.0.1:${port}${path}`;
}

test('GET /dapr/subscribe returns the thing topic subscription', async () => {
    const app = createApp();
    const server = await listen(app);

    try {
        const response = await fetch(url(server, '/dapr/subscribe'));

        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), [
            {
                pubsubname: 'pubsub',
                topic: 'thing',
                route: 'thing',
            },
        ]);
    } finally {
        await close(server);
    }
});

test('POST /thing persists the CloudEvent data payload to Dapr state', async () => {
    const persisted = [];
    const app = createApp({
        daprHttpPort: 9999,
        fetchImpl: async (stateUrl, options) => {
            persisted.push({ stateUrl, options });
            return { ok: true };
        },
    });
    const server = await listen(app);

    try {
        const data = {
            id: 42,
            description: 'i am a thing.',
            unique: false,
            inflated: true,
        };

        const response = await fetch(url(server, '/thing'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/cloudevents+json' },
            body: JSON.stringify({ data }),
        });

        assert.equal(response.status, 200);
        assert.deepEqual(persisted, [
            {
                stateUrl: 'http://localhost:9999/v1.0/state/statestore',
                options: {
                    method: 'POST',
                    body: JSON.stringify([
                        {
                            key: 'thing',
                            value: data,
                        },
                    ]),
                    headers: {
                        'Content-Type': 'application/json',
                    },
                },
            },
        ]);
    } finally {
        await close(server);
    }
});

test('POST /thing returns 500 when Dapr state persistence fails', async () => {
    const app = createApp({
        fetchImpl: async () => ({ ok: false }),
    });
    const server = await listen(app);

    try {
        const response = await fetch(url(server, '/thing'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/cloudevents+json' },
            body: JSON.stringify({ data: { id: 42 } }),
        });

        assert.equal(response.status, 500);
        assert.deepEqual(await response.json(), { message: 'Failed to persist state.' });
    } finally {
        await close(server);
    }
});
