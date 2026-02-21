import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TAG_PRIORITY, tagPrioritySQL } from './tagPriority.js';

describe('TAG_PRIORITY', () => {
  it('assigns ascending priority values to tags', () => {
    assert.equal(TAG_PRIORITY.love, 1);
    assert.equal(TAG_PRIORITY.like, 2);
    assert.equal(TAG_PRIORITY.meh, 3);
    assert.equal(TAG_PRIORITY.tax_deduction, 4);
  });

  it('love has highest priority (lowest number)', () => {
    const sorted = Object.entries(TAG_PRIORITY).sort((a, b) => a[1] - b[1]);
    assert.equal(sorted[0][0], 'love');
  });
});

describe('tagPrioritySQL', () => {
  it('generates a CASE expression with default column', () => {
    const sql = tagPrioritySQL();
    assert.ok(sql.includes("CASE tag WHEN 'love' THEN 1"));
    assert.ok(sql.includes("WHEN 'tax_deduction' THEN 4 END"));
  });

  it('accepts a custom column name', () => {
    const sql = tagPrioritySQL('p2.tag');
    assert.ok(sql.includes("CASE p2.tag WHEN 'love' THEN 1"));
  });
});
