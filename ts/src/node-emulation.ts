/**
 * Node emulation layer for standalone (non-LuaTeX) usage.
 * Port of pdfmml-emulate-node.lua.
 */
import type { MathNode, PropertiesTable, NodeProperties } from './types.js';

/** Shared properties table for the emulated node system. */
export const properties: PropertiesTable = new Map();

/** Get or create properties for a node. */
export function getProps(n: MathNode): NodeProperties {
  let p = properties.get(n);
  if (!p) {
    p = {};
    properties.set(n, p);
  }
  return p;
}

/** Noad subtype names, indexed by number. */
export const noadSubtypes: string[] = [
  'ord', 'opdisplaylimits', 'oplimits', 'opnolimits',
  'bin', 'rel', 'open', 'close', 'punct',
  'inner', 'under', 'over', 'vcenter',
];

/** Fence subtype names, indexed by number. */
export const fenceSubtypes: string[] = [
  'unset', 'left', 'middle', 'right', 'no',
];

/** Radical subtype names, indexed by number. */
export const radicalSubtypes: string[] = [
  'radical', 'uradical', 'uroot',
  'uunderdelimiter', 'uoverdelimiter',
  'udelimiterunder', 'udelimiterover',
];

const subtypeMap: Record<string, string[]> = {
  noad: noadSubtypes,
  fence: fenceSubtypes,
  radical: radicalSubtypes,
};

/** Get subtype name for a given node type and subtype number. */
export function getSubtypeName(nodeType: string, subtype: number): string | undefined {
  return subtypeMap[nodeType]?.[subtype];
}

/** Traverse a linked list of math nodes. */
export function* traverseNodes(head: MathNode | null | undefined): Generator<MathNode> {
  let current = head;
  while (current) {
    yield current;
    current = current.next ?? null;
  }
}

/** Check if something is a node (table with an id). */
export function isNode(value: unknown): value is MathNode {
  return typeof value === 'object' && value !== null && 'id' in value;
}

/** Default null delimiter space in scaled points (1.2pt). */
export const nullDelimiterSpace = 78643;
