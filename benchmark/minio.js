'use strict';

const { performance } = require('node:perf_hooks');
const {
    CreateBucketCommand,
    GetObjectCommand,
    HeadBucketCommand,
    PutObjectCommand,
    S3Client,
} = require('@aws-sdk/client-s3');
const { createS3Storage } = require('..');

// This benchmark only runs in the local dev container. Keeping these values
// here is intentional: there is no production configuration or secret input.
const MINIO = Object.freeze({
    endpoint: 'http://minio:9000',
    region: 'us-east-1',
    bucket: 'api-blob-load-test',
    accessKeyId: 'minio-load-test',
    secretAccessKey: 'minio-load-test-secret',
});

const DEFAULTS = Object.freeze({
    operations: 1_000,
    concurrency: 16,
    payloadBytes: 1_024,
    warmupOperations: 50,
    rounds: 2,
});

function positiveInteger(value, name) {
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
        throw new TypeError(`${name} must be a positive integer.`);
    }
    return parsed;
}

function parseArguments(argv) {
    const values = { ...DEFAULTS };
    const names = {
        '--operations': 'operations',
        '--concurrency': 'concurrency',
        '--payload-bytes': 'payloadBytes',
        '--warmup-operations': 'warmupOperations',
        '--rounds': 'rounds',
    };

    for (let index = 0; index < argv.length; index += 1) {
        const argument = argv[index];
        const [flag, inlineValue] = argument.split('=', 2);
        const name = names[flag];
        if (!name) {
            throw new TypeError(`Unknown argument: ${argument}`);
        }

        const value = inlineValue ?? argv[++index];
        if (value == null) {
            throw new TypeError(`${flag} requires a value.`);
        }
        values[name] = positiveInteger(value, flag);
    }

    values.concurrency = Math.min(values.concurrency, values.operations);
    values.warmupOperations = Math.min(values.warmupOperations, values.operations);
    return values;
}

function createClient() {
    return new S3Client({
        endpoint: MINIO.endpoint,
        region: MINIO.region,
        forcePathStyle: true,
        credentials: {
            accessKeyId: MINIO.accessKeyId,
            secretAccessKey: MINIO.secretAccessKey,
        },
    });
}

function wait(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isMissingBucket(error) {
    return error?.name === 'NotFound'
        || error?.name === 'NoSuchBucket'
        || error?.$metadata?.httpStatusCode === 404;
}

async function ensureBucket(client, timeoutMilliseconds = 30_000) {
    const deadline = Date.now() + timeoutMilliseconds;
    let lastError;

    while (Date.now() < deadline) {
        try {
            await client.send(new HeadBucketCommand({ Bucket: MINIO.bucket }));
            return;
        } catch (error) {
            lastError = error;
            if (isMissingBucket(error)) {
                try {
                    await client.send(new CreateBucketCommand({ Bucket: MINIO.bucket }));
                    return;
                } catch (createError) {
                    if (['BucketAlreadyExists', 'BucketAlreadyOwnedByYou'].includes(createError?.name)) {
                        return;
                    }
                    lastError = createError;
                }
            }
        }
        await wait(500);
    }

    throw new Error(
        `MinIO did not become ready at ${MINIO.endpoint} within ${timeoutMilliseconds}ms.`,
        { cause: lastError },
    );
}

async function drainBody(body) {
    if (typeof body?.transformToByteArray === 'function') {
        return Buffer.from(await body.transformToByteArray());
    }

    const chunks = [];
    for await (const chunk of body) {
        chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
}

function percentile(sortedValues, fraction) {
    const index = Math.min(
        sortedValues.length - 1,
        Math.ceil(sortedValues.length * fraction) - 1,
    );
    return sortedValues[index];
}

async function measure({ name, operations, concurrency, payloadBytes, operation }) {
    const latencies = new Array(operations);
    let nextOperation = 0;
    const started = performance.now();

    async function worker() {
        while (nextOperation < operations) {
            const operationIndex = nextOperation;
            nextOperation += 1;
            const operationStarted = performance.now();
            await operation(operationIndex);
            latencies[operationIndex] = performance.now() - operationStarted;
        }
    }

    await Promise.all(Array.from({ length: concurrency }, worker));
    const elapsedMilliseconds = performance.now() - started;
    latencies.sort((left, right) => left - right);

    return {
        name,
        operations,
        elapsedMilliseconds,
        operationsPerSecond: operations / (elapsedMilliseconds / 1_000),
        mebibytesPerSecond: ((operations * payloadBytes) / (1024 * 1024))
            / (elapsedMilliseconds / 1_000),
        p50Milliseconds: percentile(latencies, 0.50),
        p95Milliseconds: percentile(latencies, 0.95),
        p99Milliseconds: percentile(latencies, 0.99),
        latencies,
    };
}

function combineMeasurements(name, measurements, payloadBytes) {
    const operations = measurements.reduce((total, measurement) => total + measurement.operations, 0);
    const elapsedMilliseconds = measurements.reduce(
        (total, measurement) => total + measurement.elapsedMilliseconds,
        0,
    );
    const latencies = measurements.flatMap((measurement) => measurement.latencies)
        .sort((left, right) => left - right);

    return {
        name,
        operations,
        elapsedMilliseconds,
        operationsPerSecond: operations / (elapsedMilliseconds / 1_000),
        mebibytesPerSecond: ((operations * payloadBytes) / (1024 * 1024))
            / (elapsedMilliseconds / 1_000),
        p50Milliseconds: percentile(latencies, 0.50),
        p95Milliseconds: percentile(latencies, 0.95),
        p99Milliseconds: percentile(latencies, 0.99),
    };
}

async function warmup(operations, concurrency, operation) {
    let nextOperation = 0;

    async function worker() {
        while (nextOperation < operations) {
            const operationIndex = nextOperation;
            nextOperation += 1;
            await operation(operationIndex);
        }
    }

    await Promise.all(Array.from({ length: Math.min(concurrency, operations) }, worker));
}

function printResults(results) {
    const heading = [
        'scenario'.padEnd(18),
        'ops/sec'.padStart(12),
        'MiB/sec'.padStart(10),
        'p50 ms'.padStart(10),
        'p95 ms'.padStart(10),
        'p99 ms'.padStart(10),
    ].join(' ');

    console.log('\n' + heading);
    console.log('-'.repeat(heading.length));
    for (const result of results) {
        console.log([
            result.name.padEnd(18),
            result.operationsPerSecond.toFixed(1).padStart(12),
            result.mebibytesPerSecond.toFixed(2).padStart(10),
            result.p50Milliseconds.toFixed(2).padStart(10),
            result.p95Milliseconds.toFixed(2).padStart(10),
            result.p99Milliseconds.toFixed(2).padStart(10),
        ].join(' '));
    }

    const directWrite = results.find(({ name }) => name === 'direct PUT');
    const packageWrite = results.find(({ name }) => name === 'package put');
    const directRead = results.find(({ name }) => name === 'direct GET');
    const packageRead = results.find(({ name }) => name === 'package get');
    console.log('\nPackage/direct throughput ratio:');
    console.log(`  writes: ${(packageWrite.operationsPerSecond / directWrite.operationsPerSecond).toFixed(3)}x`);
    console.log(`  reads:  ${(packageRead.operationsPerSecond / directRead.operationsPerSecond).toFixed(3)}x`);
}

async function main() {
    const options = parseArguments(process.argv.slice(2));
    const client = createClient();
    const runId = `${Date.now()}-${process.pid}`;
    const payload = Buffer.alloc(options.payloadBytes, 0x61);
    const contentType = 'application/octet-stream';
    const directPrefix = `direct/${runId}`;
    const packagePrefix = `package/${runId}`;
    const warmupPrefix = `warmup/${runId}`;
    const storage = createS3Storage({
        client,
        bucket: MINIO.bucket,
        prefix: packagePrefix,
    });
    const warmupStorage = createS3Storage({
        client,
        bucket: MINIO.bucket,
        prefix: `${warmupPrefix}/package`,
    });

    const directPut = (index) => client.send(new PutObjectCommand({
        Bucket: MINIO.bucket,
        Key: `${directPrefix}/${index}`,
        Body: payload,
        ContentType: contentType,
    }));
    const packagePut = (index) => storage.put(String(index), payload, { contentType });
    const directGet = async (index) => {
        const response = await client.send(new GetObjectCommand({
            Bucket: MINIO.bucket,
            Key: `${directPrefix}/${index}`,
        }));
        const bytes = await drainBody(response.Body);
        if (bytes.length !== payload.length) throw new Error('Direct GET returned the wrong payload size.');
    };
    const packageGet = async (index) => {
        const object = await storage.get(String(index));
        if (object?.bytes.length !== payload.length) throw new Error('Package get returned the wrong payload size.');
    };

    try {
        console.log(`Waiting for MinIO at ${MINIO.endpoint} ...`);
        await ensureBucket(client);
        console.log([
            `Running ${options.rounds} rounds of ${options.operations} operations per scenario`,
            `with concurrency ${options.concurrency}`,
            `and ${options.payloadBytes} byte payloads.`,
        ].join(' '));

        const warmupDirectPut = (index) => client.send(new PutObjectCommand({
            Bucket: MINIO.bucket,
            Key: `${warmupPrefix}/direct/${index}`,
            Body: payload,
            ContentType: contentType,
        }));
        const warmupPackagePut = (index) => warmupStorage.put(String(index), payload, { contentType });
        await warmup(options.warmupOperations, options.concurrency, warmupDirectPut);
        await warmup(options.warmupOperations, options.concurrency, warmupPackagePut);

        const measurements = new Map([
            ['direct PUT', []],
            ['package put', []],
            ['direct GET', []],
            ['package get', []],
        ]);
        const putScenarios = [
            { name: 'direct PUT', operation: directPut },
            { name: 'package put', operation: packagePut },
        ];
        const getScenarios = [
            { name: 'direct GET', operation: directGet },
            { name: 'package get', operation: packageGet },
        ];

        for (let round = 0; round < options.rounds; round += 1) {
            const roundScenarios = round % 2 === 0 ? putScenarios : putScenarios.toReversed();
            for (const scenario of roundScenarios) {
                measurements.get(scenario.name).push(await measure({
                    name: scenario.name,
                    ...options,
                    operation: scenario.operation,
                }));
            }
        }

        await warmup(options.warmupOperations, options.concurrency, directGet);
        await warmup(options.warmupOperations, options.concurrency, packageGet);

        for (let round = 0; round < options.rounds; round += 1) {
            const roundScenarios = round % 2 === 0 ? getScenarios : getScenarios.toReversed();
            for (const scenario of roundScenarios) {
                measurements.get(scenario.name).push(await measure({
                    name: scenario.name,
                    ...options,
                    operation: scenario.operation,
                }));
            }
        }

        const results = Array.from(measurements, ([name, values]) => (
            combineMeasurements(name, values, options.payloadBytes)
        ));

        printResults(results);
    } finally {
        client.destroy();
    }
}

if (require.main === module) {
    main().catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });
}

module.exports = {
    DEFAULTS,
    MINIO,
    combineMeasurements,
    ensureBucket,
    measure,
    parseArguments,
};
