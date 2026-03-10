/**
 * TeX log file parser.
 * Port of pdfmml-logreader.lua (lpeg-based parser -> PEG grammar via Peggy).
 *
 * Parses LUAMML markers from TeX log files to extract math formula data.
 */
import type { ParsedLog } from './types.js';
import { parse as pegParse } from './logreader-parser.js';

/**
 * Parse a TeX log file content for LuaMML markers.
 */
export function parseLog(content: string): ParsedLog {
  const raw = pegParse(content);

  // Compute final counts from precount/postcount
  const count: Record<number, number> = {};
  for (const [id, pre] of Object.entries(raw.precount)) {
    const post = raw.postcount[parseInt(id)];
    if (post === undefined) throw new Error('Unbalanced count');
    count[parseInt(id)] = post - (pre as number);
  }

  return {
    groups: raw.groups as ParsedLog['groups'],
    marks: raw.marks,
    instructions: raw.instructions,
    count,
    mathml: {},
  };
}

/**
 * Parse a log file from a file path.
 */
export async function parseLogFile(filename: string): Promise<ParsedLog> {
  const { readFile } = await import('node:fs/promises');
  const content = await readFile(filename, 'utf-8');
  return parseLog(content);
}
