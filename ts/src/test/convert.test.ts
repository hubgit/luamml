import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { process, makeRoot, registerFamily } from '../convert.js';
import { writeXml } from '../xmlwriter.js';
import { elem } from '../types.js';
import type { MathNode } from '../types.js';

function mathChar(fam: number, char: number): MathNode {
  return { id: 'math_char', subtype: 0, fam, char };
}

function simpleNoad(subtype: number, nucleus: MathNode | null, opts?: Partial<MathNode>): MathNode {
  return { id: 'noad', subtype, nucleus, ...opts };
}

function link(...nodes: MathNode[]): MathNode | null {
  for (let i = 0; i < nodes.length - 1; i++) {
    nodes[i].next = nodes[i + 1];
    nodes[i + 1].prev = nodes[i];
  }
  return nodes[0] ?? null;
}

describe('convert', () => {
  describe('process', () => {
    it('should convert a single math_char (ord) to mi', () => {
      const head = simpleNoad(0, mathChar(0, 0x78)); // 'x'
      const result = process(head);
      assert.equal(result.tag, 'mi');
      assert.equal(result.children[0], 'x');
      assert.equal(result.attrs.mathvariant, 'normal');
    });

    it('should convert a digit to mn', () => {
      const head = simpleNoad(0, mathChar(0, 0x32)); // '2'
      const result = process(head);
      assert.equal(result.tag, 'mn');
      assert.equal(result.children[0], '2');
    });

    it('should convert an operator (rel) to mo', () => {
      const head = simpleNoad(5, mathChar(0, 0x3D)); // '=' as rel
      const result = process(head);
      assert.equal(result.tag, 'mo');
      assert.equal(result.children[0], '=');
    });

    it('should handle subscript', () => {
      const head = simpleNoad(0, mathChar(0, 0x78), {
        sub: { id: 'sub_mlist', subtype: 0, list: simpleNoad(0, mathChar(0, 0x69)) },
      });
      const result = process(head);
      assert.equal(result.tag, 'msub');
      assert.equal(result.children.length, 2);
    });

    it('should handle superscript', () => {
      const head = simpleNoad(0, mathChar(0, 0x78), {
        sup: { id: 'sub_mlist', subtype: 0, list: simpleNoad(0, mathChar(0, 0x32)) },
      });
      const result = process(head);
      assert.equal(result.tag, 'msup');
    });

    it('should handle x + y = z as mrow', () => {
      const x = simpleNoad(0, mathChar(0, 0x78));
      const plus = simpleNoad(4, mathChar(0, 0x2B)); // bin
      const y = simpleNoad(0, mathChar(0, 0x79));
      const eq = simpleNoad(5, mathChar(0, 0x3D)); // rel
      const z = simpleNoad(0, mathChar(0, 0x7A));
      const head = link(x, plus, y, eq, z)!;
      const result = process(head);
      assert.equal(result.tag, 'mrow');
      // Should contain mi, mo(+), mi, mo(=), mi
      assert.ok(result.children.length >= 5);
    });

    it('should join consecutive mn digits', () => {
      const d1 = simpleNoad(0, mathChar(0, 0x31)); // '1'
      const d2 = simpleNoad(0, mathChar(0, 0x32)); // '2'
      const d3 = simpleNoad(0, mathChar(0, 0x33)); // '3'
      const head = link(d1, d2, d3)!;
      const result = process(head);
      assert.equal(result.tag, 'mn');
      assert.equal(result.children.join(''), '123');
    });

    it('should handle fraction', () => {
      const head: MathNode = {
        id: 'fraction', subtype: 0,
        num: { id: 'sub_mlist', subtype: 0, list: simpleNoad(0, mathChar(0, 0x61)) },
        denom: { id: 'sub_mlist', subtype: 0, list: simpleNoad(0, mathChar(0, 0x62)) },
        width: 0x40000000, // default
      };
      const result = process(head);
      assert.equal(result.tag, 'mfrac');
      assert.equal(result.children.length, 2);
    });

    it('should handle radical (sqrt)', () => {
      const head: MathNode = {
        id: 'radical', subtype: 0,
        nucleus: { id: 'sub_mlist', subtype: 0, list: simpleNoad(0, mathChar(0, 0x78)) },
        left: { id: 'delim', subtype: 0, small_fam: 0, small_char: 0 },
      };
      const result = process(head);
      assert.equal(result.tag, 'msqrt');
    });

    it('should handle fence (left/right)', () => {
      const leftFence: MathNode = {
        id: 'fence', subtype: 1,
        delim: { id: 'delim', subtype: 0, small_fam: 0, small_char: 0x28 },
        options: 0, height: 0, depth: 0, class: -1,
      };
      const inner = simpleNoad(0, mathChar(0, 0x78));
      const rightFence: MathNode = {
        id: 'fence', subtype: 3,
        delim: { id: 'delim', subtype: 0, small_fam: 0, small_char: 0x29 },
        options: 0, height: 0, depth: 0, class: -1,
      };
      const head = link(leftFence, inner, rightFence)!;
      const result = process(head);
      assert.equal(result.tag, 'mrow');
      // Should contain mo('('), mi('x'), mo(')')
      assert.ok(result.children.length >= 3);
    });

    it('should handle accent (hat)', () => {
      const head: MathNode = {
        id: 'accent', subtype: 0,
        nucleus: mathChar(0, 0x78),
        accent: mathChar(0, 0x302), // combining circumflex
      };
      const result = process(head);
      assert.equal(result.tag, 'mover');
    });
  });

  describe('makeRoot', () => {
    it('should wrap with math element for display style', () => {
      const inner = elem('mrow', [elem('mi', ['x'])]);
      const root = makeRoot(inner, 0);
      assert.equal(root.tag, 'math');
      assert.equal(root.attrs.display, 'block');
      assert.equal(root.attrs.xmlns, 'http://www.w3.org/1998/Math/MathML');
    });

    it('should not set display=block for text style', () => {
      const inner = elem('mi', ['x']);
      const root = makeRoot(inner, 2);
      assert.equal(root.tag, 'math');
      assert.equal(root.attrs.display, undefined);
    });
  });

  describe('registerFamily', () => {
    it('should register a font mapping without error', () => {
      registerFamily(99, [0x41, 0x42, 0x43]); // A, B, C
      // After registration, math_char with fam=99, char=0 should produce 'A'
      const head = simpleNoad(0, mathChar(99, 0));
      const result = process(head);
      assert.equal(result.children[0], 'A');
    });
  });
});
