# API Blob Storage Middleware

`@jefking/api-blob-storage` turns a JSON HTTP resource into objects in an
S3-compatible store. Its handlers are standard Express middleware and accept
both direct JSON requests and structured CloudEvents delivered by Dapr.

```text
HTTP JSON ─┐
           ├─> JSON resource middleware ─> storage port ─> S3 / MinIO
Dapr event ┘
```

The storage port is deliberately small (`put` and `get`), so another blob
provider can be added without changing the API or Dapr middleware.

## Data contract

[`dapr-app/sample.json`](dapr-app/sample.json) is the canonical definition of
data entering and leaving this subsystem:

```json
{
  "id": 42,
  "description": "i am a thing.",
  "unique": false
}
```

The middleware derives its runtime contract from this example. Every field is
required, additional fields are rejected, values must have the demonstrated
JSON types, and an integer example requires a JavaScript-safe integer. Writes
and reads return the same object without enrichment or mutation.

## Install

```sh
npm install @jefking/api-blob-storage express
```

Node 22.22 or newer is required.

## Use as Express middleware

```js
const express = require('express');
const {
  createJsonResource,
  createS3Storage,
} = require('@jefking/api-blob-storage');

const storage = createS3Storage({
  client: myS3Client,
  bucket: 'application-data',
  prefix: 'things',
});
const things = createJsonResource({ storage });

const app = express();
app.use(express.json({ type: ['application/json', 'application/*+json'] }));
app.post('/thing', things.write);
app.get('/thing/:id', things.read);
```

`POST /thing` writes `things/<encoded-id>.json` and returns the stored JSON with
status 201. `GET /thing/:id` reads it back or returns 404.

A structured CloudEvent is unwrapped only when its content type is
`application/cloudevents+json` or it has CloudEvent `specversion` and `data`
fields. A successful event delivery returns an empty 200 response, which keeps
the handlers compatible with Dapr pub/sub delivery. A permanently invalid Dapr
payload returns `200 {"status":"DROP"}` so it is not retried forever; transient
storage failures remain non-2xx responses and can be retried.

## Configure S3 from the environment

The Dapr writer example uses `createS3StorageFromEnv()` and accepts:

| Variable | Required | Default |
| --- | --- | --- |
| `S3_BUCKET` | yes | — |
| `S3_PREFIX` | no | `things` |
| `S3_ENDPOINT` | no | AWS SDK default |
| `S3_REGION` / `AWS_REGION` | no | `us-east-1` |
| `S3_ACCESS_KEY_ID` / `AWS_ACCESS_KEY_ID` | for static credentials | AWS SDK provider chain |
| `S3_SECRET_ACCESS_KEY` / `AWS_SECRET_ACCESS_KEY` | for static credentials | AWS SDK provider chain |
| `S3_SESSION_TOKEN` / `AWS_SESSION_TOKEN` | for temporary credentials | AWS SDK provider chain |
| `S3_FORCE_PATH_STYLE` | no | true when `S3_ENDPOINT` is set |

For MinIO, set `S3_ENDPOINT` to its API endpoint and supply its access key and
secret. The bucket must exist before the application starts; provisioning is
kept outside request middleware.

## Storage adapter contract

A custom provider needs only this shape:

```js
const storage = {
  async put(key, bytes, { contentType }) {
    // Persist bytes and return optional provider metadata.
    return { key };
  },
  async get(key) {
    // Return null when absent, otherwise bytes and optional metadata.
    return { key, bytes, contentType: 'application/json' };
  },
};
```

MinIO validates the S3-compatible adapter. Azure Blob Storage would require a
separate adapter and an Azurite-backed integration suite because MinIO does not
implement Azure's protocol.

## Tests

```sh
# Fast tests; Docker is not required
npm test

# Starts a real MinIO container and crosses the HTTP/S3 boundary both ways
npm run test:integration

# Everything
npm run test:all
```

The integration suite writes the canonical sample through the HTTP middleware
and reads it directly with the AWS S3 client. It also seeds an object directly
through S3 and reads it through HTTP. This prevents a shared implementation bug
from making a simple round-trip test pass.

The test image is pinned because MinIO's community repository was archived in
2026 and maintained binary images are no longer published. It is suitable as
an isolated compatibility fixture; production deployments should choose and
maintain their object-storage implementation independently.

## Existing Dapr example

The original two-stage example remains under [`dapr-app`](dapr-app/README.md):

1. `validation` validates the direct API payload and publishes `pubsub/thing`.
2. Dapr wraps the message as a CloudEvent and posts it to the writer's `/thing`.
3. The package middleware unwraps, validates, and stores `things/<id>.json`.
4. The writer also exposes `GET /thing/:id` for reads.

The former `inflated` field was removed at the storage boundary so input and
output both conform exactly to `sample.json`.
