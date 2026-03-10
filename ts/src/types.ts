/**
 * Core types for the LuaMML TypeScript port.
 *
 * In the Lua codebase, MathML trees are represented as tables with:
 *   - [0] = element name (string)
 *   - [1..n] = children (string | MathMLElement)
 *   - string keys = attributes
 *   - keys starting with ':' = internal metadata
 *
 * We model this with a dedicated MathMLElement type.
 */

/** An MathML element in the internal tree representation. */
export interface MathMLElement {
  /** Element tag name (e.g. 'math', 'mrow', 'mi', 'mo') */
  tag: string;
  /** Ordered children: text content or child elements */
  children: Array<string | MathMLElement>;
  /** XML attributes (key-value pairs without ':' prefix) */
  attrs: Record<string, string | number | boolean | undefined>;
  /** Internal metadata (keys starting with ':' in Lua) */
  meta: Record<string, unknown>;
}

/** Create a new MathML element. */
export function elem(
  tag: string,
  children: Array<string | MathMLElement> = [],
  attrs: Record<string, string | number | boolean | undefined> = {},
  meta: Record<string, unknown> = {},
): MathMLElement {
  return { tag, children, attrs, meta };
}

/**
 * Node types from the TeX math list.
 * In the Lua code these are string IDs from `node.id(name)`.
 * The emulation layer (pdfmml-emulate-node) uses strings directly.
 */
export type NodeId =
  | 'noad'
  | 'accent'
  | 'style'
  | 'choice'
  | 'radical'
  | 'fraction'
  | 'fence'
  | 'math_char'
  | 'sub_box'
  | 'sub_mlist'
  | 'hlist'
  | 'vlist'
  | 'kern'
  | 'glue'
  | 'rule'
  | 'delim'
  | 'penalty'
  | 'mark'
  | 'math';

/**
 * A TeX math node in linked-list form.
 * This mirrors the Lua table structure produced by pdfmml-showlists.
 */
export interface MathNode {
  id: NodeId;
  subtype: number;
  next?: MathNode | null;
  prev?: MathNode | null;

  // noad fields
  nucleus?: MathNode | null;
  sub?: MathNode | null;
  sup?: MathNode | null;

  // math_char fields
  fam?: number;
  char?: number;

  // sub_box fields
  list?: MathNode | MathListHead | null;

  // delimiter fields
  small_fam?: number;
  small_char?: number;
  large_fam?: number;
  large_char?: number;

  // fraction fields
  num?: MathNode | null;
  denom?: MathNode | null;
  left?: MathNode | null;
  right?: MathNode | null;
  width?: number;
  middle?: MathNode | null;

  // fence fields
  delim?: MathNode | null;
  options?: number;
  height?: number;
  depth?: number;
  class?: number;

  // accent fields
  accent?: MathNode | null;
  bot_accent?: MathNode | null;

  // choice fields
  display?: MathNode | null;
  text?: MathNode | null;
  script?: MathNode | null;
  scriptscript?: MathNode | null;

  // kern/glue fields
  kern?: number;

  // rule fields (uses height/depth/width from above)

  // hlist fields
  head?: MathNode | null;

  // glue fields (uses width from fraction above)
  stretch?: number;
  stretch_order?: number;
  shrink?: number;
  shrink_order?: number;

  // penalty
  penalty?: number;

  // mark
  mark?: unknown;

  // math node
  surround?: number;

  // shift for box nodes
  shift?: number;
  glue_sign?: number;
  glue_set?: number;
  glue_order?: number;
}

export interface MathListHead {
  id?: NodeId;
  head?: MathNode | null;
}

/** Properties table - maps nodes to their annotation properties. */
export type PropertiesTable = Map<MathNode, NodeProperties>;

export interface NodeProperties {
  mathml_core?: MathMLElement | false | null;
  mathml_table?: MathMLElement | null;
  mathml_filter?: (mml: MathMLElement, core?: MathMLElement | null) => [MathMLElement, MathMLElement | null | undefined];
  saved_mathml_table?: MathMLElement | null;
  saved_mathml_core?: MathMLElement | null;
  glyph_info?: string;
  mathml_row?: MathMLElement;
  mathml_table_node_table?: MathMLElement;
  luamml_array_startmath?: MathNode;
}

/** Parsed log file data. */
export interface ParsedLog {
  groups: ParsedGroup[];
  marks: Record<number, string>;
  instructions: string[];
  count: Record<number, number>;
  mathml: Record<string, MathMLElement>;
}

export interface ParsedGroup {
  flag: number;
  tag: string;
  label?: string;
  blocks: ParsedMathBlock[];
}

export interface ParsedMathBlock {
  display?: boolean;
  line?: number;
  lines: string[];
}

/** Text families map: family number -> boolean (is text family). */
export type TextFamilies = Record<number, boolean>;
