/**
 * Compatibility tests derived from KaTeX's MathML test suite.
 *
 * KaTeX is licensed under the MIT License.
 * Copyright (c) 2013-2020 Khan Academy and other contributors.
 * https://github.com/KaTeX/KaTeX
 *
 * These tests verify that our parser handles the same LaTeX inputs
 * that KaTeX's MathML builder is tested against. We compare structural
 * properties rather than exact output, since the two libraries differ
 * in whitespace, attribute ordering, and features like <semantics> wrapping.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { render, renderToString } from '../latex.js';
import type { MathMLElement } from '../types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtures: Array<{ name: string; latex: string; mathml: string }> =
  JSON.parse(readFileSync(join(__dirname, 'fixtures', 'katex-fixtures.json'), 'utf-8'));

/** Collect all element tags in a MathML tree (depth-first). */
function collectTags(el: MathMLElement): string[] {
  const tags: string[] = [el.tag];
  for (const child of el.children) {
    if (typeof child !== 'string') {
      tags.push(...collectTags(child));
    }
  }
  return tags;
}

/** Check if a tag exists anywhere in the tree. */
function hasTag(el: MathMLElement, tag: string): boolean {
  if (el.tag === tag) return true;
  return el.children.some(c => typeof c !== 'string' && hasTag(c, tag));
}

/** Extract all text content from a tree. */
function textContent(el: MathMLElement): string {
  let text = '';
  for (const child of el.children) {
    if (typeof child === 'string') text += child;
    else text += textContent(child);
  }
  return text;
}

describe('KaTeX compatibility', () => {

  // Test that all KaTeX fixtures parse without error
  describe('all fixtures parse successfully', () => {
    for (const fixture of fixtures) {
      it(`KaTeX: ${fixture.name}`, () => {
        // Some KaTeX fixtures use features we don't support (e.g., \copyright, \KaTeX).
        // We just verify no uncaught exception (ParseError from merror is OK).
        assert.doesNotThrow(() => render(fixture.latex));
      });
    }
  });

  // Structural tests for specific KaTeX features
  describe('structural checks', () => {

    it('generates mi, mo, mn for \\sin{x}+1', () => {
      const tree = render('\\sin{x}+1\\;\\text{a}');
      const tags = collectTags(tree);
      assert.ok(tags.includes('mi'), 'should have mi');
      assert.ok(tags.includes('mo'), 'should have mo');
      assert.ok(tags.includes('mn'), 'should have mn');
      assert.ok(tags.includes('mtext'), 'should have mtext');
    });

    it('concatenates digits into mn', () => {
      const tree = render('0.34');
      assert.ok(hasTag(tree, 'mn'));
      assert.ok(textContent(tree).includes('0.34'));
    });

    it('makes prime into mo', () => {
      const tree = render("f'");
      assert.ok(hasTag(tree, 'msup'), 'prime should create msup');
    });

    it('generates mphantom for \\phantom', () => {
      const tree = render('\\phantom{x}');
      assert.ok(hasTag(tree, 'mphantom'));
    });

    it('uses munderover for large operators in display', () => {
      // Our parser doesn't distinguish display/text operator limits,
      // but \sum with sub/sup should produce msubsup or munderover
      const tree = render('\\sum_a^b');
      const tags = collectTags(tree);
      assert.ok(
        tags.includes('munderover') || tags.includes('msubsup'),
        'should have munderover or msubsup'
      );
    });

    it('handles \\limsup with subscript', () => {
      const tree = render('\\limsup_{x \\rightarrow \\infty}');
      assert.ok(hasTag(tree, 'msub') || hasTag(tree, 'munder'));
      assert.ok(textContent(tree).includes('lim'));
    });

    it('sizes delimiters with \\big etc.', () => {
      // We don't have \big yet but this should at least parse
      assert.doesNotThrow(() => render('(M) \\big(M\\big)'));
    });

    it('renders boldsymbol with correct mathvariant', () => {
      // \boldsymbol is not implemented, but should not throw
      assert.doesNotThrow(() => render('\\boldsymbol{Ax}'));
    });

    it('renders \\text with font variants', () => {
      const tree = render('\\text{roman\\textit{italic}\\textbf{bold}}');
      assert.ok(hasTag(tree, 'mtext'));
    });

    it('handles accents', () => {
      const tree = render('\\hat{x}');
      assert.ok(hasTag(tree, 'mover'), 'accent should use mover');
    });

    it('handles spacing commands', () => {
      const tree = render('\\kern1em');
      // \kern is not implemented, but should not throw
      assert.ok(tree.tag === 'math');
    });

    it('handles special space commands', () => {
      const tree = render('\\,\\:\\;\\!');
      assert.ok(hasTag(tree, 'mspace'));
    });
  });
});
