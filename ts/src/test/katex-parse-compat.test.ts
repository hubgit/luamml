/**
 * Extended compatibility tests derived from KaTeX's katex-spec.ts and unicode-spec.ts.
 *
 * KaTeX is licensed under the MIT License.
 * Copyright (c) 2013-2020 Khan Academy and other contributors.
 * https://github.com/KaTeX/KaTeX
 *
 * These tests verify that our parser handles the same LaTeX inputs
 * that KaTeX's parser is tested against. We extract expressions that
 * KaTeX expects to parse successfully and verify we can parse them too.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { render } from '../latex.js';
import type { MathMLElement } from '../types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtures: Array<{ name: string; latex: string }> =
  JSON.parse(readFileSync(join(__dirname, 'fixtures', 'katex-parse-fixtures.json'), 'utf-8'));

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

describe('KaTeX extended compatibility', () => {

  // Batched parse test: all fixtures should parse without throwing
  it('parses all extractable KaTeX inputs', () => {
    const failures: string[] = [];
    for (const fixture of fixtures) {
      try {
        render(fixture.latex);
      } catch (e) {
        failures.push(`${fixture.name}: ${fixture.latex} → ${(e as Error).message}`);
      }
    }
    const pct = ((fixtures.length - failures.length) / fixtures.length * 100).toFixed(1);
    console.log(`  KaTeX parse success: ${fixtures.length - failures.length}/${fixtures.length} (${pct}%)`);
    // Allow up to 5% failures for KaTeX-specific features (\def, \let, etc.)
    assert.ok(failures.length / fixtures.length < 0.05,
      `Too many parse failures (${failures.length}/${fixtures.length}):\n  ${failures.slice(0, 15).join('\n  ')}`);
  });

  // Structural tests for key LaTeX features from katex-spec.ts
  describe('structural checks', () => {

    it('parses ord characters', () => {
      const tree = render('1234|/@."`abcdefgzABCDEFGZ');
      const tags = collectTags(tree);
      assert.ok(tags.includes('mn'), 'expected <mn> for digits');
      assert.ok(tags.includes('mi'), 'expected <mi> for letters');
    });

    it('parses binary operators', () => {
      const tree = render('+-*\\cdot\\pm\\div');
      assert.ok(hasTag(tree, 'mo'), 'expected <mo> for operators');
    });

    it('parses relations', () => {
      const tree = render('=<>\\leq\\geq\\neq\\cong');
      assert.ok(hasTag(tree, 'mo'), 'expected <mo> for relations');
    });

    it('parses \\not relations', () => {
      const tree = render('\\not=\\not<\\not>\\not\\leq\\not\\geq\\not\\in');
      assert.ok(hasTag(tree, 'mo'));
    });

    it('parses mathinner', () => {
      const tree = render('\\mathinner{\\langle{\\psi}\\rangle}');
      assert.ok(hasTag(tree, 'mi'));
    });

    it('parses sub/superscripts', () => {
      for (const expr of ['x^2', 'x_3', 'x^2_3', 'x_2^3', '^3', '_2', '^3_2', '_2^3']) {
        assert.doesNotThrow(() => render(expr), `failed on: ${expr}`);
      }
    });

    it('parses sub/superscripts with braces', () => {
      for (const expr of ['x^{2+3}', 'x_{3-2}', 'x^{2+3}_3', 'x^{2+3}_{3-2}']) {
        assert.doesNotThrow(() => render(expr), `failed on: ${expr}`);
      }
    });

    it('parses fractions without braces', () => {
      const tree = render('\\frac12');
      assert.ok(hasTag(tree, 'mfrac'));
    });

    it('parses nested fractions', () => {
      const tree = render('\\frac{\\frac12}{\\frac34}');
      const tags = collectTags(tree);
      const fracCount = tags.filter(t => t === 'mfrac').length;
      assert.ok(fracCount >= 3, `expected >= 3 mfrac, got ${fracCount}`);
    });

    it('parses \\over as infix fraction', () => {
      assert.doesNotThrow(() => render('1 \\over 2'));
    });

    it('parses sizing commands', () => {
      for (const cmd of ['\\Huge', '\\huge', '\\LARGE', '\\Large', '\\large',
                          '\\normalsize', '\\small', '\\footnotesize',
                          '\\scriptsize', '\\tiny']) {
        assert.doesNotThrow(() => render(`${cmd} x`), `failed on: ${cmd}`);
      }
    });

    it('parses text commands', () => {
      assert.doesNotThrow(() => render('\\text{hello world}'));
      assert.doesNotThrow(() => render('\\textrm{roman}'));
      assert.doesNotThrow(() => render('\\textit{italic}'));
      assert.doesNotThrow(() => render('\\textbf{bold}'));
    });

    it('parses color commands', () => {
      assert.doesNotThrow(() => render('\\color{blue}{x}'));
      assert.doesNotThrow(() => render('\\color{#FF0000}{y}'));
    });

    it('parses delimiter sizing', () => {
      for (const cmd of ['\\bigl', '\\bigr', '\\Bigl', '\\Bigr',
                          '\\biggl', '\\biggr', '\\Biggl', '\\Biggr']) {
        assert.doesNotThrow(() => render(`${cmd}(`), `failed on: ${cmd}`);
      }
    });

    it('parses \\overline', () => {
      const tree = render('\\overline{x}');
      assert.ok(hasTag(tree, 'mover'));
    });

    it('parses \\sqrt', () => {
      const tree = render('\\sqrt{x}');
      assert.ok(hasTag(tree, 'msqrt'));
      const tree2 = render('\\sqrt[3]{x}');
      assert.ok(hasTag(tree2, 'mroot'));
    });

    it('parses left/right delimiters', () => {
      for (const expr of [
        '\\left(x\\right)',
        '\\left[x\\right]',
        '\\left\\{x\\right\\}',
        '\\left.x\\right)',
      ]) {
        assert.doesNotThrow(() => render(expr), `failed on: ${expr}`);
      }
    });

    it('parses environments', () => {
      for (const env of ['matrix', 'pmatrix', 'bmatrix', 'cases', 'aligned']) {
        assert.doesNotThrow(() => render(`\\begin{${env}}a\\\\b\\end{${env}}`),
          `failed on: ${env}`);
      }
    });

    it('parses font commands', () => {
      for (const cmd of ['\\mathrm', '\\mathit', '\\mathbf', '\\mathbb',
                          '\\mathcal', '\\mathfrak', '\\mathsf', '\\mathtt']) {
        assert.doesNotThrow(() => render(`${cmd}{x}`), `failed on: ${cmd}`);
      }
    });

    it('parses accents', () => {
      for (const cmd of ['\\hat', '\\bar', '\\vec', '\\dot', '\\ddot',
                          '\\tilde', '\\acute', '\\grave', '\\breve']) {
        const tree = render(`${cmd}{x}`);
        assert.ok(hasTag(tree, 'mover'), `expected <mover> for ${cmd}`);
      }
    });

    it('parses \\operatorname and \\operatorname*', () => {
      assert.doesNotThrow(() => render('\\operatorname{sn}'));
      assert.doesNotThrow(() => render('\\operatorname*{arg\\,max}'));
    });

    it('parses Greek letters as Unicode', () => {
      const tree = render('αβγδεζηθ');
      assert.ok(hasTag(tree, 'mi') || hasTag(tree, 'mo'));
    });

    it('parses \\text{} with Latin-1 characters', () => {
      assert.doesNotThrow(() =>
        render('\\text{ÀÁÂÃÄÅÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝàáâãäåèéêëìíîïñòóôõöùúûüýÿ}'));
    });

    it('parses \\text{} with CJK characters', () => {
      assert.doesNotThrow(() => render('\\text{私はバナナです}'));
      assert.doesNotThrow(() => render('\\text{여보세요}'));
    });

    it('parses spacing commands', () => {
      for (const cmd of ['\\,', '\\:', '\\;', '\\!', '\\ ', '\\quad', '\\qquad']) {
        assert.doesNotThrow(() => render(`a${cmd}b`), `failed on: ${cmd}`);
      }
    });

    it('parses \\phantom', () => {
      const tree = render('\\phantom{x}');
      assert.ok(hasTag(tree, 'mphantom'));
    });
  });
});
