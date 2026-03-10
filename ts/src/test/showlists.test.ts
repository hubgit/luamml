import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseList } from '../showlists.js';
import type { ParsedLog } from '../types.js';

const emptyParsed: ParsedLog = { groups: [], marks: {}, instructions: [], count: {}, mathml: {} };

describe('showlists parser', () => {
  it('should parse a simple mathord with fam0 x', () => {
    const lines = ['\\mathord', '.\\fam0 x'];
    const [head] = parseList(lines, 0, '', emptyParsed);
    assert.ok(head);
    assert.equal(head.id, 'noad');
    assert.equal(head.subtype, 0);
    assert.ok(head.nucleus);
    assert.equal(head.nucleus!.id, 'math_char');
    assert.equal(head.nucleus!.fam, 0);
    assert.equal(head.nucleus!.char, 0x78); // 'x'
  });

  it('should parse a mathrel =', () => {
    const lines = ['\\mathrel', '.\\fam0 ='];
    const [head] = parseList(lines, 0, '', emptyParsed);
    assert.ok(head);
    assert.equal(head.id, 'noad');
    assert.equal(head.subtype, 5); // rel
    assert.ok(head.nucleus);
    assert.equal(head.nucleus!.char, 0x3D);
  });

  it('should parse a node with superscript', () => {
    const lines = ['\\mathord', '.\\fam0 x', '^\\fam0 2'];
    const [head] = parseList(lines, 0, '', emptyParsed);
    assert.ok(head);
    assert.ok(head.sup);
    assert.equal(head.sup!.id, 'math_char');
    assert.equal(head.sup!.char, 0x32); // '2'
  });

  it('should parse a linked list of two noads', () => {
    const lines = [
      '\\mathord', '.\\fam0 x',
      '\\mathrel', '.\\fam0 =',
    ];
    const [head] = parseList(lines, 0, '', emptyParsed);
    assert.ok(head);
    assert.ok(head.next);
    assert.equal(head.next.id, 'noad');
    assert.equal(head.next.subtype, 5);
  });

  it('should parse a fraction', () => {
    const lines = [
      '\\fraction, thickness = default',
      '\\.\\fam0 a',
      '/.\\fam0 b',
    ];
    const [head] = parseList(lines, 0, '', emptyParsed);
    assert.ok(head);
    assert.equal(head.id, 'fraction');
    assert.ok(head.num);
    assert.ok(head.denom);
  });

  it('should parse a radical', () => {
    const lines = [
      '\\radical"000000',
      '.\\fam0 x',
    ];
    const [head] = parseList(lines, 0, '', emptyParsed);
    assert.ok(head);
    assert.equal(head.id, 'radical');
    assert.ok(head.nucleus);
  });

  it('should parse a fence (left paren)', () => {
    const lines = ['\\left"028300'];
    const [head] = parseList(lines, 0, '', emptyParsed);
    assert.ok(head);
    assert.equal(head.id, 'fence');
    assert.equal(head.subtype, 1);
    assert.ok(head.delim);
  });

  it('should parse style changes', () => {
    const lines = ['\\displaystyle'];
    const [head] = parseList(lines, 0, '', emptyParsed);
    assert.ok(head);
    assert.equal(head.id, 'style');
    assert.equal(head.subtype, 0);
  });
});
