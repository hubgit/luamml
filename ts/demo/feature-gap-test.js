// Feature gap test: LuaMML vs KaTeX vs MathJax
import { renderToString } from '../dist/latex.js';
import katex from 'katex';
import { TeX } from 'mathjax-full/js/input/tex.js';
import { SVG } from 'mathjax-full/js/output/svg.js';
import { liteAdaptor } from 'mathjax-full/js/adaptors/liteAdaptor.js';
import { RegisterHTMLHandler } from 'mathjax-full/js/handlers/html.js';
import { AllPackages } from 'mathjax-full/js/input/tex/AllPackages.js';
import { mathjax as mj } from 'mathjax-full/js/mathjax.js';

const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);
const mjHtml = mj.document('', {
  InputJax: new TeX({ packages: AllPackages }),
  OutputJax: new SVG({ fontCache: 'none' }),
});

function tryLuamml(tex) {
  try {
    const r = renderToString(tex);
    if (r.includes('<merror')) return { ok: false, type: 'merror' };
    return { ok: true };
  } catch (e) { return { ok: false, type: 'throw', msg: String(e).slice(0, 80) }; }
}

function tryKatex(tex) {
  try {
    const r = katex.renderToString(tex, { throwOnError: true, output: 'mathml' });
    return { ok: true };
  } catch (e) { return { ok: false, type: 'throw', msg: String(e).slice(0, 80) }; }
}

function tryMathjax(tex) {
  try {
    const node = mjHtml.convert(tex, { display: false });
    const html = adaptor.outerHTML(node);
    if (html.includes('merror')) return { ok: false, type: 'merror' };
    return { ok: true };
  } catch (e) { return { ok: false, type: 'throw', msg: String(e).slice(0, 80) }; }
}

const expressions = [
  // Modular arithmetic
  { cat: 'Modular arithmetic', tex: '\\pmod{n}' },
  { cat: 'Modular arithmetic', tex: 'a \\bmod b' },
  { cat: 'Modular arithmetic', tex: 'a \\pod{n}' },
  // Extensible arrows
  { cat: 'Extensible arrows', tex: '\\xrightarrow{abc}' },
  { cat: 'Extensible arrows', tex: '\\xleftarrow{abc}' },
  { cat: 'Extensible arrows', tex: '\\xrightarrow[below]{above}' },
  { cat: 'Extensible arrows', tex: '\\xleftrightarrow{abc}' },
  { cat: 'Extensible arrows', tex: '\\xRightarrow{abc}' },
  { cat: 'Extensible arrows', tex: '\\xLeftarrow{abc}' },
  { cat: 'Extensible arrows', tex: '\\xhookrightarrow{abc}' },
  { cat: 'Extensible arrows', tex: '\\xhookleftarrow{abc}' },
  { cat: 'Extensible arrows', tex: '\\xmapsto{abc}' },
  { cat: 'Extensible arrows', tex: '\\xtwoheadrightarrow{abc}' },
  // Cancel
  { cat: 'Cancel', tex: '\\cancel{x}' },
  { cat: 'Cancel', tex: '\\bcancel{x}' },
  { cat: 'Cancel', tex: '\\xcancel{x}' },
  { cat: 'Cancel', tex: '\\sout{text}' },
  // Color extensions
  { cat: 'Color extensions', tex: '\\colorbox{yellow}{x+y}' },
  { cat: 'Color extensions', tex: '\\fcolorbox{red}{yellow}{x}' },
  { cat: 'Color extensions', tex: '\\textcolor{red}{hello}' },
  // Tags & refs
  { cat: 'Tags & refs', tex: '\\tag{1}' },
  { cat: 'Tags & refs', tex: '\\tag*{A}' },
  // Links
  { cat: 'Links', tex: '\\href{https://example.com}{text}' },
  { cat: 'Links', tex: '\\url{https://example.com}' },
  // Logo commands
  { cat: 'Logos', tex: '\\LaTeX' },
  { cat: 'Logos', tex: '\\TeX' },
  { cat: 'Logos', tex: '\\KaTeX' },
  // Unicode/char
  { cat: 'Char/Unicode', tex: '\\char"263A' },
  // Environments
  { cat: 'Environments', tex: '\\begin{rcases} a \\\\ b \\end{rcases}' },
  { cat: 'Environments', tex: '\\begin{dcases} a \\\\ b \\end{dcases}' },
  { cat: 'Environments', tex: '\\begin{equation} x = 1 \\end{equation}' },
  { cat: 'Environments', tex: '\\begin{gather} a \\\\ b \\end{gather}' },
  { cat: 'Environments', tex: '\\begin{multline} a \\\\ b \\end{multline}' },
  { cat: 'Environments', tex: '\\begin{split} a &= b \\\\ &= c \\end{split}' },
  { cat: 'Environments', tex: '\\begin{smallmatrix} a & b \\\\ c & d \\end{smallmatrix}' },
  // Sideset
  { cat: 'Sideset', tex: '\\sideset{_a^b}{_c^d}{\\sum}' },
  // Extra symbols - AMS
  { cat: 'AMS symbols', tex: '\\boxplus' },
  { cat: 'AMS symbols', tex: '\\boxminus' },
  { cat: 'AMS symbols', tex: '\\boxtimes' },
  { cat: 'AMS symbols', tex: '\\boxdot' },
  { cat: 'AMS symbols', tex: '\\lll' },
  { cat: 'AMS symbols', tex: '\\ggg' },
  { cat: 'AMS symbols', tex: '\\lessgtr' },
  { cat: 'AMS symbols', tex: '\\gtrless' },
  { cat: 'AMS symbols', tex: '\\twoheadrightarrow' },
  { cat: 'AMS symbols', tex: '\\twoheadleftarrow' },
  { cat: 'AMS symbols', tex: '\\rightarrowtail' },
  { cat: 'AMS symbols', tex: '\\leftarrowtail' },
  { cat: 'AMS symbols', tex: '\\rightrightarrows' },
  { cat: 'AMS symbols', tex: '\\leftleftarrows' },
  { cat: 'AMS symbols', tex: '\\rightleftarrows' },
  { cat: 'AMS symbols', tex: '\\leftrightarrows' },
  { cat: 'AMS symbols', tex: '\\Rsh' },
  { cat: 'AMS symbols', tex: '\\Lsh' },
  { cat: 'AMS symbols', tex: '\\circlearrowleft' },
  { cat: 'AMS symbols', tex: '\\circlearrowright' },
  { cat: 'AMS symbols', tex: '\\curvearrowleft' },
  { cat: 'AMS symbols', tex: '\\curvearrowright' },
  { cat: 'AMS symbols', tex: '\\multimap' },
  { cat: 'AMS symbols', tex: '\\upuparrows' },
  { cat: 'AMS symbols', tex: '\\downdownarrows' },
  { cat: 'AMS symbols', tex: '\\upharpoonright' },
  { cat: 'AMS symbols', tex: '\\upharpoonleft' },
  { cat: 'AMS symbols', tex: '\\downharpoonright' },
  { cat: 'AMS symbols', tex: '\\downharpoonleft' },
  { cat: 'AMS symbols', tex: '\\rightleftharpoons' },
  { cat: 'AMS symbols', tex: '\\leftrightharpoons' },
  // AMS relations
  { cat: 'AMS relations', tex: '\\nleq' },
  { cat: 'AMS relations', tex: '\\ngeq' },
  { cat: 'AMS relations', tex: '\\nless' },
  { cat: 'AMS relations', tex: '\\ngtr' },
  { cat: 'AMS relations', tex: '\\nprec' },
  { cat: 'AMS relations', tex: '\\nsucc' },
  { cat: 'AMS relations', tex: '\\subsetneq' },
  { cat: 'AMS relations', tex: '\\supsetneq' },
  { cat: 'AMS relations', tex: '\\nsubseteq' },
  { cat: 'AMS relations', tex: '\\nsupseteq' },
  { cat: 'AMS relations', tex: '\\trianglelefteq' },
  { cat: 'AMS relations', tex: '\\trianglerighteq' },
  { cat: 'AMS relations', tex: '\\vartriangleleft' },
  { cat: 'AMS relations', tex: '\\vartriangleright' },
  { cat: 'AMS relations', tex: '\\ntriangleleft' },
  { cat: 'AMS relations', tex: '\\ntriangleright' },
  { cat: 'AMS relations', tex: '\\ntrianglelefteq' },
  { cat: 'AMS relations', tex: '\\ntrianglerighteq' },
  { cat: 'AMS relations', tex: '\\between' },
  { cat: 'AMS relations', tex: '\\pitchfork' },
  { cat: 'AMS relations', tex: '\\backepsilon' },
  { cat: 'AMS relations', tex: '\\smallsmile' },
  { cat: 'AMS relations', tex: '\\smallfrown' },
  { cat: 'AMS relations', tex: '\\Subset' },
  { cat: 'AMS relations', tex: '\\Supset' },
  { cat: 'AMS relations', tex: '\\sqsubset' },
  { cat: 'AMS relations', tex: '\\sqsupset' },
  { cat: 'AMS relations', tex: '\\bumpeq' },
  { cat: 'AMS relations', tex: '\\Bumpeq' },
  { cat: 'AMS relations', tex: '\\doteq' },
  { cat: 'AMS relations', tex: '\\doteqdot' },
  { cat: 'AMS relations', tex: '\\fallingdotseq' },
  { cat: 'AMS relations', tex: '\\risingdotseq' },
  { cat: 'AMS relations', tex: '\\eqcirc' },
  { cat: 'AMS relations', tex: '\\circeq' },
  { cat: 'AMS relations', tex: '\\triangleq' },
  { cat: 'AMS relations', tex: '\\thicksim' },
  { cat: 'AMS relations', tex: '\\thickapprox' },
  { cat: 'AMS relations', tex: '\\backsim' },
  { cat: 'AMS relations', tex: '\\backsimeq' },
  { cat: 'AMS relations', tex: '\\vDash' },
  { cat: 'AMS relations', tex: '\\Vdash' },
  { cat: 'AMS relations', tex: '\\Vvdash' },
  // AMS operators
  { cat: 'AMS binary ops', tex: '\\intercal' },
  { cat: 'AMS binary ops', tex: '\\veebar' },
  { cat: 'AMS binary ops', tex: '\\barwedge' },
  { cat: 'AMS binary ops', tex: '\\doublebarwedge' },
  { cat: 'AMS binary ops', tex: '\\curlywedge' },
  { cat: 'AMS binary ops', tex: '\\curlyvee' },
  { cat: 'AMS binary ops', tex: '\\ltimes' },
  { cat: 'AMS binary ops', tex: '\\rtimes' },
  { cat: 'AMS binary ops', tex: '\\leftthreetimes' },
  { cat: 'AMS binary ops', tex: '\\rightthreetimes' },
  { cat: 'AMS binary ops', tex: '\\circleddash' },
  { cat: 'AMS binary ops', tex: '\\circledast' },
  { cat: 'AMS binary ops', tex: '\\circledcirc' },
  { cat: 'AMS binary ops', tex: '\\centerdot' },
  { cat: 'AMS binary ops', tex: '\\divideontimes' },
  { cat: 'AMS binary ops', tex: '\\dotplus' },
  { cat: 'AMS binary ops', tex: '\\Cap' },
  { cat: 'AMS binary ops', tex: '\\Cup' },
  // AMS misc symbols
  { cat: 'AMS misc', tex: '\\smallint' },
  { cat: 'AMS misc', tex: '\\eth' },
  { cat: 'AMS misc', tex: '\\mho' },
  { cat: 'AMS misc', tex: '\\Finv' },
  { cat: 'AMS misc', tex: '\\Game' },
  { cat: 'AMS misc', tex: '\\digamma' },
  { cat: 'AMS misc', tex: '\\varkappa' },
  { cat: 'AMS misc', tex: '\\varpi' },
  { cat: 'AMS misc', tex: '\\varrho' },
  { cat: 'AMS misc', tex: '\\varsigma' },
  { cat: 'AMS misc', tex: '\\varphi' },
  { cat: 'AMS misc', tex: '\\vartheta' },
  { cat: 'AMS misc', tex: '\\varepsilon' },
  { cat: 'AMS misc', tex: '\\hslash' },
  { cat: 'AMS misc', tex: '\\Bbbk' },
  { cat: 'AMS misc', tex: '\\circledS' },
  { cat: 'AMS misc', tex: '\\circledR' },
  { cat: 'AMS misc', tex: '\\lozenge' },
  { cat: 'AMS misc', tex: '\\blacklozenge' },
  { cat: 'AMS misc', tex: '\\blacktriangle' },
  { cat: 'AMS misc', tex: '\\blacktriangledown' },
  { cat: 'AMS misc', tex: '\\blacksquare' },
  { cat: 'AMS misc', tex: '\\square' },
  { cat: 'AMS misc', tex: '\\bigstar' },
  { cat: 'AMS misc', tex: '\\sphericalangle' },
  { cat: 'AMS misc', tex: '\\measuredangle' },
  { cat: 'AMS misc', tex: '\\diagup' },
  { cat: 'AMS misc', tex: '\\diagdown' },
  { cat: 'AMS misc', tex: '\\maltese' },
  // Spacing & layout
  { cat: 'Layout', tex: '\\rule{1em}{1pt}' },
  { cat: 'Layout', tex: '\\kern{1em}' },
  { cat: 'Layout', tex: '\\mkern{18mu}' },
  { cat: 'Layout', tex: '\\hspace{1em}' },
  { cat: 'Layout', tex: '\\smash{x}' },
  { cat: 'Layout', tex: '\\vphantom{x}' },
  { cat: 'Layout', tex: '\\hphantom{x}' },
  // Fraction variants
  { cat: 'Fraction variants', tex: '\\cfrac{1}{1+\\cfrac{1}{2}}' },
  // operatorname variants
  { cat: 'Operator variants', tex: '\\operatorname*{argmax}_{x}' },
  // Negations
  { cat: 'Negation', tex: '\\not\\equiv' },
  { cat: 'Negation', tex: '\\not\\sim' },
  { cat: 'Negation', tex: '\\not\\approx' },
  // Big delimiters
  { cat: 'Big delimiters', tex: '\\big( \\Big( \\bigg( \\Bigg(' },
  { cat: 'Big delimiters', tex: '\\bigl( x \\bigr)' },
  // Integrals
  { cat: 'Integrals', tex: '\\iiiint' },
  { cat: 'Integrals', tex: '\\idotsint' },
  // Math alphabets
  { cat: 'Math alphabets', tex: '\\boldsymbol{\\alpha}' },
  { cat: 'Math alphabets', tex: '\\pmb{x}' },
  { cat: 'Math alphabets', tex: '\\bm{x}' },
  // Misc commands
  { cat: 'Misc commands', tex: '\\mathstrut' },
  { cat: 'Misc commands', tex: '\\strut' },
  { cat: 'Misc commands', tex: '\\dddot{x}' },
  { cat: 'Misc commands', tex: '\\ddddot{x}' },
  { cat: 'Misc commands', tex: '\\overleftrightarrow{AB}' },
  { cat: 'Misc commands', tex: '\\underleftarrow{AB}' },
  { cat: 'Misc commands', tex: '\\underrightarrow{AB}' },
  { cat: 'Misc commands', tex: '\\underleftrightarrow{AB}' },
  // Text with nested math
  { cat: 'Nested text/math', tex: '\\text{if $x > 0$}' },
];

// Run tests
const results = { luamml_only_fail: [], katex_only_fail: [], mathjax_only_fail: [], all_fail: [], all_pass: [] };
const luammlFails = [];

for (const e of expressions) {
  const l = tryLuamml(e.tex);
  const k = tryKatex(e.tex);
  const m = tryMathjax(e.tex);

  if (!l.ok && k.ok && m.ok) {
    luammlFails.push({ ...e, luamml: l, katex: k, mathjax: m, who: 'luamml-only' });
  } else if (!l.ok && k.ok) {
    luammlFails.push({ ...e, luamml: l, katex: k, mathjax: m, who: 'luamml+mj-fail' });
  } else if (!l.ok && m.ok) {
    luammlFails.push({ ...e, luamml: l, katex: k, mathjax: m, who: 'luamml+katex-fail' });
  } else if (l.ok && !k.ok) {
    results.katex_only_fail.push({ ...e, katex: k });
  } else if (l.ok && !m.ok) {
    results.mathjax_only_fail.push({ ...e, mathjax: m });
  } else if (!l.ok && !k.ok && !m.ok) {
    results.all_fail.push(e);
  } else {
    results.all_pass.push(e);
  }
}

// Group luamml failures by category
const failsByCategory = {};
for (const f of luammlFails) {
  if (!failsByCategory[f.cat]) failsByCategory[f.cat] = [];
  failsByCategory[f.cat].push(f);
}

console.log('=== FEATURES MISSING FROM LuaMML ===\n');
for (const [cat, items] of Object.entries(failsByCategory)) {
  console.log(`## ${cat}`);
  for (const item of items) {
    const failType = item.luamml.type === 'merror' ? '(produces <merror>)' : `(throws: ${item.luamml.msg || ''})`;
    const katexStatus = item.katex.ok ? 'KaTeX: OK' : 'KaTeX: FAIL';
    const mjStatus = item.mathjax.ok ? 'MathJax: OK' : 'MathJax: FAIL';
    console.log(`  ${item.tex.padEnd(40)} ${failType.padEnd(45)} ${katexStatus}, ${mjStatus}`);
  }
  console.log();
}

console.log(`\n=== SUMMARY ===`);
console.log(`All 3 pass:       ${results.all_pass.length}`);
console.log(`LuaMML-only fail: ${luammlFails.filter(f => f.who === 'luamml-only').length}`);
console.log(`LuaMML+MJ fail:   ${luammlFails.filter(f => f.who === 'luamml+mj-fail').length}`);
console.log(`LuaMML+KaTeX fail:${luammlFails.filter(f => f.who === 'luamml+katex-fail').length}`);
console.log(`KaTeX-only fail:  ${results.katex_only_fail.length}`);
console.log(`MathJax-only fail:${results.mathjax_only_fail.length}`);
console.log(`All 3 fail:       ${results.all_fail.length}`);

if (results.katex_only_fail.length) {
  console.log('\n=== LuaMML PASSES but KaTeX FAILS ===');
  for (const e of results.katex_only_fail) {
    console.log(`  ${e.tex.padEnd(40)} ${e.katex.msg || e.katex.type}`);
  }
}

if (results.mathjax_only_fail.length) {
  console.log('\n=== LuaMML PASSES but MathJax FAILS ===');
  for (const e of results.mathjax_only_fail) {
    console.log(`  ${e.tex.padEnd(40)} ${e.mathjax.type}`);
  }
}

if (results.all_fail.length) {
  console.log('\n=== ALL 3 FAIL ===');
  for (const e of results.all_fail) console.log(`  ${e.tex}`);
}
