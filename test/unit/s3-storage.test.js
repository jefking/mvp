'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
    createS3Storage,
    createS3StorageFromEnv,
} = require('../..');
const { s3ClientConfigFromEnv } = require('../../src/storage/s3');

test('S3 storage writes bytes with the resolved prefix and content type', async () => {
    const commands = [];
    const client = {
        async send(command) {
            commands.push(command);
            return { ETag: 'etag-1', VersionId: 'version-1' };
        },
    };
    const storage = createS3Storage({
        client,
        bucket: 'things-bucket',
        prefix: '/things/',
    });
    const bytes = Buffer.from('{"id":42}');

    const result = await storage.put('42.json', bytes, { contentType: 'application/json' });

    assert.deepEqual(result, {
        key: 'things/42.json',
        etag: 'etag-1',
        versionId: 'version-1',
    });
    assert.equal(commands[0].constructor.name, 'PutObjectCommand');
    assert.deepEqual(commands[0].input, {
        Bucket: 'things-bucket',
        Key: 'things/42.json',
        Body: bytes,
        ContentType: 'application/json',
    });
});

test('S3 storage consumes response bodies and maps missing keys to null', async () => {
    let missing = false;
    const client = {
        async send(command) {
            if (missing) {
                const error = new Error('missing');
                error.name = 'NoSuchKey';
                throw error;
            }
            assert.equal(command.constructor.name, 'GetObjectCommand');
            return {
                Body: {
                    transformToByteArray: async () => Uint8Array.from(Buffer.from('{"id":42}')),
                },
                ContentType: 'application/json',
                ETag: 'etag-1',
            };
        },
    };
    const storage = createS3Storage({ client, bucket: 'things-bucket' });

    const object = await storage.get('42.json');
    assert.equal(Buffer.from(object.bytes).toString('utf8'), '{"id":42}');
    assert.equal(object.contentType, 'application/json');

    missing = true;
    assert.equal(await storage.get('missing.json'), null);
});

test('environment configuration requires a bucket and applies its prefix', () => {
    const client = { send: async () => ({}) };
    assert.throws(
        () => createS3StorageFromEnv({ env: {}, client }),
        /S3_BUCKET must be a non-empty string/,
    );

    const storage = createS3StorageFromEnv({
        client,
        env: {
            S3_BUCKET: 'things-bucket',
            S3_PREFIX: 'records',
        },
    });
    assert.equal(storage.resolveKey('42.json'), 'records/42.json');
});

test('environment configuration preserves temporary AWS session credentials', () => {
    const config = s3ClientConfigFromEnv({
        S3_ENDPOINT: 'http://127.0.0.1:9000',
        AWS_ACCESS_KEY_ID: 'temporary-key',
        AWS_SECRET_ACCESS_KEY: 'temporary-secret',
        AWS_SESSION_TOKEN: 'temporary-token',
    });

    assert.deepEqual(config, {
        region: 'us-east-1',
        forcePathStyle: true,
        endpoint: 'http://127.0.0.1:9000',
        credentials: {
            accessKeyId: 'temporary-key',
            secretAccessKey: 'temporary-secret',
            sessionToken: 'temporary-token',
        },
    });
});

test('S3 credential overrides never mix with ambient AWS session credentials', () => {
    const config = s3ClientConfigFromEnv({
        S3_ACCESS_KEY_ID: 'minio-key',
        S3_SECRET_ACCESS_KEY: 'minio-secret',
        AWS_ACCESS_KEY_ID: 'temporary-aws-key',
        AWS_SECRET_ACCESS_KEY: 'temporary-aws-secret',
        AWS_SESSION_TOKEN: 'unrelated-aws-token',
    });

    assert.deepEqual(config.credentials, {
        accessKeyId: 'minio-key',
        secretAccessKey: 'minio-secret',
    });
});
