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
    definition: './api-thing.yml',
    strict: true,
    quick: false,
    validate: true,
    ignoreTrailingSlashes: true,
    handlers: {
        postThing: async (c, req, res) => {
            const data = req.body;

            data.inflated = true;
            console.log("Publishing: ", data);

            await axios.post(`${daprUrl}/publish/${queueName}/${messageType}`, data).catch(err => console.log(err));
            res.status(200).json({ operationId: c.operation.operationId });
        },
        validationFail: async (c, req, res) => res.status(405).json({ err: c.validation.errors }),
        notFound: async (c, req, res) => res.status(404).json({ err: 'not found' }),
    },
});

api.init();

// use as express middleware
app.use((req, res) => api.handleRequest(req, req, res));

app.listen(port, () => console.log(`Node App listening on port ${port}!`));