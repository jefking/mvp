// ------------------------------------------------------------
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// ------------------------------------------------------------
const OpenAPIBackend = require('openapi-backend').default;
const express = require('express');
const axios = require('axios');
require('isomorphic-fetch');

const app = express();
app.use(express.json());

const daprPort = process.env.DAPR_HTTP_PORT || 3500;
const queueName = `pubsub`;
const messageType = `thing`;
const daprUrl = `http://localhost:${daprPort}/v1.0`;
const port = 3000;

// define api
const api = new OpenAPIBackend({
    definition: {
        openapi: '3.0.1',
        info: {
            title: 'My API',
            version: '1.0.0',
        },
        paths: {
            '/thing': {
                post: {
                    operationId: 'postThing',
                    responses: {
                        200: { description: 'ok' },
                    },
                },
            }
        },
    },
    handlers: {
        postThing: async (c, req, res) => {
            const data = req.body;

            if (undefined === data.id || 0 == data.id) {
                console.logError("no id!"); //fake validation.

                res.sendStatus(500);
            }
            else {
                data.inflated = true;
                console.log("Publishing: ", data);

                await axios.post(`${daprUrl}/publish/${queueName}/${messageType}`, data).catch(err => console.log(err));
                res.status(200).json({ operationId: c.operation.operationId });
            }
        },
        validationFail: async (c, req, res) => res.status(400).json({ err: c.validation.errors }),
        notFound: async (c, req, res) => res.status(404).json({ err: 'not found' }),
    },
});

api.init();

// use as express middleware
app.use((req, res) => api.handleRequest(req, req, res));

app.listen(port, () => console.log(`Node App listening on port ${port}!`));