'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
    PayloadValidationError,
    assertMatchesDefinition,
    thingDefinition,
    validateAgainstDefinition,
} = require('../..');
const sample = require('../../dapr-app/sample.json');

test('sample.json is the exported, immutable data definition', () => {
    assert.deepEqual(thingDefinition, sample);
    assert.equal(Object.isFrozen(thingDefinition), true);
    assert.doesNotThrow(() => assertMatchesDefinition(structuredClone(sample)));
});

test('the definition requires every sample field and preserves false values', () => {
    const valid = validateAgainstDefinition({
        id: 7,
        description: 'false is data, not a missing value',
        unique: false,
    });
    assert.deepEqual(valid, { valid: true, issues: [] });

    const missing = validateAgainstDefinition({ id: 7, unique: false });
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
        }),
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
