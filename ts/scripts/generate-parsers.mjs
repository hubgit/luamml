#!/usr/bin/env node
// Generates JavaScript parsers from Peggy grammars.
// Output goes to dist/ so TypeScript can import them via .d.ts declarations in src/.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import peggy from 'peggy';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const grammarsDir = join(root, 'src', 'grammars');
const distDir = join(root, 'dist');

mkdirSync(distDir, { recursive: true });

const grammars = [
  { name: 'logreader-parser', file: 'logreader.peggy', options: {} },
  {
    name: 'showlists-parser', file: 'showlists.peggy',
    options: {
      allowedStartRules: [
        'node_line', 'fraction_line', 'mathchoice_line',
        'math_char_line', 'box_line', 'mark_whatsit_line',
      ],
    },
  },
];

for (const { name, file, options } of grammars) {
  const source = readFileSync(join(grammarsDir, file), 'utf-8');
  const parser = peggy.generate(source, {
    output: 'source',
    format: 'es',
    ...options,
  });

  writeFileSync(join(distDir, `${name}.js`), parser);
  console.log(`Generated ${name}.js`);
}
