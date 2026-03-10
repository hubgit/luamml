/**
 * TeX \showlists output parser.
 * Port of pdfmml-showlists.lua.
 *
 * Uses Peggy-generated PEG parser for line-level pattern matching,
 * with procedural recursive descent for list structure (matching the original Lua design).
 */
import type { MathNode, ParsedLog, ParsedMathBlock } from './types.js';
import { properties } from './node-emulation.js';
import { parse as pegParse } from './showlists-parser.js';

/**
 * Try to match a line with a PEG grammar start rule.
 * Returns the parsed result or null if the line doesn't match.
 */
function tryParse<T>(line: string, startRule?: string): T | null {
  try {
    return pegParse(line, startRule ? { startRule } : undefined) as T;
  } catch {
    return null;
  }
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
  const mc = tryParse<MathNode>(content, 'math_char_line');
  if (mc) return [mc, i + 1];

  // Try box
  const isBox = tryParse<boolean>(content, 'box_line');
  if (isBox) {
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

    // Try simple noad (noad, accent, radical, fence, style, kern, glue, etc.)
    let node = tryParse<MathNode>(content, 'node_line');
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
      const frac = tryParse<MathNode>(content, 'fraction_line');
      if (frac) {
        let nextI: number;
        [frac.num, nextI] = parseKernel(lines, i + 1, prefix + '\\', parsed!);
        [frac.denom, nextI] = parseKernel(lines, nextI, prefix + '/', parsed!);
        node = frac;
        i = nextI;
      } else {
        // Try mathchoice
        const choice = tryParse<MathNode>(content, 'mathchoice_line');
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
          const markId = parsed ? tryParse<number>(content, 'mark_whatsit_line') : null;
          if (markId !== null && parsed) {
            skip = true;
            const markContent = parsed.marks[markId];
            if (markContent) {
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

  const countMatch = content.match(/count\s*=\s*(\d+)/);
  if (countMatch) result.count = parseInt(countMatch[1]);

  const offsetMatch = content.match(/offset\s*=\s*(\d+)/);
  if (offsetMatch) result.offset = parseInt(offsetMatch[1]);

  const nucleusMatch = content.match(/nucleus\s*=\s*(true|false)/);
  if (nucleusMatch) result.nucleus = nucleusMatch[1] === 'true';

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
