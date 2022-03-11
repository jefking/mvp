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
const queueName = `pubsub`;
const messageType = `thing`;
const daprUrl = `http://localhost:${daprPort}/v1.0`;
const port = 3000;

// Publish to topic (messageType) using Dapr pub-sub
app.post('/thing', async (req, res) => {
        const data = req.body;

        if (undefined === data.id || 0 == data.id) {
            console.logError("no id!"); //fake validation.

            res.sendStatus(500);
        }
        else {
            data.inflated = true;
            console.log("Publishing: ", data);

            await axios.post(`${daprUrl}/publish/${queueName}/${messageType}`, data).catch(err => console.log(err));
            res.sendStatus(200);
        }
});

app.listen(port, () => console.log(`Node App listening on port ${port}!`));