'use strict';

function createMemoryQueue() {
    const queue = [];

    return {
        async put(data) {
            queue.push(data);
            return { key };
        },

        async get() {
            return queue.shift()
        }
    };
}

module.exports = {
    createMemoryStorage,
};