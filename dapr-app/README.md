# Dapr-compatible example

This example keeps the existing Dapr pub/sub edge while using the repository's
object-storage middleware for persistence.

```text
POST :3000/thing
  -> validation
  -> Dapr pubsub/thing
  -> writer POST :3001/thing (CloudEvent)
  -> S3-compatible bucket at things/<id>.json
```

[`sample.json`](sample.json) is the complete input/output data definition.

## Prerequisites

- Node 22.22+
- Dapr CLI and a running Dapr environment
- An existing S3-compatible bucket

Install the repository dependencies once from its root:

```sh
npm install
```

## Start the writer

Configure AWS credentials normally, or use these variables for an
S3-compatible endpoint such as MinIO:

```sh
export S3_BUCKET=application-data
export S3_ENDPOINT=http://127.0.0.1:9000
export S3_ACCESS_KEY_ID=minioadmin
export S3_SECRET_ACCESS_KEY=minioadmin
export S3_FORCE_PATH_STYLE=true

dapr run --app-id mvpstate --app-port 3001 -- node dapr-app/writer/app.js
```

The writer preserves Dapr's subscription discovery endpoint:

```json
[
  {
    "pubsubname": "pubsub",
    "topic": "thing",
    "route": "thing"
  }
]
```

## Start validation

```sh
dapr run --app-id mvpval --app-port 3000 -- node dapr-app/validation/app.js
```

Invoke the API with the canonical payload:

```sh
dapr invoke --app-id mvpval --method thing --data-file dapr-app/sample.json
```

Read it through the writer API:

```sh
curl http://127.0.0.1:3001/thing/42
```

## Verify without Dapr

The writer's middleware also accepts direct JSON, which is useful when testing
storage independently of pub/sub:

```sh
curl \
  -H 'Content-Type: application/json' \
  --data @dapr-app/sample.json \
  http://127.0.0.1:3001/thing
```

Run `npm run test:integration` from the repository root to start MinIO
automatically and prove direct API writes and reads against real S3-compatible
storage.
