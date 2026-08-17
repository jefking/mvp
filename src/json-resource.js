'use strict';

const {
    assertMatchesDefinition,
    cloneJson,
} = require('./definition');
const {
    PayloadValidationError,
    StoredDataError,
} = require('./errors');

const JSON_CONTENT_TYPE = 'application/json';

function defaultKeyOf(value) {
    return value.id;
}

function keyFromId(id) {
    if (!['string', 'number', 'bigint'].includes(typeof id) || String(id).length === 0) {
        throw new PayloadValidationError([{
            path: '$.id',
            expected: 'non-empty string, number, or bigint',
            actual: id == null ? String(id) : typeof id,
        }]);
    }
    return `${encodeURIComponent(String(id))}.json`;
}

function sendValidationError(res, error) {
    return res.status(error.statusCode).json({
        error: error.code,
        message: error.message,
        issues: error.issues,
    });
}

function createJsonResource({
    storage,
    definition,
    keyOf = defaultKeyOf,
    allowAdditionalProperties = false,
} = {}) {
    if (!storage || typeof storage.put !== 'function' || typeof storage.get !== 'function') {
        throw new TypeError('storage must provide async put(key, bytes, options) and get(key) functions.');
    }
    if (typeof keyOf !== 'function') {
        throw new TypeError('keyOf must be a function.');
    }

    const validationOptions = { allowAdditionalProperties };

    async function put(value) {
        assertMatchesDefinition(value, definition, validationOptions);
        const copy = cloneJson(value);
        const key = keyFromId(keyOf(copy));
        await storage.put(key, Buffer.from(JSON.stringify(copy)), {
            contentType: JSON_CONTENT_TYPE,
        });
        return { key, value: copy };
    }

    async function get(id) {
        const key = keyFromId(id);
        const object = await storage.get(key);
        if (!object) return null;

        let value;
        try {
            value = JSON.parse(Buffer.from(object.bytes).toString('utf8'));
            assertMatchesDefinition(value, definition, validationOptions);
            if (String(keyOf(value)) !== String(id)) {
                throw new Error('Stored resource ID does not match its object key.');
            }
        } catch (error) {
            throw new StoredDataError(object.key || key, error);
        }
        return { key, value };
    }

    async function write(req, res, next) {
        try {
            const result = await put(req.body);
            return res.status(201).json(result.value);
        } catch (error) {
            if (error instanceof PayloadValidationError) {
                return sendValidationError(res, error);
            }
            if (typeof next === 'function') return next(error);
            throw error;
        }
    }

    async function read(req, res, next) {
        try {
            const id = req.params?.id;
            const result = await get(id);
            if (!result) {
                return res.status(404).json({
                    error: 'NOT_FOUND',
                    message: `No object exists for id ${id}.`,
                });
            }
            return res.status(200).json(result.value);
        } catch (error) {
            if (error instanceof PayloadValidationError) {
                return sendValidationError(res, error);
            }
            if (typeof next === 'function') return next(error);
            throw error;
        }
    }

    return {
        definition,
        get,
        put,
        read,
        write,
    };
}

module.exports = {
    createJsonResource,
    keyFromId,
};
