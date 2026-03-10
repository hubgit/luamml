import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { writeXml } from '../xmlwriter.js';
import { elem } from '../types.js';

describe('writeXml', () => {
  it('should serialize a simple mi element', () => {
    const el = elem('mi', ['x']);
    assert.equal(writeXml(el), '<mi>x</mi>');
  });

  it('should serialize a self-closing element', () => {
    const el = elem('mspace', [], { width: '0.5em' });
    assert.equal(writeXml(el), '<mspace width="0.5em"/>');
  });

  it('should escape special characters in text', () => {
    const el = elem('mi', ['<x&y>']);
    assert.equal(writeXml(el), '<mi>&lt;x&amp;y&gt;</mi>');
  });

  it('should sort attributes alphabetically', () => {
    const el = elem('mo', ['+'], { rspace: '0.222em', lspace: '0.222em' });
    assert.equal(writeXml(el), '<mo lspace="0.222em" rspace="0.222em">+</mo>');
  });

  it('should handle nested elements', () => {
    const inner = elem('mi', ['a']);
    const outer = elem('msup', [inner, elem('mn', ['2'])]);
    assert.equal(writeXml(outer), '<msup><mi>a</mi><mn>2</mn></msup>');
  });

  it('should handle indentation', () => {
    const inner = elem('mi', ['x']);
    const outer = elem('mrow', [inner]);
    const result = writeXml(outer, true);
    assert.ok(result.includes('\n'));
    assert.ok(result.includes('<mi>x</mi>'));
  });

  it('should skip undefined attributes', () => {
    const el = elem('mi', ['x'], { mathvariant: undefined, foo: 'bar' });
    assert.equal(writeXml(el), '<mi foo="bar">x</mi>');
  });

  it('should skip colon-prefixed attributes (internal metadata)', () => {
    const el = elem('mi', ['x']);
    // attrs with ':' should be internal metadata only in Lua; in our TS model
    // they'd be in meta, but if someone puts them in attrs, they should be skipped
    el.attrs[':internal'] = 'test';
    assert.equal(writeXml(el), '<mi>x</mi>');
  });

  it('should prepend XML 1.1 declaration when version is 11', () => {
    const el = elem('mi', ['x']);
    const result = writeXml(el, false, '11');
    assert.ok(result.startsWith('<?xml version="1.1"?>'));
  });

  it('should serialize a complete math element', () => {
    const mathEl = elem('math', [
      elem('mi', ['x']),
      elem('mo', ['='], { lspace: '0.278em', rspace: '0.278em' }),
      elem('mn', ['1']),
    ], {
      xmlns: 'http://www.w3.org/1998/Math/MathML',
      display: 'block',
    });
    const result = writeXml(mathEl);
    // xmlns should be skipped by our writer (matching Lua behavior)
    assert.ok(result.includes('<math'));
    assert.ok(result.includes('display="block"'));
    assert.ok(result.includes('<mi>x</mi>'));
    assert.ok(result.includes('<mo'));
    assert.ok(result.includes('<mn>1</mn>'));
  });
});
