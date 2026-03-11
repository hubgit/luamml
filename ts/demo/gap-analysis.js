#!/usr/bin/env node
// Gap analysis: find KaTeX commands that LuaMML doesn't support.
// Usage: node demo/gap-analysis.js

import { renderToString } from '../dist/latex.js';

// All KaTeX commands organized by category, with test expressions
const katexCommands = {
  // --- Accents missing from LuaMML ---
  'Accents': [
    ['\\ddddot{x}', '\\ddddot'],
    ['\\utilde{x}', '\\utilde'],
    ['\\widecheck{x}', '\\widecheck'],
    ['\\underleftarrow{x}', '\\underleftarrow'],
    ['\\underrightarrow{x}', '\\underrightarrow'],
    ['\\overleftharpoon{x}', '\\overleftharpoon'],
    ['\\overrightharpoon{x}', '\\overrightharpoon'],
    ['\\overleftrightarrow{x}', '\\overleftrightarrow'],
    ['\\underleftrightarrow{x}', '\\underleftrightarrow'],
    ['\\overgroup{x}', '\\overgroup'],
    ['\\undergroup{x}', '\\undergroup'],
    ['\\Overrightarrow{x}', '\\Overrightarrow'],
    ['\\overlinesegment{x}', '\\overlinesegment'],
    ['\\underlinesegment{x}', '\\underlinesegment'],
    ['\\underbar{x}', '\\underbar'],
  ],

  // --- Delimiters ---
  'Delimiters': [
    ['\\lparen', '\\lparen'],
    ['\\rparen', '\\rparen'],
    ['\\lang x \\rang', '\\lang/\\rang'],
    ['\\lBrace x \\rBrace', '\\lBrace/\\rBrace'],
    ['\\ulcorner', '\\ulcorner'],
    ['\\urcorner', '\\urcorner'],
    ['\\llcorner', '\\llcorner'],
    ['\\lrcorner', '\\lrcorner'],
    ['\\llbracket x \\rrbracket', '\\llbracket/\\rrbracket'],
    ['\\big(', '\\big'],
    ['\\Big(', '\\Big'],
    ['\\bigg(', '\\bigg'],
    ['\\Bigg(', '\\Bigg'],
    ['\\bigl(', '\\bigl'],
    ['\\bigr)', '\\bigr'],
    ['\\bigm|', '\\bigm'],
  ],

  // --- Environments ---
  'Environments': [
    ['\\begin{pmatrix*} a & b \\\\ c & d \\end{pmatrix*}', 'pmatrix*'],
    ['\\begin{bmatrix*} a & b \\\\ c & d \\end{bmatrix*}', 'bmatrix*'],
    ['\\begin{Bmatrix*} a & b \\\\ c & d \\end{Bmatrix*}', 'Bmatrix*'],
    ['\\begin{vmatrix*} a & b \\\\ c & d \\end{vmatrix*}', 'vmatrix*'],
    ['\\begin{Vmatrix*} a & b \\\\ c & d \\end{Vmatrix*}', 'Vmatrix*'],
    ['\\begin{drcases} x \\\\ y \\end{drcases}', 'drcases'],
    ['\\begin{subarray}{l} a \\\\ b \\end{subarray}', 'subarray'],
    ['\\begin{darray}{l} a \\\\ b \\end{darray}', 'darray'],
    ['\\begin{alignat}{2} a &= b & c &= d \\end{alignat}', 'alignat'],
    ['\\begin{alignat*}{2} a &= b & c &= d \\end{alignat*}', 'alignat*'],
    ['\\begin{alignedat}{2} a &= b & c &= d \\end{alignedat}', 'alignedat'],
    ['\\begin{multline} a \\\\ b \\end{multline}', 'multline'],
    ['\\begin{multline*} a \\\\ b \\end{multline*}', 'multline*'],
  ],

  // --- Greek letters (extra KaTeX aliases) ---
  'Greek extras': [
    ['\\Alpha', '\\Alpha'],
    ['\\Beta', '\\Beta'],
    ['\\Epsilon', '\\Epsilon'],
    ['\\Zeta', '\\Zeta'],
    ['\\Eta', '\\Eta'],
    ['\\Iota', '\\Iota'],
    ['\\Kappa', '\\Kappa'],
    ['\\Mu', '\\Mu'],
    ['\\Nu', '\\Nu'],
    ['\\Omicron', '\\Omicron'],
    ['\\Rho', '\\Rho'],
    ['\\Tau', '\\Tau'],
    ['\\Chi', '\\Chi'],
    ['\\omicron', '\\omicron'],
    ['\\varGamma', '\\varGamma'],
    ['\\varDelta', '\\varDelta'],
    ['\\varTheta', '\\varTheta'],
    ['\\varLambda', '\\varLambda'],
    ['\\varXi', '\\varXi'],
    ['\\varPi', '\\varPi'],
    ['\\varSigma', '\\varSigma'],
    ['\\varUpsilon', '\\varUpsilon'],
    ['\\varPhi', '\\varPhi'],
    ['\\varPsi', '\\varPsi'],
    ['\\varOmega', '\\varOmega'],
  ],

  // --- Other letters ---
  'Other letters': [
    ['\\beth', '\\beth'],
    ['\\gimel', '\\gimel'],
    ['\\daleth', '\\daleth'],
    ['\\cnums', '\\cnums'],
    ['\\Complex', '\\Complex'],
    ['\\N', '\\N'],
    ['\\natnums', '\\natnums'],
    ['\\R', '\\R'],
    ['\\reals', '\\reals'],
    ['\\Reals', '\\Reals'],
    ['\\Z', '\\Z'],
  ],

  // --- Logic/Set extras ---
  'Logic extras': [
    ['\\therefore', '\\therefore'],
    ['\\because', '\\because'],
    ['\\set{x}', '\\set'],
    ['\\exist', '\\exist'],
    ['\\isin', '\\isin'],
    ['\\notni', '\\notni'],
  ],

  // --- Big operators extras ---
  'Big ops extras': [
    ['\\oiint', '\\oiint'],
    ['\\oiiint', '\\oiiint'],
    ['\\intop', '\\intop'],
  ],

  // --- Binary operator extras ---
  'Binary op extras': [
    ['\\bigcirc', '\\bigcirc'],
    ['a \\lessdot b', '\\lessdot'],
    ['a \\gtrdot b', '\\gtrdot'],
    ['a \\lhd b', '\\lhd'],
    ['a \\rhd b', '\\rhd'],
    ['a \\unlhd b', '\\unlhd'],
    ['a \\unrhd b', '\\unrhd'],
    ['a \\uplus b', '\\uplus'],
    ['a \\sqcap b', '\\sqcap'],
    ['a \\sqcup b', '\\sqcup'],
    ['a \\smallsetminus b', '\\smallsetminus'],
    ['a \\And b', '\\And'],
  ],

  // --- Relation extras ---
  'Relation extras': [
    ['a \\geqq b', '\\geqq'],
    ['a \\geqslant b', '\\geqslant'],
    ['a \\leqq b', '\\leqq'],
    ['a \\leqslant b', '\\leqslant'],
    ['a \\gtrapprox b', '\\gtrapprox'],
    ['a \\gtreqless b', '\\gtreqless'],
    ['a \\gtreqqless b', '\\gtreqqless'],
    ['a \\gtrsim b', '\\gtrsim'],
    ['a \\eqslantgtr b', '\\eqslantgtr'],
    ['a \\eqslantless b', '\\eqslantless'],
    ['a \\asymp b', '\\asymp'],
    ['a \\bowtie b', '\\bowtie'],
    ['a \\Join b', '\\Join'],
    ['a \\approxeq b', '\\approxeq'],
    ['a \\eqsim b', '\\eqsim'],
    ['a \\curlyeqprec b', '\\curlyeqprec'],
    ['a \\curlyeqsucc b', '\\curlyeqsucc'],
    ['a \\precapprox b', '\\precapprox'],
    ['a \\preccurlyeq b', '\\preccurlyeq'],
    ['a \\precsim b', '\\precsim'],
    ['a \\succapprox b', '\\succapprox'],
    ['a \\succcurlyeq b', '\\succcurlyeq'],
    ['a \\succsim b', '\\succsim'],
    ['a \\subseteqq b', '\\subseteqq'],
    ['a \\supseteqq b', '\\supseteqq'],
    ['a \\shortmid b', '\\shortmid'],
    ['a \\shortparallel b', '\\shortparallel'],
    ['a \\varpropto b', '\\varpropto'],
    ['a \\vartriangle b', '\\vartriangle'],
    ['a \\colonapprox b', '\\colonapprox'],
    ['a \\coloneq b', '\\coloneq'],
    ['a \\colonsim b', '\\colonsim'],
    ['a \\eqcolon b', '\\eqcolon'],
    ['a \\Coloneqq b', '\\Coloneqq'],
    ['a \\dblcolon b', '\\dblcolon'],
  ],

  // --- Negated relation extras ---
  'Negated extras': [
    ['a \\gnapprox b', '\\gnapprox'],
    ['a \\gneq b', '\\gneq'],
    ['a \\gneqq b', '\\gneqq'],
    ['a \\gnsim b', '\\gnsim'],
    ['a \\gvertneqq b', '\\gvertneqq'],
    ['a \\lnapprox b', '\\lnapprox'],
    ['a \\lneq b', '\\lneq'],
    ['a \\lneqq b', '\\lneqq'],
    ['a \\lnsim b', '\\lnsim'],
    ['a \\lvertneqq b', '\\lvertneqq'],
    ['a \\ncong b', '\\ncong'],
    ['a \\ngeqq b', '\\ngeqq'],
    ['a \\ngeqslant b', '\\ngeqslant'],
    ['a \\nleqq b', '\\nleqq'],
    ['a \\nleqslant b', '\\nleqslant'],
    ['a \\nparallel b', '\\nparallel'],
    ['a \\npreceq b', '\\npreceq'],
    ['a \\nshortmid b', '\\nshortmid'],
    ['a \\nshortparallel b', '\\nshortparallel'],
    ['a \\nsim b', '\\nsim'],
    ['a \\nsubseteqq b', '\\nsubseteqq'],
    ['a \\nsucceq b', '\\nsucceq'],
    ['a \\nsupseteqq b', '\\nsupseteqq'],
    ['a \\nvdash b', '\\nvdash'],
    ['a \\nvDash b', '\\nvDash'],
    ['a \\nVDash b', '\\nVDash'],
    ['a \\nVdash b', '\\nVdash'],
    ['a \\precnapprox b', '\\precnapprox'],
    ['a \\precneqq b', '\\precneqq'],
    ['a \\precnsim b', '\\precnsim'],
    ['a \\subsetneqq b', '\\subsetneqq'],
    ['a \\succnapprox b', '\\succnapprox'],
    ['a \\succneqq b', '\\succneqq'],
    ['a \\succnsim b', '\\succnsim'],
    ['a \\supsetneqq b', '\\supsetneqq'],
    ['a \\varsubsetneqq b', '\\varsubsetneqq'],
    ['a \\varsupsetneqq b', '\\varsupsetneqq'],
  ],

  // --- Arrow extras ---
  'Arrow extras': [
    ['\\leftrightsquigarrow', '\\leftrightsquigarrow'],
    ['\\Lleftarrow', '\\Lleftarrow'],
    ['\\looparrowleft', '\\looparrowleft'],
    ['\\looparrowright', '\\looparrowright'],
    ['\\nleftarrow', '\\nleftarrow'],
    ['\\nLeftarrow', '\\nLeftarrow'],
    ['\\nleftrightarrow', '\\nleftrightarrow'],
    ['\\nLeftrightarrow', '\\nLeftrightarrow'],
    ['\\nrightarrow', '\\nrightarrow'],
    ['\\nRightarrow', '\\nRightarrow'],
    ['\\rightsquigarrow', '\\rightsquigarrow'],
    ['\\Rrightarrow', '\\Rrightarrow'],
    ['\\dashleftarrow', '\\dashleftarrow'],
    ['\\dashrightarrow', '\\dashrightarrow'],
    ['\\leadsto', '\\leadsto'],
  ],

  // --- Extensible arrow extras ---
  'Ext arrow extras': [
    ['A \\xtofrom{f} B', '\\xtofrom'],
    ['A \\xRightarrow{f} B', '\\xRightarrow'],
  ],

  // --- Math operator extras ---
  'Operator extras': [
    ['\\arctg x', '\\arctg'],
    ['\\arcctg x', '\\arcctg'],
    ['\\ch x', '\\ch'],
    ['\\cosec x', '\\cosec'],
    ['\\cotg x', '\\cotg'],
    ['\\ctg x', '\\ctg'],
    ['\\cth x', '\\cth'],
    ['\\sh x', '\\sh'],
    ['\\tg x', '\\tg'],
    ['\\th x', '\\th'],
    ['\\argmax', '\\argmax'],
    ['\\argmin', '\\argmin'],
    ['\\injlim', '\\injlim'],
    ['\\varinjlim', '\\varinjlim'],
    ['\\varliminf', '\\varliminf'],
    ['\\varlimsup', '\\varlimsup'],
    ['\\plim', '\\plim'],
    ['\\projlim', '\\projlim'],
    ['\\varprojlim', '\\varprojlim'],
    ['\\operatornamewithlimits{op}', '\\operatornamewithlimits'],
  ],

  // --- Symbol extras ---
  'Symbol extras': [
    ['\\dag', '\\dag'],
    ['\\ddag', '\\ddag'],
    ['\\Dagger', '\\Dagger'],
    ['\\degree', '\\degree'],
    ['\\Box', '\\Box'],
    ['\\diamond', '\\diamond'],
    ['\\Diamond', '\\Diamond'],
    ['\\triangledown', '\\triangledown'],
    ['\\blacktriangleleft', '\\blacktriangleleft'],
    ['\\blacktriangleright', '\\blacktriangleright'],
    ['\\bigtriangledown', '\\bigtriangledown'],
    ['\\bigtriangleup', '\\bigtriangleup'],
    ['\\backprime', '\\backprime'],
    ['\\pounds', '\\pounds'],
    ['\\yen', '\\yen'],
    ['\\minuso', '\\minuso'],
    ['\\colon', '\\colon'],
    ['\\P', '\\P'],
    ['\\S', '\\S'],
    ['\\copyright', '\\copyright'],
  ],

  // --- Font/style extras ---
  'Font extras': [
    ['\\mathnormal{x}', '\\mathnormal'],
    ['\\bold{x}', '\\bold'],
    ['\\boldsymbol{x}', '\\boldsymbol'],
    ['\\bm{x}', '\\bm'],
    ['\\Bbb{R}', '\\Bbb'],
    ['\\frak{g}', '\\frak'],
    ['\\mathsfit{x}', '\\mathsfit'],
    ['\\pmb{x}', '\\pmb'],
    ['\\emph{x}', '\\emph'],
  ],

  // --- Size commands ---
  'Size commands': [
    ['\\tiny x', '\\tiny'],
    ['\\small x', '\\small'],
    ['\\normalsize x', '\\normalsize'],
    ['\\large x', '\\large'],
    ['\\Large x', '\\Large'],
    ['\\LARGE x', '\\LARGE'],
    ['\\huge x', '\\huge'],
    ['\\Huge x', '\\Huge'],
  ],

  // --- Layout extras ---
  'Layout extras': [
    ['\\vcenter{x}', '\\vcenter'],
    ['\\llap{x}', '\\llap'],
    ['\\rlap{x}', '\\rlap'],
    ['\\clap{x}', '\\clap'],
    ['\\angl{n}', '\\angl'],
    ['\\phase{\\theta}', '\\phase'],
    ['\\verb|code|', '\\verb'],
    ['\\nobreak x', '\\nobreak'],
    ['\\allowbreak x', '\\allowbreak'],
    ['\\newline', '\\newline'],
    ['\\limits', '\\limits'],
    ['\\nolimits', '\\nolimits'],
  ],

  // --- Spacing extras ---
  'Spacing extras': [
    ['a \\thinspace b', '\\thinspace'],
    ['a \\medspace b', '\\medspace'],
    ['a \\thickspace b', '\\thickspace'],
    ['a \\nobreakspace b', '\\nobreakspace'],
    ['a \\negmedspace b', '\\negmedspace'],
    ['a \\negthickspace b', '\\negthickspace'],
    ['a \\mskip{3mu} b', '\\mskip'],
    ['a \\hskip{1em} b', '\\hskip'],
    ['a \\mathstrut b', '\\mathstrut'],
  ],

  // --- Atom type overrides ---
  'Atom types': [
    ['\\mathbin{x}', '\\mathbin'],
    ['\\mathclose{x}', '\\mathclose'],
    ['\\mathop{x}', '\\mathop'],
    ['\\mathopen{x}', '\\mathopen'],
    ['\\mathord{x}', '\\mathord'],
    ['\\mathpunct{x}', '\\mathpunct'],
    ['\\mathrel{x}', '\\mathrel'],
  ],

  // --- Macro extras ---
  'Macro extras': [
    ['\\mathchoice{a}{b}{c}{d}', '\\mathchoice'],
  ],

  // --- Braket extras ---
  'Braket extras': [
    ['\\Bra{\\psi}', '\\Bra'],
    ['\\Ket{\\psi}', '\\Ket'],
  ],

  // --- Fraction extras ---
  'Fraction extras': [
    ['a \\brace b', '\\brace'],
    ['a \\brack b', '\\brack'],
  ],
};

// ---------------------------------------------------------------------------
// Test each command
// ---------------------------------------------------------------------------
const missing = {};
const supported = {};
let totalMissing = 0;
let totalSupported = 0;

for (const [category, commands] of Object.entries(katexCommands)) {
  missing[category] = [];
  supported[category] = [];

  for (const [tex, label] of commands) {
    try {
      renderToString(tex);
      supported[category].push(label);
      totalSupported++;
    } catch {
      missing[category].push(label);
      totalMissing++;
    }
  }
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------
console.log(`\nKaTeX Gap Analysis: ${totalMissing} missing, ${totalSupported} already supported\n`);

for (const [category, cmds] of Object.entries(missing)) {
  if (cmds.length === 0) continue;
  console.log(`${category} (${cmds.length} missing):`);
  console.log(`  ${cmds.join(', ')}`);
}

console.log(`\n--- Already supported (${totalSupported}) ---\n`);
for (const [category, cmds] of Object.entries(supported)) {
  if (cmds.length === 0) continue;
  console.log(`${category} (${cmds.length}):`);
  console.log(`  ${cmds.join(', ')}`);
}
