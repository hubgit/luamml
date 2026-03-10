/**
 * Compatibility tests derived from MathJax's Base TeX test suite.
 *
 * MathJax is licensed under the Apache License 2.0.
 * Copyright (c) 2009-2024 The MathJax Consortium.
 * https://github.com/mathjax/MathJax-src
 *
 * These tests verify that our parser handles the same LaTeX inputs
 * that MathJax's TeX-to-MathML converter is tested against. We compare
 * structural properties rather than exact output, since the libraries
 * differ in attributes, whitespace, and MathML dialect choices.
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
  JSON.parse(readFileSync(join(__dirname, 'fixtures', 'mathjax-fixtures.json'), 'utf-8'));

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

/** Check if tree has an merror (indicating unsupported command). */
function hasError(el: MathMLElement): boolean {
  return hasTag(el, 'merror');
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

/**
 * Parse expected MathML string into a tag set for structural comparison.
 * Extracts tag names from the expected output for loose matching.
 */
function extractExpectedTags(mathml: string): string[] {
  const tagRe = /<(m[a-z]+)[\s>/]/g;
  const tags: string[] = [];
  let m;
  while ((m = tagRe.exec(mathml)) !== null) {
    if (!tags.includes(m[1])) tags.push(m[1]);
  }
  return tags;
}

describe('MathJax compatibility', () => {

  // Test that most MathJax fixtures parse without throwing (batched for performance)
  it('most fixtures parse without throwing', () => {
    const failures: string[] = [];
    for (const fixture of fixtures) {
      try {
        render(fixture.latex);
      } catch (e) {
        failures.push(`${fixture.name}: ${(e as Error).message}`);
      }
    }
    const pct = ((fixtures.length - failures.length) / fixtures.length * 100).toFixed(1);
    console.log(`  MathJax parse success: ${fixtures.length - failures.length}/${fixtures.length} (${pct}%)`);
    // Allow up to 10% parse failures for unsupported MathJax-specific syntax
    assert.ok(failures.length / fixtures.length < 0.1,
      `Too many parse failures (${failures.length}/${fixtures.length}):\n  ${failures.slice(0, 10).join('\n  ')}`);
  });

  // Structural comparison: check that our output uses the same MathML elements
  describe('structural tag matching', () => {
    // Test a curated subset of important structural tests
    const structuralTests: Array<{
      latex: string;
      requiredTags: string[];
      description: string;
    }> = [
      { latex: 'x', requiredTags: ['mi'], description: 'single identifier' },
      { latex: 'xy', requiredTags: ['mi'], description: 'two identifiers' },
      { latex: 'x^2', requiredTags: ['msup', 'mi', 'mn'], description: 'superscript' },
      { latex: 'x_n', requiredTags: ['msub', 'mi'], description: 'subscript' },
      { latex: 'x_n^2', requiredTags: ['msubsup', 'mi', 'mn'], description: 'sub+superscript' },
      { latex: '\\sum^2_1', requiredTags: ['mo', 'mn'], description: 'sum with limits' },
      { latex: '\\frac{a}{b}', requiredTags: ['mfrac', 'mi'], description: 'fraction' },
      { latex: '\\sqrt{x}', requiredTags: ['msqrt', 'mi'], description: 'square root' },
      { latex: '\\sqrt[3]{x}', requiredTags: ['mroot', 'mn', 'mi'], description: 'nth root' },
      { latex: '\\alpha', requiredTags: ['mi'], description: 'Greek letter' },
      { latex: '\\sin x', requiredTags: ['mi'], description: 'named operator' },
      { latex: '\\hat{x}', requiredTags: ['mover', 'mo', 'mi'], description: 'accent' },
      { latex: '\\overline{x}', requiredTags: ['mover', 'mo', 'mi'], description: 'overline' },
      { latex: '\\left(x\\right)', requiredTags: ['mo', 'mi'], description: 'left/right parens' },
      { latex: 'a + b = c', requiredTags: ['mi', 'mo'], description: 'equation' },
      { latex: '1 + 2', requiredTags: ['mn', 'mo'], description: 'numbers and operator' },
      { latex: '\\text{hello}', requiredTags: ['mtext'], description: 'text' },
      { latex: '\\mathbb{R}', requiredTags: ['mi'], description: 'blackboard bold' },
      { latex: '\\phantom{x}', requiredTags: ['mphantom'], description: 'phantom' },
      { latex: '\\binom{n}{k}', requiredTags: ['mfrac', 'mo'], description: 'binomial' },
      { latex: '\\infty', requiredTags: ['mi'], description: 'infinity symbol' },
      { latex: '\\forall x \\exists y', requiredTags: ['mo', 'mi'], description: 'quantifiers' },
      { latex: '\\rightarrow', requiredTags: ['mo'], description: 'arrow' },
      { latex: '\\leq', requiredTags: ['mo'], description: 'relation' },
      { latex: '\\times', requiredTags: ['mo'], description: 'binary operator' },
      { latex: '\\displaystyle x', requiredTags: ['mstyle'], description: 'display style' },
    ];

    for (const { latex, requiredTags, description } of structuralTests) {
      it(`${description}: ${latex}`, () => {
        const tree = render(latex);
        const tags = collectTags(tree);
        for (const tag of requiredTags) {
          assert.ok(tags.includes(tag), `expected <${tag}> in output for "${latex}"`);
        }
      });
    }
  });

  // Compare against MathJax expected output for tag coverage
  describe('expected tag coverage vs MathJax', () => {
    // For each MathJax fixture, check that we produce the same key MathML elements
    const keyTags = new Set(['mfrac', 'msqrt', 'mroot', 'msub', 'msup', 'msubsup',
      'munder', 'mover', 'munderover', 'mtable', 'mtr', 'mtd',
      'mtext', 'mphantom', 'menclose', 'mstyle', 'mspace']);

    // Collect stats
    let total = 0;
    let matching = 0;
    let errors = 0;

    for (const fixture of fixtures) {
      const expectedTags = extractExpectedTags(fixture.mathml).filter(t => keyTags.has(t));
      if (expectedTags.length === 0) continue;

      total++;
      let tree;
      try {
        tree = render(fixture.latex);
      } catch {
        errors++;
        continue;
      }
      if (hasError(tree)) {
        errors++;
        continue;
      }
      const ourTags = collectTags(tree);
      const allPresent = expectedTags.every(t => ourTags.includes(t));
      if (allPresent) matching++;
    }

    it(`reports tag coverage stats`, () => {
      const pct = total > 0 ? ((matching / total) * 100).toFixed(1) : '0';
      console.log(`  MathJax tag coverage: ${matching}/${total} (${pct}%) ` +
        `[${errors} with unsupported commands]`);
      // Baseline: we expect at least 25% structural match on the base test suite
      // This threshold should increase as we add more LaTeX command support
      assert.ok(matching / total > 0.25,
        `Tag coverage too low: ${matching}/${total}`);
    });
  });
});
