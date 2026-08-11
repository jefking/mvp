'use strict';

const assert = require('node:assert/strict');
const {
    after,
    before,
    test,
} = require('node:test');
const {
    CreateBucketCommand,
    GetObjectCommand,
    PutObjectCommand,
    S3Client,
} = require('@aws-sdk/client-s3');
const { MinioContainer } = require('@testcontainers/minio');
const express = require('express');
const {
    createJsonResource,
    createS3Storage,
} = require('../..');
const sample = require('../../dapr-app/sample.json');

const MINIO_IMAGE = 'quay.io/minio/minio:RELEASE.2025-09-07T16-13-09Z@sha256:14cea493d9a34af32f524e538b8346cf79f3321eff8e708c1e2960462bd8936e';
const username = 'integration-user';
const password = 'integration-password';

let container;
let s3;
let storage;
let server;
let baseUrl;
let bucket;

function listen(app) {
    return new Promise((resolve) => {
        const running = app.listen(0, '127.0.0.1', () => resolve(running));
    });
}

function close(running) {
    return new Promise((resolve, reject) => {
        running.close((error) => error ? reject(error) : resolve());
    });
}

before(async () => {
    container = await new MinioContainer(MINIO_IMAGE)
        .withUsername(username)
        .withPassword(password)
        .withStartupTimeout(120_000)
        .start();

    s3 = new S3Client({
        endpoint: `http://${container.getHost()}:${container.getPort()}`,
        region: 'us-east-1',
        forcePathStyle: true,
        credentials: {
            accessKeyId: username,
            secretAccessKey: password,
        },
    });
    bucket = `api-blob-${process.pid}-${Date.now()}`;
    await s3.send(new CreateBucketCommand({ Bucket: bucket }));
    storage = createS3Storage({ client: s3, bucket, prefix: 'things' });

    const resource = createJsonResource({ storage });
    const app = express();
    app.use(express.json({ type: ['application/json', 'application/*+json'] }));
    app.post('/thing', resource.write);
    app.get('/thing/:id', resource.read);
    app.use((error, _req, res, _next) => {
        res.status(error.statusCode || 500).json({ message: error.message });
    });
    server = await listen(app);
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    if (server) await close(server);
    if (s3) s3.destroy();
    if (container) await container.stop({ timeout: 10_000 });
});

test('API write produces the exact JSON object in MinIO', async () => {
    const response = await fetch(`${baseUrl}/thing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sample),
    });

    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), sample);

    const raw = await s3.send(new GetObjectCommand({
        Bucket: bucket,
        Key: 'things/42.json',
    }));
    assert.equal(raw.ContentType, 'application/json');
    assert.deepEqual(JSON.parse(await raw.Body.transformToString()), sample);
});

test('API read returns an object seeded independently through S3', async () => {
    const seeded = { ...sample, id: 84, description: 'seeded directly in MinIO' };
    await s3.send(new PutObjectCommand({
        Bucket: bucket,
        Key: 'things/84.json',
        Body: JSON.stringify(seeded),
        ContentType: 'application/json',
    }));

    const response = await fetch(`${baseUrl}/thing/84`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), seeded);
});

test('API read maps a missing MinIO object to 404', async () => {
    const response = await fetch(`${baseUrl}/thing/999`);
    assert.equal(response.status, 404);
    assert.equal((await response.json()).error, 'NOT_FOUND');
});
