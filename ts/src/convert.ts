/**
 * Core MathML conversion engine.
 * Port of luamml-convert.lua.
 *
 * Converts TeX math node lists to MathML element trees.
 */
import type { MathMLElement, MathNode, TextFamilies } from './types.js';
import { elem } from './types.js';
import { combiningMap } from './data-combining.js';
import { stretchySet } from './data-stretchy.js';
import { properties, noadSubtypes, traverseNodes, isNode, nullDelimiterSpace } from './node-emulation.js';

// Noad subtype constants
const noad_ord = 0, noad_op = 1, noad_oplimits = 2, noad_opnolimits = 3;
const noad_bin = 4, noad_rel = 5, noad_open = 6, noad_close = 7, noad_punct = 8;
const noad_inner = 9, noad_under = 10, noad_over = 11, _noad_vcenter = 12;

// Remap lookup cache: key = (fam << 21 | char) -> Unicode string
const remapLookup = new Map<number, string>();
function getRemapChar(key: number): string {
  let ch = remapLookup.get(key);
  if (ch === undefined) {
    ch = String.fromCodePoint(key & 0x1FFFFF);
    remapLookup.set(key, ch);
  }
  return ch;
}

const digitMap = new Set(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);

const alwaysMo = new Set([
  '%', '&', '.', '/', '\\', '\u00AC', '\u2032', '\u2033', '\u2034',
  '\u2057', '\u2035', '\u2036', '\u2037', '|',
  '\u2200', '\u2201', '\u2203', '\u2202', '\u2204',
]);

/** Sentinel object for space-like core operators. */
const SPACE_LIKE = Symbol('space_like');
type CoreResult = MathMLElement | typeof SPACE_LIKE | null | false;

/** Type guard: is this core result an actual MathML element? */
function isMathMLElement(core: CoreResult): core is MathMLElement {
  return core !== null && core !== false && core !== SPACE_LIKE;
}

// Spacing tables (indexed by subtype, 0-based)
type SpacingRow = (string | 0 | null)[];
const _st: (SpacingRow | null)[] = [
  [0,        '0.167em', '0.167em', '0.167em', '0.222em', '0.278em', 0,        0,        0,        '0.167em', 0,        0,        0],
  ['0.167em','0.167em', '0.167em', '0.167em', null,      '0.278em', 0,        0,        0,        '0.167em', '0.167em','0.167em','0.167em'],
  null, null,
  ['0.222em','0.222em', '0.222em', '0.222em', null,      null,      '0.222em', null,     null,     '0.222em', '0.222em','0.222em','0.222em'],
  ['0.278em','0.278em', '0.278em', '0.278em', null,      0,         '0.278em', 0,        0,        '0.278em', '0.278em','0.278em','0.278em'],
  [0,        0,         0,         0,         null,      0,         0,         0,        0,         0,        0,        0,        0],
  [0,        '0.167em', '0.167em', '0.167em', '0.222em', '0.278em', 0,        0,        0,        '0.167em', 0,        0,        0],
  ['0.167em','0.167em', '0.167em', '0.167em', null,      '0.167em', '0.167em','0.167em','0.167em','0.167em', '0.167em','0.167em','0.167em'],
  ['0.167em','0.167em', '0.167em', '0.167em', '0.222em', '0.278em', '0.167em', 0,       '0.167em','0.167em', '0.167em','0.167em','0.167em'],
  null, null, null,
];

const _sts: (SpacingRow | null)[] = [
  [0,        '0.167em', '0.167em', '0.167em', 0,         0,         0,        0,        0,        0,        0,        0,        0],
  ['0.167em','0.167em', '0.167em', '0.167em', null,      0,         0,        0,        0,        0,        '0.167em','0.167em','0.167em'],
  null, null,
  [0,        0,         0,         0,         null,      null,      0,        null,     null,     0,        0,        0,        0],
  [0,        0,         0,         0,         null,      0,         0,        0,        0,        0,        0,        0,        0],
  [0,        0,         0,         0,         null,      0,         0,        0,        0,        0,        0,        0,        0],
  [0,        '0.167em', '0.167em', '0.167em', 0,         0,         0,        0,        0,        0,        0,        0,        0],
  [0,        0,         0,         0,         null,      0,         0,        0,        0,        0,        0,        0,        0],
  [0,        '0.167em', '0.167em', '0.167em', 0,         0,         0,        0,        0,        0,        0,        0,        0],
  null, null, null,
];

// Fill blanks (op variants and ord variants share rows)
_st[noad_oplimits] = _st[noad_op];
_st[noad_opnolimits] = _st[noad_op];
_sts[noad_oplimits] = _sts[noad_op];
_sts[noad_opnolimits] = _sts[noad_op];
_st[noad_under] = _st[noad_ord];
_st[noad_over] = _st[noad_ord];
_st[12] = _st[noad_ord]; // vcenter
_sts[noad_under] = _sts[noad_ord];
_sts[noad_over] = _sts[noad_ord];
_sts[12] = _sts[noad_ord]; // vcenter

function getSpacing(lastNoad: number, newNoad: number, curStyle: number): string | 0 | null {
  const table = curStyle >= 4 ? _sts : _st;
  const row = table[lastNoad];
  if (!row) return 0;
  return row[newNoad] ?? 0;
}

function subStyle(s: number): number { return Math.floor(s / 4) * 2 + 5; }
function supStyle(s: number): number { return Math.floor(s / 4) * 2 + 4 + s % 2; }

function hasRelevantAttributes(t: MathMLElement): boolean {
  for (const k of Object.keys(t.attrs)) {
    if (!k.includes(':') && k !== 'xmlns') {
      if (t.attrs[k] !== undefined) return true;
    }
  }
  return false;
}

function getProp(n: MathNode, key: string): unknown {
  const p = properties.get(n);
  return p ? (p as Record<string, unknown>)[key] : undefined;
}

function delimToTable(delim: MathNode | null | undefined): [MathMLElement | null, CoreResult] {
  if (!delim) return [null, null];
  const props = properties.get(delim);
  const mathmlCore = props?.mathml_core;
  const mathmlTable = props?.mathml_table ?? (mathmlCore ?? undefined);
  if (mathmlTable !== undefined) return [mathmlTable || null, mathmlCore ?? null];

  const char = delim.small_char!;
  if (char === 0) {
    const result = elem('mspace', [], { width: (nullDelimiterSpace / 65781.76).toFixed(3) + 'pt' });
    return [result, SPACE_LIKE];
  } else {
    const fam = delim.small_fam!;
    const ch = getRemapChar((fam << 21) | char);
    const result = elem('mo', [ch], {
      'tex:family': fam !== 0 ? fam : undefined,
      stretchy: stretchySet.has(ch) ? false : undefined,
      lspace: 0,
      rspace: 0,
    });
    // Store actual and nodes in meta
    result.meta[':nodes'] = [delim];
    result.meta[':actual'] = ch;
    return [result, result];
  }
}

function accToTable(acc: MathNode | null | undefined, _curStyle: number, stretch: boolean): [MathMLElement | null, CoreResult] {
  if (!acc) return [null, null];
  const props = properties.get(acc);
  const mathmlCore = props?.mathml_core;
  const mathmlTable = props?.mathml_table ?? (mathmlCore ?? undefined);
  if (mathmlTable !== undefined) return [mathmlTable || null, mathmlCore ?? null];

  if (acc.id !== 'math_char') {
    throw new Error('confusion');
  }

  const fam = acc.fam!;
  let ch = getRemapChar((fam << 21) | acc.char!);
  ch = combiningMap[ch] || ch;

  let stretchAttr: boolean | undefined = undefined;
  if (stretch !== !stretchySet.has(ch)) {
    // mismatch means no stretchy attr needed (nil in Lua)
    stretchAttr = undefined;
  } else {
    stretchAttr = stretch;
  }

  const result = elem('mo', [ch], {
    'tex:family': fam !== 0 ? fam : undefined,
    stretchy: stretchAttr,
  });
  result.meta[':nodes'] = [acc];
  if (stretchAttr) {
    result.meta[':actual'] = ch;
  }

  return [result, result];
}

function kernelToTable(
  kernel: MathNode | null | undefined,
  curStyle: number,
  textFamilies: TextFamilies,
): [MathMLElement | null, CoreResult] {
  if (!kernel) return [null, null];
  const props = properties.get(kernel);
  const mathmlCore = props?.mathml_core;
  const mathmlTable = props?.mathml_table ?? (mathmlCore ?? undefined);
  if (mathmlTable !== undefined) return [mathmlTable || null, mathmlCore ?? null];

  const id = kernel.id;
  if (id === 'math_char') {
    const fam = kernel.fam!;
    const ch = getRemapChar((fam << 21) | kernel.char!);
    const elemName = digitMap.has(ch) ? 'mn' : 'mi';
    const cpLen = [...ch].length;
    const result = elem(elemName, [ch], {
      'tex:family': fam !== 0 ? fam : undefined,
      mathvariant: cpLen === 1 && elemName === 'mi' && ch.codePointAt(0)! < 0x10000 ? 'normal' : undefined,
    });
    result.meta[':nodes'] = [kernel];
    return [result, result];
  } else if (id === 'sub_box') {
    // In the standalone context, sub_box typically means we have a box.
    // We simplify to an mi with mglyph placeholder.
    const result = elem('mi', [elem('mglyph', [], { 'tex:box': 'true' })]);
    result.meta[':nodes'] = [kernel];
    return [result, result];
  } else if (id === 'sub_mlist') {
    const list = kernel.list as MathNode | null;
    return nodesToTable(list, curStyle, textFamilies);
  } else {
    throw new Error('confusion: unknown kernel id ' + id);
  }
}

function doSubSup(
  t: MathMLElement,
  core: CoreResult,
  n: MathNode,
  curStyle: number,
  textFamilies: TextFamilies,
): [MathMLElement, CoreResult] {
  const [sub] = kernelToTable(n.sub, subStyle(curStyle), textFamilies);
  const [sup] = kernelToTable(n.sup, supStyle(curStyle), textFamilies);
  if (sub) {
    if (sup) {
      return [elem('msubsup', [t, sub, sup]), core];
    } else {
      return [elem('msub', [t, sub]), core];
    }
  } else if (sup) {
    return [elem('msup', [t, sup]), core];
  } else {
    return [t, core];
  }
}

function maybeToMn(noad: MathNode, core: MathMLElement): boolean {
  if (noad.sub || noad.sup) return false;
  const after = noad.next;
  if (!after) return false;
  if (after.id !== 'noad') return false;
  if (after.subtype !== noad_ord) return false;
  const afterNucleus = after.nucleus;
  if (!afterNucleus) return false;
  if (afterNucleus.id !== 'math_char') return false;
  if (!digitMap.has(getRemapChar((afterNucleus.fam! << 21) | afterNucleus.char!))) return false;
  core.tag = 'mn';
  return true;
}

type NoadResult = {
  node: MathMLElement | null;
  core: CoreResult;
  joining: MathMLElement | false | null;
};

function noadToTable(
  noad: MathNode,
  sub: number,
  curStyle: number,
  joining: MathMLElement | false | null,
  binReplacements: Set<MathNode>,
  textFamilies: TextFamilies,
): NoadResult {
  const [nucleus, coreRaw] = kernelToTable(
    noad.nucleus,
    sub === noad_over ? Math.floor(curStyle / 2) * 2 + 1 : curStyle,
    textFamilies,
  );
  // Use explicit CoreResult type to avoid TS over-narrowing
  const core: CoreResult = coreRaw;
  if (!nucleus) return { node: null, core: null, joining: null };

  if (isMathMLElement(core) && core.tag === 'mo' && core.attrs.minsize && !core.attrs.maxsize) {
    core.attrs.maxsize = core.attrs.minsize;
  }

  if (sub === noad_ord && !(binReplacements.has(noad) || (nucleus === core && isMathMLElement(core) && core.children.length === 1 && typeof core.children[0] === 'string' && alwaysMo.has(core.children[0])))) {
    if (isMathMLElement(core) && core.tag === 'mo') {
      delete core.attrs['tex:class'];
      if (!core.attrs.minsize && !core.attrs.movablelimits) {
        core.tag = 'mi';
        delete core.attrs.movablelimits;
        const firstChild = core.children[0];
        if (core.children.length === 1 && typeof firstChild === 'string') {
          const cpLen = [...firstChild].length;
          core.attrs.mathvariant = cpLen === 1 && firstChild.codePointAt(0)! < 0x10000 ? 'normal' : undefined;
        }
        delete core.attrs.stretchy;
        delete core.attrs.lspace;
        delete core.attrs.rspace;
      }
    }
    if (nucleus === core && isMathMLElement(core) && core.children.length === 1) {
      const firstChild = core.children[0];
      if (typeof firstChild === 'string') {
        const isJoiningMn = joining && joining.tag === 'mn' && core.tag === 'mi' && (firstChild === '.' || firstChild === ',') && maybeToMn(noad, core);
        if (isJoiningMn || core.tag === 'mn' || textFamilies[core.attrs['tex:family'] as number ?? 0]) {
          if (joining && core.tag === joining.tag && core.attrs['tex:family'] === joining.attrs['tex:family']) {
            joining.children.push(firstChild);
            const [result] = doSubSup(joining, joining, noad, curStyle, textFamilies);
            if (result === joining) {
              return { node: null, core: joining, joining: joining };
            } else {
              return { node: result, core: joining, joining: false };
            }
          } else if (!noad.sub && !noad.sup) {
            return { node: core, core: core, joining: core };
          }
        }
      }
    }
  } else if (sub === noad_op || sub === noad_oplimits || sub === noad_opnolimits || sub === noad_bin || sub === noad_rel || sub === noad_open
      || sub === noad_close || sub === noad_punct || sub === noad_inner || sub === noad_ord) {
    if (isMathMLElement(core) && core.tag) {
      core.tag = 'mo';
      if (!core.attrs.minsize) {
        const firstChild = core.children[0];
        if (typeof firstChild === 'string' && stretchySet.has(firstChild)) {
          core.attrs.stretchy = false;
        }
      }
      if (core.attrs.mathvariant === 'normal') delete core.attrs.mathvariant;
      core.attrs.lspace = 0;
      core.attrs.rspace = 0;
    }
    nucleus.attrs['tex:class'] = noadSubtypes[sub];

    if ((noad.sup || noad.sub) && (sub === noad_op || sub === noad_oplimits)) {
      if (isMathMLElement(core) && core.tag === 'mo') {
        core.attrs.movablelimits = sub === noad_op;
      }
      const [subEl] = kernelToTable(noad.sub, subStyle(curStyle), textFamilies);
      const [supEl] = kernelToTable(noad.sup, supStyle(curStyle), textFamilies);
      const tag = supEl ? (subEl ? 'munderover' : 'mover') : 'munder';
      const children: MathMLElement[] = [nucleus];
      if (subEl && supEl) {
        children.push(subEl, supEl);
      } else {
        children.push((subEl || supEl)!);
      }
      return { node: elem(tag, children), core, joining: null };
    }
  } else if (sub === noad_under) {
    const result = elem('munder', [nucleus, elem('mo', ['_'])]);
    return { node: result, core, joining: null };
  } else if (sub === noad_over) {
    const result = elem('mover', [nucleus, elem('mo', ['\u203E'])]);
    return { node: result, core, joining: null };
  }

  const [result, resultCore] = doSubSup(nucleus, core, noad, curStyle, textFamilies);
  return { node: result, core: resultCore, joining: null };
}

function accentToTable(
  accent: MathNode,
  sub: number,
  curStyle: number,
  textFamilies: TextFamilies,
): [MathMLElement, CoreResult] {
  const [nucleus, core] = kernelToTable(accent.nucleus, Math.floor(curStyle / 2) * 2 + 1, textFamilies);
  const [topAcc] = accToTable(accent.accent, curStyle, (sub & 1) === 0);
  const [botAcc] = accToTable(accent.bot_accent, curStyle, (sub & 2) === 0);

  const tag = topAcc ? (botAcc ? 'munderover' : 'mover') : 'munder';
  const children: (MathMLElement | null)[] = [nucleus!];
  if (botAcc && topAcc) {
    children.push(botAcc, topAcc);
  } else {
    children.push(botAcc || topAcc);
  }

  const withAccents = elem(tag, children.filter((c): c is MathMLElement => c !== null));
  return doSubSup(withAccents, core, accent, curStyle, textFamilies);
}

const fenceSubLeft = 1;
const radicalSubtypeNames = [
  'radical', 'uradical', 'uroot',
  'uunderdelimiter', 'uoverdelimiter',
  'udelimiterunder', 'udelimiterover',
];

function radicalToTable(
  radical: MathNode,
  sub: number,
  curStyle: number,
  textFamilies: TextFamilies,
): [MathMLElement, CoreResult] {
  const kind = radicalSubtypeNames[sub];
  const [nucleus] = kernelToTable(radical.nucleus, Math.floor(curStyle / 2) * 2 + 1, textFamilies);
  const [left] = delimToTable(radical.left);

  let result: MathMLElement;
  let core: CoreResult = null;

  if (kind === 'radical' || kind === 'uradical') {
    result = elem('msqrt', nucleus ? [nucleus] : []);
    result.meta[':artifact'] = true;
    if (left) result.meta[':nodes'] = left.meta[':nodes'];
  } else if (kind === 'uroot') {
    const [degree] = kernelToTable(radical.denom ?? radical.nucleus, 7, textFamilies);
    result = elem('mroot', nucleus && degree ? [nucleus, degree] : nucleus ? [nucleus] : []);
    result.meta[':artifact'] = true;
    if (left) result.meta[':nodes'] = left.meta[':nodes'];
  } else if (kind === 'uunderdelimiter') {
    result = elem('munder', left && nucleus ? [left, nucleus] : []);
    core = left;
  } else if (kind === 'uoverdelimiter') {
    result = elem('mover', left && nucleus ? [left, nucleus] : []);
    core = left;
  } else if (kind === 'udelimiterunder') {
    result = elem('munder', nucleus && left ? [nucleus, left] : []);
  } else if (kind === 'udelimiterover') {
    result = elem('mover', nucleus && left ? [nucleus, left] : []);
  } else {
    throw new Error('confusion');
  }

  return doSubSup(result, core, radical, curStyle, textFamilies);
}

function fractionToTable(
  fraction: MathNode,
  _sub: number,
  curStyle: number,
  textFamilies: TextFamilies,
): [MathMLElement, CoreResult] {
  const [num] = kernelToTable(fraction.num, curStyle + 2 - Math.floor(curStyle / 6) * 2, textFamilies);
  const [denom] = kernelToTable(fraction.denom, Math.floor(curStyle / 2) * 2 + 3 - Math.floor(curStyle / 6) * 2, textFamilies);
  const [left] = delimToTable(fraction.left);
  const [right] = delimToTable(fraction.right);

  const mfrac = elem('mfrac', [], {
    linethickness: fraction.width !== undefined && fraction.width === 0 ? 0 : undefined,
    bevelled: fraction.middle ? 'true' : undefined,
  });
  mfrac.meta[':nodes'] = [fraction];
  mfrac.meta[':artifact'] = true;
  if (num) mfrac.children.push(num);
  if (denom) mfrac.children.push(denom);

  if (left) {
    const children: MathMLElement[] = [left, mfrac];
    if (right) children.push(right);
    return [elem('mrow', children), null];
  } else if (right) {
    return [elem('mrow', [mfrac, right]), null];
  } else {
    return [mfrac, null];
  }
}

function fenceToTable(
  fence: MathNode,
  _sub: number,
  _curStyle: number,
): [MathMLElement | null, CoreResult] {
  const [delim, core] = delimToTable(fence.delim);
  if (!core || core === SPACE_LIKE || core.tag !== 'mo') {
    return [delim, core];
  }
  core.attrs.fence = 'true';
  core.attrs.symmetric = 'true';

  const options = fence.options ?? 0;
  if ((fence.height ?? 0) !== 0 || (fence.depth ?? 0) !== 0) {
    const size = ((fence.height ?? 0) + (fence.depth ?? 0)) / 65781.76;
    core.attrs.minsize = size.toFixed(3) + 'pt';
    core.attrs.maxsize = core.attrs.minsize;
  }
  return [delim, core];
}

function spaceToTable(amount: number, sub: number): [MathMLElement | null, CoreResult] {
  if (amount === 0) return [null, null];
  if (sub === 99) {
    // mu units: 18*2^16 = 1179648
    return [elem('mspace', [], { width: (amount / 1179648).toFixed(3) + 'em' }), SPACE_LIKE];
  } else {
    return [elem('mspace', [], { width: (amount / 65781.76).toFixed(3) + 'pt' }), SPACE_LIKE];
  }
}

const RUNNING_LENGTH = -1073741824;

function ruleToTable(rule: MathNode): [MathMLElement, CoreResult] {
  const width = ((rule.width ?? 0) / 65781.76).toFixed(3) + 'pt';
  let height: string;
  if ((rule.height ?? 0) === RUNNING_LENGTH) {
    height = '0.8em';
  } else {
    height = ((rule.height ?? 0) / 65781.76).toFixed(3) + 'pt';
  }
  let depth: string;
  if ((rule.depth ?? 0) === RUNNING_LENGTH) {
    depth = '0.2em';
  } else {
    depth = ((rule.depth ?? 0) / 65781.76).toFixed(3) + 'pt';
  }
  return [elem('mspace', [], { mathbackground: 'currentColor', width, height, depth }), SPACE_LIKE];
}

function cleanupMathbin(head: MathNode | null): Set<MathNode> {
  const replacements = new Set<MathNode>();
  let last: MathNode | number | string = 'open';

  for (const n of traverseNodes(head)) {
    const id = n.id;
    const sub = n.subtype;

    if (id === 'noad') {
      if (sub === noad_bin) {
        if (isNode(last) || last === noad_op || last === noad_oplimits || last === noad_opnolimits
            || last === noad_rel || last === noad_open || last === noad_punct) {
          replacements.add(n);
          n.subtype = noad_ord;
          last = noad_ord;
        } else {
          last = n;
        }
      } else {
        if ((sub === noad_rel || sub === noad_close || sub === noad_punct) && isNode(last)) {
          replacements.add(last);
          last.subtype = noad_ord;
        }
        last = sub;
      }
    } else if (id === 'fence') {
      if (sub === fenceSubLeft) {
        last = noad_open;
      } else {
        if (isNode(last)) {
          replacements.add(last);
          last.subtype = noad_ord;
        }
        last = noad_ord;
      }
    } else if (id === 'fraction' || id === 'radical' || id === 'accent') {
      last = noad_ord;
    }
  }
  if (isNode(last)) {
    replacements.add(last);
    last.subtype = noad_ord;
  }
  return replacements;
}

export function nodesToTable(
  head: MathNode | null,
  curStyle: number,
  textFamilies: TextFamilies,
): [MathMLElement, CoreResult] {
  const binReplacements = head ? cleanupMathbin(head) : new Set<MathNode>();
  const t: MathMLElement = elem('mrow');
  let result = t;
  let nonscript = false;
  let core: CoreResult = SPACE_LIKE;
  let lastNoad: number | null = null;
  let lastCore: MathMLElement | null = null;
  let joining: MathMLElement | false | null = null;

  for (const n of traverseNodes(head)) {
    const id = n.id;
    const sub = n.subtype;
    let newCore: CoreResult = null;
    let newJoining: MathMLElement | false | null = null;
    let newNode: MathMLElement | null = null;
    let newNoad: number | null = null;

    const props = properties.get(n);
    const mathmlCore = props?.mathml_core;
    const mathmlTable = props?.mathml_table ?? (mathmlCore !== undefined ? mathmlCore : undefined);
    if (mathmlTable !== undefined) {
      newNode = mathmlTable || null;
      newCore = mathmlCore ?? null;
    } else if (id === 'noad') {
      const r = noadToTable(n, sub, curStyle, joining, binReplacements, textFamilies);
      if (r.joining === false) {
        // Replace the last element
        t.children[t.children.length - 1] = r.node!;
        newJoining = null;
      } else {
        newNode = r.node;
        newJoining = r.joining;
      }
      newCore = r.core;
      newNoad = sub;
    } else if (id === 'accent') {
      const [accNode, accCore] = accentToTable(n, sub, curStyle, textFamilies);
      newNode = accNode;
      newCore = accCore;
      newNoad = noad_ord;
    } else if (id === 'style') {
      if (sub !== curStyle) {
        if (t.children.length === 0) {
          t.tag = 'mstyle';
        } else {
          const newT = elem('mstyle');
          t.children.push(newT);
          // Note: in the Lua version, `t` changes to the inner mstyle.
          // We handle this differently since we're building a tree.
          // For simplicity, we'll add the mstyle inline.
        }
        if (sub < 2) {
          t.attrs.displaystyle = true;
          t.attrs.scriptlevel = 0;
        } else {
          t.attrs.displaystyle = false;
          t.attrs.scriptlevel = Math.floor(sub / 2) - 1;
        }
        curStyle = sub;
      }
      newCore = SPACE_LIKE;
    } else if (id === 'choice') {
      const size = Math.floor(curStyle / 2);
      const field = size === 0 ? 'display' : size === 1 ? 'text' : size === 2 ? 'script' : 'scriptscript';
      const choiceHead = (n as unknown as Record<string, unknown>)[field] as MathNode | null;
      const [choiceNode] = nodesToTable(choiceHead, 2 * size, textFamilies);
      newNode = choiceNode;
      newCore = SPACE_LIKE;
    } else if (id === 'radical') {
      const [radNode, radCore] = radicalToTable(n, sub, curStyle, textFamilies);
      newNode = radNode;
      newCore = radCore;
      newNoad = noad_ord;
    } else if (id === 'fraction') {
      const [fracNode, fracCore] = fractionToTable(n, sub, curStyle, textFamilies);
      newNode = fracNode;
      newCore = fracCore;
      newNoad = noad_inner;
    } else if (id === 'fence') {
      const [fenceNode, fenceCore] = fenceToTable(n, sub, curStyle);
      newNode = fenceNode;
      newCore = fenceCore;
      const cls = n.class ?? -1;
      newNoad = cls >= 0 ? cls : sub === fenceSubLeft ? noad_open : noad_close;
    } else if (id === 'kern') {
      if (!nonscript) {
        const [kernNode, kernCore] = spaceToTable(n.kern ?? 0, sub);
        newNode = kernNode;
        newCore = kernCore;
      }
    } else if (id === 'glue') {
      if (curStyle >= 4 || !nonscript) {
        if (sub === 98) {
          nonscript = true;
        } else {
          const [glueNode, glueCore] = spaceToTable(n.width ?? 0, sub);
          newNode = glueNode;
          newCore = glueCore;
        }
      }
    } else if (id === 'rule') {
      const [ruleNode, ruleCore] = ruleToTable(n);
      newNode = ruleNode;
      newCore = ruleCore;
    }

    nonscript = false;

    if (core !== null && newCore !== SPACE_LIKE) {
      core = core === SPACE_LIKE ? newCore : null;
    }

    if (newNode) {
      if (newNoad !== null) {
        const space = lastNoad !== null ? getSpacing(lastNoad, newNoad, curStyle) : 0;
        if (space !== null && space !== 0) {
          if (isMathMLElement(newCore) && newCore.tag === 'mo') {
            newCore.attrs.lspace = space;
          } else if (lastCore && lastCore.tag === 'mo') {
            lastCore.attrs.rspace = space;
          } else {
            t.children.push(elem('mspace', [], { width: space }));
          }
        }
        lastNoad = newNoad;
        lastCore = isMathMLElement(newCore) ? newCore : null;
      } else if (newNode.tag !== 'mspace' || newNode.attrs.mathbackground) {
        lastCore = null;
      }

      // Omit completely empty mrows
      if (newNode.tag !== 'mrow' || newNode.children.length > 0 || hasRelevantAttributes(newNode)) {
        t.children.push(newNode);
      }
    }
    joining = newJoining;
  }

  // Simplify single-child mrow
  if (t.tag === 'mrow' && t.children.length === 1 && !hasRelevantAttributes(t)) {
    const child = t.children[0];
    if (typeof child !== 'string') {
      result = child;
    }
  }

  return [result, core];
}

/**
 * Register a font family mapping.
 * Maps character codes from a legacy font encoding to Unicode.
 */
export function registerFamily(family: number, mapping: (number | null)[]): void {
  const base = family << 21;
  for (let i = 0; i < mapping.length; i++) {
    const to = mapping[i];
    if (to !== null && to !== undefined) {
      remapLookup.set(base | i, String.fromCodePoint(to));
    }
  }
}

/**
 * Wrap a MathML tree with the <math> root element.
 */
export function makeRoot(root: MathMLElement, style: number): MathMLElement {
  let result: MathMLElement;
  if (root.tag === 'mrow') {
    result = root;
    result.tag = 'math';
  } else {
    result = elem('math', [root]);
  }
  result.attrs.xmlns = 'http://www.w3.org/1998/Math/MathML';
  result.attrs['xmlns:tex'] = 'http://typesetting.eu/2021/LuaMathML';
  if (style < 2) {
    result.attrs.display = 'block';
  }
  return result;
}

/**
 * Process a math list into a MathML tree.
 * Main entry point matching the Lua `process` export.
 */
export function process(
  head: MathNode | null,
  style: number = 2,
  textFamilies: TextFamilies = {},
): MathMLElement {
  const [result] = nodesToTable(head, style, textFamilies);
  return result;
}
