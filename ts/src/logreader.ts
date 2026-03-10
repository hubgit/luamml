/**
 * TeX log file parser.
 * Port of pdfmml-logreader.lua (lpeg-based parser -> regex-based parser).
 *
 * Parses LUAMML markers from TeX log files to extract math formula data.
 */
import type { ParsedLog, ParsedGroup, ParsedMathBlock } from './types.js';

/**
 * Parse a TeX log file content for LuaMML markers.
 */
export function parseLog(content: string): ParsedLog {
  const groups: ParsedGroup[] = [];
  const marks: Record<number, string> = {};
  const instructions: string[] = [];
  const precount: Record<number, number> = {};
  const postcount: Record<number, number> = {};

  const lines = content.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // LUAMML_FORMULA_BEGIN:id:flag:tag:label
    const formulaBegin = line.match(/^LUAMML_FORMULA_BEGIN:(\d+):$/);
    if (formulaBegin) {
      i++;
      const group = parseFormulaBlock(lines, i);
      groups[parseInt(formulaBegin[1])] = group.parsed;
      i = group.nextLine;
      continue;
    }

    // LUAMML_MARK:id:content...LUAMML_MARK_END
    const markMatch = line.match(/^LUAMML_MARK:(\d+):(.*)$/);
    if (markMatch) {
      const markId = parseInt(markMatch[1]);
      const markLines: string[] = [markMatch[2]];
      i++;
      while (i < lines.length && lines[i] !== 'LUAMML_MARK_END') {
        markLines.push(lines[i]);
        i++;
      }
      marks[markId] = markLines.join('\n');
      i++; // skip LUAMML_MARK_END
      continue;
    }

    // LUAMML_INSTRUCTION:content
    const instrMatch = line.match(/^LUAMML_INSTRUCTION:(.*)$/);
    if (instrMatch) {
      instructions.push(instrMatch[1]);
      i++;
      continue;
    }

    // LUAMML_COUNT:id (precount)
    const precountMatch = line.match(/^LUAMML_COUNT:(\d+)$/);
    if (precountMatch) {
      const id = parseInt(precountMatch[1]);
      i++;
      // Skip blank lines
      while (i < lines.length && lines[i] === '') i++;
      // Count backslash-starting lines in ### blocks
      let count = 0;
      while (i < lines.length && !lines[i].startsWith('LUAMML_')) {
        if (lines[i].startsWith('### ')) {
          i++;
          while (i < lines.length && !lines[i].startsWith('### ') && !lines[i].startsWith('LUAMML_')) {
            if (lines[i].startsWith('\\')) count++;
            i++;
          }
        } else {
          i++;
        }
      }
      precount[id] = count;
      continue;
    }

    // LUAMML_COUNT_END:id (postcount)
    const postcountMatch = line.match(/^LUAMML_COUNT_END:(\d+)$/);
    if (postcountMatch) {
      const id = parseInt(postcountMatch[1]);
      i++;
      while (i < lines.length && lines[i] === '') i++;
      let count = 0;
      while (i < lines.length && !lines[i].startsWith('LUAMML_')) {
        if (lines[i].startsWith('### ')) {
          i++;
          while (i < lines.length && !lines[i].startsWith('### ') && !lines[i].startsWith('LUAMML_')) {
            if (lines[i].startsWith('\\')) count++;
            i++;
          }
        } else {
          i++;
        }
      }
      postcount[id] = count;
      continue;
    }

    i++;
  }

  // Compute final counts
  const count: Record<number, number> = {};
  for (const [id, pre] of Object.entries(precount)) {
    const post = postcount[parseInt(id)];
    if (post === undefined) throw new Error('Unbalanced count');
    count[parseInt(id)] = post - pre;
  }

  return { groups, marks, instructions, count, mathml: {} };
}

function parseFormulaBlock(lines: string[], start: number): { parsed: ParsedGroup; nextLine: number } {
  let i = start;

  // Parse header: flag:tag:label
  const headerLine = lines[i];
  const headerMatch = headerLine.match(/^(\d+):([^:\n]*):?(.*)$/);
  if (!headerMatch) {
    throw new Error(`Invalid formula header at line ${i}: ${headerLine}`);
  }

  const flag = parseInt(headerMatch[1]);
  const tag = headerMatch[2];
  const label = headerMatch[3] || undefined;
  i++;

  // Skip blank lines
  while (i < lines.length && lines[i] === '') i++;

  // Parse math list blocks
  const blocks: ParsedMathBlock[] = [];
  while (i < lines.length && lines[i] !== 'LUAMML_FORMULA_END') {
    if (lines[i].startsWith('### ')) {
      const blockHeader = lines[i];
      const displayMatch = blockHeader.match(/^### (display )?math mode entered at line (\d+)$/);

      if (displayMatch) {
        const block: ParsedMathBlock = {
          display: !!displayMatch[1],
          line: parseInt(displayMatch[2]),
          lines: [],
        };
        i++;
        while (i < lines.length && !lines[i].startsWith('### ') && lines[i] !== 'LUAMML_FORMULA_END') {
          if (lines[i] !== '') {
            block.lines.push(lines[i]);
          }
          i++;
        }
        blocks.push(block);
      } else {
        // Skip non-math blocks (like "current page:")
        i++;
        while (i < lines.length && !lines[i].startsWith('### ') && lines[i] !== 'LUAMML_FORMULA_END') {
          i++;
        }
      }
    } else {
      i++;
    }
  }

  if (i < lines.length && lines[i] === 'LUAMML_FORMULA_END') {
    i++;
  }

  return {
    parsed: { flag, tag, label, blocks },
    nextLine: i,
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
