/**
 * MathML XML writer.
 * Direct port of luamml-xmlwriter.lua.
 */
import type { MathMLElement } from './types.js';

const escapes: Record<string, string> = {
  '"': '&quot;',
  '<': '&lt;',
  '>': '&gt;',
  '&': '&amp;',
};

function escapeText(text: string): string {
  return String(text)
    .replace(/["<>&]/g, (ch) => escapes[ch]!)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, (x) => {
      return '^^' + x.charCodeAt(0).toString(16).padStart(2, '0');
    });
}

function writeElem(tree: MathMLElement, _indent: string | null): string {
  let indent = _indent;
  const escapedName = tree.tag;

  // Collect and sort attributes
  const attrParts: string[] = [];
  for (const [attr, val] of Object.entries(tree.attrs)) {
    if (val === undefined || val === null) continue;
    if (attr.includes(':')) continue;
    if (attr === 'xmlns') continue;
    attrParts.push(` ${attr}="${escapeText(String(val))}"`);
  }
  attrParts.sort();

  let out = `${indent ?? ''}<${escapedName}${attrParts.join('')}`;

  if (tree.children.length === 0) {
    return out + '/>';
  }
  out += '>';

  // Never indent the content if it's purely text
  if (tree.children.length === 1 && typeof tree.children[0] === 'string') {
    indent = null;
  }
  const innerIndent = indent !== null ? indent + '  ' : null;

  let isString = false;
  for (const child of tree.children) {
    if (typeof child === 'string') {
      if (innerIndent !== null && !isString) {
        out += innerIndent;
      }
      out += escapeText(child);
      isString = true;
    } else {
      out += writeElem(child, innerIndent);
      isString = false;
    }
  }

  if (indent !== null) out += indent;
  return out + '</' + escapedName + '>';
}

/**
 * Serialize a MathML element tree to XML string.
 * @param element The root MathML element
 * @param indent If true, pretty-print with indentation
 * @param version If '11', prepend XML 1.1 declaration
 */
export function writeXml(
  element: MathMLElement,
  indent: boolean = false,
  version?: string,
): string {
  return (
    (version === '11' ? '<?xml version="1.1"?>' : '') +
    writeElem(element, indent ? '\n' : null)
  );
}
