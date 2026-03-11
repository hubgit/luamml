/**
 * LaTeX math parser for browser-side MathML rendering.
 *
 * Parses LaTeX math expressions and produces MathML element trees.
 * Supports custom macros via a configurable registry.
 */
import type { MathMLElement } from './types.js';
import { elem } from './types.js';
import { writeXml } from './xmlwriter.js';
import {
  symbols, accents, wideAccents, operatorNames, operatorNamesWithLimits,
  bigOperators, delimiters, fontCommands,
} from './latex-commands.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface MacroDef {
  /** Number of arguments (0–9) */
  args: number;
  /** Expansion template. Use #1, #2, ... for argument placeholders. */
  expansion: string;
}

export interface RenderOptions {
  /** If true, render in display mode (block-level). Default: false (inline). */
  displayMode?: boolean;
  /** Custom macro definitions. */
  macros?: Record<string, string | MacroDef>;
}

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

type Token =
  | { type: 'char'; value: string }
  | { type: 'command'; name: string }
  | { type: '{' }
  | { type: '}' }
  | { type: '^' }
  | { type: '_' }
  | { type: '&' }
  | { type: 'newline' }
  | { type: 'space' };

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (ch === '\\') {
      i++;
      if (i >= input.length) break;
      const next = input[i];
      if (next === '\\') {
        tokens.push({ type: 'newline' });
        i++;
      } else if (/[a-zA-Z]/.test(next)) {
        let name = '';
        while (i < input.length && /[a-zA-Z]/.test(input[i])) {
          name += input[i];
          i++;
        }
        // Skip trailing whitespace after command name
        while (i < input.length && /[ \t\n\r]/.test(input[i])) i++;
        tokens.push({ type: 'command', name });
      } else {
        // Single-character command: \{, \}, \|, \,, \;, \:, \!, \  etc.
        tokens.push({ type: 'command', name: next });
        i++;
      }
    } else if (ch === '{') {
      tokens.push({ type: '{' });
      i++;
    } else if (ch === '}') {
      tokens.push({ type: '}' });
      i++;
    } else if (ch === '^') {
      tokens.push({ type: '^' });
      i++;
    } else if (ch === '_') {
      tokens.push({ type: '_' });
      i++;
    } else if (ch === '&') {
      tokens.push({ type: '&' });
      i++;
    } else if (ch === '~') {
      tokens.push({ type: 'char', value: '\u00A0' });
      i++;
    } else if (ch === '%') {
      // Comment: skip to end of line
      while (i < input.length && input[i] !== '\n') i++;
      if (i < input.length) i++;
    } else if (ch === "'" ) {
      // Prime shorthand
      tokens.push({ type: 'char', value: '\u2032' });
      i++;
    } else if (/[ \t\n\r]/.test(ch)) {
      // Whitespace: collapse into a single space token
      tokens.push({ type: 'space' });
      while (i < input.length && /[ \t\n\r]/.test(input[i])) i++;
    } else {
      tokens.push({ type: 'char', value: ch });
      i++;
    }
  }
  return tokens;
}

// ---------------------------------------------------------------------------
// Macro expansion
// ---------------------------------------------------------------------------

function normalizeMacros(macros: Record<string, string | MacroDef>): Map<string, MacroDef> {
  const result = new Map<string, MacroDef>();
  for (const [key, value] of Object.entries(macros)) {
    // Strip leading backslash if present
    const name = key.startsWith('\\') ? key.slice(1) : key;
    if (typeof value === 'string') {
      result.set(name, { args: 0, expansion: value });
    } else {
      result.set(name, value);
    }
  }
  return result;
}

/** Read a command name starting at position i (after the backslash). Returns [name, newPos]. */
function readCommandName(str: string, pos: number): [string, number] {
  let name = '';
  let i = pos;
  if (i < str.length && /[a-zA-Z]/.test(str[i])) {
    while (i < str.length && /[a-zA-Z]/.test(str[i])) {
      name += str[i];
      i++;
    }
    // Skip trailing whitespace after command name
    while (i < str.length && /[ \t\n\r]/.test(str[i])) i++;
  } else if (i < str.length) {
    name = str[i];
    i++;
  }
  return [name, i];
}

/** Read a braced group at position i. Returns [content, newPos]. */
function readBracedArg(str: string, pos: number): [string, number] {
  let i = pos;
  while (i < str.length && /[ \t\n\r]/.test(str[i])) i++;
  if (i >= str.length || str[i] !== '{') return ['', i];
  i++; // consume {
  let depth = 1;
  let content = '';
  while (i < str.length && depth > 0) {
    if (str[i] === '{') depth++;
    else if (str[i] === '}') {
      depth--;
      if (depth === 0) { i++; break; }
    }
    content += str[i];
    i++;
  }
  return [content, i];
}

/** Read a single token (for macro arguments). Returns [token, newPos]. */
function readSingleToken(str: string, pos: number): [string, number] {
  let i = pos;
  while (i < str.length && /[ \t\n\r]/.test(str[i])) i++;
  if (i >= str.length) return ['', i];
  if (str[i] === '{') return readBracedArg(str, i);
  if (str[i] === '\\') {
    i++;
    const [name, newPos] = readCommandName(str, i);
    return ['\\' + name, newPos];
  }
  return [str[i], i + 1];
}

/**
 * Process inline macro definitions (\def, \let, \newcommand, \renewcommand,
 * \gdef, \xdef, \edef, \DeclareMathOperator) and remove them from the input.
 */
function processInlineDefs(input: string, macros: Map<string, MacroDef>): string {
  let result = input;
  let changed = true;

  while (changed) {
    changed = false;
    let i = 0;
    let out = '';

    while (i < result.length) {
      if (result[i] !== '\\') { out += result[i]; i++; continue; }

      const cmdStart = i;
      i++;
      const [cmdName, afterCmd] = readCommandName(result, i);
      i = afterCmd;

      // \def\foo{expansion} or \def\foo#1#2{expansion with #1 and #2}
      if (cmdName === 'def' || cmdName === 'gdef' || cmdName === 'xdef' || cmdName === 'edef') {
        changed = true;
        // Read the macro name
        if (i < result.length && result[i] === '\\') {
          i++;
          const [macroName, afterName] = readCommandName(result, i);
          i = afterName;
          // Count #n parameter tokens
          let argCount = 0;
          while (i < result.length && result[i] === '#') {
            i++; // skip #
            if (i < result.length && /[0-9]/.test(result[i])) {
              argCount = Math.max(argCount, parseInt(result[i]));
              i++;
            }
          }
          // Read expansion body
          const [expansion, afterBody] = readBracedArg(result, i);
          i = afterBody;
          macros.set(macroName, { args: argCount, expansion });
        }
        continue;
      }

      // \let\foo=\bar  or  \let\foo\bar  or  \let\foo=x
      if (cmdName === 'let') {
        changed = true;
        if (i < result.length && result[i] === '\\') {
          i++;
          const [macroName, afterName] = readCommandName(result, i);
          i = afterName;
          // Optional =
          if (i < result.length && result[i] === '=') i++;
          while (i < result.length && /[ \t\n\r]/.test(result[i])) i++;
          // Read the value (a command or single char)
          let value = '';
          if (i < result.length && result[i] === '\\') {
            i++;
            const [valName, afterVal] = readCommandName(result, i);
            i = afterVal;
            value = '\\' + valName;
          } else if (i < result.length) {
            value = result[i];
            i++;
          }
          macros.set(macroName, { args: 0, expansion: value });
        }
        continue;
      }

      // \newcommand\foo{expansion}  or  \newcommand{\foo}{expansion}
      // \newcommand\foo[n]{expansion}  or  \newcommand{\foo}[n]{expansion}
      // Also \renewcommand and \providecommand
      if (cmdName === 'newcommand' || cmdName === 'renewcommand' || cmdName === 'providecommand') {
        changed = true;
        let macroName = '';
        // Read macro name: either \foo or {\foo}
        while (i < result.length && /[ \t\n\r]/.test(result[i])) i++;
        if (i < result.length && result[i] === '{') {
          i++; // skip {
          if (i < result.length && result[i] === '\\') {
            i++;
            const [name, afterName] = readCommandName(result, i);
            macroName = name;
            i = afterName;
          }
          while (i < result.length && result[i] !== '}') i++;
          if (i < result.length) i++; // skip }
        } else if (i < result.length && result[i] === '\\') {
          i++;
          const [name, afterName] = readCommandName(result, i);
          macroName = name;
          i = afterName;
        }
        // Optional [n] argument count
        let argCount = 0;
        while (i < result.length && /[ \t\n\r]/.test(result[i])) i++;
        if (i < result.length && result[i] === '[') {
          i++;
          let numStr = '';
          while (i < result.length && result[i] !== ']') {
            numStr += result[i]; i++;
          }
          if (i < result.length) i++; // skip ]
          argCount = parseInt(numStr) || 0;
        }
        // Read expansion body
        const [expansion, afterBody] = readBracedArg(result, i);
        i = afterBody;
        if (macroName) {
          macros.set(macroName, { args: argCount, expansion });
        }
        continue;
      }

      // \DeclareMathOperator{\foo}{name} or \DeclareMathOperator*{\foo}{name}
      if (cmdName === 'DeclareMathOperator') {
        changed = true;
        // Optional *
        if (i < result.length && result[i] === '*') i++;
        // Read macro name
        const [macroBody, afterMacro] = readBracedArg(result, i);
        i = afterMacro;
        const macroName = macroBody.replace(/^\\/, '');
        // Read operator name
        const [opName, afterOp] = readBracedArg(result, i);
        i = afterOp;
        if (macroName) {
          macros.set(macroName, { args: 0, expansion: `\\operatorname{${opName}}` });
        }
        continue;
      }

      // \expandafter — just skip it (it's a TeX primitive for macro ordering)
      if (cmdName === 'expandafter') {
        changed = true;
        continue;
      }

      // \noexpand — just skip it
      if (cmdName === 'noexpand') {
        changed = true;
        continue;
      }

      // \relax — just skip it
      if (cmdName === 'relax') {
        changed = true;
        continue;
      }

      // Not a definition command — output as-is
      out += result.slice(cmdStart, i);
    }

    result = out;
  }
  return result;
}

function expandMacros(input: string, macros: Map<string, MacroDef>): string {
  // First, process inline definitions (\def, \let, \newcommand, etc.)
  let result = processInlineDefs(input, macros);

  if (macros.size === 0) return result;

  const MAX_ITERATIONS = 100;

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    let expanded = false;

    let i = 0;
    let out = '';
    while (i < result.length) {
      if (result[i] === '\\') {
        i++;
        if (i >= result.length) { out += '\\'; break; }

        const [name, afterName] = readCommandName(result, i);
        i = afterName;

        const def = macros.get(name);
        if (def) {
          expanded = true;
          if (def.args === 0) {
            out += def.expansion;
          } else {
            const args: string[] = [];
            for (let a = 0; a < def.args; a++) {
              const [arg, afterArg] = readSingleToken(result, i);
              args.push(arg);
              i = afterArg;
            }
            let exp = def.expansion;
            for (let a = 0; a < args.length; a++) {
              exp = exp.replaceAll(`#${a + 1}`, args[a]);
            }
            out += exp;
          }
        } else {
          out += '\\' + name;
        }
      } else {
        out += result[i];
        i++;
      }
    }

    result = out;
    if (!expanded) break;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

class Parser {
  private tokens: Token[];
  private pos: number;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
    this.pos = 0;
  }

  private peek(): Token | null {
    return this.pos < this.tokens.length ? this.tokens[this.pos] : null;
  }

  private advance(): Token {
    if (this.pos >= this.tokens.length) {
      throw new ParseError('Unexpected end of input');
    }
    return this.tokens[this.pos++];
  }

  private expect(type: string): Token {
    const t = this.advance();
    if (t.type !== type) {
      throw new ParseError(`Expected '${type}', got '${t.type}'`);
    }
    return t;
  }

  private skipSpaces(): void {
    while (this.peek()?.type === 'space') this.pos++;
  }

  /** Parse a full expression: sequence of items until a stop token. */
  parseExpression(): MathMLElement {
    const items: (string | MathMLElement)[] = [];

    while (true) {
      this.skipSpaces();
      const t = this.peek();
      if (!t) break;
      if (t.type === '}' || t.type === '&' || t.type === 'newline') break;
      if (t.type === 'command' && (t.name === 'right' || t.name === 'end')) break;

      // \tag and \tag* — equation tags
      if (t.type === 'command' && t.name === 'tag') {
        this.advance();
        // Check for *
        const star = this.peek();
        if (star?.type === 'char' && (star as { type: 'char'; value: string }).value === '*') {
          this.advance();
        }
        const tagContent = this.parseArgSingle();
        // Append tag as parenthesized label
        items.push(elem('mrow', [
          elem('mspace', [], { width: '2em' }),
          elem('mo', ['('], { fence: 'true' }),
          tagContent,
          elem('mo', [')'], { fence: 'true' }),
        ]));
        continue;
      }

      // Infix fraction operators: \over, \atop, \choose, \above, \*withdelims
      if (t.type === 'command' && (t.name === 'over' || t.name === 'atop' ||
          t.name === 'choose' || t.name === 'above' ||
          t.name === 'overwithdelims' || t.name === 'atopwithdelims' ||
          t.name === 'abovewithdelims')) {
        this.advance();
        const num = items.length === 1 && typeof items[0] !== 'string'
          ? items[0] : elem('mrow', items);

        // *withdelims variants read two delimiters
        if (t.name === 'overwithdelims' || t.name === 'atopwithdelims' ||
            t.name === 'abovewithdelims') {
          const leftDelim = this.readDelimiter();
          const rightDelim = this.readDelimiter();
          const denom = this.parseExpression();
          const attrs: Record<string, string | number | boolean | undefined> = {};
          if (t.name === 'atopwithdelims' || t.name === 'abovewithdelims') {
            attrs.linethickness = '0';
          }
          const frac = elem('mfrac', [num, denom], attrs);
          const result: (string | MathMLElement)[] = [];
          if (leftDelim) result.push(elem('mo', [leftDelim], { fence: 'true', stretchy: 'true', symmetric: 'true' }));
          result.push(frac);
          if (rightDelim) result.push(elem('mo', [rightDelim], { fence: 'true', stretchy: 'true', symmetric: 'true' }));
          return result.length === 1 ? frac : elem('mrow', result);
        }

        const denom = this.parseExpression();
        if (t.name === 'atop' || t.name === 'above') {
          return elem('mfrac', [num, denom], { linethickness: '0' });
        }
        if (t.name === 'choose') {
          return elem('mrow', [
            elem('mo', ['('], { fence: 'true', stretchy: 'true', symmetric: 'true' }),
            elem('mfrac', [num, denom], { linethickness: '0' }),
            elem('mo', [')'], { fence: 'true', stretchy: 'true', symmetric: 'true' }),
          ]);
        }
        return elem('mfrac', [num, denom]);
      }

      // Style switches apply to the rest of the group
      if (t.type === 'command' && isStyleSwitch(t.name)) {
        this.advance();
        const rest = this.parseExpression();
        const style = getStyleAttrs(t.name);
        const wrapper = elem('mstyle', rest.tag === 'mrow' ? rest.children : [rest], style);
        items.push(wrapper);
        break;
      }

      const item = this.parseItem();
      if (item) items.push(item);
    }

    if (items.length === 0) return elem('mrow');
    if (items.length === 1) {
      const child = items[0];
      return typeof child === 'string' ? elem('mrow', [child]) : child;
    }
    return elem('mrow', items);
  }

  /** Parse a single item, possibly with sub/superscripts. */
  parseItem(): MathMLElement | null {
    let base = this.parseAtom();

    // Handle bare sub/superscripts (e.g. ^2) with an empty base
    if (!base) {
      const t = this.peek();
      if (t && (t.type === '^' || t.type === '_')) {
        base = elem('mi');
      } else {
        return null;
      }
    }

    let sub: MathMLElement | null = null;
    let sup: MathMLElement | null = null;

    // Collect consecutive primes as superscript
    const primes = this.collectPrimes();
    if (primes) {
      sup = primes;
    }

    // Look for _ and ^ in any order
    while (true) {
      this.skipSpaces();
      const t = this.peek();
      if (t?.type === '_' && !sub) {
        this.advance();
        sub = this.parseArgSingle();
      } else if (t?.type === '^' && !sup) {
        this.advance();
        sup = this.parseArgSingle();
        // Collect primes after ^{...}
        const morePrimes = this.collectPrimes();
        if (morePrimes) {
          sup = elem('mrow', [sup, morePrimes]);
        }
      } else {
        break;
      }
    }

    if (sub && sup) return elem('msubsup', [base, sub, sup]);
    if (sub) return elem('msub', [base, sub]);
    if (sup) return elem('msup', [base, sup]);
    return base;
  }

  /** Collect consecutive prime characters into a single mo. */
  private collectPrimes(): MathMLElement | null {
    let primes = '';
    while (this.peek()?.type === 'char' &&
           (this.peek() as { type: 'char'; value: string }).value === '\u2032') {
      primes += '\u2032';
      this.advance();
    }
    return primes ? elem('mo', [primes]) : null;
  }

  /** Parse an atomic expression (no sub/sup). */
  parseAtom(): MathMLElement | null {
    this.skipSpaces();
    const t = this.peek();
    if (!t) return null;

    if (t.type === 'char') {
      this.advance();
      return this.makeCharElement(t.value);
    }

    if (t.type === '{') {
      return this.parseGroup();
    }

    if (t.type === 'command') {
      this.advance();
      return this.parseCommand(t.name);
    }

    return null;
  }

  /** Create a MathML element for a single character. */
  private makeCharElement(ch: string): MathMLElement {
    // Letters → mi
    if (/[a-zA-Z]/.test(ch)) {
      return elem('mi', [ch]);
    }
    // Digits → mn (join consecutive digits)
    if (/[0-9]/.test(ch)) {
      let digits = ch;
      while (true) {
        const next = this.peek();
        if (next?.type === 'char') {
          const v = (next as { type: 'char'; value: string }).value;
          if (/[0-9]/.test(v)) {
            digits += v;
            this.advance();
            continue;
          }
          // Allow one decimal point followed by more digits
          if (v === '.') {
            const saved = this.pos;
            this.advance();
            const afterDot = this.peek();
            if (afterDot?.type === 'char' &&
                /[0-9]/.test((afterDot as { type: 'char'; value: string }).value)) {
              digits += '.';
              continue; // next iteration will pick up the digit
            } else {
              this.pos = saved; // backtrack
              break;
            }
          }
        }
        break;
      }
      return elem('mn', [digits]);
    }
    // Minus sign: use proper Unicode minus
    if (ch === '-') {
      return elem('mo', ['\u2212']);
    }
    // Everything else → mo
    return elem('mo', [ch]);
  }

  /** Parse a braced group { ... }. */
  private parseGroup(): MathMLElement {
    this.expect('{');
    const expr = this.parseExpression();
    this.expect('}');
    return expr;
  }

  /** Parse a single required argument: a braced group or a single token. */
  private parseArgSingle(): MathMLElement {
    this.skipSpaces();
    const t = this.peek();
    if (t?.type === '{') return this.parseGroup();
    if (t?.type === 'char') {
      this.advance();
      // Single-token argument: don't do digit joining (e.g. \frac12 → \frac{1}{2})
      return this.makeCharElementSingle(t.value);
    }
    if (t?.type === 'command') {
      this.advance();
      const result = this.parseCommand(t.name);
      if (result) return result;
    }
    throw new ParseError('Expected argument');
  }

  /** Create a MathML element for a single character (no digit joining). */
  private makeCharElementSingle(ch: string): MathMLElement {
    if (/[a-zA-Z]/.test(ch)) return elem('mi', [ch]);
    if (/[0-9]/.test(ch)) return elem('mn', [ch]);
    if (ch === '-') return elem('mo', ['\u2212']);
    return elem('mo', [ch]);
  }

  /** Parse a command (backslash already consumed). */
  private parseCommand(name: string): MathMLElement {
    // --- Structural commands ---

    if (name === 'frac' || name === 'dfrac' || name === 'tfrac')
      return this.parseFrac(name);
    if (name === 'sqrt')
      return this.parseSqrt();
    if (name === 'left')
      return this.parseLeftRight();
    if (name === 'binom' || name === 'dbinom' || name === 'tbinom')
      return this.parseBinom(name);
    if (name === 'overset')
      return this.parseOverUnderSet('mover');
    if (name === 'underset')
      return this.parseOverUnderSet('munder');
    if (name === 'stackrel')
      return this.parseOverUnderSet('mover');
    if (name === 'operatorname')
      return this.parseOperatorname();
    if (name === 'begin')
      return this.parseEnvironment();
    if (name === 'not')
      return this.parseNot();
    if (name === 'phantom')
      return this.parsePhantom();
    if (name === 'color')
      return this.parseColor();
    if (name === 'boxed')
      return this.parseBoxed();
    if (name === 'substack')
      return this.parseSubstack();
    if (name === 'array')
      return this.parseArrayCommand();
    if (name === 'displaylines')
      return this.parseDisplaylines();
    if (name === 'eqalign')
      return this.parseEqalign();
    if (name === 'eqalignno' || name === 'leqalignno')
      return this.parseEqalign();
    if (name === 'cases')
      return this.parseCasesCommand();
    if (name === 'matrix' || name === 'pmatrix' || name === 'bmatrix' ||
        name === 'Bmatrix' || name === 'vmatrix' || name === 'Vmatrix')
      return this.parseMatrixCommand(name);
    if (name === 'mbox' || name === 'hbox')
      return this.parseMbox();

    // --- Extensible arrows ---

    if (name === 'xrightarrow' || name === 'xleftarrow' ||
        name === 'xlongequal' || name === 'xmapsto' ||
        name === 'xleftrightarrow' || name === 'xRightarrow' ||
        name === 'xLeftarrow' || name === 'xLeftrightarrow' ||
        name === 'xhookleftarrow' || name === 'xhookrightarrow' ||
        name === 'xtwoheadrightarrow' || name === 'xtwoheadleftarrow' ||
        name === 'xrightharpoondown' || name === 'xrightharpoonup' ||
        name === 'xleftharpoondown' || name === 'xleftharpoonup' ||
        name === 'xrightleftharpoons' || name === 'xleftrightharpoons')
      return this.parseExtensibleArrow(name);

    // --- Fraction variants ---

    if (name === 'cfrac')
      return this.parseCfrac();
    if (name === 'genfrac')
      return this.parseGenfrac();
    // --- Modular arithmetic ---

    if (name === 'pmod')
      return this.parsePmod();
    if (name === 'pod')
      return this.parsePod();
    if (name === 'mod')
      return this.parseMod();
    if (name === 'bmod')
      return elem('mo', ['mod']);

    // --- Cancel ---

    if (name === 'cancel' || name === 'bcancel' || name === 'xcancel')
      return this.parseCancel(name);

    // --- Color/box commands ---

    if (name === 'textcolor')
      return this.parseTextcolor();
    if (name === 'colorbox')
      return this.parseColorbox();
    if (name === 'fcolorbox')
      return this.parseFcolorbox();

    // --- Layout commands ---

    if (name === 'smash')
      return this.parseSmash();
    if (name === 'vphantom')
      return this.parseVphantom();
    if (name === 'hphantom')
      return this.parseHphantom();
    if (name === 'mathclap' || name === 'mathllap' || name === 'mathrlap')
      return this.parseMathLap(name);
    if (name === 'kern' || name === 'mkern')
      return this.parseKern(name);
    if (name === 'hspace')
      return this.parseHspace();
    if (name === 'rule')
      return this.parseRule();
    if (name === 'raisebox')
      return this.parseRaisebox();

    // --- Miscellaneous ---

    if (name === 'sideset')
      return this.parseSideset();
    if (name === 'prescript')
      return this.parsePrescript();
    if (name === 'mathinner')
      return this.parseMathinner();
    if (name === 'sout')
      return this.parseSout();
    if (name === 'href')
      return this.parseHref();
    if (name === 'url')
      return this.parseUrl();
    if (name === 'char')
      return this.parseChar();
    if (name === 'unicode')
      return this.parseUnicode();
    if (name === 'label')
      return this.parseLabel();
    if (name === 'ref' || name === 'eqref')
      return this.parseRef(name);
    if (name === 'htmlStyle' || name === 'htmlClass' || name === 'htmlId' || name === 'htmlData')
      return this.parseHtmlAttr(name);

    // --- Braket/physics commands ---

    if (name === 'bra')
      return this.parseBraket('bra');
    if (name === 'ket')
      return this.parseBraket('ket');
    if (name === 'braket' || name === 'Braket')
      return this.parseBraket(name);
    if (name === 'Set')
      return this.parseSetNotation();
    if (name === 'abs' || name === 'norm' || name === 'qty')
      return this.parseDelimiterShortcut(name);
    if (name === 'dv')
      return this.parseDerivative('d');
    if (name === 'pdv')
      return this.parseDerivative('\u2202');

    // --- Chemistry ---

    if (name === 'ce')
      return this.parseCe();

    // --- Text/font commands ---

    if (name === 'text' || name === 'textrm' || name === 'textit' ||
        name === 'textbf' || name === 'textsf' || name === 'texttt')
      return this.parseTextCommand(name);

    if (name in fontCommands)
      return this.parseMathFont(name);

    // --- Accents ---

    if (name in accents)
      return this.parseAccent(name);

    // --- Spacing commands ---

    if (name === ',') return elem('mspace', [], { width: '0.167em' });
    if (name === ':' || name === '>') return elem('mspace', [], { width: '0.222em' });
    if (name === ';') return elem('mspace', [], { width: '0.278em' });
    if (name === '!') return elem('mspace', [], { width: '-0.167em' });
    if (name === ' ') return elem('mspace', [], { width: '0.25em' });
    if (name === 'quad') return elem('mspace', [], { width: '1em' });
    if (name === 'qquad') return elem('mspace', [], { width: '2em' });
    if (name === 'enspace') return elem('mspace', [], { width: '0.5em' });

    // --- Special single-char commands ---

    if (name === '{') return elem('mo', ['{']);
    if (name === '}') return elem('mo', ['}']);
    if (name === '|') return elem('mo', ['\u2016']);
    if (name === '%') return elem('mo', ['%']);
    if (name === '#') return elem('mo', ['#']);
    if (name === '&') return elem('mo', ['&']);
    if (name === '_') return elem('mo', ['_']);
    if (name === '$') return elem('mo', ['$']);

    // --- Named operators ---

    if (operatorNames.has(name))
      return elem('mi', [name]);

    if (operatorNamesWithLimits.has(name))
      return elem('mo', [name], { movablelimits: 'true' });

    // --- Symbol lookup ---

    const sym = symbols[name];
    if (sym) return elem(sym.element, [sym.char]);

    // --- Unknown command: produce merror ---

    return elem('merror', [elem('mtext', ['\\' + name])]);
  }

  // --- Command parsers ---

  private parseFrac(variant: string): MathMLElement {
    const num = this.parseArgSingle();
    const denom = this.parseArgSingle();
    const frac = elem('mfrac', [num, denom]);
    if (variant === 'dfrac') {
      return elem('mstyle', [frac], { displaystyle: 'true', scriptlevel: '0' });
    }
    if (variant === 'tfrac') {
      return elem('mstyle', [frac], { displaystyle: 'false', scriptlevel: '0' });
    }
    return frac;
  }

  private parseSqrt(): MathMLElement {
    this.skipSpaces();
    // Check for optional argument [n]
    const t = this.peek();
    if (t?.type === 'char' && (t as { type: 'char'; value: string }).value === '[') {
      this.advance(); // consume [
      const indexItems: (string | MathMLElement)[] = [];
      while (true) {
        this.skipSpaces();
        const p = this.peek();
        if (!p) throw new ParseError('Missing ] in \\sqrt');
        if (p.type === 'char' && (p as { type: 'char'; value: string }).value === ']') {
          this.advance();
          break;
        }
        const item = this.parseItem();
        if (item) indexItems.push(item);
      }
      const index = indexItems.length === 1 && typeof indexItems[0] !== 'string'
        ? indexItems[0]
        : elem('mrow', indexItems);
      const body = this.parseArgSingle();
      return elem('mroot', [body, index]);
    }
    const body = this.parseArgSingle();
    return elem('msqrt', [body]);
  }

  private parseLeftRight(): MathMLElement {
    const leftDelim = this.readDelimiter();
    const items: (string | MathMLElement)[] = [];

    if (leftDelim) {
      items.push(elem('mo', [leftDelim], { stretchy: 'true', fence: 'true', symmetric: 'true' }));
    }

    // Parse content until \right
    while (true) {
      this.skipSpaces();
      const t = this.peek();
      if (!t) throw new ParseError('Missing \\right');
      if (t.type === 'command' && t.name === 'right') {
        this.advance();
        break;
      }
      // Handle \middle
      if (t.type === 'command' && t.name === 'middle') {
        this.advance();
        const midDelim = this.readDelimiter();
        if (midDelim) {
          items.push(elem('mo', [midDelim], { stretchy: 'true', fence: 'true', symmetric: 'true' }));
        }
        continue;
      }
      const item = this.parseItem();
      if (item) items.push(item);
    }

    const rightDelim = this.readDelimiter();
    if (rightDelim) {
      items.push(elem('mo', [rightDelim], { stretchy: 'true', fence: 'true', symmetric: 'true' }));
    }

    return elem('mrow', items);
  }

  /** Read a delimiter token (used after \left, \right, \middle). */
  private readDelimiter(): string | null {
    this.skipSpaces();
    const t = this.peek();
    if (!t) throw new ParseError('Expected delimiter');

    if (t.type === 'char') {
      this.advance();
      const v = (t as { type: 'char'; value: string }).value;
      return delimiters[v] ?? v;
    }
    if (t.type === 'command') {
      this.advance();
      const name = (t as { type: 'command'; name: string }).name;
      // Check delimiter table
      const d = delimiters[name];
      if (d !== undefined) return d || null; // empty string = invisible
      // Fallback: try symbols table
      const sym = symbols[name];
      if (sym) return sym.char;
      throw new ParseError(`Unknown delimiter: \\${name}`);
    }
    throw new ParseError('Expected delimiter');
  }

  private parseBinom(variant: string): MathMLElement {
    const n = this.parseArgSingle();
    const k = this.parseArgSingle();
    const inner = elem('mrow', [
      elem('mo', ['('], { fence: 'true', stretchy: 'true', symmetric: 'true' }),
      elem('mfrac', [n, k], { linethickness: '0' }),
      elem('mo', [')'], { fence: 'true', stretchy: 'true', symmetric: 'true' }),
    ]);
    if (variant === 'dbinom') {
      return elem('mstyle', [inner], { displaystyle: 'true', scriptlevel: '0' });
    }
    if (variant === 'tbinom') {
      return elem('mstyle', [inner], { displaystyle: 'false', scriptlevel: '0' });
    }
    return inner;
  }

  private parseOverUnderSet(tag: 'mover' | 'munder'): MathMLElement {
    const annotation = this.parseArgSingle();
    const base = this.parseArgSingle();
    return elem(tag, [base, annotation]);
  }

  private parseOperatorname(): MathMLElement {
    // Check for \operatorname* (limits variant)
    const star = this.peek();
    if (star?.type === 'char' && (star as { type: 'char'; value: string }).value === '*') {
      this.advance();
    }
    this.expect('{');
    let name = '';
    while (true) {
      const t = this.peek();
      if (!t || t.type === '}') break;
      this.advance();
      if (t.type === 'char') name += (t as { type: 'char'; value: string }).value;
      else if (t.type === 'space') name += ' ';
      else if (t.type === 'command') name += (t as { type: 'command'; name: string }).name;
    }
    this.expect('}');
    return elem('mi', [name]);
  }

  private parseNot(): MathMLElement {
    // \not followed by a relation: produce negated version
    const next = this.parseAtom();
    if (next && next.tag === 'mo' && next.children.length === 1 &&
        typeof next.children[0] === 'string') {
      const ch = next.children[0];
      const negMap: Record<string, string> = {
        '=': '\u2260',
        '<': '\u226E',
        '>': '\u226F',
        '\u2208': '\u2209',
        '\u2282': '\u2284',
        '\u2283': '\u2285',
        '\u2286': '\u2288',
        '\u2287': '\u2289',
        '\u2261': '\u2262',
        '\u223C': '\u2241',
        '\u2248': '\u2249',
      };
      if (negMap[ch]) {
        next.children[0] = negMap[ch];
        return next;
      }
      // Fallback: overlay with combining /
      return elem('mrow', [next, elem('mo', ['\u0338'])]);
    }
    if (next) return next;
    return elem('mo', ['\u00AC']);
  }

  private parsePhantom(): MathMLElement {
    const body = this.parseArgSingle();
    return elem('mphantom', [body]);
  }

  private parseColor(): MathMLElement {
    this.expect('{');
    let color = '';
    while (true) {
      const t = this.peek();
      if (!t || t.type === '}') break;
      this.advance();
      if (t.type === 'char') color += (t as { type: 'char'; value: string }).value;
    }
    this.expect('}');
    // \color applies to the rest of the current group/expression, not just next arg
    const rest = this.parseExpression();
    const children = rest.tag === 'mrow' ? rest.children : [rest];
    return elem('mstyle', children, { mathcolor: color });
  }

  private parseBoxed(): MathMLElement {
    const body = this.parseArgSingle();
    return elem('menclose', [body], { notation: 'box' });
  }

  private parseTextCommand(cmd: string): MathMLElement {
    // Collect raw text from argument (braced group or single token)
    this.skipSpaces();
    const next = this.peek();
    if (next && next.type !== '{') {
      // Single-token argument without braces (e.g. \textrm a)
      this.advance();
      let text = '';
      if (next.type === 'char') text = (next as { type: 'char'; value: string }).value;
      else if (next.type === 'command') text = (next as { type: 'command'; name: string }).name;
      const attrs: Record<string, string | number | boolean | undefined> = {};
      if (cmd === 'textbf') attrs.mathvariant = 'bold';
      else if (cmd === 'textit') attrs.mathvariant = 'italic';
      else if (cmd === 'textsf') attrs.mathvariant = 'sans-serif';
      else if (cmd === 'texttt') attrs.mathvariant = 'monospace';
      return elem('mtext', [text], attrs);
    }
    this.expect('{');
    let text = '';
    let depth = 1;
    while (this.pos < this.tokens.length && depth > 0) {
      const t = this.advance();
      if (t.type === '{') {
        depth++;
        text += '{';
      } else if (t.type === '}') {
        depth--;
        if (depth === 0) break;
        text += '}';
      } else if (t.type === 'char') {
        text += (t as { type: 'char'; value: string }).value;
      } else if (t.type === 'space') {
        text += ' ';
      } else if (t.type === 'command') {
        text += '\\' + (t as { type: 'command'; name: string }).name;
      } else if (t.type === '^') {
        text += '^';
      } else if (t.type === '_') {
        text += '_';
      }
    }

    const attrs: Record<string, string | number | boolean | undefined> = {};
    if (cmd === 'textbf') attrs.mathvariant = 'bold';
    else if (cmd === 'textit') attrs.mathvariant = 'italic';
    else if (cmd === 'textsf') attrs.mathvariant = 'sans-serif';
    else if (cmd === 'texttt') attrs.mathvariant = 'monospace';

    return elem('mtext', [text], attrs);
  }

  private parseMathFont(cmd: string): MathMLElement {
    const body = this.parseArgSingle();
    const variant = fontCommands[cmd];
    if (!variant) return body;

    // If body is a simple mi/mn, set mathvariant directly
    if ((body.tag === 'mi' || body.tag === 'mn') && body.children.length === 1) {
      body.attrs.mathvariant = variant;
      return body;
    }
    // Otherwise wrap in mstyle
    return elem('mstyle', [body], { mathvariant: variant });
  }

  private parseAccent(name: string): MathMLElement {
    const def = accents[name];
    const body = this.parseArgSingle();
    const stretchy = wideAccents.has(name);
    const accentMo = elem('mo', [def.char], { stretchy: stretchy ? 'true' : 'false' });
    const tag = def.over ? 'mover' : 'munder';
    const attrKey = def.over ? 'accent' : 'accentunder';
    return elem(tag, [body, accentMo], { [attrKey]: 'true' });
  }

  private parseEnvironment(): MathMLElement {
    // Read environment name
    this.expect('{');
    let envName = '';
    while (true) {
      const t = this.peek();
      if (!t || t.type === '}') break;
      this.advance();
      if (t.type === 'char') envName += (t as { type: 'char'; value: string }).value;
    }
    this.expect('}');

    // Matrix-like environments
    const matrixEnvs: Record<string, [string, string]> = {
      matrix:   ['', ''],
      pmatrix:  ['(', ')'],
      bmatrix:  ['[', ']'],
      Bmatrix:  ['{', '}'],
      vmatrix:  ['|', '|'],
      Vmatrix:  ['\u2016', '\u2016'],
      smallmatrix: ['', ''],
    };

    if (envName in matrixEnvs) {
      return this.parseMatrix(envName, matrixEnvs[envName]);
    }
    if (envName === 'cases' || envName === 'dcases') {
      return this.parseCases();
    }
    if (envName === 'rcases') {
      return this.parseRcases();
    }
    if (envName === 'aligned' || envName === 'align' || envName === 'align*') {
      return this.parseAligned(envName);
    }
    if (envName === 'gathered') {
      return this.parseGathered(envName);
    }
    if (envName === 'array') {
      return this.parseArray(envName);
    }
    // matrix* environment (same as matrix, but with optional alignment)
    if (envName === 'matrix*') {
      // Skip optional [alignment] argument
      this.skipSpaces();
      const maybeOpt = this.peek();
      if (maybeOpt?.type === 'char' &&
          (maybeOpt as { type: 'char'; value: string }).value === '[') {
        this.advance();
        while (true) {
          const p = this.peek();
          if (!p) break;
          this.advance();
          if (p.type === 'char' && (p as { type: 'char'; value: string }).value === ']') break;
        }
      }
      return this.parseMatrix(envName, ['', '']);
    }
    // Display equation environments
    if (envName === 'equation' || envName === 'equation*') {
      return this.parseEquationEnv(envName);
    }
    if (envName === 'gather' || envName === 'gather*') {
      return this.parseGathered(envName);
    }
    if (envName === 'multline' || envName === 'multline*') {
      return this.parseGathered(envName);
    }
    if (envName === 'split') {
      return this.parseAligned(envName);
    }
    if (envName === 'CD') {
      return this.parseCDEnv(envName);
    }

    // Unknown environment: render as error
    return elem('merror', [elem('mtext', [`\\begin{${envName}}`])]);
  }

  private parseMatrix(envName: string, [leftDelim, rightDelim]: [string, string]): MathMLElement {
    const rows = this.parseTableRows(envName);
    const mtable = elem('mtable', rows);

    if (leftDelim || rightDelim) {
      const items: (string | MathMLElement)[] = [];
      if (leftDelim) {
        items.push(elem('mo', [leftDelim], { fence: 'true', stretchy: 'true', symmetric: 'true' }));
      }
      items.push(mtable);
      if (rightDelim) {
        items.push(elem('mo', [rightDelim], { fence: 'true', stretchy: 'true', symmetric: 'true' }));
      }
      return elem('mrow', items);
    }
    return mtable;
  }

  private parseCases(): MathMLElement {
    const rows = this.parseTableRows('cases');
    const mtable = elem('mtable', rows, { columnalign: 'left left' });
    return elem('mrow', [
      elem('mo', ['{'], { fence: 'true', stretchy: 'true', symmetric: 'true' }),
      mtable,
    ]);
  }

  private parseAligned(envName: string): MathMLElement {
    const rows = this.parseTableRows(envName);
    return elem('mtable', rows, { columnalign: 'right left' });
  }

  private parseGathered(envName: string): MathMLElement {
    const rows = this.parseTableRows(envName);
    return elem('mtable', rows, { columnalign: 'center' });
  }

  private parseArray(envName: string): MathMLElement {
    // Skip optional [pos] argument (e.g., [b], [t])
    this.skipSpaces();
    const maybeOpt = this.peek();
    if (maybeOpt?.type === 'char' &&
        (maybeOpt as { type: 'char'; value: string }).value === '[') {
      this.advance();
      while (true) {
        const p = this.peek();
        if (!p) break;
        this.advance();
        if (p.type === 'char' && (p as { type: 'char'; value: string }).value === ']') break;
      }
    }
    // Read column spec
    this.expect('{');
    let colSpec = '';
    while (true) {
      const t = this.peek();
      if (!t || t.type === '}') break;
      this.advance();
      if (t.type === 'char') colSpec += (t as { type: 'char'; value: string }).value;
    }
    this.expect('}');

    const alignMap: Record<string, string> = { l: 'left', c: 'center', r: 'right' };
    const colAlign = [...colSpec].filter(c => c in alignMap).map(c => alignMap[c]).join(' ');

    const rows = this.parseTableRows(envName);
    return elem('mtable', rows, { columnalign: colAlign || undefined });
  }

  private parseSubstack(): MathMLElement {
    this.expect('{');
    const rows: MathMLElement[] = [];
    let currentCells: MathMLElement[] = [];

    while (true) {
      this.skipSpaces();
      const t = this.peek();
      if (!t || t.type === '}') break;
      if (t.type === 'newline') {
        this.advance();
        rows.push(elem('mtr', [elem('mtd', currentCells.length === 1 ? [currentCells[0]] : [elem('mrow', currentCells)])]));
        currentCells = [];
        continue;
      }
      const item = this.parseItem();
      if (item) currentCells.push(item);
    }
    // Flush last row
    if (currentCells.length > 0) {
      rows.push(elem('mtr', [elem('mtd', currentCells.length === 1 ? [currentCells[0]] : [elem('mrow', currentCells)])]));
    }
    this.expect('}');
    return elem('mtable', rows);
  }

  /** Parse \array{...} command (MathJax-style, not \begin{array}). */
  private parseArrayCommand(): MathMLElement {
    this.skipSpaces();
    if (this.peek()?.type === '{') {
      return this.parseBracedTable();
    }
    // Single token argument (e.g., \matrix a)
    const body = this.parseArgSingle();
    return elem('mtable', [elem('mtr', [elem('mtd', [body])])]);
  }

  /** Parse \displaylines{...} command. */
  private parseDisplaylines(): MathMLElement {
    const rows = this.parseBracedTableRows();
    return elem('mtable', rows, { columnalign: 'center' });
  }

  /** Parse \eqalign{...} and friends. */
  private parseEqalign(): MathMLElement {
    const rows = this.parseBracedTableRows();
    return elem('mtable', rows, { columnalign: 'right left' });
  }

  /** Parse \cases{...} command (MathJax-style). */
  private parseCasesCommand(): MathMLElement {
    const rows = this.parseBracedTableRows();
    const mtable = elem('mtable', rows, { columnalign: 'left left' });
    return elem('mrow', [
      elem('mo', ['{'], { fence: 'true', stretchy: 'true', symmetric: 'true' }),
      mtable,
    ]);
  }

  /** Parse \matrix{...}, \pmatrix{...} etc. commands (MathJax-style). */
  private parseMatrixCommand(name: string): MathMLElement {
    const delimMap: Record<string, [string, string]> = {
      matrix:   ['', ''],
      pmatrix:  ['(', ')'],
      bmatrix:  ['[', ']'],
      Bmatrix:  ['{', '}'],
      vmatrix:  ['|', '|'],
      Vmatrix:  ['\u2016', '\u2016'],
    };
    const [leftDelim, rightDelim] = delimMap[name] ?? ['', ''];
    this.skipSpaces();
    let rows: MathMLElement[];
    if (this.peek()?.type === '{') {
      rows = this.parseBracedTableRows();
    } else {
      // Single token argument
      const body = this.parseArgSingle();
      rows = [elem('mtr', [elem('mtd', [body])])];
    }
    const mtable = elem('mtable', rows);

    if (leftDelim || rightDelim) {
      const items: (string | MathMLElement)[] = [];
      if (leftDelim)
        items.push(elem('mo', [leftDelim], { fence: 'true', stretchy: 'true', symmetric: 'true' }));
      items.push(mtable);
      if (rightDelim)
        items.push(elem('mo', [rightDelim], { fence: 'true', stretchy: 'true', symmetric: 'true' }));
      return elem('mrow', items);
    }
    return mtable;
  }

  /** Parse \mbox{...} or \hbox{...}, treating content as text. */
  private parseMbox(): MathMLElement {
    this.skipSpaces();
    const next = this.peek();
    if (next && next.type !== '{') {
      // Single-token argument
      this.advance();
      const text = next.type === 'char'
        ? (next as { type: 'char'; value: string }).value : '';
      return elem('mtext', [text]);
    }
    this.expect('{');
    let text = '';
    let depth = 1;
    while (this.pos < this.tokens.length && depth > 0) {
      const t = this.advance();
      if (t.type === '{') { depth++; text += '{'; }
      else if (t.type === '}') {
        depth--;
        if (depth === 0) break;
        text += '}';
      }
      else if (t.type === 'char') text += (t as { type: 'char'; value: string }).value;
      else if (t.type === 'space') text += ' ';
      else if (t.type === 'newline') text += ' ';
      else if (t.type === 'command') text += (t as { type: 'command'; name: string }).name;
    }
    return elem('mtext', [text]);
  }

  /** Parse a braced table: {rows with & and \\}. */
  private parseBracedTable(): MathMLElement {
    const rows = this.parseBracedTableRows();
    return elem('mtable', rows);
  }

  /** Parse rows from a braced group {... & ... \\ ...}. */
  private parseBracedTableRows(): MathMLElement[] {
    this.expect('{');
    const rows: MathMLElement[] = [];
    let currentCells: MathMLElement[] = [];

    const pushRow = () => {
      if (currentCells.length > 0 || rows.length > 0) {
        rows.push(elem('mtr', currentCells.map(c => elem('mtd', [c]))));
      }
      currentCells = [];
    };

    currentCells.push(this.parseExpression());

    while (true) {
      this.skipSpaces();
      const t = this.peek();
      if (!t || t.type === '}') break;

      if (t.type === '&') {
        this.advance();
        currentCells.push(this.parseExpression());
      } else if (t.type === 'newline') {
        this.advance();
        // Skip optional [dimension] after \\
        this.skipOptionalDimension();
        pushRow();
        this.skipSpaces();
        const next = this.peek();
        if (next && next.type !== '}') {
          currentCells.push(this.parseExpression());
        }
      } else {
        break;
      }
    }
    pushRow();
    this.expect('}');
    return rows;
  }

  /** Skip an optional [dimension] argument (e.g., \\[1cm]). */
  private skipOptionalDimension(): void {
    this.skipSpaces();
    const t = this.peek();
    if (t?.type === 'char' && (t as { type: 'char'; value: string }).value === '[') {
      this.advance();
      let depth = 1;
      while (depth > 0) {
        const p = this.peek();
        if (!p) break;
        this.advance();
        if (p.type === 'char') {
          const v = (p as { type: 'char'; value: string }).value;
          if (v === '[') depth++;
          else if (v === ']') depth--;
        }
      }
    }
  }

  /** Parse an extensible arrow command: \xrightarrow[below]{above}. */
  private parseExtensibleArrow(name: string): MathMLElement {
    const arrowChars: Record<string, string> = {
      xrightarrow: '\u2192',
      xleftarrow: '\u2190',
      xlongequal: '=',
      xmapsto: '\u21A6',
      xleftrightarrow: '\u2194',
      xRightarrow: '\u21D2',
      xLeftarrow: '\u21D0',
      xLeftrightarrow: '\u21D4',
      xhookleftarrow: '\u21A9',
      xhookrightarrow: '\u21AA',
      xtwoheadrightarrow: '\u21A0',
      xtwoheadleftarrow: '\u219E',
      xrightharpoondown: '\u21C1',
      xrightharpoonup: '\u21C0',
      xleftharpoondown: '\u21BD',
      xleftharpoonup: '\u21BC',
      xrightleftharpoons: '\u21CC',
      xleftrightharpoons: '\u21CB',
    };

    const arrow = elem('mo', [arrowChars[name] || '\u2192'], { stretchy: 'true' });

    // Check for optional [below] argument
    this.skipSpaces();
    let below: MathMLElement | null = null;
    const t = this.peek();
    if (t?.type === 'char' && (t as { type: 'char'; value: string }).value === '[') {
      this.advance();
      const items: (string | MathMLElement)[] = [];
      while (true) {
        this.skipSpaces();
        const p = this.peek();
        if (!p) throw new ParseError('Missing ] in extensible arrow');
        if (p.type === 'char' && (p as { type: 'char'; value: string }).value === ']') {
          this.advance();
          break;
        }
        const item = this.parseItem();
        if (item) items.push(item);
      }
      below = items.length === 1 && typeof items[0] !== 'string'
        ? items[0] : elem('mrow', items);
    }

    // Required {above} argument
    const above = this.parseArgSingle();

    if (below) {
      return elem('munderover', [arrow, below, above]);
    }
    return elem('mover', [arrow, above]);
  }

  /** Parse \cfrac[l|r]{num}{denom}. */
  private parseCfrac(): MathMLElement {
    this.skipSpaces();
    // Optional [l] or [r] alignment
    const t = this.peek();
    if (t?.type === 'char' && (t as { type: 'char'; value: string }).value === '[') {
      this.advance();
      // Read alignment character
      while (true) {
        const p = this.peek();
        if (!p) break;
        this.advance();
        if (p.type === 'char' && (p as { type: 'char'; value: string }).value === ']') break;
      }
    }
    const num = this.parseArgSingle();
    const denom = this.parseArgSingle();
    const frac = elem('mfrac', [num, denom]);
    return elem('mstyle', [frac], { displaystyle: 'true', scriptlevel: '0' });
  }

  /** Parse \genfrac{left}{right}{thickness}{style}{num}{denom}. */
  private parseGenfrac(): MathMLElement {
    // Read 6 required braced arguments
    const readBracedText = (): string => {
      this.expect('{');
      let text = '';
      while (true) {
        const t = this.peek();
        if (!t || t.type === '}') break;
        this.advance();
        if (t.type === 'char') text += (t as { type: 'char'; value: string }).value;
        else if (t.type === 'command') text += (t as { type: 'command'; name: string }).name;
      }
      this.expect('}');
      return text;
    };
    const leftDelim = readBracedText();
    const rightDelim = readBracedText();
    const thickness = readBracedText();
    const _style = readBracedText();
    const num = this.parseArgSingle();
    const denom = this.parseArgSingle();

    const attrs: Record<string, string | number | boolean | undefined> = {};
    if (thickness !== '') attrs.linethickness = thickness;

    const frac = elem('mfrac', [num, denom], attrs);

    if (leftDelim || rightDelim) {
      const items: (string | MathMLElement)[] = [];
      if (leftDelim) items.push(elem('mo', [leftDelim], { fence: 'true', stretchy: 'true', symmetric: 'true' }));
      items.push(frac);
      if (rightDelim) items.push(elem('mo', [rightDelim], { fence: 'true', stretchy: 'true', symmetric: 'true' }));
      return elem('mrow', items);
    }
    return frac;
  }

  /** Parse \pmod{...}. */
  private parsePmod(): MathMLElement {
    const body = this.parseArgSingle();
    return elem('mrow', [
      elem('mspace', [], { width: '1em' }),
      elem('mo', ['('], { fence: 'true' }),
      elem('mi', ['mod']),
      elem('mspace', [], { width: '0.333em' }),
      body,
      elem('mo', [')'], { fence: 'true' }),
    ]);
  }

  /** Parse \pod{...}. */
  private parsePod(): MathMLElement {
    const body = this.parseArgSingle();
    return elem('mrow', [
      elem('mspace', [], { width: '1em' }),
      elem('mo', ['('], { fence: 'true' }),
      body,
      elem('mo', [')'], { fence: 'true' }),
    ]);
  }

  /** Parse \mod{...}. */
  private parseMod(): MathMLElement {
    const body = this.parseArgSingle();
    return elem('mrow', [
      elem('mspace', [], { width: '1em' }),
      elem('mi', ['mod']),
      elem('mspace', [], { width: '0.333em' }),
      body,
    ]);
  }

  /** Parse \cancel, \bcancel, \xcancel. */
  private parseCancel(name: string): MathMLElement {
    const body = this.parseArgSingle();
    const notationMap: Record<string, string> = {
      cancel: 'updiagonalstrike',
      bcancel: 'downdiagonalstrike',
      xcancel: 'updiagonalstrike downdiagonalstrike',
    };
    return elem('menclose', [body], { notation: notationMap[name] });
  }

  /** Parse \textcolor{color}{body}. */
  private parseTextcolor(): MathMLElement {
    this.expect('{');
    let color = '';
    while (true) {
      const t = this.peek();
      if (!t || t.type === '}') break;
      this.advance();
      if (t.type === 'char') color += (t as { type: 'char'; value: string }).value;
    }
    this.expect('}');
    const body = this.parseArgSingle();
    return elem('mstyle', [body], { mathcolor: color });
  }

  /** Parse \colorbox{color}{body}. */
  private parseColorbox(): MathMLElement {
    this.expect('{');
    let color = '';
    while (true) {
      const t = this.peek();
      if (!t || t.type === '}') break;
      this.advance();
      if (t.type === 'char') color += (t as { type: 'char'; value: string }).value;
    }
    this.expect('}');
    const body = this.parseArgSingle();
    return elem('mpadded', [body], { mathbackground: color });
  }

  /** Parse \fcolorbox{bordercolor}{bgcolor}{body}. */
  private parseFcolorbox(): MathMLElement {
    this.expect('{');
    let borderColor = '';
    while (true) {
      const t = this.peek();
      if (!t || t.type === '}') break;
      this.advance();
      if (t.type === 'char') borderColor += (t as { type: 'char'; value: string }).value;
    }
    this.expect('}');
    this.expect('{');
    let bgColor = '';
    while (true) {
      const t = this.peek();
      if (!t || t.type === '}') break;
      this.advance();
      if (t.type === 'char') bgColor += (t as { type: 'char'; value: string }).value;
    }
    this.expect('}');
    const body = this.parseArgSingle();
    return elem('mpadded', [body], {
      mathbackground: bgColor,
      style: `border: 1px solid ${borderColor}`,
    });
  }

  /** Parse \smash[tb]{body}. */
  private parseSmash(): MathMLElement {
    this.skipSpaces();
    let smashType = 'both'; // default: smash both height and depth
    const t = this.peek();
    if (t?.type === 'char' && (t as { type: 'char'; value: string }).value === '[') {
      this.advance();
      let opt = '';
      while (true) {
        const p = this.peek();
        if (!p) break;
        if (p.type === 'char' && (p as { type: 'char'; value: string }).value === ']') {
          this.advance();
          break;
        }
        this.advance();
        if (p.type === 'char') opt += (p as { type: 'char'; value: string }).value;
      }
      smashType = opt;
    }
    const body = this.parseArgSingle();
    const attrs: Record<string, string | number | boolean | undefined> = {};
    if (smashType === 'b' || smashType === 'both') attrs.depth = '0';
    if (smashType === 't' || smashType === 'both') attrs.height = '0';
    return elem('mpadded', [body], attrs);
  }

  /** Parse \vphantom{body}. */
  private parseVphantom(): MathMLElement {
    const body = this.parseArgSingle();
    return elem('mpadded', [elem('mphantom', [body])], { width: '0' });
  }

  /** Parse \hphantom{body}. */
  private parseHphantom(): MathMLElement {
    const body = this.parseArgSingle();
    return elem('mpadded', [elem('mphantom', [body])], { height: '0', depth: '0' });
  }

  /** Parse \mathclap, \mathllap, \mathrlap. */
  private parseMathLap(name: string): MathMLElement {
    const body = this.parseArgSingle();
    if (name === 'mathclap') {
      return elem('mpadded', [body], { width: '0', lspace: '-0.5width' });
    }
    if (name === 'mathllap') {
      return elem('mpadded', [body], { width: '0', lspace: '-1width' });
    }
    // mathrlap
    return elem('mpadded', [body], { width: '0' });
  }

  /** Parse \kern or \mkern followed by a dimension. */
  private parseKern(name: string): MathMLElement {
    this.skipSpaces();
    let dim = '';
    while (true) {
      const t = this.peek();
      if (!t) break;
      if (t.type === 'char') {
        const v = (t as { type: 'char'; value: string }).value;
        if (/[0-9.\-]/.test(v) || /[a-z]/.test(v)) {
          dim += v;
          this.advance();
          continue;
        }
      }
      break;
    }
    // Convert mu units to em for mkern (18mu = 1em)
    if (name === 'mkern' && dim.endsWith('mu')) {
      const val = parseFloat(dim);
      if (!isNaN(val)) {
        dim = (val / 18).toFixed(3) + 'em';
      }
    }
    return elem('mspace', [], { width: dim || '0pt' });
  }

  /** Parse \hspace{dimension}. */
  private parseHspace(): MathMLElement {
    // Check for optional *
    this.skipSpaces();
    const t = this.peek();
    if (t?.type === 'char' && (t as { type: 'char'; value: string }).value === '*') {
      this.advance(); // skip *
    }
    this.expect('{');
    let dim = '';
    while (true) {
      const t = this.peek();
      if (!t || t.type === '}') break;
      this.advance();
      if (t.type === 'char') dim += (t as { type: 'char'; value: string }).value;
    }
    this.expect('}');
    return elem('mspace', [], { width: dim || '0pt' });
  }

  /** Parse \rule[lift]{width}{height}. */
  private parseRule(): MathMLElement {
    this.skipSpaces();
    // Optional [lift] argument
    const t = this.peek();
    if (t?.type === 'char' && (t as { type: 'char'; value: string }).value === '[') {
      this.advance();
      while (true) {
        const p = this.peek();
        if (!p) break;
        this.advance();
        if (p.type === 'char' && (p as { type: 'char'; value: string }).value === ']') break;
      }
    }
    // Read {width}
    this.expect('{');
    let width = '';
    while (true) {
      const t2 = this.peek();
      if (!t2 || t2.type === '}') break;
      this.advance();
      if (t2.type === 'char') width += (t2 as { type: 'char'; value: string }).value;
    }
    this.expect('}');
    // Read {height}
    this.expect('{');
    let height = '';
    while (true) {
      const t2 = this.peek();
      if (!t2 || t2.type === '}') break;
      this.advance();
      if (t2.type === 'char') height += (t2 as { type: 'char'; value: string }).value;
    }
    this.expect('}');
    return elem('mspace', [], { width: width || '0pt', height: height || '0pt' });
  }

  /** Parse \raisebox{lift}{body}. */
  private parseRaisebox(): MathMLElement {
    this.expect('{');
    let lift = '';
    while (true) {
      const t = this.peek();
      if (!t || t.type === '}') break;
      this.advance();
      if (t.type === 'char') lift += (t as { type: 'char'; value: string }).value;
    }
    this.expect('}');
    const body = this.parseArgSingle();
    return elem('mpadded', [body], { voffset: lift });
  }

  /** Parse \sideset{left}{right}{base}. */
  private parseSideset(): MathMLElement {
    const left = this.parseArgSingle();
    const right = this.parseArgSingle();
    const base = this.parseArgSingle();
    // Approximate sideset: place left scripts, base, right scripts
    return elem('mrow', [
      elem('mrow', [left]),
      base,
      elem('mrow', [right]),
    ]);
  }

  /** Parse \prescript{sup}{sub}{base}. */
  private parsePrescript(): MathMLElement {
    const presup = this.parseArgSingle();
    const presub = this.parseArgSingle();
    const base = this.parseArgSingle();
    return elem('mmultiscripts', [
      base,
      elem('mprescripts'),
      presub,
      presup,
    ]);
  }

  /** Parse \mathinner{body}. */
  private parseMathinner(): MathMLElement {
    return this.parseArgSingle();
  }

  /** Parse \sout{body} — strikeout. */
  private parseSout(): MathMLElement {
    const body = this.parseArgSingle();
    return elem('menclose', [body], { notation: 'horizontalstrike' });
  }

  /** Parse \href{url}{body}. */
  private parseHref(): MathMLElement {
    this.expect('{');
    let url = '';
    while (true) {
      const t = this.peek();
      if (!t || t.type === '}') break;
      this.advance();
      if (t.type === 'char') url += (t as { type: 'char'; value: string }).value;
      else if (t.type === 'command') url += '\\' + (t as { type: 'command'; name: string }).name;
    }
    this.expect('}');
    const body = this.parseArgSingle();
    return elem('mrow', [body], { href: url });
  }

  /** Parse \url{...}. */
  private parseUrl(): MathMLElement {
    this.expect('{');
    let url = '';
    while (true) {
      const t = this.peek();
      if (!t || t.type === '}') break;
      this.advance();
      if (t.type === 'char') url += (t as { type: 'char'; value: string }).value;
      else if (t.type === 'command') url += '\\' + (t as { type: 'command'; name: string }).name;
    }
    this.expect('}');
    return elem('mtext', [url], { href: url });
  }

  /** Parse \char"XXXX or \charNN. */
  private parseChar(): MathMLElement {
    this.skipSpaces();
    let code = '';
    let isHex = false;
    const t = this.peek();
    if (t?.type === 'char' && (t as { type: 'char'; value: string }).value === '"') {
      this.advance();
      isHex = true;
    }
    while (true) {
      const p = this.peek();
      if (!p || p.type !== 'char') break;
      const v = (p as { type: 'char'; value: string }).value;
      if (isHex ? /[0-9a-fA-F]/.test(v) : /[0-9]/.test(v)) {
        code += v;
        this.advance();
      } else break;
    }
    const codePoint = isHex ? parseInt(code, 16) : parseInt(code, 10);
    if (!isNaN(codePoint)) {
      return elem('mtext', [String.fromCodePoint(codePoint)]);
    }
    return elem('merror', [elem('mtext', ['\\char'])]);
  }

  /** Parse \unicode{XXXX}. */
  private parseUnicode(): MathMLElement {
    this.expect('{');
    let code = '';
    while (true) {
      const t = this.peek();
      if (!t || t.type === '}') break;
      this.advance();
      if (t.type === 'char') code += (t as { type: 'char'; value: string }).value;
    }
    this.expect('}');
    const codePoint = code.startsWith('x') || code.startsWith('X')
      ? parseInt(code.slice(1), 16) : parseInt(code, 16);
    if (!isNaN(codePoint)) {
      return elem('mtext', [String.fromCodePoint(codePoint)]);
    }
    return elem('merror', [elem('mtext', ['\\unicode'])]);
  }

  /** Parse \label{...} — renders as nothing (used for cross-references). */
  private parseLabel(): MathMLElement {
    this.expect('{');
    while (true) {
      const t = this.peek();
      if (!t || t.type === '}') break;
      this.advance();
    }
    this.expect('}');
    return elem('mrow'); // invisible
  }

  /** Parse \ref{...} or \eqref{...}. */
  private parseRef(name: string): MathMLElement {
    this.expect('{');
    let label = '';
    while (true) {
      const t = this.peek();
      if (!t || t.type === '}') break;
      this.advance();
      if (t.type === 'char') label += (t as { type: 'char'; value: string }).value;
    }
    this.expect('}');
    if (name === 'eqref') {
      return elem('mrow', [
        elem('mo', ['(']),
        elem('mtext', [label]),
        elem('mo', [')']),
      ]);
    }
    return elem('mtext', [label]);
  }

  /** Parse \htmlStyle, \htmlClass, \htmlId, \htmlData commands. */
  private parseHtmlAttr(_name: string): MathMLElement {
    // Consume the first argument (the HTML attribute value)
    this.expect('{');
    while (true) {
      const t = this.peek();
      if (!t || t.type === '}') break;
      this.advance();
    }
    this.expect('}');
    // The second argument is the body
    return this.parseArgSingle();
  }

  /** Parse rcases environment. */
  private parseRcases(): MathMLElement {
    const rows = this.parseTableRows('rcases');
    const mtable = elem('mtable', rows, { columnalign: 'left left' });
    return elem('mrow', [
      mtable,
      elem('mo', ['}'], { fence: 'true', stretchy: 'true', symmetric: 'true' }),
    ]);
  }

  /** Parse \begin{equation} or \begin{equation*}. */
  private parseEquationEnv(envName: string): MathMLElement {
    const body = this.parseExpression();
    // Consume \end{equation}
    this.skipSpaces();
    const t = this.peek();
    if (t?.type === 'command' && (t as { type: 'command'; name: string }).name === 'end') {
      this.advance();
      this.expect('{');
      let endName = '';
      while (true) {
        const et = this.peek();
        if (!et || et.type === '}') break;
        this.advance();
        if (et.type === 'char') endName += (et as { type: 'char'; value: string }).value;
        if (et.type === 'command') endName += (et as { type: 'command'; name: string }).name;
      }
      this.expect('}');
    }
    return body;
  }

  /** Parse \begin{CD} commutative diagram environment. */
  private parseCDEnv(envName: string): MathMLElement {
    // Simple table-based rendering of commutative diagrams
    const rows = this.parseTableRows(envName);
    return elem('mtable', rows, { columnalign: 'center' });
  }

  /** Parse table rows until \end{envName}. */
  private parseTableRows(envName: string): MathMLElement[] {
    const rows: MathMLElement[] = [];
    let currentCells: MathMLElement[] = [];

    const pushRow = () => {
      if (currentCells.length > 0 || rows.length > 0) {
        rows.push(elem('mtr', currentCells.map(c => elem('mtd', [c]))));
      }
      currentCells = [];
    };

    // Parse cell content
    const parseCell = (): MathMLElement => {
      return this.parseExpression();
    };

    currentCells.push(parseCell());

    while (true) {
      this.skipSpaces();
      const t = this.peek();
      if (!t) break;

      // Check for \end{envName}
      if (t.type === 'command' && t.name === 'end') {
        this.advance();
        this.expect('{');
        // Read and verify environment name
        let endName = '';
        while (true) {
          const et = this.peek();
          if (!et || et.type === '}') break;
          this.advance();
          if (et.type === 'char') endName += (et as { type: 'char'; value: string }).value;
        }
        this.expect('}');
        pushRow();
        break;
      }

      if (t.type === '&') {
        this.advance();
        currentCells.push(parseCell());
      } else if (t.type === 'newline') {
        this.advance();
        this.skipOptionalDimension();
        pushRow();
        // Start new row if there's more content
        this.skipSpaces();
        const next = this.peek();
        if (next && !(next.type === 'command' && next.name === 'end')) {
          currentCells.push(parseCell());
        }
      } else {
        break;
      }
    }

    return rows;
  }

  // --- Braket/physics commands ---

  private parseBraket(variant: string): MathMLElement {
    const content = this.parseGroup();
    if (variant === 'bra') {
      return elem('mrow', [
        elem('mo', ['\u27E8'], { stretchy: 'true', fence: 'true' }),
        content,
        elem('mo', ['|'], { stretchy: 'true', fence: 'true' }),
      ]);
    }
    if (variant === 'ket') {
      return elem('mrow', [
        elem('mo', ['|'], { stretchy: 'true', fence: 'true' }),
        content,
        elem('mo', ['\u27E9'], { stretchy: 'true', fence: 'true' }),
      ]);
    }
    // braket or Braket: split on | to get phi|psi
    const children = content.tag === 'mrow' ? content.children : [content];
    const parts: MathMLElement[][] = [[]];
    for (const child of children) {
      if (typeof child !== 'string' && child.tag === 'mo' &&
          child.children.length === 1 && child.children[0] === '|') {
        parts.push([]);
      } else if (typeof child !== 'string' && child.tag === 'mo' &&
          child.children.length === 1 && child.children[0] === '\u2223') {
        parts.push([]);
      } else {
        parts[parts.length - 1].push(typeof child === 'string' ? elem('mtext', [child]) : child);
      }
    }
    const result: Array<string | MathMLElement> = [
      elem('mo', ['\u27E8'], { stretchy: 'true', fence: 'true' }),
    ];
    for (let i = 0; i < parts.length; i++) {
      if (i > 0) {
        result.push(elem('mo', ['|'], { stretchy: 'true', fence: 'true' }));
      }
      if (parts[i].length === 1) {
        result.push(parts[i][0]);
      } else if (parts[i].length > 1) {
        result.push(elem('mrow', parts[i]));
      }
    }
    result.push(elem('mo', ['\u27E9'], { stretchy: 'true', fence: 'true' }));
    return elem('mrow', result);
  }

  private parseSetNotation(): MathMLElement {
    const content = this.parseGroup();
    const children = content.tag === 'mrow' ? content.children : [content];
    const parts: MathMLElement[][] = [[]];
    for (const child of children) {
      if (typeof child !== 'string' && child.tag === 'mo' &&
          child.children.length === 1 && (child.children[0] === '|' || child.children[0] === '\u2223')) {
        parts.push([]);
      } else {
        parts[parts.length - 1].push(typeof child === 'string' ? elem('mtext', [child]) : child);
      }
    }
    const result: Array<string | MathMLElement> = [
      elem('mo', ['{'], { stretchy: 'true', fence: 'true' }),
    ];
    for (let i = 0; i < parts.length; i++) {
      if (i > 0) {
        result.push(elem('mo', ['|'], { stretchy: 'true' }));
      }
      if (parts[i].length === 1) {
        result.push(parts[i][0]);
      } else if (parts[i].length > 1) {
        result.push(elem('mrow', parts[i]));
      }
    }
    result.push(elem('mo', ['}'], { stretchy: 'true', fence: 'true' }));
    return elem('mrow', result);
  }

  private parseDelimiterShortcut(name: string): MathMLElement {
    const content = this.parseGroup();
    let left: string, right: string;
    if (name === 'abs') {
      left = '|'; right = '|';
    } else if (name === 'norm') {
      left = '\u2016'; right = '\u2016';
    } else {
      // qty - parentheses
      left = '('; right = ')';
    }
    return elem('mrow', [
      elem('mo', [left], { stretchy: 'true', fence: 'true' }),
      content,
      elem('mo', [right], { stretchy: 'true', fence: 'true' }),
    ]);
  }

  private parseDerivative(symbol: string): MathMLElement {
    const f = this.parseGroup();
    const x = this.parseGroup();
    return elem('mfrac', [
      elem('mrow', [elem('mi', [symbol]), f]),
      elem('mrow', [elem('mi', [symbol]), x]),
    ]);
  }

  // --- Chemistry ---

  private parseCe(): MathMLElement {
    // Parse the braced argument as raw text
    this.skipSpaces();
    const t = this.peek();
    if (!t || t.type !== '{') {
      return elem('merror', [elem('mtext', ['\\ce requires braced argument'])]);
    }
    this.advance(); // skip {

    // Collect raw tokens until matching }
    let depth = 1;
    const parts: Array<string | MathMLElement> = [];
    let currentText = '';

    const flushText = () => {
      if (currentText) {
        parts.push(elem('mtext', [currentText]));
        currentText = '';
      }
    };

    while (this.pos < this.tokens.length && depth > 0) {
      const tok = this.tokens[this.pos];
      if (tok.type === '{') {
        depth++;
        this.pos++;
      } else if (tok.type === '}') {
        depth--;
        if (depth === 0) { this.pos++; break; }
        this.pos++;
      } else if (tok.type === 'char') {
        const ch = tok.value;
        if (/[A-Z]/.test(ch)) {
          // Element symbol start
          flushText();
          let symbol = ch;
          // Look ahead for lowercase letters
          while (this.pos + 1 < this.tokens.length) {
            const next = this.tokens[this.pos + 1];
            if (next.type === 'char' && /[a-z]/.test(next.value)) {
              symbol += next.value;
              this.pos++;
            } else {
              break;
            }
          }
          parts.push(elem('mi', [symbol], { mathvariant: 'normal' }));
          this.pos++;
        } else if (/[0-9]/.test(ch)) {
          // Subscript number
          flushText();
          let num = ch;
          while (this.pos + 1 < this.tokens.length) {
            const next = this.tokens[this.pos + 1];
            if (next.type === 'char' && /[0-9]/.test(next.value)) {
              num += next.value;
              this.pos++;
            } else {
              break;
            }
          }
          parts.push(elem('mn', [num]));
          this.pos++;
        } else if (ch === '+') {
          flushText();
          parts.push(elem('mo', ['+']));
          this.pos++;
        } else if (ch === '-') {
          flushText();
          // Check for arrow ->
          if (this.pos + 1 < this.tokens.length) {
            const next = this.tokens[this.pos + 1];
            if (next.type === 'char' && next.value === '>') {
              parts.push(elem('mo', ['\u2192']));
              this.pos += 2;
              continue;
            }
          }
          parts.push(elem('mo', ['-']));
          this.pos++;
        } else if (ch === '=') {
          flushText();
          parts.push(elem('mo', ['=']));
          this.pos++;
        } else if (ch === '(' || ch === ')' || ch === '[' || ch === ']') {
          flushText();
          parts.push(elem('mo', [ch]));
          this.pos++;
        } else if (ch === '^') {
          // Superscript handling
          flushText();
          this.pos++;
        } else if (ch === ' ' || ch === '\u00A0') {
          this.pos++;
        } else {
          currentText += ch;
          this.pos++;
        }
      } else if (tok.type === '_') {
        // Subscript - the number after should already be handled
        this.pos++;
      } else if (tok.type === '^') {
        this.pos++;
      } else if (tok.type === 'space') {
        this.pos++;
      } else if (tok.type === 'command') {
        flushText();
        // Handle some common chem commands
        if (tok.name === 'rightarrow' || tok.name === 'to') {
          parts.push(elem('mo', ['\u2192']));
        } else if (tok.name === 'leftarrow') {
          parts.push(elem('mo', ['\u2190']));
        } else if (tok.name === 'leftrightarrow' || tok.name === 'rightleftharpoons') {
          parts.push(elem('mo', ['\u21CC']));
        } else {
          parts.push(elem('mtext', ['\\' + tok.name]));
        }
        this.pos++;
      } else {
        this.pos++;
      }
    }
    flushText();

    return elem('mrow', parts);
  }
}

// ---------------------------------------------------------------------------
// Style helpers
// ---------------------------------------------------------------------------

/** Old-style font switches (\bf, \it, etc.) that apply to the rest of the group. */
const fontSwitches: Record<string, string> = {
  bf: 'bold',
  it: 'italic',
  rm: 'normal',
  sf: 'sans-serif',
  tt: 'monospace',
  cal: 'script',
};

function isStyleSwitch(name: string): boolean {
  return name === 'displaystyle' || name === 'textstyle' ||
         name === 'scriptstyle' || name === 'scriptscriptstyle' ||
         name in fontSwitches;
}

function getStyleAttrs(name: string): Record<string, string | number | boolean | undefined> {
  if (name in fontSwitches) {
    return { mathvariant: fontSwitches[name] };
  }
  switch (name) {
    case 'displaystyle':
      return { displaystyle: 'true', scriptlevel: '0' };
    case 'textstyle':
      return { displaystyle: 'false', scriptlevel: '0' };
    case 'scriptstyle':
      return { displaystyle: 'false', scriptlevel: '1' };
    case 'scriptscriptstyle':
      return { displaystyle: 'false', scriptlevel: '2' };
    default:
      return {};
  }
}

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParseError';
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a LaTeX math expression and return a MathML element tree.
 *
 * @param input - LaTeX math expression (without $ delimiters).
 * @param options - Rendering options.
 * @returns MathMLElement tree rooted at `<math>`.
 */
export function render(input: string, options: RenderOptions = {}): MathMLElement {
  const macros = options.macros ? normalizeMacros(options.macros) : new Map();
  const expanded = expandMacros(input, macros);
  const tokens = tokenize(expanded);
  const parser = new Parser(tokens);
  const body = parser.parseExpression();

  const math = elem('math', body.tag === 'mrow' ? body.children : [body], {
    xmlns: 'http://www.w3.org/1998/Math/MathML',
  });
  if (options.displayMode) {
    math.attrs.display = 'block';
  }
  return math;
}

/**
 * Parse a LaTeX math expression and return a MathML string.
 *
 * @param input - LaTeX math expression (without $ delimiters).
 * @param options - Rendering options.
 * @returns MathML markup string.
 */
export function renderToString(input: string, options: RenderOptions = {}): string {
  const tree = render(input, options);
  let xml = writeXml(tree);
  // writeXml strips xmlns, but we need it for standalone MathML in browsers
  xml = xml.replace(/^<math/, '<math xmlns="http://www.w3.org/1998/Math/MathML"');
  return xml;
}
