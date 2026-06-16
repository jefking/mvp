// ------------------------------------------------------------
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// ------------------------------------------------------------

const express = require('express');
const bodyParser = require('body-parser');
require('isomorphic-fetch');

const daprPort = process.env.DAPR_HTTP_PORT || 3500;
const queueName = `pubsub`;
const stateStoreName = `statestore`;
const port = 3001;

function createApp({ fetchImpl = globalThis.fetch, daprHttpPort = daprPort } = {}) {
    const app = express();
    const stateUrl = `http://localhost:${daprHttpPort}/v1.0/state/${stateStoreName}`;

    // Dapr publishes messages with the application/cloudevents+json content-type
    app.use(bodyParser.json({ type: 'application/*+json' }));

    app.get('/dapr/subscribe', (_req, res) => {
        res.json([
            {
                pubsubname: queueName,
                topic: "thing",
                route: "thing"
            }
        ]);
    });

    app.post('/thing', (req, res) => {
        const data = req.body.data;
        console.log(`Got a thing! ${JSON.stringify(data)}`);

        const state = [{
            key: "thing",
            value: data
        }];

        fetchImpl(stateUrl, {
            method: "POST",
            body: JSON.stringify(state),
            headers: {
                "Content-Type": "application/json"
            }
        }).then((response) => {
            if (!response.ok) {
                throw "Failed to persist state.";
            }

            console.log("Successfully persisted state.");
            res.status(200).send();
        }).catch((error) => {
            console.log(error);
            res.status(500).send({ message: error });
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
