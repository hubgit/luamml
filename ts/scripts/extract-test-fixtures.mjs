#!/usr/bin/env node
/**
 * Extracts LaTeX→MathML test fixtures from KaTeX and MathJax test suites.
 *
 * Produces JSON fixture files that map LaTeX inputs to expected MathML structure.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const fixturesDir = join(root, 'src', 'test', 'fixtures');
mkdirSync(fixturesDir, { recursive: true });

// ---------------------------------------------------------------------------
// KaTeX: Parse snapshot file
// ---------------------------------------------------------------------------

function extractKatexFixtures() {
  const specSrc = readFileSync(join(root, '..', 'katex-mathml-spec.ts'), 'utf-8');
  const snapSrc = readFileSync(join(root, '..', 'katex-mathml-spec.ts.snap'), 'utf-8');

  // Extract LaTeX inputs from spec file
  // Pattern: getMathML("..." or getMathML(`...`)
  const inputRe = /getMathML\((?:"([^"]+)"|`([^`]+)`|'([^']+)')/g;
  const inputs = [];
  let m;
  while ((m = inputRe.exec(specSrc)) !== null) {
    inputs.push(m[1] || m[2] || m[3]);
  }

  // Extract snapshots: exports[`name`] = `<math ...>...</math>`;
  const snapRe = /exports\[`([^`]+)`\]\s*=\s*`\n([\s\S]*?)\n`;\s*/g;
  const snapshots = new Map();
  while ((m = snapRe.exec(snapSrc)) !== null) {
    snapshots.set(m[1], m[2].trim());
  }

  // Extract inner MathML (strip <semantics> and <annotation> wrapper)
  function stripSemantics(mathml) {
    // Remove <semantics>...</semantics> wrapper, keep the content MathML
    const inner = mathml
      .replace(/<semantics>\s*/g, '')
      .replace(/\s*<annotation[^>]*>[\s\S]*?<\/annotation>\s*/g, '')
      .replace(/\s*<\/semantics>/g, '');
    return inner;
  }

  // Strip data-* attributes and normalize whitespace
  function normalize(mathml) {
    return stripSemantics(mathml)
      .replace(/\s+/g, ' ')
      .replace(/> </g, '>\n<')
      .trim();
  }

  const fixtures = [];
  for (const [name, snap] of snapshots) {
    // Extract the LaTeX from the annotation tag
    const annMatch = snap.match(/<annotation encoding="application\/x-tex">\s*([\s\S]*?)\s*<\/annotation>/);
    // Unescape \\ from the snapshot annotation
    const latex = annMatch ? annMatch[1].trim().replace(/\\\\/g, '\\') : null;
    if (!latex) continue;

    fixtures.push({
      name: name.replace(/^A MathML builder /, ''),
      latex,
      mathml: normalize(snap),
    });
  }

  return fixtures;
}

// ---------------------------------------------------------------------------
// MathJax: Parse Base.test.ts
// ---------------------------------------------------------------------------

function extractMathJaxFixtures() {
  const src = readFileSync(join(root, '..', 'mathjax-base.test.ts'), 'utf-8');

  const fixtures = [];
  // Match: it('name', () => { toXmlMatch(tex2mml('input'), `expected`); });
  // The pattern is: it('name', ... tex2mml('input' or `input`) ... `<math ...>expected</math>`
  const testBlockRe = /it\('([^']+)'[^)]*\)\s*(?:=>|,\s*(?:function\s*\(\)))\s*\{([\s\S]*?)\n\s*\}\);/g;

  let match;
  while ((match = testBlockRe.exec(src)) !== null) {
    const name = match[1];
    const body = match[2];

    // Extract LaTeX input
    const texMatch = body.match(/tex2mml\((?:'([^']*)'|`([^`]*)`|"([^"]*)")/);
    if (!texMatch) continue;
    let latex = texMatch[1] ?? texMatch[2] ?? texMatch[3];
    // Unescape \\  to single backslash
    latex = latex.replace(/\\\\/g, '\\');

    // Extract expected MathML
    const xmlMatch = body.match(/`(<math[\s\S]*?<\/math>)`/);
    if (!xmlMatch) continue;
    let mathml = xmlMatch[1];

    // Strip data-latex and data-mjx-* attributes, normalize
    mathml = mathml
      .replace(/\s*data-latex="[^"]*"/g, '')
      .replace(/\s*data-mjx-[a-z]+="[^"]*"/g, '')
      .replace(/\s+/g, ' ')
      .replace(/> </g, '>\n<')
      .trim();

    fixtures.push({ name, latex, mathml });
  }

  return fixtures;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const katex = extractKatexFixtures();
const mathjax = extractMathJaxFixtures();

console.log(`Extracted ${katex.length} KaTeX fixtures`);
console.log(`Extracted ${mathjax.length} MathJax fixtures`);

writeFileSync(
  join(fixturesDir, 'katex-fixtures.json'),
  JSON.stringify(katex, null, 2) + '\n',
);
writeFileSync(
  join(fixturesDir, 'mathjax-fixtures.json'),
  JSON.stringify(mathjax, null, 2) + '\n',
);

console.log('Written to src/test/fixtures/');
