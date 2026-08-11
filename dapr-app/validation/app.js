// ------------------------------------------------------------
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// ------------------------------------------------------------
const OpenAPIBackend = require('openapi-backend').default;
const express = require('express');
const axios = require('axios');
const path = require('path');
const {
    PayloadValidationError,
    assertMatchesDefinition,
    thingDefinition,
} = require('../..');

const daprPort = process.env.DAPR_HTTP_PORT || 3500;
const queueName = `pubsub`;
const messageType = `thing`;
const port = 3000;

function createApp({
    publisher = axios,
    daprHttpPort = daprPort,
    definition = path.join(__dirname, 'api-thing.yml'),
    dataDefinition = thingDefinition,
} = {}) {
    const app = express();
    app.use(express.json());

    const daprUrl = `http://localhost:${daprHttpPort}/v1.0`;

    // define api
    const api = new OpenAPIBackend({
        definition,
        strict: true,
        quick: false,
        validate: true,
        ignoreTrailingSlashes: true,
        handlers: {
            postThing: async (c, req, res) => {
                const data = req.body;

                try {
                    assertMatchesDefinition(data, dataDefinition);
                } catch (error) {
                    if (error instanceof PayloadValidationError) {
                        return res.status(400).json({
                            error: error.code,
                            issues: error.issues,
                        });
                    }
                    throw error;
                }

                await publisher.post(`${daprUrl}/publish/${queueName}/${messageType}`, data);
                res.status(200).json({ operationId: c.operation.operationId });
            },
            validationFail: async (c, req, res) => res.status(400).json({
                error: 'INVALID_PAYLOAD',
                issues: c.validation.errors,
            }),
            notFound: async (c, req, res) => res.status(404).json({ err: 'not found' }),
        },
    });

    const apiReady = api.init();

    // use as express middleware
    app.use(async (req, res, next) => {
        try {
            await apiReady;
            await api.handleRequest(req, req, res);
        } catch (err) {
            next(err);
        }
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
