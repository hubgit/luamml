/**
 * TeX \showlists output parser.
 * Port of pdfmml-showlists.lua.
 *
 * Parses the textual dump of TeX math lists into MathNode linked-list structures.
 */
import type { MathNode, ParsedLog, ParsedMathBlock } from './types.js';
import { properties } from './node-emulation.js';

/** Parse a ^^XX hex escape or literal char into a code point. */
function parseTexChar(s: string, pos: number): [number, number] {
  if (s.startsWith('^^', pos)) {
    const c1 = s.charCodeAt(pos + 2);
    const c2 = s.charCodeAt(pos + 3);
    // Check if two hex digits
    if (isHexDigit(c1) && isHexDigit(c2)) {
      return [parseInt(s.substring(pos + 2, pos + 4), 16), pos + 4];
    }
    // Otherwise single character after ^^
    const ch = s.charCodeAt(pos + 2);
    if (ch >= 0 && ch <= 0x3F) {
      return [ch + 0x40, pos + 3];
    } else if (ch >= 0x40 && ch <= 0x7F) {
      return [ch - 0x40, pos + 3];
    }
  }
  return [s.charCodeAt(pos), pos + 1];
}

function isHexDigit(c: number): boolean {
  return (c >= 0x30 && c <= 0x39) || (c >= 0x61 && c <= 0x66);
}

function parseScaled(s: string): number {
  const n = parseFloat(s);
  return Math.floor(n * 0x10000 + 0.5);
}

function parseDelimiterCode(hex: string): MathNode {
  const code = parseInt(hex, 16);
  return {
    id: 'delim',
    subtype: 0,
    small_fam: (code >> 20) & 0xF,
    small_char: (code >> 12) & 0xFF,
    large_fam: (code >> 8) & 0xF,
    large_char: code & 0xFF,
  };
}

/** Parse a single line as a math_char: \fam<N> <char> */
function parseMathChar(line: string): MathNode | null {
  const m = line.match(/^\\fam(\d+) (.+)$/);
  if (!m) return null;
  const fam = parseInt(m[1]);
  const charStr = m[2];
  const [charCode] = parseTexChar(charStr, 0);
  return { id: 'math_char', subtype: 0, fam, char: charCode };
}

/**
 * Parse a simple noad from a line (noads, fences, styles, etc.).
 */
function parseSimpleNoad(line: string): MathNode | null {
  // Simple noads: \mathord, \mathop, \mathbin, etc.
  const noadMap: Record<string, number> = {
    'mathord': 0, 'mathopen': 6,
    'mathop\\limits': 2, 'mathop\\nolimits': 3, 'mathop': 1,
    'mathbin': 4, 'mathrel': 5,
    'mathclose': 7, 'mathpunct': 8, 'mathinner': 9,
    'mathunder': 10, 'mathover': 11, 'mathvcenter': 12,
  };
  for (const [prefix, subtype] of Object.entries(noadMap)) {
    if (line === '\\' + prefix) {
      return { id: 'noad', subtype };
    }
  }

  // Radical: \radical"HEXCODE
  const radicalMatch = line.match(/^\\radical"([0-9A-Fa-f]+)$/);
  if (radicalMatch) {
    return { id: 'radical', subtype: 0, left: parseDelimiterCode(radicalMatch[1]) };
  }

  // Accent: \accent followed by math_char
  const accentMatch = line.match(/^\\accent(\\fam\d+ .+)$/);
  if (accentMatch) {
    const accChar = parseMathChar(accentMatch[1]);
    return { id: 'accent', subtype: 0, accent: accChar };
  }

  // Fences: \left, \middle, \right followed by delimiter code
  const fenceMatch = line.match(/^\\(left|middle|right)"([0-9A-Fa-f]+)$/);
  if (fenceMatch) {
    const fenceSubtypes: Record<string, number> = { left: 1, middle: 2, right: 3 };
    return {
      id: 'fence',
      subtype: fenceSubtypes[fenceMatch[1]],
      delim: parseDelimiterCode(fenceMatch[2]),
      options: 0, height: 0, depth: 0, class: -1,
    };
  }

  // Style: \displaystyle, \textstyle, etc.
  const styleMap: Record<string, number> = {
    'displaystyle': 0, 'textstyle': 2,
    'scriptscriptstyle': 6, 'scriptstyle': 4,
  };
  for (const [name, subtype] of Object.entries(styleMap)) {
    if (line === '\\' + name) {
      return { id: 'style', subtype };
    }
  }

  // Math kern: \mkernXXpt
  const mkernMatch = line.match(/^\\mkern(-?[\d.]+)mu$/);
  if (mkernMatch) {
    return { id: 'kern', subtype: 99, kern: parseScaled(mkernMatch[1]) };
  }

  // Math glue: \glue(\mskip) XXmu
  const mskipMatch = line.match(/^\\glue\(\\mskip\) (-?[\d.]+)mu/);
  if (mskipMatch) {
    return { id: 'glue', subtype: 99, width: parseScaled(mskipMatch[1]) };
  }

  // Nonscript glue
  if (line === '\\glue(\\nonscript)') {
    return { id: 'glue', subtype: 98 };
  }

  // Regular kern
  const kernMatch = line.match(/^\\kern ?(-?[\d.]+)(?:\s|$)/);
  if (kernMatch) {
    return { id: 'kern', subtype: 0, kern: parseScaled(kernMatch[1]) };
  }

  // Regular glue
  const glueMatch = line.match(/^\\glue(?:\(\\(\w+)skip\))? (-?[\d.]+)/);
  if (glueMatch) {
    const subtypeMap: Record<string, number> = {
      line: 1, baseline: 2, par: 3, abovedisplay: 4, belowdisplay: 5,
      abovedisplayshort: 6, belowdisplayshort: 7, left: 8, right: 9,
      top: 10, splittop: 11, tab: 12, space: 13, xspace: 14, parfill: 15,
      math: 16, thinmu: 17, medmu: 18, thickmu: 19,
    };
    return {
      id: 'glue',
      subtype: glueMatch[1] ? (subtypeMap[glueMatch[1]] ?? 0) : 0,
      width: parseScaled(glueMatch[2]),
    };
  }

  // Rule
  const ruleMatch = line.match(/^\\rule\((-?[\d.]+|\*)\+(-?[\d.]+|\*)\)x(-?[\d.]+|\*)$/);
  if (ruleMatch) {
    const parseHDW = (s: string) => s === '*' ? -0x40000000 : parseScaled(s);
    return {
      id: 'rule', subtype: 0,
      height: parseHDW(ruleMatch[1]),
      depth: parseHDW(ruleMatch[2]),
      width: parseHDW(ruleMatch[3]),
    };
  }

  // Penalty
  const penaltyMatch = line.match(/^\\penalty (-?\d+)$/);
  if (penaltyMatch) {
    return { id: 'penalty', subtype: 0, penalty: parseInt(penaltyMatch[1]) };
  }

  return null;
}

/** Parse a fraction noad. */
function parseFraction(line: string): MathNode | null {
  const m = line.match(/^\\fraction, thickness (= default|[\d.-]+)(, left-delimiter "([0-9A-Fa-f]+))?(, right-delimiter "([0-9A-Fa-f]+))?$/);
  if (!m) return null;
  return {
    id: 'fraction',
    subtype: 0,
    width: m[1] === '= default' ? 0x40000000 : parseScaled(m[1]),
    left: m[3] ? parseDelimiterCode(m[3]) : undefined,
    right: m[5] ? parseDelimiterCode(m[5]) : undefined,
  };
}

/** Parse a mathchoice noad. */
function parseMathchoice(line: string): MathNode | null {
  if (line === '\\mathchoice') {
    return { id: 'choice', subtype: 0 };
  }
  return null;
}

/** Parse a box line. */
function parseBox(line: string): boolean {
  return /^\\[hv]box\(/.test(line);
}

/** Check for mark whatsit. */
function parseMarkWhatsit(line: string): number | null {
  const m = line.match(/^\\write-?\d+\{LUAMML_MARK_REF:(\d+):/);
  return m ? parseInt(m[1]) : null;
}

/**
 * Parse a kernel (nucleus/sub/sup) from the list lines.
 */
function parseKernel(
  lines: string[],
  i: number,
  prefix: string,
  parsed: ParsedLog,
): [MathNode | null, number] {
  if (i >= lines.length) return [null, i];
  const line = lines[i];
  if (!line.startsWith(prefix)) return [null, i];
  const content = line.substring(prefix.length);

  // Try math_char
  const mc = parseMathChar(content);
  if (mc) return [mc, i + 1];

  // Try box
  if (parseBox(content)) {
    return skipList(lines, i + 1, prefix + '.');
  }

  // Otherwise it's a sub_mlist
  const [head, nextI] = parseList(lines, i, prefix, parsed);
  return [{ id: 'sub_mlist', subtype: 0, list: head }, nextI];
}

function skipList(lines: string[], i: number, prefix: string): [MathNode, number] {
  while (i < lines.length && lines[i].startsWith(prefix)) {
    i++;
  }
  return [{ id: 'sub_box', subtype: 0, list: { head: null } }, i];
}

/**
 * Parse a linked list of math nodes from showlists output lines.
 */
export function parseList(
  lines: string[],
  startI: number = 0,
  prefix: string = '',
  parsed?: ParsedLog,
): [MathNode | null, number] {
  let i = startI;
  let head: MathNode | null = null;
  let last: MathNode | null = null;

  let currentMark: Record<string, unknown> | null = null;
  let currentCount = 0;
  let currentOffset = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.startsWith(prefix)) break;
    const content = line.substring(prefix.length);

    let skip = false;

    // Try simple noad
    let node = parseSimpleNoad(content);
    if (node) {
      if (node.id === 'noad' || node.id === 'accent' || node.id === 'radical') {
        node.nucleus = null;
        let nextI: number;
        [node.nucleus, nextI] = parseKernel(lines, i + 1, prefix + '.', parsed!);
        [node.sup, nextI] = parseKernel(lines, nextI, prefix + '^', parsed!);
        [node.sub, nextI] = parseKernel(lines, nextI, prefix + '_', parsed!);
        i = nextI;
      } else {
        i++;
      }
    } else {
      // Try fraction
      const frac = parseFraction(content);
      if (frac) {
        let nextI: number;
        [frac.num, nextI] = parseKernel(lines, i + 1, prefix + '\\', parsed!);
        [frac.denom, nextI] = parseKernel(lines, nextI, prefix + '/', parsed!);
        node = frac;
        i = nextI;
      } else {
        // Try mathchoice
        const choice = parseMathchoice(content);
        if (choice) {
          let nextI: number;
          [choice.display, nextI] = parseList(lines, i + 1, prefix + 'D', parsed!);
          [choice.text, nextI] = parseList(lines, nextI, prefix + 'T', parsed!);
          [choice.script, nextI] = parseList(lines, nextI, prefix + 'S', parsed!);
          [choice.scriptscript, nextI] = parseList(lines, nextI, prefix + 's', parsed!);
          node = choice;
          i = nextI;
        } else {
          // Check for mark whatsit
          const markId = parsed ? parseMarkWhatsit(content) : null;
          if (markId !== null && parsed) {
            skip = true;
            const markContent = parsed.marks[markId];
            if (markContent) {
              // Parse mark content - simplified version of the Lua load() approach
              const markTable = parseMarkTable(markContent, parsed);
              if (currentMark) {
                if (((markTable.count as number) ?? 1) > currentCount) {
                  throw new Error('Invalid mark nesting');
                }
              } else {
                currentMark = markTable;
                currentCount = (markTable.count as number) ?? 1;
                currentOffset = (markTable.offset as number) ?? currentCount;
              }
            }
            i++;
          } else {
            skip = true;
            i++;
          }
        }
      }
    }

    if (node) {
      if (last) {
        node.prev = last;
        last.next = node;
      }
      last = node;
      if (!head) head = node;
    }

    if (!skip && currentMark && last) {
      currentCount--;
      currentOffset--;
      if (currentOffset === 0) {
        const target = currentMark.nucleus ? last.nucleus! : last;
        const p = properties.get(target) || {};
        p.mathml_core = (currentMark.core as any) ?? undefined;
        properties.set(target, p);
      } else {
        const p = properties.get(last) || {};
        p.mathml_core = false;
        properties.set(last, p);
      }
      if (currentCount === 0) currentMark = null;
    }
  }

  return [head, i];
}

/**
 * Parse a mark table from its string content.
 * In Lua this uses load('return {' + content + '}').
 * We parse a simplified subset.
 */
function parseMarkTable(content: string, _parsed: ParsedLog): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  // Parse key = value pairs
  const countMatch = content.match(/count\s*=\s*(\d+)/);
  if (countMatch) result.count = parseInt(countMatch[1]);

  const offsetMatch = content.match(/offset\s*=\s*(\d+)/);
  if (offsetMatch) result.offset = parseInt(offsetMatch[1]);

  const nucleusMatch = content.match(/nucleus\s*=\s*(true|false)/);
  if (nucleusMatch) result.nucleus = nucleusMatch[1] === 'true';

  // core = false
  if (/core\s*=\s*false/.test(content)) {
    result.core = false;
  }

  return result;
}

/**
 * Parse a showlists block (from a ParsedMathBlock) into a MathNode list.
 */
export function parseShowlists(
  block: ParsedMathBlock,
  parsed: ParsedLog,
): MathNode | null {
  const [head] = parseList(block.lines, 0, '', parsed);
  return head;
}
