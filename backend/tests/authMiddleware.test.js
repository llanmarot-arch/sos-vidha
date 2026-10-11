const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { isStrictHttpAuthRequired } = require('../lib/authMiddleware');

describe('isStrictHttpAuthRequired', () => {
  it('is true when NODE_ENV is production', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    assert.equal(isStrictHttpAuthRequired(), true);
    process.env.NODE_ENV = prev;
  });
});
