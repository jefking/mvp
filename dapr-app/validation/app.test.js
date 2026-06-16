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

test('POST /thing validates and publishes inflated things', async () => {
    const published = [];
    const app = createApp({
        daprHttpPort: 9999,
        publisher: {
            post: async (publishUrl, body) => {
                published.push({ publishUrl, body });
                return { status: 204 };
            },
        },
    });
    const server = await listen(app);

    try {
        const thing = {
            id: 42,
            description: 'i am a thing.',
            unique: false,
        };

        const response = await fetch(url(server, '/thing'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(thing),
        });

        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { operationId: 'postThing' });
        assert.deepEqual(published, [
            {
                publishUrl: 'http://localhost:9999/v1.0/publish/pubsub/thing',
                body: {
                    ...thing,
                    inflated: true,
                },
            },
        ]);
    } finally {
        await close(server);
    }
});

test('POST /thing rejects invalid request bodies', async () => {
    const app = createApp({
        publisher: {
            post: async () => {
                throw new Error('invalid requests should not be published');
            },
        },
    });
    const server = await listen(app);

    try {
        const response = await fetch(url(server, '/thing'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: 42 }),
        });
        const body = await response.json();

        assert.equal(response.status, 405);
        assert.ok(Array.isArray(body.err));
        assert.equal(body.err[0].message, "must have required property 'unique'");
    } finally {
        await close(server);
    }
});

test('unknown validation routes return 404', async () => {
    const app = createApp();
    const server = await listen(app);

    try {
        const response = await fetch(url(server, '/missing'));

        assert.equal(response.status, 404);
        assert.deepEqual(await response.json(), { err: 'not found' });
    } finally {
        await close(server);
    }
});
