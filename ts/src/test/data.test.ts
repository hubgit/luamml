import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { combiningMap } from '../data-combining.js';
import { stretchySet } from '../data-stretchy.js';
import { mappings, remap_oml, remap_oms, remap_omx } from '../legacy-mappings.js';

describe('data-combining', () => {
  it('should map combining circumflex to modifier circumflex', () => {
    assert.equal(combiningMap['\u0302'], '\u02C6');
  });

  it('should map combining overline to minus', () => {
    assert.equal(combiningMap['\u0305'], '\u2212');
  });

  it('should map combining right arrow above to right arrow', () => {
    assert.equal(combiningMap['\u20D7'], '\u2192');
  });

  it('should have 25 entries', () => {
    assert.equal(Object.keys(combiningMap).length, 25);
  });
});

describe('data-stretchy', () => {
  it('should include parentheses', () => {
    assert.ok(stretchySet.has('('));
    assert.ok(stretchySet.has(')'));
  });

  it('should include brackets', () => {
    assert.ok(stretchySet.has('['));
    assert.ok(stretchySet.has(']'));
  });

  it('should include braces', () => {
    assert.ok(stretchySet.has('{'));
    assert.ok(stretchySet.has('}'));
  });

  it('should include arrows', () => {
    assert.ok(stretchySet.has('\u2190')); // leftarrow
    assert.ok(stretchySet.has('\u2192')); // rightarrow
    assert.ok(stretchySet.has('\u21D2')); // Rightarrow
  });

  it('should not include regular letters', () => {
    assert.ok(!stretchySet.has('a'));
    assert.ok(!stretchySet.has('x'));
    assert.ok(!stretchySet.has('+'));
  });

  it('should have a large number of entries', () => {
    assert.ok(stretchySet.size > 400);
  });
});

describe('legacy-mappings', () => {
  it('should have oml, oms, omx mappings', () => {
    assert.ok(mappings.oml);
    assert.ok(mappings.oms);
    assert.ok(mappings.omx);
  });

  it('oml should map first entry to italic Gamma', () => {
    assert.equal(remap_oml[0], 0x1D6E4);
  });

  it('oms should map first entry to minus sign', () => {
    assert.equal(remap_oms[0], 0x2212);
  });

  it('omx should have some null entries', () => {
    assert.equal(remap_omx[0], null);
  });

  it('omx should map integral', () => {
    assert.equal(remap_omx[0x52], 0x222B); // integral
  });
});
