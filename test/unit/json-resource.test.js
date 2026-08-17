'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
    StoredDataError,
    createJsonResource,
    createMemoryStorage,
    keyFromId,
} = require('../..');
const sample = require('../fixtures/thing.json');

test('put/get round-trips the canonical payload without mutating it', async () => {
    const storage = createMemoryStorage();
    const resource = createJsonResource({ storage, definition: sample });
    const input = structuredClone(sample);
    const before = structuredClone(input);

    const written = await resource.put(input);
    assert.deepEqual(written, { key: '42.json', value: sample });
    assert.deepEqual(input, before);
    assert.deepEqual(storage.keys(), ['42.json']);

    const read = await resource.get(sample.id);
    assert.deepEqual(read, { key: '42.json', value: sample });
});

test('writing the same ID is an idempotent replacement', async () => {
    const storage = createMemoryStorage();
    const resource = createJsonResource({ storage, definition: sample });
    await resource.put(sample);
    const replacement = { ...sample, description: 'replacement' };
    await resource.put(replacement);

    assert.deepEqual(storage.keys(), ['42.json']);
    assert.deepEqual((await resource.get(sample.id)).value, replacement);
});

test('object keys encode IDs and cannot create prefix-like paths', () => {
    assert.equal(keyFromId('../thing/42'), '..%2Fthing%2F42.json');
});

test('invalid JSON in storage fails as invalid stored data', async () => {
    const storage = createMemoryStorage();
    await storage.put('42.json', Buffer.from('{invalid'), { contentType: 'application/json' });
    const resource = createJsonResource({ storage, definition: sample });

    await assert.rejects(
        resource.get(42),
        (error) => error instanceof StoredDataError && error.code === 'INVALID_STORED_DATA',
    );
});
