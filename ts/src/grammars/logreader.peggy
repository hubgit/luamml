// PEG grammar for parsing TeX log files with LuaMML markers.
// Mirrors the lpeg grammar in pdfmml-logreader.lua.

{{
function multiTableSet(t, key, value, table) {
  const arr = t[table];
  if (key != null) {
    arr[key] = value;
  } else {
    arr.push(value);
  }
  return t;
}
}}

log_file
  = init:init_tables entries:(luamml_block / luamml_mark / luamml_instruction / luamml_precount / luamml_postcount / line)* {
      let t = init;
      for (const entry of entries) {
        if (entry && entry._type) {
          t = multiTableSet(t, entry.key, entry.value, entry._type);
        }
      }
      return t;
    }

init_tables
  = &. {
      return { groups: [], precount: {}, postcount: {}, marks: {}, instructions: [] };
    }
  / "" {
      return { groups: [], precount: {}, postcount: {}, marks: {}, instructions: [] };
    }

luamml_block
  = "LUAMML_FORMULA_BEGIN:" id:integer ":" "\n" body:formula_body "LUAMML_FORMULA_END" "\n" {
      return { _type: "groups", key: id, value: body };
    }

formula_body
  = flag:integer ":" tag:tag_text ":" label:label_text? "\n"+ blocks:(math_block / generic_block)* extra_lines* {
      const result = { flag, tag };
      if (label) result.label = label;
      const mathBlocks = blocks.filter(b => b !== null);
      result.blocks = mathBlocks;
      return result;
    }

tag_text
  = $[^:\n]*

label_text
  = $[^\n]+

math_block
  = "### " display:("display " { return true; })? "math mode entered at line " lineNum:integer "\n" lines:non_final_lines {
      return { display: display || false, line: lineNum, lines: lines.filter(l => l !== "") };
    }

generic_block
  = "### " !"math mode" !"display math mode" first_line lines:non_final_lines { return null; }

first_line
  = [^\n]* "\n"

non_final_lines
  = lines:(non_final_line)* { return lines; }

non_final_line
  = !("### " / "LUAMML_FORMULA_END") text:$[^\n]* "\n" { return text; }

luamml_mark
  = "LUAMML_MARK:" id:integer ":" content:mark_content "\n" "LUAMML_MARK_END" "\n" {
      return { _type: "marks", key: id, value: content };
    }

mark_content
  = lines:mark_line|1.., "\n"| {
      return lines.join("\n");
    }

mark_line
  = !("LUAMML_MARK_END") text:$[^\n]* { return text; }

luamml_instruction
  = "LUAMML_INSTRUCTION:" content:$[^\n]* ("\n" / !.) {
      return { _type: "instructions", key: null, value: content };
    }

luamml_precount
  = "LUAMML_COUNT:" id:integer "\n"+ block:count_block {
      return { _type: "precount", key: id, value: block };
    }

luamml_postcount
  = "LUAMML_COUNT_END:" id:integer "\n"+ block:count_block {
      return { _type: "postcount", key: id, value: block };
    }

count_block
  = "### " [^\n]* "\n" lines:count_lines {
      let count = 0;
      for (const l of lines) {
        if (l.startsWith("\\")) count++;
      }
      return count;
    }

count_lines
  = lines:(!("### " / "LUAMML_") text:$[^\n]* "\n" { return text; })* { return lines; }

extra_lines
  = !("LUAMML_FORMULA_END") [^\n]* "\n"

line
  = [^\n]* "\n" { return null; }
  / [^\n]+ { return null; } // handle last line without newline

integer
  = digits:$[0-9]+ { return parseInt(digits, 10); }
