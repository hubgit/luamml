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
  symbols, accents, wideAccents, nonAccentDecorations, operatorNames,
  operatorNamesWithLimits, bigOperators, delimiters, fontCommands,
} from './latex-commands.js';

/** Replace leading/trailing spaces with nbsp so they survive HTML parsing in mtext. */
function preserveSpaces(text: string): string {
  return text.replace(/^ /, '\u00A0').replace(/ $/, '\u00A0');
}

// Characters that are stretchy by default in MathML and need stretchy="false"
// when used as ordinary (non-\left/\right) delimiters/arrows.
const stretchyChars = new Set([
  '(', ')', '[', ']', '{', '}', '|', '\u2016',       // basic fences
  '\u2191', '\u2193', '\u2195',                       // ↑ ↓ ↕
  '\u21D1', '\u21D3', '\u21D5',                       // ⇑ ⇓ ⇕
  '\u27E8', '\u27E9',                                 // ⟨ ⟩
  '\u230A', '\u230B', '\u2308', '\u2309',             // ⌊ ⌋ ⌈ ⌉
  '\u23B0', '\u23B1',                                 // ⎰ ⎱ (moustache)
  '\u27EE', '\u27EF',                                 // ⟮ ⟯ (group)
  '/',  '\\',                                         // slashes
  '\u2192', '\u2190', '\u21D2', '\u21D0',             // → ← ⇒ ⇐
  '\u2194', '\u21D4',                                 // ↔ ⇔
  '\u27F5', '\u27F6', '\u27F7', '\u27F8', '\u27F9', '\u27FA', // long arrows
  '\u21A6', '\u27FC',                                 // ↦ ⟼
  '\u221A',                                           // √ (surd)
]);

// Fence characters — used to decide whether to add fence="false" when
// a delimiter symbol appears outside \left/\right context.
const fenceChars = new Set([
  '(', ')', '[', ']', '{', '}', '|', '\u2016',
  '\u27E8', '\u27E9', '\u230A', '\u230B', '\u2308', '\u2309',
  '\u23B0', '\u23B1', '\u27EE', '\u27EF',
]);

// Symbols that are upright in TeX and need mathvariant="normal" as single-char <mi>.
// Only needed for characters in the "default italic" range of MathML:
// Latin (a-z, A-Z) and Greek (α-ω, Α-Ω). Other Unicode symbols (ℏ, ∂, ∞, etc.)
// don't default to italic so they don't need mathvariant="normal".
const uprightSymbols = new Set([
  // Uppercase Greek letters
  'Gamma', 'Delta', 'Theta', 'Lambda', 'Xi', 'Pi', 'Sigma', 'Upsilon',
  'Phi', 'Psi', 'Omega',
]);

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
  | { type: 'char'; value: string; _noexpand?: boolean }
  | { type: 'command'; name: string; _noexpand?: boolean }
  | { type: '{'; _noexpand?: boolean }
  | { type: '}'; _noexpand?: boolean }
  | { type: '^'; _noexpand?: boolean }
  | { type: '_'; _noexpand?: boolean }
  | { type: '&'; _noexpand?: boolean }
  | { type: 'newline'; _noexpand?: boolean }
  | { type: 'space'; _noexpand?: boolean };

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
// Macro expansion (KaTeX-style token-based)
// ---------------------------------------------------------------------------

function normalizeMacros(macros: Record<string, string | MacroDef>): Map<string, MacroDef> {
  const result = new Map<string, MacroDef>();
  for (const [key, value] of Object.entries(macros)) {
    const name = key.startsWith('\\') ? key.slice(1) : key;
    if (typeof value === 'string') {
      result.set(name, { args: 0, expansion: value });
    } else {
      result.set(name, value);
    }
  }
  return result;
}

/**
 * Token-based macro expander inspired by KaTeX's MacroExpander ("gullet").
 *
 * Instead of doing string-level expansion before tokenization, this class
 * wraps the token stream and expands macros lazily as tokens are consumed
 * by the parser.  It maintains a token stack (in reverse order) so that
 * expansion results are naturally consumed in the correct order.
 *
 * Key API for the parser:
 *   future()          – peek at the next token without expanding
 *   popToken()        – remove and return the next unexpanded token
 *   expandNextToken() – recursively expand and return the next non-macro token
 *   consumeSpaces()   – skip whitespace tokens
 */
class MacroExpander {
  private macros: Map<string, MacroDef>;
  /** Token source – the flat tokenized input. */
  private source: Token[];
  private sourcePos: number;
  /** Stack of tokens in REVERSE order (top = end of array). */
  private stack: Token[];
  private expansionCount: number;
  private static MAX_EXPAND = 1000;

  constructor(tokens: Token[], macros: Map<string, MacroDef>) {
    this.source = tokens;
    this.sourcePos = 0;
    this.macros = macros;
    this.stack = [];
    this.expansionCount = 0;

    // Built-in macros (can be overridden by user macros)
    if (!this.macros.has('idotsint')) {
      this.macros.set('idotsint', { args: 0, expansion: '\\int\\cdots\\int' });
    }
  }

  // ---- Low-level token access ----

  /** Peek at the next token without consuming it. */
  future(): Token | null {
    if (this.stack.length === 0) {
      if (this.sourcePos >= this.source.length) return null;
      this.stack.push(this.source[this.sourcePos++]);
    }
    return this.stack[this.stack.length - 1];
  }

  /** Remove and return the next unexpanded token. */
  popToken(): Token | null {
    this.future(); // ensure non-empty stack if possible
    return this.stack.length > 0 ? this.stack.pop()! : null;
  }

  /** Push a token back onto the stack (for lookahead / expansion). */
  pushToken(token: Token): void {
    this.stack.push(token);
  }

  /** Push an array of tokens onto the stack (in reverse, so first token is on top). */
  pushTokens(tokens: Token[]): void {
    for (let i = tokens.length - 1; i >= 0; i--) {
      this.stack.push(tokens[i]);
    }
  }

  /** Skip whitespace tokens. */
  consumeSpaces(): void {
    while (true) {
      const tok = this.future();
      if (tok && tok.type === 'space') {
        this.stack.pop();
      } else {
        break;
      }
    }
  }

  // ---- Argument reading (at token level) ----

  /**
   * Consume a single macro argument from the token stream.
   * If the next non-space token is '{', reads the entire braced group
   * (returning the tokens inside, without the braces).
   * Otherwise returns a single token.
   */
  consumeArg(): Token[] {
    this.consumeSpaces();
    const tok = this.popToken();
    if (!tok) throw new ParseError('Expected argument, got end of input');

    if (tok.type === '{') {
      // Read until matching '}'
      const tokens: Token[] = [];
      let depth = 1;
      while (depth > 0) {
        const t = this.popToken();
        if (!t) throw new ParseError('Unexpected end of input in macro argument');
        if (t.type === '{') depth++;
        else if (t.type === '}') {
          depth--;
          if (depth === 0) break;
        }
        tokens.push(t);
      }
      return tokens;
    }
    return [tok];
  }

  /**
   * Consume the specified number of arguments.
   */
  consumeArgs(numArgs: number): Token[][] {
    const args: Token[][] = [];
    for (let i = 0; i < numArgs; i++) {
      args.push(this.consumeArg());
    }
    return args;
  }

  // ---- Expansion ----

  /**
   * Try to expand the next token once.
   * Returns true if expansion occurred, false otherwise.
   * After expansion, the result tokens are on the stack.
   */
  private expandOnce(): boolean {
    const tok = this.popToken();
    if (!tok) return false;

    // Only commands can be macros
    if (tok.type !== 'command') {
      this.pushToken(tok);
      return false;
    }

    // Handle inline definition commands — they consume tokens and register
    // macros but produce no output tokens.
    if (this.tryProcessDefinition(tok.name)) {
      return true;
    }

    // Handle \expandafter — expand the token after the next token
    if (tok.name === 'expandafter') {
      const nextTok = this.popToken();
      if (nextTok) {
        // Expand the token after nextTok once
        this.expandOnce();
        // Push nextTok back so it's processed next
        this.pushToken(nextTok);
      }
      return true;
    }

    // Handle \noexpand — next token should not be expanded
    if (tok.name === 'noexpand') {
      const nextTok = this.popToken();
      if (nextTok) {
        // Mark as non-expandable by converting command to a special form
        // that won't match any macro (we push it with a noexpand flag)
        const safeTok: Token = { ...nextTok, _noexpand: true } as Token & { _noexpand: boolean };
        this.pushToken(safeTok);
      }
      return true;
    }

    // Handle \relax — just consume it
    if (tok.name === 'relax') {
      return true;
    }

    // Check noexpand flag
    if ((tok as Token & { _noexpand?: boolean })._noexpand) {
      // Push back without the flag, as a plain token
      const clean: Token = { type: 'command', name: tok.name };
      this.pushToken(clean);
      return false;
    }

    // Look up in macro registry
    const def = this.macros.get(tok.name);
    if (!def) {
      this.pushToken(tok);
      return false;
    }

    // Guard against infinite expansion
    this.expansionCount++;
    if (this.expansionCount > MacroExpander.MAX_EXPAND) {
      throw new ParseError('Too many macro expansions: possible infinite loop');
    }

    // Read arguments
    let args: Token[][] = [];
    if (def.args > 0) {
      args = this.consumeArgs(def.args);
    }

    // Tokenize the expansion template and substitute arguments
    const expansionTokens = tokenize(def.expansion);
    const result = this.substituteArgs(expansionTokens, args);

    // Push result onto stack (they'll be expanded on next calls)
    this.pushTokens(result);
    return true;
  }

  /**
   * Substitute #1, #2, ... placeholders in expansion tokens with argument tokens.
   */
  private substituteArgs(tokens: Token[], args: Token[][]): Token[] {
    if (args.length === 0) return tokens;

    const result: Token[] = [];
    let i = 0;
    while (i < tokens.length) {
      const tok = tokens[i];
      // Check for # followed by a digit
      if (tok.type === 'command' && tok.name === '#') {
        // In tokenize, # becomes command '#' — but actually # isn't a command.
        // Let's handle the case where the expansion string has #1, #2 etc.
        // These are tokenized as char '#' followed by char '1' etc.
        i++;
        if (i < tokens.length) {
          const next = tokens[i];
          if (next.type === 'char' && /[1-9]/.test(next.value)) {
            const argIdx = parseInt(next.value) - 1;
            if (argIdx < args.length) {
              result.push(...args[argIdx]);
            }
            i++;
            continue;
          }
          // ## → literal #
          if (next.type === 'command' && next.name === '#') {
            result.push(tok);
            i++;
            continue;
          }
        }
        result.push(tok);
        continue;
      }
      // Also handle # as a char token (from tokenize, # is not special)
      if (tok.type === 'char' && tok.value === '#') {
        i++;
        if (i < tokens.length) {
          const next = tokens[i];
          if (next.type === 'char' && /[1-9]/.test(next.value)) {
            const argIdx = parseInt(next.value) - 1;
            if (argIdx < args.length) {
              result.push(...args[argIdx]);
            }
            i++;
            continue;
          }
          // ## → literal #
          if (next.type === 'char' && next.value === '#') {
            result.push(tok);
            i++;
            continue;
          }
        }
        result.push(tok);
        continue;
      }
      result.push(tok);
      i++;
    }
    return result;
  }

  /**
   * Recursively expand tokens until the next non-expandable token is found.
   * Returns that token (already removed from the stream).
   */
  expandNextToken(): Token | null {
    while (true) {
      if (this.expandOnce() === false) {
        // The token on top of the stack is not expandable
        return this.popToken();
      }
      // Expansion occurred — loop to try expanding the new top token
    }
  }

  /**
   * Peek at the next fully-expanded token without consuming it.
   */
  peekExpanded(): Token | null {
    const tok = this.expandNextToken();
    if (tok) this.pushToken(tok);
    return tok;
  }

  // ---- Inline definition processing ----

  /**
   * Try to process an inline macro definition command.
   * Returns true if the command was a definition and was processed.
   */
  private tryProcessDefinition(name: string): boolean {
    if (name === 'def' || name === 'gdef' || name === 'xdef' || name === 'edef') {
      this.processDef();
      return true;
    }
    if (name === 'let') {
      this.processLet();
      return true;
    }
    if (name === 'newcommand' || name === 'renewcommand' || name === 'providecommand') {
      this.processNewcommand();
      return true;
    }
    if (name === 'DeclareMathOperator') {
      this.processDeclareMathOperator();
      return true;
    }
    return false;
  }

  /**
   * Process \def\macroname#1#2{expansion}
   */
  private processDef(): void {
    // Read the macro name (should be a command token)
    this.consumeSpaces();
    const nameTok = this.popToken();
    if (!nameTok || nameTok.type !== 'command') {
      return; // malformed \def — skip silently
    }
    const macroName = nameTok.name;

    // Count #n parameter tokens
    let argCount = 0;
    while (true) {
      const t = this.future();
      if (t && t.type === 'char' && t.value === '#') {
        this.popToken();
        const numTok = this.popToken();
        if (numTok && numTok.type === 'char' && /[0-9]/.test(numTok.value)) {
          argCount = Math.max(argCount, parseInt(numTok.value));
        }
      } else {
        break;
      }
    }

    // Read expansion body (braced group)
    const bodyTokens = this.consumeArg();
    const expansion = this.tokensToString(bodyTokens);
    this.macros.set(macroName, { args: argCount, expansion });
  }

  /**
   * Process \let\foo=\bar or \let\foo\bar
   */
  private processLet(): void {
    this.consumeSpaces();
    const nameTok = this.popToken();
    if (!nameTok || nameTok.type !== 'command') return;
    const macroName = nameTok.name;

    // Optional =
    this.consumeSpaces();
    const eq = this.future();
    if (eq && eq.type === 'char' && eq.value === '=') {
      this.popToken();
    }
    this.consumeSpaces();

    // Read the value
    const valTok = this.popToken();
    if (!valTok) return;
    let value: string;
    if (valTok.type === 'command') {
      value = '\\' + valTok.name;
    } else if (valTok.type === 'char') {
      value = valTok.value;
    } else {
      return;
    }
    this.macros.set(macroName, { args: 0, expansion: value });
  }

  /**
   * Process \newcommand{\foo}[n]{expansion}
   */
  private processNewcommand(): void {
    this.consumeSpaces();

    // Read macro name: either \foo or {\foo}
    let macroName = '';
    const t = this.future();
    if (t && t.type === '{') {
      this.popToken(); // consume {
      const inner = this.popToken();
      if (inner && inner.type === 'command') {
        macroName = inner.name;
      }
      // consume until }
      while (true) {
        const tok = this.popToken();
        if (!tok || tok.type === '}') break;
      }
    } else if (t && t.type === 'command') {
      this.popToken();
      macroName = t.name;
    }

    // Optional [n] argument count
    let argCount = 0;
    this.consumeSpaces();
    const bracket = this.future();
    if (bracket && bracket.type === 'char' && bracket.value === '[') {
      this.popToken(); // consume [
      let numStr = '';
      while (true) {
        const tok = this.popToken();
        if (!tok) break;
        if (tok.type === 'char' && tok.value === ']') break;
        if (tok.type === 'char') numStr += tok.value;
      }
      argCount = parseInt(numStr) || 0;
    }

    // Read expansion body
    const bodyTokens = this.consumeArg();
    const expansion = this.tokensToString(bodyTokens);
    if (macroName) {
      this.macros.set(macroName, { args: argCount, expansion });
    }
  }

  /**
   * Process \DeclareMathOperator{\foo}{name} or \DeclareMathOperator*{\foo}{name}
   */
  private processDeclareMathOperator(): void {
    // Optional *
    const star = this.future();
    if (star && star.type === 'char' && star.value === '*') {
      this.popToken();
    }

    // Read macro name from braced group
    const nameTokens = this.consumeArg();
    let macroName = '';
    for (const t of nameTokens) {
      if (t.type === 'command') macroName = t.name;
      else if (t.type === 'char') macroName += t.value;
    }
    macroName = macroName.replace(/^\\/, '');

    // Read operator name
    const opTokens = this.consumeArg();
    const opName = this.tokensToString(opTokens);

    if (macroName) {
      this.macros.set(macroName, { args: 0, expansion: `\\operatorname{${opName}}` });
    }
  }

  /**
   * Convert tokens back to a string (for storing expansion templates).
   */
  private tokensToString(tokens: Token[]): string {
    let result = '';
    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      switch (tok.type) {
        case 'command': {
          const needsSpace = /[a-zA-Z]/.test(tok.name[tok.name.length - 1]) &&
            i + 1 < tokens.length &&
            tokens[i + 1].type === 'char' && /[a-zA-Z]/.test((tokens[i + 1] as { type: 'char'; value: string }).value);
          result += '\\' + tok.name + (needsSpace ? ' ' : '');
          break;
        }
        case 'char':
          result += tok.value;
          break;
        case '{':
          result += '{';
          break;
        case '}':
          result += '}';
          break;
        case '^':
          result += '^';
          break;
        case '_':
          result += '_';
          break;
        case '&':
          result += '&';
          break;
        case 'newline':
          result += '\\\\';
          break;
        case 'space':
          result += ' ';
          break;
      }
    }
    return result;
  }
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

class Parser {
  private expander: MacroExpander;

  constructor(expander: MacroExpander) {
    this.expander = expander;
  }

  /**
   * Peek at the next fully-expanded token without consuming it.
   */
  private peek(): Token | null {
    return this.expander.peekExpanded();
  }

  /**
   * Consume and return the next fully-expanded token.
   */
  private advance(): Token {
    const tok = this.expander.expandNextToken();
    if (!tok) {
      throw new ParseError('Unexpected end of input');
    }
    return tok;
  }

  private expect(type: string): Token {
    const t = this.advance();
    if (t.type !== type) {
      throw new ParseError(`Expected '${type}', got '${t.type}'`);
    }
    return t;
  }

  private skipSpaces(): void {
    while (this.peek()?.type === 'space') {
      this.expander.expandNextToken();
    }
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
          elem('mo', ['(']),
          tagContent,
          elem('mo', [')']),
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

          // \abovewithdelims also reads a dimension
          let aboveDimStr = '';
          if (t.name === 'abovewithdelims') {
            this.skipSpaces();
            while (true) {
              const p = this.peek();
              if (!p) break;
              if (p.type === 'char') {
                const v = (p as { type: 'char'; value: string }).value;
                if (/[0-9.a-z]/.test(v)) {
                  aboveDimStr += v;
                  this.advance();
                  continue;
                }
              }
              break;
            }
          }

          const denom = this.parseExpression();
          const attrs: Record<string, string | number | boolean | undefined> = {};
          if (t.name === 'atopwithdelims') {
            attrs.linethickness = '0';
          } else if (t.name === 'abovewithdelims') {
            attrs.linethickness = aboveDimStr || '0';
          }
          const frac = elem('mfrac', [num, denom], attrs);
          const result: (string | MathMLElement)[] = [];
          const delimSize = '2.047em';
          if (leftDelim) result.push(elem('mrow', [
            elem('mo', [leftDelim], { minsize: delimSize, maxsize: delimSize }),
          ]));
          result.push(frac);
          if (rightDelim) result.push(elem('mrow', [
            elem('mo', [rightDelim], { minsize: delimSize, maxsize: delimSize }),
          ]));
          if (result.length === 1) return frac;
          const wrapper = elem('mrow', result);
          wrapper.meta[':fenced'] = true;
          return wrapper;
        }

        // \above reads a dimension
        let aboveDim = '';
        if (t.name === 'above') {
          this.skipSpaces();
          while (true) {
            const p = this.peek();
            if (!p) break;
            if (p.type === 'char') {
              const v = (p as { type: 'char'; value: string }).value;
              if (/[0-9.a-z]/.test(v)) {
                aboveDim += v;
                this.advance();
                continue;
              }
            }
            break;
          }
        }

        const denom = this.parseExpression();
        if (t.name === 'above') {
          return elem('mfrac', [num, denom], { linethickness: aboveDim || '0' });
        }
        if (t.name === 'atop') {
          return elem('mfrac', [num, denom], { linethickness: '0' });
        }
        if (t.name === 'choose') {
          const delimSize = '2.047em';
          const result = elem('mrow', [
            elem('mrow', [
              elem('mo', ['('], { minsize: delimSize, maxsize: delimSize }),
            ]),
            elem('mfrac', [num, denom], { linethickness: '0' }),
            elem('mrow', [
              elem('mo', [')'], { minsize: delimSize, maxsize: delimSize }),
            ]),
          ]);
          result.meta[':fenced'] = true;
          return result;
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
      if (item) {
        items.push(item);
        // Insert invisible ApplyFunction after named operators when followed by more content
        if (item.meta[':applyfunction']) {
          const next = this.peek();
          if (next && next.type !== '}' && next.type !== '&' && next.type !== 'newline' &&
              !(next.type === 'command' && (next.name === 'right' || next.name === 'end'))) {
            items.push(elem('mo', ['\u2061']));
          }
        }
      }
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

    // Handle \limits / \nolimits modifiers
    let limitsOverride: boolean | null = null;
    while (true) {
      this.skipSpaces();
      const t = this.peek();
      if (t?.type === 'command' && t.name === 'limits') {
        this.advance();
        limitsOverride = true;
      } else if (t?.type === 'command' && t.name === 'nolimits') {
        this.advance();
        limitsOverride = false;
      } else {
        break;
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

    // Determine limits placement: \limits/\nolimits override, then default from base
    const defaultLimits = base.meta[':limits'] === true;
    const useLimits = limitsOverride !== null ? limitsOverride : defaultLimits;

    // When \limits forces under/over on an operator that defaults to sub/sup,
    // add movablelimits="false" to prevent the browser from moving them back.
    // When \nolimits forces sub/sup on a default-limits operator, also mark it.
    if (limitsOverride !== null && limitsOverride !== defaultLimits &&
        base.tag === 'mo') {
      base.attrs.movablelimits = 'false';
    }
    const applyFn = base.meta[':applyfunction'] === true;
    let result: MathMLElement;
    if (sub && sup) result = elem(useLimits ? 'munderover' : 'msubsup', [base, sub, sup]);
    else if (sub) result = elem(useLimits ? 'munder' : 'msub', [base, sub]);
    else if (sup) result = elem(useLimits ? 'mover' : 'msup', [base, sup]);
    else return base;
    // Propagate ApplyFunction flag so parseExpression inserts ⁡ after \sin^2 etc.
    if (applyFn) result.meta[':applyfunction'] = true;
    return result;
  }

  /** Collect consecutive prime characters into a single mo. */
  private collectPrimes(): MathMLElement | null {
    let count = 0;
    while (this.peek()?.type === 'char' &&
           (this.peek() as { type: 'char'; value: string }).value === '\u2032') {
      count++;
      this.advance();
    }
    if (count === 0) return null;
    // Use combined prime Unicode characters
    const primeChars: Record<number, string> = {
      1: '\u2032',  // ′
      2: '\u2033',  // ″
      3: '\u2034',  // ‴
      4: '\u2057',  // ⁗
    };
    const ch = primeChars[count] || '\u2032'.repeat(count);
    return elem('mo', [ch]);
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
            const dotTok = this.advance(); // consume the '.'
            const afterDot = this.peek();
            if (afterDot?.type === 'char' &&
                /[0-9]/.test((afterDot as { type: 'char'; value: string }).value)) {
              digits += '.';
              continue; // next iteration will pick up the digit
            } else {
              // backtrack: push the dot token back
              this.expander.pushToken(dotTok);
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
    // Stretchy characters: add stretchy="false" so they don't grow
    // unexpectedly inside an mrow (only \left/\right should stretch)
    if (stretchyChars.has(ch)) {
      return elem('mo', [ch], { stretchy: 'false' });
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
    if (stretchyChars.has(ch)) return elem('mo', [ch], { stretchy: 'false' });
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
    if (name === 'big' || name === 'Big' || name === 'bigg' || name === 'Bigg' ||
        name === 'bigl' || name === 'Bigl' || name === 'biggl' || name === 'Biggl' ||
        name === 'bigr' || name === 'Bigr' || name === 'biggr' || name === 'Biggr' ||
        name === 'bigm' || name === 'Bigm' || name === 'biggm' || name === 'Biggm')
      return this.parseBigDelim(name);
    if (name === 'binom' || name === 'dbinom' || name === 'tbinom')
      return this.parseBinom(name);
    if (name === 'overset')
      return this.parseOverUnderSet('mover');
    if (name === 'underset')
      return this.parseOverUnderSet('munder');
    if (name === 'stackrel')
      return this.parseOverUnderSet('mover');
    if (name === 'overunderset')
      return this.parseOverUnderset();
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
        name === 'xrightleftharpoons' || name === 'xleftrightharpoons' ||
        name === 'xtofrom')
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

    // --- Bold math symbols ---

    if (name === 'boldsymbol' || name === 'bm')
      return this.parseBoldSymbol();
    if (name === 'pmb')
      return this.parsePoorManBold();

    // --- Struts ---

    if (name === 'mathstrut')
      return elem('mpadded', [elem('mphantom', [elem('mo', ['('], { stretchy: 'false' })])], { width: '0px' });

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

    // --- Math mode delimiters ---

    if (name === '(' || name === ')')
      return elem('mrow');  // inline math delimiters (no-op in math mode)
    if (name === '[' || name === ']')
      return elem('mrow');  // display math delimiters (no-op in math mode)

    // --- Font sizing commands ---

    if (name === 'tiny' || name === 'sixptsize' || name === 'scriptsize' ||
        name === 'footnotesize' || name === 'small' || name === 'normalsize' ||
        name === 'large' || name === 'Large' || name === 'LARGE' ||
        name === 'huge' || name === 'Huge')
      return this.parseSizingCommand(name);

    // --- Spacing: \hskip, \mskip ---

    if (name === 'hskip' || name === 'mskip')
      return this.parseKern(name);

    // --- Atom class commands ---

    if (name === 'mathopen' || name === 'mathclose' || name === 'mathpunct' ||
        name === 'mathord' || name === 'mathbin' || name === 'mathrel')
      return this.parseAtomClass(name);

    // --- Line break hints ---

    if (name === 'nobreak' || name === 'allowbreak')
      return elem('mrow');  // no MathML equivalent, silently consume

    // --- \mathchoice ---

    if (name === 'mathchoice')
      return this.parseMathchoice();

    // --- Text/font commands ---

    if (name === 'text' || name === 'textrm' || name === 'textit' ||
        name === 'textbf' || name === 'textsf' || name === 'texttt' ||
        name === 'textup' || name === 'textnormal')
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

    // \iff: long double arrow with extra spacing
    if (name === 'iff')
      return elem('mrow', [
        elem('mspace', [], { width: '0.278em' }),
        elem('mo', ['\u27FA'], { stretchy: 'false' }),
        elem('mspace', [], { width: '0.278em' }),
      ]);

    // --- Special single-char commands ---

    if (name === '{') return elem('mo', ['{'], { fence: 'false', stretchy: 'false' });
    if (name === '}') return elem('mo', ['}'], { fence: 'false', stretchy: 'false' });
    if (name === '|') return elem('mo', ['\u2016'], { fence: 'false', stretchy: 'false' });
    if (name === '%') return elem('mo', ['%']);
    if (name === '#') return elem('mo', ['#']);
    if (name === '&') return elem('mo', ['&']);
    if (name === '_') return elem('mo', ['_']);
    if (name === '$') return elem('mo', ['$']);

    // --- Named operators ---

    if (operatorNames.has(name))
      return elem('mi', [name], {}, { ':applyfunction': true });

    if (operatorNamesWithLimits.has(name)) {
      // Some operator names need spaces in the display text
      const opDisplayNames: Record<string, string> = {
        liminf: 'lim inf', limsup: 'lim sup',
      };
      const displayName = opDisplayNames[name] || name;
      return elem('mo', [displayName], { movablelimits: 'true' }, { ':limits': true });
    }

    // --- Symbol lookup ---

    const sym = symbols[name];
    if (sym) {
      // Uppercase Greek and specific symbols are upright in TeX.
      // In MathML, single-char <mi> defaults to italic, so we need mathvariant="normal".
      if (sym.element === 'mi' && uprightSymbols.has(name)) {
        return elem(sym.element, [sym.char], { mathvariant: 'normal' });
      }
      // Big operators (∑, ∏, ⋃, etc.) use under/over for limits
      if (bigOperators.has(name)) {
        return elem(sym.element, [sym.char], {}, { ':limits': true });
      }
      // Stretchy characters get stretchy="false" so they don't grow
      // unexpectedly (only \left/\right should stretch).
      // Fence characters also get fence="false" when used as plain symbols.
      if (sym.element === 'mo' && stretchyChars.has(sym.char)) {
        const attrs: Record<string, string> = { stretchy: 'false' };
        if (fenceChars.has(sym.char)) attrs.fence = 'false';
        // surd gets symmetric="true"
        if (sym.char === '\u221A') attrs.symmetric = 'true';
        return elem(sym.element, [sym.char], attrs);
      }
      return elem(sym.element, [sym.char]);
    }

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

    items.push(this.makeDelimElement(leftDelim));

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
        // MathJax wraps \middle with empty <mrow></mrow> on each side
        items.push(elem('mrow'));
        if (midDelim) {
          items.push(elem('mo', [midDelim], { stretchy: 'true' }));
        }
        items.push(elem('mrow'));
        continue;
      }
      const item = this.parseItem();
      if (item) items.push(item);
    }

    const rightDelim = this.readDelimiter();
    items.push(this.makeDelimElement(rightDelim));

    const mrow = elem('mrow', items);
    mrow.meta[':fenced'] = true;
    return mrow;
  }

  /** Create a delimiter <mo> element for \left/\right context. */
  private makeDelimElement(delim: string | null): MathMLElement {
    if (!delim) {
      // Invisible delimiter (\left. or \right.)
      return elem('mo', [], { fence: 'true', stretchy: 'true', symmetric: 'true' });
    }
    // Non-fence characters (arrows etc.) get fence="true" symmetric="true"
    if (!fenceChars.has(delim)) {
      return elem('mo', [delim], { fence: 'true', symmetric: 'true' });
    }
    // Normal fence characters — bare <mo> is stretchy by default in mrow
    return elem('mo', [delim]);
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
    // Handle braced delimiter: {\{}, {\langle}, etc.
    if (t.type === '{') {
      this.advance();
      const inner = this.readDelimiter();
      this.expect('}');
      return inner;
    }
    throw new ParseError('Expected delimiter');
  }

  private parseBigDelim(name: string): MathMLElement {
    // Size map: big=1.2em, Big=1.8em, bigg=2.4em, Bigg=3em
    // MathJax uses slightly different sizes: 1.2, 1.623, 2.047, 2.470
    const sizeMap: Record<string, string> = {
      big: '1.2em', Big: '1.623em', bigg: '2.047em', Bigg: '2.470em',
    };
    const base = name.replace(/^(big|Big|bigg|Bigg)[lrm]?$/, '$1');
    const size = sizeMap[base] || '1.2em';
    const suffix = name.slice(base.length); // 'l', 'r', 'm', or ''
    const delim = this.readDelimiter();
    if (!delim) return elem('mo');
    const moEl = elem('mo', [delim], {
      fence: 'true',
      stretchy: 'true',
      symmetric: 'true',
      minsize: size,
      maxsize: size,
    });
    // MathJax wraps \big in <mrow>
    return elem('mrow', [moEl]);
  }

  private parseBinom(variant: string): MathMLElement {
    const n = this.parseArgSingle();
    const k = this.parseArgSingle();
    const inner = elem('mrow', [
      elem('mo', ['('], {}),
      elem('mfrac', [n, k], { linethickness: '0' }),
      elem('mo', [')'], {}),
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
    // MathJax only adds accent when annotation is a single <mo> (operator symbol)
    const attrs: Record<string, string> = {};
    if (annotation.tag === 'mo') {
      if (tag === 'mover') attrs.accent = 'true';
      else attrs.accentunder = 'true';
      annotation.attrs.stretchy = 'false';
    }
    return elem(tag, [base, annotation], attrs);
  }

  /** Parse \overunderset{over}{under}{base}. */
  private parseOverUnderset(): MathMLElement {
    const over = this.parseArgSingle();
    const under = this.parseArgSingle();
    const base = this.parseArgSingle();
    const attrs: Record<string, string> = {};
    if (over.tag === 'mo') {
      attrs.accent = 'true';
      over.attrs.stretchy = 'false';
    }
    if (under.tag === 'mo') {
      attrs.accentunder = 'true';
      under.attrs.stretchy = 'false';
    }
    return elem('munderover', [base, under, over], attrs);
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
        '\u2208': '\u2209',     // ∈ → ∉
        '\u2282': '\u2284',     // ⊂ → ⊄
        '\u2283': '\u2285',     // ⊃ → ⊅
        '\u2286': '\u2288',     // ⊆ → ⊈
        '\u2287': '\u2289',     // ⊇ → ⊉
        '\u2261': '\u2262',     // ≡ → ≢
        '\u223C': '\u2241',     // ∼ → ≁
        '\u2248': '\u2249',     // ≈ → ≉
        '\u2264': '\u2270',     // ≤ → ≰
        '\u2265': '\u2271',     // ≥ → ≱
        '\u227A': '\u2280',     // ≺ → ⊀
        '\u227B': '\u2281',     // ≻ → ⊁
        '\u2190': '\u219A',     // ← → ↚
        '\u2192': '\u219B',     // → → ↛
        '\u21D0': '\u21CD',     // ⇐ → ⇍
        '\u21D2': '\u21CF',     // ⇒ → ⇏
        '\u2194': '\u21AE',     // ↔ → ↮
        '\u21D4': '\u21CE',     // ⇔ → ⇎
        '\u22A2': '\u22AC',     // ⊢ → ⊬
        '\u22A8': '\u22AD',     // ⊨ → ⊭
        '\u22A9': '\u22AE',     // ⊩ → ⊮
        '\u2223': '\u2224',     // ∣ → ∤
        '\u2225': '\u2226',     // ∥ → ∦
        '\u27F6': '\u27F6\u0338', // ⟶ → ⟶̸ (long right arrow)
        '\u27F5': '\u27F5\u0338', // ⟵ → ⟵̸ (long left arrow)
      };
      if (negMap[ch]) {
        next.children[0] = negMap[ch];
        // Negated arrows that aren't standard fence chars get stretchy="false"
        if (stretchyChars.has(negMap[ch])) {
          next.attrs.stretchy = 'false';
        }
        return next;
      }
      // Fallback: overlay with slash using mpadded
      return elem('mrow', [
        elem('mpadded', [elem('mtext', ['\u29F8'])], { width: '0' }),
      ]);
    }
    // Fallback for non-mo next or empty
    if (next) {
      return elem('mrow', [
        elem('mpadded', [elem('mtext', ['\u29F8'])], { width: '0' }),
      ]);
    }
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
    while (depth > 0) {
      const t = this.expander.expandNextToken();
      if (!t) break;
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

    return elem('mtext', [preserveSpaces(text)], attrs);
  }

  private parseBoldSymbol(): MathMLElement {
    const body = this.parseArgSingle();
    // For simple mi, use bold-italic (matching TeX behavior for \boldsymbol)
    if (body.tag === 'mi' && body.children.length === 1) {
      body.attrs.mathvariant = 'bold-italic';
      return body;
    }
    return elem('mstyle', [body], { mathvariant: 'bold-italic' });
  }

  private parsePoorManBold(): MathMLElement {
    const body = this.parseArgSingle();
    return elem('mstyle', [body], { mathvariant: 'bold' });
  }

  private parseSizingCommand(name: string): MathMLElement {
    const sizeMap: Record<string, string> = {
      tiny: '0.5em', sixptsize: '0.5em', scriptsize: '0.7em',
      footnotesize: '0.8em', small: '0.9em', normalsize: '1em',
      large: '1.2em', Large: '1.44em', LARGE: '1.728em',
      huge: '2.074em', Huge: '2.488em',
    };
    const size = sizeMap[name] || '1em';
    // Sizing applies to the rest of the group — parse remaining content
    const items: MathMLElement[] = [];
    while (true) {
      this.skipSpaces();
      const t = this.peek();
      if (!t || t.type === '}') break;
      if (t.type === 'command' && t.name === 'end') break;
      const item = this.parseItem();
      if (item) items.push(item);
    }
    const body = items.length === 1 ? items[0] : elem('mrow', items);
    return elem('mstyle', [body], { mathsize: size });
  }

  private parseAtomClass(name: string): MathMLElement {
    const body = this.parseArgSingle();
    // Wrap content in appropriate MathML element to convey operator class
    const classMap: Record<string, string> = {
      mathopen: 'open', mathclose: 'close', mathpunct: 'separator',
      mathord: 'normal', mathbin: 'infix', mathrel: 'infix',
    };
    if (body.tag === 'mo') {
      if (name === 'mathopen') body.attrs.fence = 'true';
      else if (name === 'mathclose') body.attrs.fence = 'true';
      return body;
    }
    // Wrap non-mo content in mo with appropriate attributes
    const text = body.children.length === 1 && typeof body.children[0] === 'string'
      ? body.children[0] : undefined;
    if (text) {
      const attrs: Record<string, string> = {};
      if (name === 'mathopen' || name === 'mathclose') attrs.fence = 'true';
      return elem('mo', [text], attrs);
    }
    return body;
  }

  private parseMathchoice(): MathMLElement {
    // \mathchoice{D}{T}{S}{SS} — pick display (first) argument
    const display = this.parseArgSingle();
    this.parseArgSingle(); // text — discard
    this.parseArgSingle(); // script — discard
    this.parseArgSingle(); // scriptscript — discard
    return display;
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
    const isDecoration = nonAccentDecorations.has(name);
    const moAttrs: Record<string, string> = {};
    // Non-wide accents (hat, tilde, etc.) need stretchy="false" to prevent
    // stretching. Wide accents (overline, overbrace, etc.) stretch by default.
    if (!stretchy) moAttrs.stretchy = 'false';
    if (!isDecoration) moAttrs.accent = 'true';
    const accentMo = elem('mo', [def.char], moAttrs);
    const tag = def.over ? 'mover' : 'munder';
    // MathJax sets movablelimits="false" on big operators inside accents
    // to prevent the browser from converting under/over to sub/sup
    if (body.tag === 'mo' && body.meta[':limits']) {
      body.attrs.movablelimits = 'false';
    }
    const meta: Record<string, unknown> = {};
    if (isDecoration) {
      meta[':limits'] = true;
    }
    return elem(tag, [body, accentMo], {}, meta);
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
    if (envName === 'aligned' || envName === 'align' || envName === 'align*' ||
        envName === 'alignat' || envName === 'alignat*' ||
        envName === 'alignedat') {
      // alignat/alignedat take a mandatory {n} argument for column count — skip it
      if (envName === 'alignat' || envName === 'alignat*' || envName === 'alignedat') {
        this.expect('{');
        while (true) {
          const t = this.peek();
          if (!t || t.type === '}') break;
          this.advance();
        }
        this.expect('}');
      }
      return this.parseAligned(envName);
    }
    if (envName === 'darray') {
      return this.parseArray(envName);
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
        items.push(elem('mo', [leftDelim], {}));
      }
      items.push(mtable);
      if (rightDelim) {
        items.push(elem('mo', [rightDelim], {}));
      }
      return elem('mrow', items);
    }
    return mtable;
  }

  private parseCases(): MathMLElement {
    const rows = this.parseTableRows('cases');
    const mtable = elem('mtable', rows, { columnalign: 'left left' });
    return elem('mrow', [
      elem('mo', ['{'], {}),
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
      elem('mo', ['{'], {}),
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
        items.push(elem('mo', [leftDelim], {}));
      items.push(mtable);
      if (rightDelim)
        items.push(elem('mo', [rightDelim], {}));
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
    while (depth > 0) {
      const t = this.expander.expandNextToken();
      if (!t) break;
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
    return elem('mtext', [preserveSpaces(text)]);
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
      xtofrom: '\u21C4',
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
      if (leftDelim) items.push(elem('mo', [leftDelim], {}));
      items.push(frac);
      if (rightDelim) items.push(elem('mo', [rightDelim], {}));
      return elem('mrow', items);
    }
    return frac;
  }

  /** Parse \pmod{...}. */
  private parsePmod(): MathMLElement {
    const body = this.parseArgSingle();
    return elem('mrow', [
      elem('mspace', [], { width: '1em' }),
      elem('mo', ['(']),
      elem('mi', ['mod']),
      elem('mspace', [], { width: '0.333em' }),
      body,
      elem('mo', [')']),
    ]);
  }

  /** Parse \pod{...}. */
  private parsePod(): MathMLElement {
    const body = this.parseArgSingle();
    return elem('mrow', [
      elem('mspace', [], { width: '1em' }),
      elem('mo', ['(']),
      body,
      elem('mo', [')']),
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
    // Strip glue (plus/minus components) for hskip/mskip
    if (name === 'hskip' || name === 'mskip') {
      const plusIdx = dim.indexOf('plus');
      if (plusIdx > 0) dim = dim.slice(0, plusIdx);
      const minusIdx = dim.indexOf('minus');
      if (minusIdx > 0) dim = dim.slice(0, minusIdx);
      dim = dim.trim();
    }
    // Convert mu units to em for mkern/mskip (18mu = 1em)
    if ((name === 'mkern' || name === 'mskip') && dim.endsWith('mu')) {
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
      elem('mo', ['}'], {}),
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

    // Skip leading \hline / \hdashline
    this.skipSpaces();
    while (true) {
      const ht = this.peek();
      if (ht?.type === 'command' && (ht.name === 'hline' || ht.name === 'hdashline')) {
        this.advance();
      } else break;
    }

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
        // Skip \hline / \hdashline after row break
        this.skipSpaces();
        while (true) {
          const ht2 = this.peek();
          if (ht2?.type === 'command' && (ht2.name === 'hline' || ht2.name === 'hdashline')) {
            this.advance();
          } else break;
        }
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
        elem('mo', ['\u27E8'], {}),
        content,
        elem('mo', ['|'], {}),
      ]);
    }
    if (variant === 'ket') {
      return elem('mrow', [
        elem('mo', ['|'], {}),
        content,
        elem('mo', ['\u27E9'], {}),
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
      elem('mo', ['\u27E8'], {}),
    ];
    for (let i = 0; i < parts.length; i++) {
      if (i > 0) {
        result.push(elem('mo', ['|'], {}));
      }
      if (parts[i].length === 1) {
        result.push(parts[i][0]);
      } else if (parts[i].length > 1) {
        result.push(elem('mrow', parts[i]));
      }
    }
    result.push(elem('mo', ['\u27E9'], {}));
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
      elem('mo', ['{'], {}),
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
    result.push(elem('mo', ['}'], {}));
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
      elem('mo', [left], {}),
      content,
      elem('mo', [right], {}),
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

    while (depth > 0) {
      const tok = this.expander.expandNextToken();
      if (!tok) break;
      if (tok.type === '{') {
        depth++;
      } else if (tok.type === '}') {
        depth--;
        if (depth === 0) break;
      } else if (tok.type === 'char') {
        const ch = tok.value;
        if (/[A-Z]/.test(ch)) {
          // Element symbol start
          flushText();
          let symbol = ch;
          // Look ahead for lowercase letters
          while (true) {
            const next = this.expander.future();
            if (next && next.type === 'char' && /[a-z]/.test(next.value)) {
              symbol += next.value;
              this.expander.popToken();
            } else {
              break;
            }
          }
          parts.push(elem('mi', [symbol], { mathvariant: 'normal' }));
        } else if (/[0-9]/.test(ch)) {
          // Subscript number
          flushText();
          let num = ch;
          while (true) {
            const next = this.expander.future();
            if (next && next.type === 'char' && /[0-9]/.test(next.value)) {
              num += next.value;
              this.expander.popToken();
            } else {
              break;
            }
          }
          parts.push(elem('mn', [num]));
        } else if (ch === '+') {
          flushText();
          parts.push(elem('mo', ['+']));
        } else if (ch === '-') {
          flushText();
          // Check for arrow ->
          const next = this.expander.future();
          if (next && next.type === 'char' && next.value === '>') {
            this.expander.popToken();
            parts.push(elem('mo', ['\u2192']));
            continue;
          }
          parts.push(elem('mo', ['-']));
        } else if (ch === '=') {
          flushText();
          parts.push(elem('mo', ['=']));
        } else if (ch === '(' || ch === ')' || ch === '[' || ch === ']') {
          flushText();
          parts.push(elem('mo', [ch]));
        } else if (ch === '^') {
          // Superscript handling
          flushText();
        } else if (ch === ' ' || ch === '\u00A0') {
          // skip
        } else {
          currentText += ch;
        }
      } else if (tok.type === '_') {
        // Subscript - the number after should already be handled
      } else if (tok.type === '^') {
        // skip
      } else if (tok.type === 'space') {
        // skip
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
      return { displaystyle: 'true' };
    case 'textstyle':
      return { displaystyle: 'false' };
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
  const tokens = tokenize(input);
  const expander = new MacroExpander(tokens, macros);
  const parser = new Parser(expander);
  const body = parser.parseExpression();

  // Unwrap the top-level mrow only if it's the implicit one from parseExpression
  // (multiple children, not from \left/\right or other semantic constructs).
  const children = (body.tag === 'mrow' && body.children.length > 1 && !body.meta[':fenced'])
    ? body.children : [body];
  const math = elem('math', children, {
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
