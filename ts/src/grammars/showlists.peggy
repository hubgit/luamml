// PEG grammar for parsing individual TeX \showlists output lines.
// Mirrors the lpeg line-level patterns in pdfmml-showlists.lua.
// The recursive parse_list logic remains procedural in TypeScript.

{{
function hexToInt(s) { return parseInt(s, 16); }

function parseDelimiterCode(s) {
  const code = parseInt(s, 16);
  return {
    id: 'delim',
    subtype: 0,
    small_fam: (code >> 20) & 0xF,
    small_char: (code >> 12) & 0xFF,
    large_fam: (code >> 8) & 0xF,
    large_char: code & 0xFF,
  };
}

function parseScaled(s) {
  const n = parseFloat(s);
  return Math.floor(n * 0x10000 + 0.5);
}

function parseTexChar(s) {
  if (s.startsWith('^^')) {
    const rest = s.substring(2);
    if (rest.length >= 2 && /^[0-9a-f]{2}/.test(rest)) {
      return parseInt(rest.substring(0, 2), 16);
    }
    const ch = rest.charCodeAt(0);
    if (ch >= 0 && ch <= 0x3F) return ch + 0x40;
    if (ch >= 0x40 && ch <= 0x7F) return ch - 0x40;
  }
  return s.charCodeAt(0);
}
}}

// Entry rule - try each node type in order
node_line
  = simple_noad
  / generic_simple_node

// Simple noad patterns (math-specific nodes)
simple_noad
  = "\\" node:(
      noad_type
    / radical_node
    / accent_node
    / fence_node
    / style_node
    / mkern_node
    / mglue_node
  ) !. { return node; }

noad_type
  = "math" subtype:(
      "ord" { return 0; }
    / "open" { return 6; }
    / "op\\limits" { return 2; }
    / "op\\nolimits" { return 3; }
    / "op" { return 1; }
    / "bin" { return 4; }
    / "rel" { return 5; }
    / "close" { return 7; }
    / "punct" { return 8; }
    / "inner" { return 9; }
    / "under" { return 10; }
    / "over" { return 11; }
    / "vcenter" { return 12; }
  ) { return { id: 'noad', subtype }; }

radical_node
  = "radical" delim:delimiter_code { return { id: 'radical', subtype: 0, left: delim }; }

accent_node
  = "accent" accent:math_char { return { id: 'accent', subtype: 0, accent }; }

fence_node
  = subtype:(
      "left" { return 1; }
    / "middle" { return 2; }
    / "right" { return 3; }
  ) delim:delimiter_code {
      return { id: 'fence', subtype, delim, options: 0, height: 0, depth: 0, class: -1 };
    }

style_node
  = subtype:(
      "displaystyle" { return 0; }
    / "textstyle" { return 2; }
    / "scriptscriptstyle" { return 6; }
    / "scriptstyle" { return 4; }
  ) { return { id: 'style', subtype }; }

mkern_node
  = "mkern" kern:scaled_number "mu" { return { id: 'kern', subtype: 99, kern }; }

mglue_node
  = "glue" node:(
      "(\\nonscript)" { return { id: 'glue', subtype: 98 }; }
    / "(\\mskip) " width:scaled_number "mu"
      stretch:(" plus " s:scaled_number go:glue_order_mu { return { stretch: s, stretch_order: go }; })?
      shrink:(" minus " s:scaled_number go:glue_order_mu { return { shrink: s, shrink_order: go }; })? {
        return {
          id: 'glue', subtype: 99, width,
          stretch: stretch ? stretch.stretch : 0,
          stretch_order: stretch ? stretch.stretch_order : 0,
          shrink: shrink ? shrink.shrink : 0,
          shrink_order: shrink ? shrink.shrink_order : 0,
        };
      }
  ) { return node; }

// Generic simple nodes (non-math-specific)
generic_simple_node
  = "\\" node:(
      rule_node
    / kern_node
    / glue_node
    / penalty_node
  ) !. { return node; }

rule_node
  = "rule" "(" height:hdw_value "+" depth:hdw_value ")x" width:hdw_value {
      return { id: 'rule', subtype: 0, height, depth, width };
    }

kern_node
  = "kern" subtype:(" " { return 1; } / "" { return 0; }) kern:scaled_number (" (for " [a-z/\\]+ ")")? {
      return { id: 'kern', subtype, kern };
    }

glue_node
  = "glue" subtype:(
      "(\\" name:(
          "line" { return 1; }
        / "baseline" { return 2; }
        / "par" { return 3; }
        / "abovedisplayshort" { return 6; }
        / "belowdisplayshort" { return 7; }
        / "abovedisplay" { return 4; }
        / "belowdisplay" { return 5; }
        / "left" { return 8; }
        / "right" { return 9; }
        / "top" { return 10; }
        / "splittop" { return 11; }
        / "tab" { return 12; }
        / "xspace" { return 14; }
        / "space" { return 13; }
        / "parfill" { return 15; }
        / "math" { return 16; }
        / "thinmu" { return 17; }
        / "medmu" { return 18; }
        / "thickmu" { return 19; }
      ) "skip)" { return name; }
    / "" { return 0; }
  ) " " width:scaled_number
  stretch:(" plus " s:scaled_number go:glue_order_pt { return { stretch: s, stretch_order: go }; })?
  shrink:(" minus " s:scaled_number go:glue_order_pt { return { shrink: s, shrink_order: go }; })? {
      return {
        id: 'glue', subtype, width,
        stretch: stretch ? stretch.stretch : 0,
        stretch_order: stretch ? stretch.stretch_order : 0,
        shrink: shrink ? shrink.shrink : 0,
        shrink_order: shrink ? shrink.shrink_order : 0,
      };
    }

penalty_node
  = "penalty " penalty:signed_integer { return { id: 'penalty', subtype: 0, penalty }; }

// Fraction noad (separate entry point)
fraction_line
  = "\\fraction, thickness " width:("= default" { return 0x40000000; } / scaled_number)
    left:(", left-delimiter " d:delimiter_code { return d; })?
    right:(", right-delimiter " d:delimiter_code { return d; })? !. {
      const result = { id: 'fraction', subtype: 0, width };
      if (left) result.left = left;
      if (right) result.right = right;
      return result;
    }

// Mathchoice noad (separate entry point)
mathchoice_line
  = "\\mathchoice" !. { return { id: 'choice', subtype: 0 }; }

// Math char (separate entry point)
math_char_line
  = math_char

// Box node detection (separate entry point)
box_line
  = "\\" ("h" / "v") "box(" { return true; }

// Mark whatsit (separate entry point)
mark_whatsit_line
  = "\\write" "-"? [0-9]+ "{LUAMML_MARK_REF:" id:$[0-9]+ ":" {
      return parseInt(id, 10);
    }

// Shared rules
math_char
  = "\\fam" fam:$[0-9]+ " " char:tex_char_value {
      return { id: 'math_char', subtype: 0, fam: parseInt(fam, 10), char };
    }

tex_char_value
  = "^^" hex:$([0-9a-f] [0-9a-f]) { return parseInt(hex, 16); }
  / "^^" ch:. {
      const code = ch.charCodeAt(0);
      if (code <= 0x3F) return code + 0x40;
      return code - 0x40;
    }
  / ch:. { return ch.charCodeAt(0); }

delimiter_code
  = "\"" hex:$[0-9A-Fa-f]+ { return parseDelimiterCode(hex); }

scaled_number
  = s:$("-"? [0-9]+ "." [0-9]+) { return parseScaled(s); }
  / s:$("-"? [0-9]+) "." { return parseScaled(s + ".0"); }
  / s:$("-"? [0-9]+) { return parseScaled(s + ".0"); }

signed_integer
  = s:$("-"? [0-9]+) { return parseInt(s, 10); }

hdw_value
  = "*" { return -0x40000000; }
  / scaled_number

glue_order_mu
  = "filll" { return 3; }
  / "fill" { return 2; }
  / "fil" { return 1; }
  / "mu" { return 0; }

glue_order_pt
  = "filll" { return 3; }
  / "fill" { return 2; }
  / "fil" { return 1; }
  / "pt" { return 0; }
  / "" { return 0; }
