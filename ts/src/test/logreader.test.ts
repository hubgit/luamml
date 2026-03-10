import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseLog } from '../logreader.js';

describe('parseLog', () => {
  it('should parse LUAMML_INSTRUCTION lines', () => {
    const content = 'some preamble\nLUAMML_INSTRUCTION:REGISTER_MAPPING:1:oml\nmore stuff\n';
    const result = parseLog(content);
    assert.equal(result.instructions.length, 1);
    assert.equal(result.instructions[0], 'REGISTER_MAPPING:1:oml');
  });

  it('should parse LUAMML_MARK blocks', () => {
    const content = 'LUAMML_MARK:42:count = 2\nmore mark data\nLUAMML_MARK_END\n';
    const result = parseLog(content);
    assert.equal(result.marks[42], 'count = 2\nmore mark data');
  });

  it('should parse LUAMML_FORMULA_BEGIN/END blocks', () => {
    const content = [
      'LUAMML_FORMULA_BEGIN:0:',
      '3:mrow:',
      '',
      '### display math mode entered at line 5',
      '\\mathord',
      '.\\fam0 x',
      'LUAMML_FORMULA_END',
      '',
    ].join('\n');
    const result = parseLog(content);
    assert.ok(result.groups[0]);
    assert.equal(result.groups[0].flag, 3);
    assert.equal(result.groups[0].tag, 'mrow');
    assert.equal(result.groups[0].blocks.length, 1);
    assert.equal(result.groups[0].blocks[0].display, true);
  });

  it('should handle empty input', () => {
    const result = parseLog('');
    assert.equal(result.groups.length, 0);
    assert.equal(result.instructions.length, 0);
  });

  it('should parse multiple instructions', () => {
    const content = [
      'LUAMML_INSTRUCTION:REGISTER_MAPPING:0:oms',
      'LUAMML_INSTRUCTION:REGISTER_MAPPING:1:oml',
    ].join('\n');
    const result = parseLog(content);
    assert.equal(result.instructions.length, 2);
  });
});
