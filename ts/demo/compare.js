#!/usr/bin/env node
// Compare MathML output: LuaMML vs KaTeX vs MathJax.
//
// Usage:
//   node demo/compare.js              # human-readable table
//   node demo/compare.js --json       # machine-readable JSON
//   node demo/compare.js --verbose    # show sample diffs per category
//
// Prerequisites (run from ts/):
//   npm run build
//   npm install --no-save katex mathjax-full

import { tests } from './bench-data.js';

// ---------------------------------------------------------------------------
// Parse CLI flags
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
let jsonOutput = false;
let verbose = false;

for (const arg of args) {
  if (arg === '--json') jsonOutput = true;
  if (arg === '--verbose') verbose = true;
}

// ---------------------------------------------------------------------------
// Load libraries
// ---------------------------------------------------------------------------
async function tryImport(name, importFn) {
  try {
    return await importFn();
  } catch {
    if (!jsonOutput) console.error(`Warning: Could not load ${name} -- skipping. Install with: npm install --no-save ${name}`);
    return null;
  }
}

const luamml = await import('../dist/latex.js');
const katexMod = await tryImport('katex', () => import('katex'));
const mathjaxMod = await tryImport('mathjax-full', async () => {
  const { TeX } = await import('mathjax-full/js/input/tex.js');
  const { SVG } = await import('mathjax-full/js/output/svg.js');
  const { liteAdaptor } = await import('mathjax-full/js/adaptors/liteAdaptor.js');
  const { RegisterHTMLHandler } = await import('mathjax-full/js/handlers/html.js');
  const { AllPackages } = await import('mathjax-full/js/input/tex/AllPackages.js');
  const { SerializedMmlVisitor } = await import('mathjax-full/js/core/MmlTree/SerializedMmlVisitor.js');
  const { HTMLMathItem } = await import('mathjax-full/js/handlers/html/HTMLMathItem.js');
  const adaptor = liteAdaptor();
  RegisterHTMLHandler(adaptor);
  const tex = new TeX({ packages: AllPackages });
  const svg = new SVG({ fontCache: 'none' });
  const { mathjax: mj } = await import('mathjax-full/js/mathjax.js');
  const html = mj.document('', { InputJax: tex, OutputJax: svg });
  const visitor = new SerializedMmlVisitor();
  const inputJax = html.inputJax[0];
  return { adaptor, html, visitor, inputJax, HTMLMathItem };
});

// ---------------------------------------------------------------------------
// Render functions
// ---------------------------------------------------------------------------
function renderLuaMML(input) {
  try { return luamml.renderToString(input); }
  catch { return null; }
}

function renderKaTeX(input) {
  try {
    const html = katexMod.default.renderToString(input, { throwOnError: false, output: 'mathml' });
    const match = html.match(/<math[^]*<\/math>/);
    return match ? match[0] : null;
  } catch { return null; }
}

function renderMathJax(input) {
  try {
    const { HTMLMathItem, inputJax, html, visitor } = mathjaxMod;
    const item = new HTMLMathItem(input, inputJax, false);
    item.setMetrics(16, 8, 1000000, 100000, 1);
    item.compile(html);
    return visitor.visitTree(item.root);
  } catch { return null; }
}

// ---------------------------------------------------------------------------
// Normalization for comparison
// ---------------------------------------------------------------------------

// Normalize whitespace and decode entities, but preserve all attributes.
function normalize(s) {
  return s
    .replace(/\n\s*/g, '')
    .replace(/>\s+</g, '><')
    .replace(/&#x([0-9A-Fa-f]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .trim();
}

// Strip library-specific non-semantic attributes for a fairer comparison.
function semantic(s) {
  return normalize(s)
    .replace(/ data-mjx-[a-z]+="[^"]*"/g, '');  // MathJax-specific
}

// ---------------------------------------------------------------------------
// Classify differences
// ---------------------------------------------------------------------------
const diffLabels = [
  ['msubsup-vs-munderover', (lm, other) =>
    other.includes('munderover') && !lm.includes('munderover') && lm.includes('msubsup')],
  ['msub-vs-munder', (lm, other) =>
    other.includes('<munder>') && !lm.includes('<munder>') && lm.includes('<msub>')],
  ['missing-applyfunction', (lm, other) =>
    other.includes('\u2061') && !lm.includes('\u2061')],
  ['extra-applyfunction', (lm, other) =>
    lm.includes('\u2061') && !other.includes('\u2061')],
  ['missing-stretchy-false', (lm, other) =>
    other.includes('stretchy="false"') && !lm.includes('stretchy="false"')],
  ['extra-stretchy-attrs', (lm, other) =>
    lm.includes('stretchy="true"') && !other.includes('stretchy="true"')],
  ['accent-attr', (lm, other) =>
    lm.includes('accent="true"') !== other.includes('accent="true"')],
  ['mrow-wrapping', (lm, other) => {
    const lmCount = (lm.match(/<mrow>/g) || []).length;
    const otherCount = (other.match(/<mrow>/g) || []).length;
    return lmCount !== otherCount;
  }],
  ['fence-symmetric-attrs', (lm, other) =>
    lm.includes('fence="true"') && !other.includes('fence="true"')],
  ['missing-mathvariant-normal', (lm, other) =>
    other.includes('mathvariant="normal"') && !lm.includes('mathvariant="normal"')],
  ['extra-mathvariant-normal', (lm, other) =>
    lm.includes('mathvariant="normal"') && !other.includes('mathvariant="normal"')],
  ['spacing-elements', (lm, other) =>
    (lm.includes('<mspace') !== other.includes('<mspace')) ||
    (lm.includes('<mstyle') !== other.includes('<mstyle'))],
];

function classifyDiffs(lmNorm, otherNorm) {
  const found = [];
  for (const [label, test] of diffLabels) {
    if (test(lmNorm, otherNorm)) found.push(label);
  }
  return found.length > 0 ? found : ['other'];
}

// ---------------------------------------------------------------------------
// Run comparison
// ---------------------------------------------------------------------------
function compare(name, renderFn) {
  let same = 0;
  let diff = 0;
  let lmErrors = 0;
  let otherErrors = 0;
  const categories = {};
  const examples = {};

  for (const t of tests) {
    const lm = renderLuaMML(t.tex);
    const other = renderFn(t.tex);
    if (!lm) { lmErrors++; continue; }
    if (!other) { otherErrors++; continue; }

    const lmS = semantic(lm);
    const otherS = semantic(other);

    if (lmS === otherS) { same++; continue; }
    diff++;

    const diffs = classifyDiffs(lmS, otherS);
    for (const d of diffs) {
      if (!categories[d]) { categories[d] = 0; examples[d] = []; }
      categories[d]++;
      if (examples[d].length < 2) {
        examples[d].push({ tex: t.tex, luamml: lmS.substring(0, 200), other: otherS.substring(0, 200) });
      }
    }
  }

  return { name, same, diff, total: same + diff, lmErrors, otherErrors, categories, examples };
}

const comparisons = [];
if (mathjaxMod) comparisons.push(compare('MathJax', renderMathJax));
if (katexMod) comparisons.push(compare('KaTeX', renderKaTeX));

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------
if (jsonOutput) {
  const output = {
    expressionCount: tests.length,
    comparisons: comparisons.map(c => ({
      library: c.name,
      same: c.same,
      different: c.diff,
      total: c.total,
      luammlErrors: c.lmErrors,
      otherErrors: c.otherErrors,
      differenceCategories: c.categories,
    })),
  };
  console.log(JSON.stringify(output, null, 2));
} else {
  for (const c of comparisons) {
    console.log(`\n=== LuaMML vs ${c.name} ===`);
    console.log(`Match: ${c.same}/${c.total} (${(100 * c.same / c.total).toFixed(0)}%)`);
    console.log(`Different: ${c.diff}`);
    if (c.lmErrors) console.log(`LuaMML errors: ${c.lmErrors}`);
    if (c.otherErrors) console.log(`${c.name} errors: ${c.otherErrors}`);

    if (c.diff > 0) {
      console.log('\nDifference breakdown:');
      const sorted = Object.entries(c.categories).sort((a, b) => b[1] - a[1]);
      for (const [cat, count] of sorted) {
        console.log(`  ${cat}: ${count}`);
        if (verbose && c.examples[cat]) {
          for (const ex of c.examples[cat]) {
            console.log(`    tex: ${ex.tex}`);
            console.log(`    LuaMML:  ${ex.luamml}`);
            console.log(`    ${c.name}: ${ex.other}`);
          }
        }
      }
    }
  }
  console.log();
}
