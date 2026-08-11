// ------------------------------------------------------------
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// ------------------------------------------------------------

const express = require('express');
const {
    createJsonResource,
    createS3StorageFromEnv,
    thingDefinition,
} = require('../..');

const queueName = `pubsub`;
const port = 3001;

function createApp({ storage, env = process.env } = {}) {
    const app = express();
    const objectStorage = storage || createS3StorageFromEnv({ env });
    const thing = createJsonResource({
        storage: objectStorage,
        definition: thingDefinition,
    });

    // Accept both direct API requests and structured CloudEvents from Dapr.
    app.use(express.json({ type: ['application/json', 'application/*+json'] }));

    app.get('/dapr/subscribe', (_req, res) => {
        res.json([
            {
                pubsubname: queueName,
                topic: "thing",
                route: "thing"
            }
        ]);
    });

    app.post('/thing', thing.write);
    app.get('/thing/:id', thing.read);

    app.use((error, _req, res, _next) => {
        res.status(error.statusCode || 500).json({
            error: error.code || 'STORAGE_ERROR',
            message: error.message,
        });
    });

    return app;
}

function start({ listenPort = port } = {}) {
    return createApp().listen(listenPort, () => console.log(`Node App listening on port ${listenPort}!`));
}

if (require.main === module) {
    start();
}

module.exports = {
    createApp,
    start,
};
