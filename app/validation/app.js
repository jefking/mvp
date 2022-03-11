// ------------------------------------------------------------
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// ------------------------------------------------------------

const express = require('express');
const axios = require('axios');
require('isomorphic-fetch');

const app = express();
app.use(express.json());

const daprPort = process.env.DAPR_HTTP_PORT || 3500;
const queueName = `queuething`;
const messageType = `thing`;
const daprUrl = `http://localhost:${daprPort}/v1.0`;
const port = 3000;

app.get('/dapr/subscribe', (_req, res) => {
    res.json([
        {
            pubsubname: queueName,
            topic: "thing",
            route: "thing"
        }
    ]);
});

// Publish to topic (messageType) using Dapr pub-sub
app.post('/thing', async (req, res) => {
    const data = req.body;

    if (undefined === data.id || 0 == data.id) {
        console.logError("no id!"); //fake validation.
        
        res.sendStatus(500);
    }
    else {
        console.log("Publishing: ", data);

        res.sendStatus(200);
    }
});

app.listen(port, () => console.log(`Node App listening on port ${port}!`));