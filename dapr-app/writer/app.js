// ------------------------------------------------------------
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// ------------------------------------------------------------

const express = require('express');
const bodyParser = require('body-parser');
require('isomorphic-fetch');

const app = express();
// Dapr publishes messages with the application/cloudevents+json content-type
app.use(bodyParser.json({ type: 'application/*+json' }));

const daprPort = process.env.DAPR_HTTP_PORT || 3500;
const queueName = `pubsub`;
const stateStoreName = `statestore`;
const stateUrl = `http://localhost:${daprPort}/v1.0/state/${stateStoreName}`;
const port = 3001;

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

    fetch(stateUrl, {
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

app.listen(port, () => console.log(`Node App listening on port ${port}!`));