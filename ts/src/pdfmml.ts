#!/usr/bin/env node
/**
 * CLI tool for converting TeX log files to MathML.
 * Port of pdfmml.lua.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { parseLog } from './logreader.js';
import { parseShowlists } from './showlists.js';
import * as convert from './convert.js';
import { mappings } from './legacy-mappings.js';
import { writeXml } from './xmlwriter.js';
import type { MathMLElement } from './types.js';

function shallowCopy(t: MathMLElement): MathMLElement {
  return {
    tag: t.tag,
    children: [...t.children],
    attrs: { ...t.attrs },
    meta: { ...t.meta },
  };
}

function tryExtensions(base: string, ...extensions: string[]): string | null {
  if (existsSync(base)) return base;
  for (const ext of extensions) {
    const fullname = base + ext;
    if (existsSync(fullname)) return fullname;
  }
  return null;
}

function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    process.stderr.write(
      `Usage: pdfmml {logname} [{outname}]\n` +
      `If {outname} includes {}, then a separate file is written for every formula ` +
      `with {} replaced by the formula id.\n`,
    );
    process.exit(1);
  }

  const inputFile = tryExtensions(args[0], '.tml', '.log');
  if (!inputFile) {
    process.stderr.write("Couldn't find input file.\n");
    process.exit(1);
  }

  const content = readFileSync(inputFile, 'utf-8');
  const parsed = parseLog(content);

  // Process instructions (font family registrations)
  for (const inst of parsed.instructions) {
    const m = inst.match(/^REGISTER_MAPPING:(\d+):(.*)$/);
    if (m) {
      const family = parseInt(m[1]);
      const mappingName = m[2];
      const mapping = mappings[mappingName];
      if (mapping) {
        convert.registerFamily(family, mapping);
      } else {
        process.stderr.write(`Unknown mapping ${mappingName} ignored\n`);
      }
    } else {
      process.stderr.write('Unknown instruction ignored\n');
    }
  }

  // Determine output mode
  let outStream: ((s: string) => void) | null = null;
  let outPrefix: string | null = null;
  let outSuffix: string | null = null;

  if (!args[1] || args[1] === '-') {
    outStream = (s: string) => process.stdout.write(s);
  } else {
    const braceIdx = args[1].indexOf('{}');
    if (braceIdx === -1) {
      const fd = { content: '' };
      outStream = (s: string) => { fd.content += s; };
      process.on('exit', () => writeFileSync(args[1], fd.content));
    } else {
      outPrefix = args[1].substring(0, braceIdx);
      outSuffix = args[1].substring(braceIdx + 2);
    }
  }

  const textFamilies: Record<number, boolean> = {};

  // Process each formula group
  for (let i = 0; i < parsed.groups.length; i++) {
    const group = parsed.groups[i];
    if (!group) continue;

    const { flag, tag, label } = group;
    if ((flag & 3) === 0) continue;

    // Use the first math block
    const block = group.blocks[0];
    if (!block) continue;

    const style = (flag & 16) === 16 ? (flag >> 5) & 0x7 : block.display ? 0 : 2;
    const head = parseShowlists(block, parsed);
    let xml = convert.process(head, style, textFamilies);

    if ((flag & 2) === 2) {
      const stream = outStream ?? ((s: string) => writeFileSync(outPrefix! + String(i) + outSuffix!, s));
      const root = convert.makeRoot(shallowCopy(xml), style);
      stream(writeXml(root) + '\n');
    }

    if (tag !== 'mrow') {
      if (xml.tag === 'mrow') {
        xml.tag = tag;
      } else {
        xml = { tag, children: [xml], attrs: {}, meta: {} };
      }
    }

    if (!block.display && (flag & 1) === 1 && label) {
      if (parsed.mathml[label]) {
        throw new Error('Invalid label reuse');
      }
      parsed.mathml[label] = xml;
    }
  }
}

main();
