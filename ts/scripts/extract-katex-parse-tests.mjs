/**
 * Extract LaTeX inputs from KaTeX's katex-spec.ts and unicode-spec.ts.
 *
 * Extracts expressions that KaTeX expects to parse successfully,
 * producing a JSON fixture file for compatibility testing.
 *
 * KaTeX is licensed under the MIT License.
 * Copyright (c) 2013-2020 Khan Academy and other contributors.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function extractFromFile(filePath, sourceName) {
  const src = readFileSync(filePath, 'utf-8');
  const fixtures = [];
  const seen = new Set();

  // Track current describe/it context for naming
  let currentDescribe = '';
  let currentIt = '';

  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Track describe blocks
    const descMatch = line.match(/describe\(["'`](.+?)["'`]/);
    if (descMatch) currentDescribe = descMatch[1];

    // Track it blocks
    const itMatch = line.match(/it\(["'`](.+?)["'`]/);
    if (itMatch) currentIt = itMatch[1];

    // Extract template literal expressions that should parse: expect`...`.toParse
    // Also match .toBuild() and .toParseLike
    const templateParseRe = /expect`([^`]*)`\s*\.\s*(?:toParse|toBuild|toParseLike)/g;
    let m;
    while ((m = templateParseRe.exec(line)) !== null) {
      const latex = m[1]
        .replace(/\\\\/g, '\\')  // unescape template literal backslashes (raw strings use r``)
        .trim();
      if (latex && !seen.has(latex)) {
        seen.add(latex);
        fixtures.push({
          name: `${sourceName}: ${currentDescribe} - ${currentIt}`,
          latex,
        });
      }
    }

    // Extract raw template literals: expect(r`...`).toParse or expect(expression).toParse
    // where expression = r`...` was defined earlier
    const rawTemplateRe = /expect\(r`([^`]*)`\)\s*\.\s*(?:toParse|toBuild)/g;
    while ((m = rawTemplateRe.exec(line)) !== null) {
      const latex = m[1].trim();
      if (latex && !seen.has(latex)) {
        seen.add(latex);
        fixtures.push({
          name: `${sourceName}: ${currentDescribe} - ${currentIt}`,
          latex,
        });
      }
    }
  }

  // Also extract named const expressions and match them to toParse calls
  const constDefs = new Map();
  for (const line of lines) {
    // Match: const expression = "..." or r`...`
    let cm = line.match(/const\s+(\w+)\s*=\s*"((?:[^"\\]|\\.)*)"/);
    if (cm) {
      constDefs.set(cm[1], cm[2].replace(/\\\\/g, '\\'));
      continue;
    }
    cm = line.match(/const\s+(\w+)\s*=\s*r`([^`]*)`/);
    if (cm) {
      constDefs.set(cm[1], cm[2]);
      continue;
    }
    // Match: const expression = "..." + "..."  (concatenated strings)
    cm = line.match(/const\s+(\w+)\s*=\s*("(?:[^"\\]|\\.)*"(?:\s*\+\s*"(?:[^"\\]|\\.)*")*)/);
    if (cm) {
      try {
        // Safely evaluate concatenated string literals
        const val = cm[2].split(/\s*\+\s*/).map(s => {
          const inner = s.slice(1, -1);
          return inner.replace(/\\\\/g, '\\');
        }).join('');
        constDefs.set(cm[1], val);
      } catch { /* skip */ }
    }
  }

  // Find expect(varName).toParse() patterns and resolve the variable
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const itMatch = line.match(/it\(["'`](.+?)["'`]/);
    if (itMatch) currentIt = itMatch[1];

    const varParseRe = /expect\((\w+)\)\s*\.\s*(?:toParse|toBuild)/g;
    let m;
    while ((m = varParseRe.exec(line)) !== null) {
      const varName = m[1];
      const latex = constDefs.get(varName);
      if (latex && !seen.has(latex)) {
        seen.add(latex);
        fixtures.push({
          name: `${sourceName}: ${currentDescribe} - ${currentIt}`,
          latex,
        });
      }
    }
  }

  return fixtures;
}

// Extract from katex-spec.ts
const katexFixtures = extractFromFile(
  join(__dirname, '../../katex-spec.ts'),
  'katex-spec'
);
console.log(`Extracted ${katexFixtures.length} fixtures from katex-spec.ts`);

// Extract from unicode-spec.ts
const unicodeFixtures = extractFromFile(
  join(__dirname, '../../katex-unicode-spec.ts'),
  'unicode-spec'
);
console.log(`Extracted ${unicodeFixtures.length} fixtures from katex-unicode-spec.ts`);

// Combine and write
const allFixtures = [...katexFixtures, ...unicodeFixtures];
console.log(`Total: ${allFixtures.length} fixtures`);

const outPath = join(__dirname, '../src/test/fixtures/katex-parse-fixtures.json');
writeFileSync(outPath, JSON.stringify(allFixtures, null, 2));
console.log(`Written to ${outPath}`);
