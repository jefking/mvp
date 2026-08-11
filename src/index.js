'use strict';

const {
    assertMatchesDefinition,
    thingDefinition,
    validateAgainstDefinition,
} = require('./definition');
const {
    PayloadValidationError,
    StoredDataError,
} = require('./errors');
const {
    createJsonResource,
    extractRequestPayload,
    isStructuredCloudEventRequest,
    keyFromId,
} = require('./json-resource');
const { createMemoryStorage } = require('./storage/memory');
const {
    createS3Storage,
    createS3StorageFromEnv,
} = require('./storage/s3');

module.exports = {
    PayloadValidationError,
    StoredDataError,
    assertMatchesDefinition,
    createBlobMiddleware: createJsonResource,
    createJsonResource,
    createMemoryStorage,
    createS3Storage,
    createS3StorageFromEnv,
    extractRequestPayload,
    isStructuredCloudEventRequest,
    keyFromId,
    thingDefinition,
    validateAgainstDefinition,
};
