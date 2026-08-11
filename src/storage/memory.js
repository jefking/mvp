'use strict';

function copyBytes(bytes) {
    return Uint8Array.from(bytes);
}

function createMemoryStorage() {
    const objects = new Map();

    return {
        async put(key, bytes, { contentType = 'application/octet-stream' } = {}) {
            objects.set(key, {
                bytes: copyBytes(bytes),
                contentType,
            });
            return { key };
        },

        async get(key) {
            const object = objects.get(key);
            if (!object) return null;
            return {
                key,
                bytes: copyBytes(object.bytes),
                contentType: object.contentType,
            };
        },

        has(key) {
            return objects.has(key);
        },

        keys() {
            return [...objects.keys()];
        },
    };
}

module.exports = {
    createMemoryStorage,
};
