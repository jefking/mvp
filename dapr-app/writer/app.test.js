const assert = require('node:assert/strict');
const test = require('node:test');
const { createMemoryStorage } = require('../..');
const sample = require('../sample.json');
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

test('GET /dapr/subscribe preserves the existing thing subscription', async () => {
    const app = createApp({ storage: createMemoryStorage() });
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

test('POST /thing unwraps a Dapr CloudEvent and stores the canonical payload', async () => {
    const storage = createMemoryStorage();
    const app = createApp({ storage });
    const server = await listen(app);

    try {
        const response = await fetch(url(server, '/thing'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/cloudevents+json' },
            body: JSON.stringify({
                specversion: '1.0',
                id: 'event-1',
                source: 'mvpval',
                type: 'thing',
                data: sample,
            }),
        });

        assert.equal(response.status, 200);
        assert.equal(await response.text(), '');

        const object = await storage.get('42.json');
        assert.ok(object);
        assert.equal(object.contentType, 'application/json');
        assert.deepEqual(JSON.parse(Buffer.from(object.bytes).toString('utf8')), sample);
    } finally {
        await close(server);
    }
});

test('invalid Dapr payloads are dropped instead of retried forever', async () => {
    const storage = createMemoryStorage();
    const app = createApp({ storage });
    const server = await listen(app);

    try {
        const response = await fetch(url(server, '/thing'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/cloudevents+json' },
            body: JSON.stringify({
                specversion: '1.0',
                id: 'event-invalid',
                source: 'mvpval',
                type: 'thing',
                data: { id: 42, unique: false },
            }),
        });

        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { status: 'DROP' });
        assert.deepEqual(storage.keys(), []);
    } finally {
        await close(server);
    }
});

test('direct API requests write and read the same sample.json payload', async () => {
    const app = createApp({ storage: createMemoryStorage() });
    const server = await listen(app);

    try {
        const writeResponse = await fetch(url(server, '/thing'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sample),
        });
        assert.equal(writeResponse.status, 201);
        assert.deepEqual(await writeResponse.json(), sample);

        const readResponse = await fetch(url(server, `/thing/${sample.id}`));
        assert.equal(readResponse.status, 200);
        assert.deepEqual(await readResponse.json(), sample);
    } finally {
        await close(server);
    }
});

test('POST /thing returns 500 when object persistence fails', async () => {
    const storage = {
        put: async () => {
            throw new Error('Failed to persist object.');
        },
        get: async () => null,
    };
    const app = createApp({ storage });
    const server = await listen(app);

    try {
        const response = await fetch(url(server, '/thing'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sample),
        });

        assert.equal(response.status, 500);
        assert.deepEqual(await response.json(), {
            error: 'STORAGE_ERROR',
            message: 'Failed to persist object.',
        });
    } finally {
        await close(server);
    }
});
