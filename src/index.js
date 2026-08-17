'use strict';

const {
    assertMatchesDefinition,
    validateAgainstDefinition,
} = require('./definition');
const {
    PayloadValidationError,
    StoredDataError,
} = require('./errors');
const {
    createJsonResource,
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
    keyFromId,
    validateAgainstDefinition,
};
