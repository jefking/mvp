'use strict';

class PayloadValidationError extends Error {
    constructor(issues) {
        super('Payload does not match the configured data definition.');
        this.name = 'PayloadValidationError';
        this.code = 'INVALID_PAYLOAD';
        this.statusCode = 400;
        this.issues = issues;
    }
}

class StoredDataError extends Error {
    constructor(key, cause) {
        super(`Object ${key} does not contain valid resource data.`, { cause });
        this.name = 'StoredDataError';
        this.code = 'INVALID_STORED_DATA';
        this.statusCode = 500;
        this.key = key;
    }
}

module.exports = {
    PayloadValidationError,
    StoredDataError,
};
