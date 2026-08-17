'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
    PayloadValidationError,
    assertMatchesDefinition,
    validateAgainstDefinition,
} = require('../..');
const sample = require('../fixtures/thing.json');

test('the definition requires every sample field and preserves false values', () => {
    const valid = validateAgainstDefinition({
        id: 7,
        description: 'false is data, not a missing value',
        unique: false,
    }, sample);
    assert.deepEqual(valid, { valid: true, issues: [] });

    const missing = validateAgainstDefinition({ id: 7, unique: false }, sample);
    assert.equal(missing.valid, false);
    assert.deepEqual(missing.issues, [
        { path: '$.description', expected: 'string', actual: 'missing' },
    ]);
});

test('the definition rejects wrong types, unsafe integer IDs, and extra fields', () => {
    assert.throws(
        () => assertMatchesDefinition({
            ...sample,
            id: Number.MAX_SAFE_INTEGER + 1,
            unique: 'false',
            extra: true,
        }, sample),
        (error) => {
            assert.ok(error instanceof PayloadValidationError);
            assert.deepEqual(error.issues.map(({ path }) => path), [
                '$.id',
                '$.unique',
                '$.extra',
            ]);
            return true;
        },
    );
});
