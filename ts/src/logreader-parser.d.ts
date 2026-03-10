// Type declarations for the Peggy-generated logreader parser.

export interface ParsedLogRaw {
  groups: Array<ParsedGroupRaw | undefined>;
  precount: Record<number, number>;
  postcount: Record<number, number>;
  marks: Record<number, string>;
  instructions: string[];
}

export interface ParsedGroupRaw {
  flag: number;
  tag: string;
  label?: string;
  blocks: ParsedMathBlockRaw[];
}

export interface ParsedMathBlockRaw {
  display: boolean;
  line: number;
  lines: string[];
}

export interface SyntaxError extends Error {
  expected: unknown[];
  found: string | null;
  location: {
    start: { offset: number; line: number; column: number };
    end: { offset: number; line: number; column: number };
  };
}

export function parse(input: string): ParsedLogRaw;
