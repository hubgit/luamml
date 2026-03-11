#!/usr/bin/env node
// Node.js benchmark: LuaMML vs KaTeX vs MathJax (no browser required).
//
// Usage:
//   node demo/bench.js              # default 100 iterations
//   node demo/bench.js --iters 200  # custom iteration count
//   node demo/bench.js --json       # machine-readable JSON output
//
// Prerequisites (run from ts/):
//   npm run build
//   npm install --no-save katex mathjax-full

import { performance } from 'node:perf_hooks';
import { tests } from './bench-data.js';

// ---------------------------------------------------------------------------
// Parse CLI flags
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
let iters = 100;
let jsonOutput = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--iters' && args[i + 1]) { iters = parseInt(args[++i], 10); }
  if (args[i] === '--json') { jsonOutput = true; }
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
// Render wrappers
// ---------------------------------------------------------------------------
function renderLuaMML(tex) {
  return luamml.renderToString(tex);
}

function renderKaTeX(tex) {
  return katexMod.default.renderToString(tex, { throwOnError: false, output: 'mathml' });
}

function renderMathJaxSVG(tex) {
  const node = mathjaxMod.html.convert(tex, { display: false });
  return mathjaxMod.adaptor.outerHTML(node);
}

function renderMathJaxMML(tex) {
  const { HTMLMathItem, inputJax, html, visitor } = mathjaxMod;
  const item = new HTMLMathItem(tex, inputJax, false);
  item.setMetrics(16, 8, 1000000, 100000, 1);
  item.compile(html);
  return visitor.visitTree(item.root);
}

// ---------------------------------------------------------------------------
// Benchmark helper
// ---------------------------------------------------------------------------
function bench(fn, n) {
  // warm-up
  for (let i = 0; i < 3; i++) fn();
  const t0 = performance.now();
  for (let i = 0; i < n; i++) fn();
  return (performance.now() - t0) / n;
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
const libs = [];
libs.push({ name: 'LuaMML', render: renderLuaMML });
if (katexMod) libs.push({ name: 'KaTeX', render: renderKaTeX });
if (mathjaxMod) {
  libs.push({ name: 'MathJax MML', render: renderMathJaxMML });
  libs.push({ name: 'MathJax SVG', render: renderMathJaxSVG });
}

if (!jsonOutput) {
  console.log(`\nBenchmark: ${tests.length} expressions x ${iters} iterations\n`);
  console.log('Libraries: ' + libs.map(l => l.name).join(', '));
  console.log('-'.repeat(70));
}

const results = [];
const totals = Object.fromEntries(libs.map(l => [l.name, 0]));
const errors = Object.fromEntries(libs.map(l => [l.name, 0]));

for (const t of tests) {
  const row = { cat: t.cat, tex: t.tex, times: {} };

  for (const lib of libs) {
    try {
      const ms = bench(() => lib.render(t.tex), iters);
      row.times[lib.name] = ms;
      totals[lib.name] += ms;
    } catch {
      row.times[lib.name] = null;
      errors[lib.name]++;
    }
  }

  results.push(row);
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------
if (jsonOutput) {
  const output = {
    iterations: iters,
    expressionCount: tests.length,
    libraries: libs.map(l => l.name),
    totals,
    errors,
    results,
  };
  console.log(JSON.stringify(output, null, 2));
} else {
  // Print per-category aggregates
  const cats = [...new Set(tests.map(t => t.cat))];

  // Column widths
  const colW = 14;
  const catW = 14;

  const header = 'Category'.padEnd(catW) + libs.map(l => l.name.padStart(colW)).join('');
  console.log(header);
  console.log('-'.repeat(header.length));

  for (const cat of cats) {
    const catRows = results.filter(r => r.cat === cat);
    const sums = {};
    for (const lib of libs) {
      sums[lib.name] = catRows.reduce((s, r) => s + (r.times[lib.name] ?? 0), 0);
    }
    const line = cat.padEnd(catW) + libs.map(l => {
      const ms = sums[l.name];
      return (ms.toFixed(2) + ' ms').padStart(colW);
    }).join('');
    console.log(line);
  }

  console.log('-'.repeat(header.length));
  const totalLine = 'TOTAL'.padEnd(catW) + libs.map(l => {
    return (totals[l.name].toFixed(2) + ' ms').padStart(colW);
  }).join('');
  console.log(totalLine);

  // Speedup ratios
  if (libs.length > 1) {
    console.log();
    const base = totals['LuaMML'];
    for (const lib of libs) {
      if (lib.name === 'LuaMML') continue;
      console.log(`${lib.name} / LuaMML: ${(totals[lib.name] / base).toFixed(1)}x slower`);
    }
  }

  // Error summary
  const errLibs = libs.filter(l => errors[l.name] > 0);
  if (errLibs.length) {
    console.log('\nErrors: ' + errLibs.map(l => `${l.name}: ${errors[l.name]}`).join(', '));
  }

  console.log();
}
