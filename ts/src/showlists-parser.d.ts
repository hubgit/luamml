// Type declarations for the Peggy-generated showlists parser.

export interface MathNodeResult {
  id: string;
  subtype?: number;
  fam?: number;
  char?: number;
  kern?: number;
  width?: number;
  height?: number;
  depth?: number;
  penalty?: number;
  stretch?: number;
  stretch_order?: number;
  shrink?: number;
  shrink_order?: number;
  left?: DelimResult;
  right?: DelimResult;
  delim?: DelimResult;
  accent?: MathNodeResult;
  options?: number;
  class?: number;
}

export interface DelimResult {
  id: 'delim';
  subtype: 0;
  small_fam: number;
  small_char: number;
  large_fam: number;
  large_char: number;
}

export interface SyntaxError extends Error {
  expected: unknown[];
  found: string | null;
  location: {
    start: { offset: number; line: number; column: number };
    end: { offset: number; line: number; column: number };
  };
}

export function parse(input: string, options?: { startRule?: string }): MathNodeResult;
