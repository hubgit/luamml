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

function expandMacros(input: string, macros: Map<string, MacroDef>): string {
  if (macros.size === 0) return input;

  const MAX_ITERATIONS = 100;
  let result = input;

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    let expanded = false;

    // Scan for command names that match a macro
    let i = 0;
    let out = '';
    while (i < result.length) {
      if (result[i] === '\\') {
        i++;
        if (i >= result.length) { out += '\\'; break; }

        // Read command name
        let name = '';
        if (/[a-zA-Z]/.test(result[i])) {
          while (i < result.length && /[a-zA-Z]/.test(result[i])) {
            name += result[i];
            i++;
          }
          // Skip trailing whitespace
          while (i < result.length && /[ \t\n\r]/.test(result[i])) i++;
        } else {
          name = result[i];
          i++;
        }

        const def = macros.get(name);
        if (def) {
          expanded = true;
          if (def.args === 0) {
            out += def.expansion;
          } else {
            // Extract arguments
            const args: string[] = [];
            for (let a = 0; a < def.args; a++) {
              // Skip whitespace
              while (i < result.length && /[ \t\n\r]/.test(result[i])) i++;
              if (i >= result.length) {
                args.push('');
              } else if (result[i] === '{') {
                // Braced argument
                i++;
                let depth = 1;
                let arg = '';
                while (i < result.length && depth > 0) {
                  if (result[i] === '{') depth++;
                  else if (result[i] === '}') {
                    depth--;
                    if (depth === 0) { i++; break; }
                  }
                  arg += result[i];
                  i++;
                }
                args.push(arg);
              } else {
                // Single token argument
                if (result[i] === '\\') {
                  let cmd = '\\';
                  i++;
                  if (i < result.length && /[a-zA-Z]/.test(result[i])) {
                    while (i < result.length && /[a-zA-Z]/.test(result[i])) {
                      cmd += result[i];
                      i++;
                    }
                  } else if (i < result.length) {
                    cmd += result[i];
                    i++;
                  }
                  args.push(cmd);
                } else {
                  args.push(result[i]);
                  i++;
                }
              }
            }
            // Substitute #1, #2, ... in expansion
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
      return this.makeCharElement(t.value);
    }
    if (t?.type === 'command') {
      this.advance();
      const result = this.parseCommand(t.name);
      if (result) return result;
    }
    throw new ParseError('Expected argument');
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
    const body = this.parseArgSingle();
    return elem('mstyle', [body], { mathcolor: color });
  }

  private parseBoxed(): MathMLElement {
    const body = this.parseArgSingle();
    return elem('menclose', [body], { notation: 'box' });
  }

  private parseTextCommand(cmd: string): MathMLElement {
    // Collect raw text from the braced argument
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
    if (envName === 'cases') {
      return this.parseCases();
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
}

// ---------------------------------------------------------------------------
// Style helpers
// ---------------------------------------------------------------------------

function isStyleSwitch(name: string): boolean {
  return name === 'displaystyle' || name === 'textstyle' ||
         name === 'scriptstyle' || name === 'scriptscriptstyle';
}

function getStyleAttrs(name: string): Record<string, string | number | boolean | undefined> {
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
