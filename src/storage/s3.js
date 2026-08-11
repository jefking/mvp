'use strict';

const {
    GetObjectCommand,
    PutObjectCommand,
    S3Client,
} = require('@aws-sdk/client-s3');

function requireText(value, name) {
    if (typeof value !== 'string' || value.trim() === '') {
        throw new TypeError(`${name} must be a non-empty string.`);
    }
    return value;
}

function normalizePrefix(prefix) {
    if (!prefix) return '';
    const normalized = String(prefix).replace(/^\/+|\/+$/g, '');
    return normalized ? `${normalized}/` : '';
}

function isNotFound(error) {
    return error?.name === 'NoSuchKey'
        || error?.name === 'NotFound'
        || error?.$metadata?.httpStatusCode === 404;
}

async function bodyToBytes(body) {
    if (body == null) {
        throw new TypeError('S3 returned an object without a body.');
    }
    if (typeof body === 'string') return Buffer.from(body);
    if (body instanceof Uint8Array) return Buffer.from(body);
    if (typeof body.transformToByteArray === 'function') {
        return Buffer.from(await body.transformToByteArray());
    }
    if (body[Symbol.asyncIterator]) {
        const chunks = [];
        for await (const chunk of body) {
            chunks.push(Buffer.from(chunk));
        }
        return Buffer.concat(chunks);
    }
    throw new TypeError('Unsupported S3 response body type.');
}

function createS3Storage({ client, clientConfig, bucket, prefix = '' } = {}) {
    requireText(bucket, 'bucket');
    if (client && clientConfig) {
        throw new TypeError('Pass either client or clientConfig, not both.');
    }

    const ownsClient = !client;
    const s3 = client || new S3Client(clientConfig || {});
    if (typeof s3.send !== 'function') {
        throw new TypeError('client must provide a send(command) function.');
    }
    const keyPrefix = normalizePrefix(prefix);

    function resolveKey(key) {
        return `${keyPrefix}${requireText(String(key), 'key')}`;
    }

    return {
        bucket,
        prefix: keyPrefix,
        resolveKey,

        async put(key, bytes, { contentType = 'application/octet-stream' } = {}) {
            const resolvedKey = resolveKey(key);
            const response = await s3.send(new PutObjectCommand({
                Bucket: bucket,
                Key: resolvedKey,
                Body: bytes,
                ContentType: contentType,
            }));
            return {
                key: resolvedKey,
                etag: response.ETag,
                versionId: response.VersionId,
            };
        },

        async get(key) {
            const resolvedKey = resolveKey(key);
            let response;
            try {
                response = await s3.send(new GetObjectCommand({
                    Bucket: bucket,
                    Key: resolvedKey,
                }));
            } catch (error) {
                if (isNotFound(error)) return null;
                throw error;
            }

            return {
                key: resolvedKey,
                bytes: await bodyToBytes(response.Body),
                contentType: response.ContentType,
                etag: response.ETag,
                versionId: response.VersionId,
            };
        },

        destroy() {
            if (ownsClient && typeof s3.destroy === 'function') {
                s3.destroy();
            }
        },
    };
}

function parseBoolean(value, fallback) {
    if (value == null || value === '') return fallback;
    if (typeof value === 'boolean') return value;
    const normalized = String(value).toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
    throw new TypeError(`Invalid boolean value: ${value}`);
}

function s3ClientConfigFromEnv(env = process.env) {
    const endpoint = env.S3_ENDPOINT || undefined;
    const hasS3CredentialOverride = [
        env.S3_ACCESS_KEY_ID,
        env.S3_SECRET_ACCESS_KEY,
        env.S3_SESSION_TOKEN,
    ].some((value) => value != null && value !== '');
    const accessKeyId = hasS3CredentialOverride
        ? env.S3_ACCESS_KEY_ID
        : env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = hasS3CredentialOverride
        ? env.S3_SECRET_ACCESS_KEY
        : env.AWS_SECRET_ACCESS_KEY;
    const sessionToken = hasS3CredentialOverride
        ? env.S3_SESSION_TOKEN
        : env.AWS_SESSION_TOKEN;

    if ((accessKeyId && !secretAccessKey) || (!accessKeyId && secretAccessKey)) {
        throw new TypeError('S3 access key ID and secret access key must be provided together.');
    }
    if (sessionToken && (!accessKeyId || !secretAccessKey)) {
        throw new TypeError('An S3 session token requires an access key ID and secret access key.');
    }

    const clientConfig = {
        region: env.S3_REGION || env.AWS_REGION || 'us-east-1',
        forcePathStyle: parseBoolean(env.S3_FORCE_PATH_STYLE, Boolean(endpoint)),
    };
    if (endpoint) clientConfig.endpoint = endpoint;
    if (accessKeyId) {
        clientConfig.credentials = {
            accessKeyId,
            secretAccessKey,
            ...(sessionToken ? { sessionToken } : {}),
        };
    }
    return clientConfig;
}

function createS3StorageFromEnv({ env = process.env, client } = {}) {
    const bucket = requireText(env.S3_BUCKET, 'S3_BUCKET');

    return createS3Storage({
        bucket,
        prefix: env.S3_PREFIX || 'things',
        ...(client ? { client } : { clientConfig: s3ClientConfigFromEnv(env) }),
    });
}

module.exports = {
    bodyToBytes,
    createS3Storage,
    createS3StorageFromEnv,
    s3ClientConfigFromEnv,
};
