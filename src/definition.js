'use strict';

const { PayloadValidationError } = require('./errors');
const sample = require('../dapr-app/sample.json');

function cloneJson(value) {
    return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
        Object.freeze(value);
        for (const child of Object.values(value)) {
            deepFreeze(child);
        }
    }
    return value;
}

function actualType(value) {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
}

function expectedType(example) {
    if (example === null) return 'null';
    if (Array.isArray(example)) return 'array';
    if (typeof example === 'number' && Number.isInteger(example)) return 'safe integer';
    return typeof example;
}

function validateNode(value, example, path, issues, allowAdditionalProperties) {
    if (example === null) {
        if (value !== null) {
            issues.push({ path, expected: 'null', actual: actualType(value) });
        }
        return;
    }

    if (Array.isArray(example)) {
        if (!Array.isArray(value)) {
            issues.push({ path, expected: 'array', actual: actualType(value) });
            return;
        }

        if (example.length > 0) {
            value.forEach((item, index) => {
                validateNode(item, example[0], `${path}[${index}]`, issues, allowAdditionalProperties);
            });
        }
        return;
    }

    if (typeof example === 'object') {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            issues.push({ path, expected: 'object', actual: actualType(value) });
            return;
        }

        for (const key of Object.keys(example)) {
            if (!Object.hasOwn(value, key)) {
                issues.push({ path: `${path}.${key}`, expected: expectedType(example[key]), actual: 'missing' });
                continue;
            }
            validateNode(value[key], example[key], `${path}.${key}`, issues, allowAdditionalProperties);
        }

        if (!allowAdditionalProperties) {
            for (const key of Object.keys(value)) {
                if (!Object.hasOwn(example, key)) {
                    issues.push({ path: `${path}.${key}`, expected: 'absent', actual: actualType(value[key]) });
                }
            }
        }
        return;
    }

    if (typeof example === 'number') {
        const valid = Number.isInteger(example)
            ? Number.isSafeInteger(value)
            : typeof value === 'number' && Number.isFinite(value);
        if (!valid) {
            issues.push({ path, expected: expectedType(example), actual: actualType(value) });
        }
        return;
    }

    if (typeof value !== typeof example) {
        issues.push({ path, expected: expectedType(example), actual: actualType(value) });
    }
}

function validateAgainstDefinition(value, definition, { allowAdditionalProperties = false } = {}) {
    const issues = [];
    validateNode(value, definition, '$', issues, allowAdditionalProperties);
    return {
        valid: issues.length === 0,
        issues,
    };
}

function assertMatchesDefinition(value, definition, options) {
    const result = validateAgainstDefinition(value, definition, options);
    if (!result.valid) {
        throw new PayloadValidationError(result.issues);
    }
    return value;
}

module.exports = {
    assertMatchesDefinition,
    cloneJson,
    validateAgainstDefinition,
};
