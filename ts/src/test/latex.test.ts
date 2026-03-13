import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { render, renderToString, ParseError } from '../latex.js';
import type { MathMLElement } from '../types.js';

/** Helper: render and return the inner content (children of <math>). */
function renderInner(input: string, options?: Parameters<typeof render>[1]): MathMLElement[] {
  const math = render(input, options);
  return math.children.filter((c): c is MathMLElement => typeof c !== 'string');
}

/** Helper: get a single child element. */
function renderSingle(input: string, options?: Parameters<typeof render>[1]): MathMLElement {
  const children = renderInner(input, options);
  assert.equal(children.length, 1, `Expected 1 child, got ${children.length}`);
  return children[0];
}

describe('LaTeX parser', () => {

  describe('basic elements', () => {
    it('parses a single letter as mi', () => {
      const el = renderSingle('x');
      assert.equal(el.tag, 'mi');
      assert.deepEqual(el.children, ['x']);
    });

    it('parses a single digit as mn', () => {
      const el = renderSingle('5');
      assert.equal(el.tag, 'mn');
      assert.deepEqual(el.children, ['5']);
    });

    it('joins consecutive digits', () => {
      const el = renderSingle('42');
      assert.equal(el.tag, 'mn');
      assert.deepEqual(el.children, ['42']);
    });

    it('joins digits with decimal point', () => {
      const el = renderSingle('3.14');
      assert.equal(el.tag, 'mn');
      assert.deepEqual(el.children, ['3.14']);
    });

    it('parses operators as mo', () => {
      const children = renderInner('x + y');
      assert.equal(children.length, 3);
      assert.equal(children[0].tag, 'mi');
      assert.equal(children[1].tag, 'mo');
      assert.deepEqual(children[1].children, ['+']);
      assert.equal(children[2].tag, 'mi');
    });

    it('converts - to unicode minus', () => {
      const children = renderInner('a - b');
      assert.equal(children[1].tag, 'mo');
      assert.deepEqual(children[1].children, ['\u2212']);
    });

    it('handles empty input', () => {
      const math = render('');
      assert.equal(math.tag, 'math');
    });
  });

  describe('grouping', () => {
    it('parses braced groups', () => {
      const children = renderInner('{ab}');
      // {ab} → mrow containing mi(a), mi(b)
      assert.equal(children.length, 2);
    });

    it('preserves nested groups', () => {
      const children = renderInner('{{x}}');
      assert.equal(children.length, 1);
      assert.equal(children[0].tag, 'mi');
    });
  });

  describe('subscripts and superscripts', () => {
    it('parses superscript', () => {
      const el = renderSingle('x^2');
      assert.equal(el.tag, 'msup');
      assert.equal(el.children.length, 2);
    });

    it('parses subscript', () => {
      const el = renderSingle('x_n');
      assert.equal(el.tag, 'msub');
      assert.equal(el.children.length, 2);
    });

    it('parses sub+superscript', () => {
      const el = renderSingle('x_n^2');
      assert.equal(el.tag, 'msubsup');
      assert.equal(el.children.length, 3);
    });

    it('parses super+subscript (reversed order)', () => {
      const el = renderSingle('x^2_n');
      assert.equal(el.tag, 'msubsup');
      assert.equal(el.children.length, 3);
    });

    it('handles braced sub/superscripts', () => {
      const el = renderSingle('x^{2n}');
      assert.equal(el.tag, 'msup');
      const sup = el.children[1] as MathMLElement;
      // The superscript should contain 2 and n
      assert.ok(sup);
    });

    it('handles prime as superscript', () => {
      const children = renderInner("f'");
      // f' should produce msup with prime
      assert.equal(children.length, 1);
      assert.equal(children[0].tag, 'msup');
    });
  });

  describe('fractions', () => {
    it('parses \\frac', () => {
      const el = renderSingle('\\frac{a}{b}');
      assert.equal(el.tag, 'mfrac');
      assert.equal(el.children.length, 2);
    });

    it('parses \\dfrac with displaystyle wrapper', () => {
      const el = renderSingle('\\dfrac{a}{b}');
      assert.equal(el.tag, 'mstyle');
      assert.equal(el.attrs.displaystyle, 'true');
    });

    it('parses nested fractions', () => {
      const el = renderSingle('\\frac{\\frac{a}{b}}{c}');
      assert.equal(el.tag, 'mfrac');
      const num = el.children[0] as MathMLElement;
      assert.equal(num.tag, 'mfrac');
    });
  });

  describe('roots', () => {
    it('parses \\sqrt', () => {
      const el = renderSingle('\\sqrt{x}');
      assert.equal(el.tag, 'msqrt');
    });

    it('parses \\sqrt with index', () => {
      const el = renderSingle('\\sqrt[3]{x}');
      assert.equal(el.tag, 'mroot');
      assert.equal(el.children.length, 2);
    });
  });

  describe('delimiters', () => {
    it('parses \\left( ... \\right)', () => {
      // Bare <mo> delimiters (matching MathJax — no explicit fence/stretchy attrs)
      const children = renderInner('\\left( x \\right)');
      assert.equal(children.length, 3); // mo( + mi(x) + mo)
      assert.equal(children[0].tag, 'mo');
      assert.deepEqual(children[0].children, ['(']);
    });

    it('handles invisible delimiter with .', () => {
      const children = renderInner('\\left. x \\right|');
      // No left delimiter, just content and right |
      assert.ok(children.some(c => c.tag === 'mo' && c.children[0] === '|'));
    });

    it('handles \\left\\{ ... \\right\\}', () => {
      const children = renderInner('\\left\\{ x \\right\\}');
      assert.equal(children.length, 3);
      assert.deepEqual(children[0].children, ['{']);
    });

    it('handles \\middle', () => {
      const children = renderInner('\\left( x \\middle| y \\right)');
      const mos = children.filter(c => c.tag === 'mo');
      assert.equal(mos.length, 3); // (, |, )
    });
  });

  describe('Greek letters', () => {
    it('parses lowercase Greek', () => {
      const el = renderSingle('\\alpha');
      assert.equal(el.tag, 'mi');
      assert.deepEqual(el.children, ['\u03B1']);
    });

    it('parses uppercase Greek with mathvariant=normal', () => {
      const el = renderSingle('\\Omega');
      assert.equal(el.tag, 'mi');
      assert.deepEqual(el.children, ['\u03A9']);
      assert.equal(el.attrs.mathvariant, 'normal');
    });
  });

  describe('operators and relations', () => {
    it('parses \\times', () => {
      const children = renderInner('a \\times b');
      assert.equal(children[1].tag, 'mo');
      assert.deepEqual(children[1].children, ['\u00D7']);
    });

    it('parses \\leq', () => {
      const children = renderInner('x \\leq y');
      assert.equal(children[1].tag, 'mo');
      assert.deepEqual(children[1].children, ['\u2264']);
    });

    it('parses arrows', () => {
      const el = renderSingle('\\rightarrow');
      assert.equal(el.tag, 'mo');
      assert.deepEqual(el.children, ['\u2192']);
    });
  });

  describe('big operators', () => {
    it('parses \\sum with limits using munderover', () => {
      const children = renderInner('\\sum_{i=1}^{n}');
      assert.equal(children.length, 1);
      // sum with sub and sup uses munderover (limits above/below)
      assert.equal(children[0].tag, 'munderover');
    });

    it('parses \\int', () => {
      const children = renderInner('\\int_0^1');
      // int is not a big operator, uses msubsup
      assert.equal(children[0].tag, 'msubsup');
    });
  });

  describe('named operators', () => {
    it('parses \\sin as mi', () => {
      const el = renderSingle('\\sin');
      assert.equal(el.tag, 'mi');
      assert.deepEqual(el.children, ['sin']);
    });

    it('inserts ApplyFunction after \\sin when followed by content', () => {
      const children = renderInner('\\sin x');
      assert.equal(children.length, 3); // mi('sin'), mo('⁡'), mi('x')
      assert.equal(children[0].tag, 'mi');
      assert.deepEqual(children[0].children, ['sin']);
      assert.equal(children[1].tag, 'mo');
      assert.deepEqual(children[1].children, ['\u2061']);
      assert.equal(children[2].tag, 'mi');
    });

    it('parses \\lim as mo with movablelimits', () => {
      const el = renderSingle('\\lim');
      assert.equal(el.tag, 'mo');
      assert.equal(el.attrs.movablelimits, 'true');
    });
  });

  describe('accents', () => {
    it('parses \\hat', () => {
      const el = renderSingle('\\hat{x}');
      assert.equal(el.tag, 'mover');
      // accent="true" goes on the <mo>, not the <mover> (matching MathJax)
      const mo = el.children[1] as MathMLElement;
      assert.equal(mo.tag, 'mo');
      assert.equal(mo.attrs.accent, 'true');
    });

    it('parses \\overline (wide)', () => {
      const el = renderSingle('\\overline{AB}');
      assert.equal(el.tag, 'mover');
      const accent = el.children[1] as MathMLElement;
      assert.equal(accent.attrs.stretchy, 'true');
    });

    it('parses \\underline', () => {
      const el = renderSingle('\\underline{x}');
      assert.equal(el.tag, 'munder');
    });
  });

  describe('font commands', () => {
    it('parses \\mathrm', () => {
      const el = renderSingle('\\mathrm{x}');
      assert.equal(el.tag, 'mi');
      assert.equal(el.attrs.mathvariant, 'normal');
    });

    it('parses \\mathbb', () => {
      const el = renderSingle('\\mathbb{R}');
      assert.equal(el.tag, 'mi');
      assert.equal(el.attrs.mathvariant, 'double-struck');
    });

    it('parses \\text', () => {
      const el = renderSingle('\\text{hello world}');
      assert.equal(el.tag, 'mtext');
      assert.deepEqual(el.children, ['hello world']);
    });
  });

  describe('spacing', () => {
    it('parses \\, as thin space', () => {
      const children = renderInner('a\\,b');
      const space = children.find(c => c.tag === 'mspace');
      assert.ok(space);
      assert.equal(space!.attrs.width, '0.167em');
    });

    it('parses \\quad', () => {
      const children = renderInner('a\\quad b');
      const space = children.find(c => c.tag === 'mspace');
      assert.ok(space);
      assert.equal(space!.attrs.width, '1em');
    });
  });

  describe('\\binom', () => {
    it('produces mfrac with linethickness=0 inside delimiters', () => {
      const children = renderInner('\\binom{n}{k}');
      // ( mfrac ) — three children at math level
      const frac = children.find(c => c.tag === 'mfrac');
      assert.ok(frac);
      assert.equal(frac!.attrs.linethickness, '0');
    });
  });

  describe('environments', () => {
    it('parses matrix environment', () => {
      const children = renderInner('\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}');
      // pmatrix: ( + mtable + )
      const mtable = children.find(c => c.tag === 'mtable');
      assert.ok(mtable);
      assert.equal(mtable!.children.length, 2); // 2 rows
    });

    it('parses cases environment', () => {
      const children = renderInner('\\begin{cases} x & y \\\\ a & b \\end{cases}');
      const mtable = children.find(c => c.tag === 'mtable');
      assert.ok(mtable);
    });
  });

  describe('\\operatorname', () => {
    it('produces upright text', () => {
      const el = renderSingle('\\operatorname{tr}');
      assert.equal(el.tag, 'mi');
      assert.deepEqual(el.children, ['tr']);
    });
  });

  describe('\\not', () => {
    it('negates = to ≠', () => {
      const el = renderSingle('\\not=');
      assert.equal(el.tag, 'mo');
      assert.deepEqual(el.children, ['\u2260']);
    });

    it('negates \\in to ∉', () => {
      const el = renderSingle('\\not\\in');
      assert.equal(el.tag, 'mo');
      assert.deepEqual(el.children, ['\u2209']);
    });
  });

  describe('style switches', () => {
    it('wraps rest in mstyle for \\displaystyle', () => {
      const children = renderInner('\\displaystyle x');
      assert.equal(children.length, 1);
      assert.equal(children[0].tag, 'mstyle');
      assert.equal(children[0].attrs.displaystyle, 'true');
    });
  });

  describe('special characters', () => {
    it('parses \\{ and \\}', () => {
      const children = renderInner('\\{ x \\}');
      assert.equal(children[0].tag, 'mo');
      assert.deepEqual(children[0].children, ['{']);
      assert.equal(children[2].tag, 'mo');
      assert.deepEqual(children[2].children, ['}']);
    });

    it('handles comments', () => {
      const children = renderInner('x % comment\n+ y');
      assert.equal(children.length, 3); // x, +, y
    });
  });

  describe('macro expansion', () => {
    it('expands simple macros', () => {
      const el = renderSingle('\\RR', {
        macros: { '\\RR': '\\mathbb{R}' },
      });
      assert.equal(el.tag, 'mi');
      assert.equal(el.attrs.mathvariant, 'double-struck');
      assert.deepEqual(el.children, ['R']);
    });

    it('expands macros with arguments', () => {
      const children = renderInner('\\norm{x}', {
        macros: {
          '\\norm': { args: 1, expansion: '\\left\\| #1 \\right\\|' },
        },
      });
      // \left\| x \right\| → ‖ x ‖
      const mos = children.filter(c => c.tag === 'mo');
      assert.ok(mos.length >= 2); // at least two ‖ delimiters
    });

    it('expands nested macros', () => {
      const el = renderSingle('\\RR', {
        macros: {
          '\\RR': '\\mathbb{\\R}',
          '\\R': 'R',
        },
      });
      assert.equal(el.tag, 'mi');
    });

    it('handles macros without leading backslash in key', () => {
      const el = renderSingle('\\RR', {
        macros: { 'RR': '\\mathbb{R}' },
      });
      assert.equal(el.tag, 'mi');
      assert.equal(el.attrs.mathvariant, 'double-struck');
    });
  });

  describe('display mode', () => {
    it('sets display=block when displayMode is true', () => {
      const math = render('x', { displayMode: true });
      assert.equal(math.attrs.display, 'block');
    });

    it('omits display attr when displayMode is false', () => {
      const math = render('x', { displayMode: false });
      assert.equal(math.attrs.display, undefined);
    });
  });

  describe('renderToString', () => {
    it('produces valid MathML markup', () => {
      const str = renderToString('x^2 + y^2 = z^2');
      assert.ok(str.startsWith('<math'));
      assert.ok(str.includes('xmlns="http://www.w3.org/1998/Math/MathML"'));
      assert.ok(str.includes('<msup>'));
      assert.ok(str.includes('</math>'));
    });
  });

  describe('complex expressions', () => {
    it('handles quadratic formula', () => {
      const str = renderToString('x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}');
      assert.ok(str.includes('<mfrac>'));
      assert.ok(str.includes('<msqrt>'));
      assert.ok(str.includes('<msup>'));
    });

    it('handles integral expression', () => {
      const str = renderToString('\\int_0^\\infty e^{-x^2} dx');
      assert.ok(str.includes('\u222B'));
      assert.ok(str.includes('\u221E'));
    });

    it('handles Euler identity', () => {
      const str = renderToString('e^{i\\pi} + 1 = 0');
      assert.ok(str.includes('<msup>'));
      assert.ok(str.includes('\u03C0'));
    });

    it('handles matrix determinant', () => {
      const str = renderToString(
        '\\begin{vmatrix} a & b \\\\ c & d \\end{vmatrix} = ad - bc'
      );
      assert.ok(str.includes('<mtable>'));
      assert.ok(str.includes('<mtr>'));
      assert.ok(str.includes('<mtd>'));
    });
  });

  describe('error handling', () => {
    it('produces merror for unknown commands', () => {
      const el = renderSingle('\\unknowncmd');
      assert.equal(el.tag, 'merror');
    });

    it('throws on missing closing brace', () => {
      assert.throws(() => render('{x'), ParseError);
    });

    it('throws on missing \\right', () => {
      assert.throws(() => render('\\left( x'), ParseError);
    });
  });

  // =========================================================================
  // New feature coverage tests
  // =========================================================================

  describe('AMS symbols', () => {
    it('parses AMS misc symbols', () => {
      const cases: [string, string][] = [
        ['\\eth', '\u00F0'], ['\\mho', '\u2127'], ['\\Finv', '\u2132'],
        ['\\Game', '\u2141'], ['\\digamma', '\u03DD'], ['\\varkappa', '\u03F0'],
        ['\\hslash', '\u210F'], ['\\circledS', '\u24C8'], ['\\circledR', '\u00AE'],
        ['\\lozenge', '\u25CA'], ['\\blacklozenge', '\u29EB'],
        ['\\blacktriangle', '\u25B4'], ['\\blacktriangledown', '\u25BE'],
        ['\\blacksquare', '\u25A0'], ['\\square', '\u25A1'],
        ['\\bigstar', '\u2605'], ['\\sphericalangle', '\u2222'],
        ['\\measuredangle', '\u2221'], ['\\diagup', '\u2571'],
        ['\\diagdown', '\u2572'], ['\\maltese', '\u2720'],
      ];
      for (const [cmd, expected] of cases) {
        const el = renderSingle(cmd);
        assert.deepEqual(el.children, [expected], `${cmd} should produce ${expected}`);
      }
    });

    it('parses AMS binary operators', () => {
      const cases: [string, string][] = [
        ['\\boxplus', '\u229E'], ['\\boxminus', '\u229F'],
        ['\\boxtimes', '\u22A0'], ['\\boxdot', '\u22A1'],
        ['\\intercal', '\u22BA'], ['\\veebar', '\u22BB'],
        ['\\barwedge', '\u22BC'], ['\\doublebarwedge', '\u2A5E'],
        ['\\curlywedge', '\u22CF'], ['\\curlyvee', '\u22CE'],
        ['\\ltimes', '\u22C9'], ['\\rtimes', '\u22CA'],
        ['\\leftthreetimes', '\u22CB'], ['\\rightthreetimes', '\u22CC'],
        ['\\circleddash', '\u229D'], ['\\circledast', '\u229B'],
        ['\\circledcirc', '\u229A'], ['\\divideontimes', '\u22C7'],
        ['\\dotplus', '\u2214'], ['\\Cap', '\u22D2'], ['\\Cup', '\u22D3'],
      ];
      for (const [cmd, expected] of cases) {
        const el = renderSingle(cmd);
        assert.equal(el.tag, 'mo', `${cmd} should be mo`);
        assert.deepEqual(el.children, [expected], `${cmd} should produce ${expected}`);
      }
    });

    it('parses AMS relations', () => {
      const cases: [string, string][] = [
        ['\\lll', '\u22D8'], ['\\ggg', '\u22D9'],
        ['\\lessgtr', '\u2276'], ['\\gtrless', '\u2277'],
        ['\\vartriangleleft', '\u22B2'], ['\\vartriangleright', '\u22B3'],
        ['\\trianglelefteq', '\u22B4'], ['\\trianglerighteq', '\u22B5'],
        ['\\between', '\u226C'], ['\\pitchfork', '\u22D4'],
        ['\\backepsilon', '\u03F6'], ['\\smallsmile', '\u2323'],
        ['\\smallfrown', '\u2322'], ['\\Subset', '\u22D0'],
        ['\\Supset', '\u22D1'], ['\\sqsubset', '\u228F'],
        ['\\sqsupset', '\u2290'], ['\\bumpeq', '\u224F'],
        ['\\Bumpeq', '\u224E'], ['\\doteq', '\u2250'],
        ['\\doteqdot', '\u2251'], ['\\fallingdotseq', '\u2252'],
        ['\\risingdotseq', '\u2253'], ['\\eqcirc', '\u2256'],
        ['\\circeq', '\u2257'], ['\\triangleq', '\u225C'],
        ['\\backsim', '\u223D'], ['\\backsimeq', '\u22CD'],
        ['\\vDash', '\u22A8'], ['\\Vdash', '\u22A9'], ['\\Vvdash', '\u22AA'],
      ];
      for (const [cmd, expected] of cases) {
        const el = renderSingle(cmd);
        assert.equal(el.tag, 'mo', `${cmd} should be mo`);
        assert.deepEqual(el.children, [expected], `${cmd} should produce ${expected}`);
      }
    });

    it('parses AMS negated relations', () => {
      const cases: [string, string][] = [
        ['\\nleq', '\u2270'], ['\\ngeq', '\u2271'],
        ['\\nless', '\u226E'], ['\\ngtr', '\u226F'],
        ['\\nprec', '\u2280'], ['\\nsucc', '\u2281'],
        ['\\subsetneq', '\u228A'], ['\\supsetneq', '\u228B'],
        ['\\nsubseteq', '\u2288'], ['\\nsupseteq', '\u2289'],
        ['\\ntriangleleft', '\u22EA'], ['\\ntriangleright', '\u22EB'],
        ['\\ntrianglelefteq', '\u22EC'], ['\\ntrianglerighteq', '\u22ED'],
      ];
      for (const [cmd, expected] of cases) {
        const el = renderSingle(cmd);
        assert.equal(el.tag, 'mo', `${cmd} should be mo`);
        assert.deepEqual(el.children, [expected], `${cmd} should produce ${expected}`);
      }
    });

    it('parses AMS arrows', () => {
      const cases: [string, string][] = [
        ['\\twoheadrightarrow', '\u21A0'], ['\\twoheadleftarrow', '\u219E'],
        ['\\rightarrowtail', '\u21A3'], ['\\leftarrowtail', '\u21A2'],
        ['\\rightrightarrows', '\u21C9'], ['\\leftleftarrows', '\u21C7'],
        ['\\rightleftarrows', '\u21C4'], ['\\leftrightarrows', '\u21C6'],
        ['\\Rsh', '\u21B1'], ['\\Lsh', '\u21B0'],
        ['\\circlearrowleft', '\u21BA'], ['\\circlearrowright', '\u21BB'],
        ['\\curvearrowleft', '\u21B6'], ['\\curvearrowright', '\u21B7'],
        ['\\multimap', '\u22B8'], ['\\upuparrows', '\u21C8'],
        ['\\downdownarrows', '\u21CA'], ['\\upharpoonright', '\u21BE'],
        ['\\upharpoonleft', '\u21BF'], ['\\downharpoonright', '\u21C2'],
        ['\\downharpoonleft', '\u21C3'], ['\\rightleftharpoons', '\u21CC'],
        ['\\leftrightharpoons', '\u21CB'],
      ];
      for (const [cmd, expected] of cases) {
        const el = renderSingle(cmd);
        assert.equal(el.tag, 'mo', `${cmd} should be mo`);
        assert.deepEqual(el.children, [expected], `${cmd} should produce ${expected}`);
      }
    });
  });

  describe('extensible arrows', () => {
    it('parses \\xrightarrow with required arg', () => {
      const el = renderSingle('\\xrightarrow{f}');
      assert.equal(el.tag, 'mover');
      const arrow = el.children[0] as MathMLElement;
      assert.equal(arrow.tag, 'mo');
      assert.deepEqual(arrow.children, ['\u2192']);
    });

    it('parses \\xrightarrow with optional and required args', () => {
      const el = renderSingle('\\xrightarrow[g]{f}');
      assert.equal(el.tag, 'munderover');
      const arrow = el.children[0] as MathMLElement;
      assert.equal(arrow.tag, 'mo');
    });

    it('parses \\xleftarrow', () => {
      const el = renderSingle('\\xleftarrow{f}');
      assert.equal(el.tag, 'mover');
      const arrow = el.children[0] as MathMLElement;
      assert.deepEqual(arrow.children, ['\u2190']);
    });

    it('parses all extensible arrow variants', () => {
      const arrows = [
        'xrightarrow', 'xleftarrow', 'xlongequal', 'xmapsto',
        'xleftrightarrow', 'xRightarrow', 'xLeftarrow',
        'xhookleftarrow', 'xhookrightarrow',
        'xtwoheadrightarrow', 'xtwoheadleftarrow',
        'xrightharpoondown', 'xrightharpoonup',
        'xleftharpoondown', 'xleftharpoonup',
        'xrightleftharpoons', 'xleftrightharpoons',
      ];
      for (const name of arrows) {
        const el = renderSingle(`\\${name}{x}`);
        assert.equal(el.tag, 'mover', `\\${name} should produce mover`);
      }
    });
  });

  describe('fraction variants', () => {
    it('parses \\cfrac', () => {
      const el = renderSingle('\\cfrac{1}{2}');
      assert.equal(el.tag, 'mstyle');
      assert.equal(el.attrs.displaystyle, 'true');
      const frac = el.children[0] as MathMLElement;
      assert.equal(frac.tag, 'mfrac');
    });

    it('parses \\cfrac with optional alignment', () => {
      const el = renderSingle('\\cfrac[l]{1}{2}');
      assert.equal(el.tag, 'mstyle');
    });

    it('parses \\genfrac', () => {
      const children = renderInner('\\genfrac{(}{)}{0pt}{}{n}{k}');
      const frac = children.find(c => c.tag === 'mfrac');
      assert.ok(frac);
    });

    it('handles \\atopwithdelims as infix', () => {
      const children = renderInner('{n \\atopwithdelims() k}');
      const frac = children.find(c => c.tag === 'mfrac');
      assert.ok(frac, 'should contain mfrac');
    });
  });

  describe('modular arithmetic', () => {
    it('parses \\pmod', () => {
      const children = renderInner('a \\pmod{p}');
      const str = renderToString('a \\pmod{p}');
      assert.ok(str.includes('mod'));
      assert.ok(str.includes('('));
      assert.ok(str.includes(')'));
    });

    it('parses \\bmod', () => {
      const children = renderInner('a \\bmod b');
      const mo = children.find(c => c.tag === 'mo' && c.children[0] === 'mod');
      assert.ok(mo);
    });

    it('parses \\mod', () => {
      const str = renderToString('a \\mod{p}');
      assert.ok(str.includes('mod'));
    });

    it('parses \\pod', () => {
      const str = renderToString('a \\pod{p}');
      assert.ok(str.includes('('));
      assert.ok(str.includes(')'));
    });
  });

  describe('cancel commands', () => {
    it('parses \\cancel', () => {
      const el = renderSingle('\\cancel{x}');
      assert.equal(el.tag, 'menclose');
      assert.equal(el.attrs.notation, 'updiagonalstrike');
    });

    it('parses \\bcancel', () => {
      const el = renderSingle('\\bcancel{x}');
      assert.equal(el.tag, 'menclose');
      assert.equal(el.attrs.notation, 'downdiagonalstrike');
    });

    it('parses \\xcancel', () => {
      const el = renderSingle('\\xcancel{x}');
      assert.equal(el.tag, 'menclose');
      assert.equal(el.attrs.notation, 'updiagonalstrike downdiagonalstrike');
    });
  });

  describe('color and box commands', () => {
    it('parses \\textcolor', () => {
      const el = renderSingle('\\textcolor{red}{x}');
      assert.equal(el.tag, 'mstyle');
      assert.equal(el.attrs.mathcolor, 'red');
    });

    it('parses \\colorbox', () => {
      const el = renderSingle('\\colorbox{yellow}{x}');
      assert.equal(el.tag, 'mpadded');
      assert.equal(el.attrs.mathbackground, 'yellow');
    });

    it('parses \\fcolorbox', () => {
      const el = renderSingle('\\fcolorbox{red}{yellow}{x}');
      assert.equal(el.tag, 'mpadded');
      assert.equal(el.attrs.mathbackground, 'yellow');
    });
  });

  describe('layout commands', () => {
    it('parses \\smash', () => {
      const el = renderSingle('\\smash{x}');
      assert.equal(el.tag, 'mpadded');
    });

    it('parses \\smash[b]', () => {
      const el = renderSingle('\\smash[b]{x}');
      assert.equal(el.tag, 'mpadded');
      assert.equal(el.attrs.depth, '0');
    });

    it('parses \\smash[t]', () => {
      const el = renderSingle('\\smash[t]{x}');
      assert.equal(el.tag, 'mpadded');
      assert.equal(el.attrs.height, '0');
    });

    it('parses \\vphantom', () => {
      const el = renderSingle('\\vphantom{x}');
      assert.equal(el.tag, 'mpadded');
      assert.equal(el.attrs.width, '0');
      const phantom = el.children[0] as MathMLElement;
      assert.equal(phantom.tag, 'mphantom');
    });

    it('parses \\hphantom', () => {
      const el = renderSingle('\\hphantom{x}');
      assert.equal(el.tag, 'mpadded');
      assert.equal(el.attrs.height, '0');
      assert.equal(el.attrs.depth, '0');
    });

    it('parses \\mathclap', () => {
      const el = renderSingle('\\mathclap{x}');
      assert.equal(el.tag, 'mpadded');
      assert.equal(el.attrs.width, '0');
    });

    it('parses \\mathrlap', () => {
      const el = renderSingle('\\mathrlap{x}');
      assert.equal(el.tag, 'mpadded');
      assert.equal(el.attrs.width, '0');
    });

    it('parses \\kern', () => {
      const children = renderInner('a\\kern1em b');
      const space = children.find(c => c.tag === 'mspace');
      assert.ok(space);
    });

    it('parses \\hspace', () => {
      const children = renderInner('a\\hspace{1em}b');
      const space = children.find(c => c.tag === 'mspace');
      assert.ok(space);
      assert.equal(space!.attrs.width, '1em');
    });

    it('parses \\rule', () => {
      const el = renderSingle('\\rule{1em}{2em}');
      assert.equal(el.tag, 'mspace');
      assert.equal(el.attrs.width, '1em');
      assert.equal(el.attrs.height, '2em');
    });

    it('parses \\raisebox', () => {
      const el = renderSingle('\\raisebox{2pt}{x}');
      assert.equal(el.tag, 'mpadded');
      assert.equal(el.attrs.voffset, '2pt');
    });
  });

  describe('new accents', () => {
    it('parses \\overparen', () => {
      const el = renderSingle('\\overparen{AB}');
      assert.equal(el.tag, 'mover');
      assert.equal(el.attrs.accent, undefined);
    });

    it('parses \\underparen', () => {
      const el = renderSingle('\\underparen{AB}');
      assert.equal(el.tag, 'munder');
    });

    it('parses \\overbracket', () => {
      const el = renderSingle('\\overbracket{AB}');
      assert.equal(el.tag, 'mover');
    });

    it('parses \\underbracket', () => {
      const el = renderSingle('\\underbracket{AB}');
      assert.equal(el.tag, 'munder');
    });
  });

  describe('new environments', () => {
    it('parses dcases environment', () => {
      const children = renderInner('\\begin{dcases} x & y \\\\ a & b \\end{dcases}');
      const mtable = children.find(c => c.tag === 'mtable');
      assert.ok(mtable);
    });

    it('parses rcases environment', () => {
      const children = renderInner('\\begin{rcases} x & y \\\\ a & b \\end{rcases}');
      const mtable = children.find(c => c.tag === 'mtable');
      assert.ok(mtable);
      // rcases should have } on the right
      const rightBrace = children.find(c => c.tag === 'mo' && c.children[0] === '}');
      assert.ok(rightBrace);
    });

    it('parses matrix* environment', () => {
      const el = renderSingle('\\begin{matrix*} a & b \\\\ c & d \\end{matrix*}');
      assert.equal(el.tag, 'mtable');
    });

    it('parses equation environment', () => {
      const str = renderToString('\\begin{equation} x = 1 \\end{equation}');
      assert.ok(str.includes('<mi>'));
    });

    it('parses gather environment', () => {
      const str = renderToString('\\begin{gather} x \\\\ y \\end{gather}');
      assert.ok(str.includes('<mtable'));
    });

    it('parses multline environment', () => {
      const str = renderToString('\\begin{multline} x \\\\ y \\end{multline}');
      assert.ok(str.includes('<mtable'));
    });

    it('parses split environment', () => {
      const str = renderToString('\\begin{split} a &= b \\\\ c &= d \\end{split}');
      assert.ok(str.includes('<mtable'));
    });

    it('parses CD environment', () => {
      const str = renderToString('\\begin{CD} A \\\\ B \\end{CD}');
      assert.ok(str.includes('<mtable'));
    });
  });

  describe('additional integrals', () => {
    it('parses \\smallint', () => {
      const el = renderSingle('\\smallint');
      assert.equal(el.tag, 'mo');
      assert.deepEqual(el.children, ['\u222B']);
    });

    it('parses \\iiiint', () => {
      const el = renderSingle('\\iiiint');
      assert.equal(el.tag, 'mo');
      assert.deepEqual(el.children, ['\u2A0C']);
    });

    it('parses \\idotsint', () => {
      const el = renderSingle('\\idotsint');
      assert.equal(el.tag, 'mo');
    });
  });

  describe('miscellaneous commands', () => {
    it('parses \\sout (strikeout)', () => {
      const el = renderSingle('\\sout{x}');
      assert.equal(el.tag, 'menclose');
      assert.equal(el.attrs.notation, 'horizontalstrike');
    });

    it('parses \\prescript', () => {
      const el = renderSingle('\\prescript{a}{b}{X}');
      assert.equal(el.tag, 'mmultiscripts');
    });

    it('parses \\mathinner', () => {
      const el = renderSingle('\\mathinner{x}');
      assert.equal(el.tag, 'mi');
    });

    it('parses \\LaTeX', () => {
      const el = renderSingle('\\LaTeX');
      assert.equal(el.tag, 'mi');
      assert.deepEqual(el.children, ['LaTeX']);
    });

    it('parses \\TeX', () => {
      const el = renderSingle('\\TeX');
      assert.equal(el.tag, 'mi');
      assert.deepEqual(el.children, ['TeX']);
    });

    it('parses \\href', () => {
      const children = renderInner('\\href{https://example.com}{x}');
      assert.ok(children.length >= 1);
    });

    it('parses \\url', () => {
      const el = renderSingle('\\url{https://example.com}');
      assert.equal(el.tag, 'mtext');
    });

    it('parses \\label (invisible)', () => {
      const str = renderToString('\\label{eq1}');
      assert.ok(!str.includes('<merror>'));
    });

    it('parses \\ref', () => {
      const el = renderSingle('\\ref{eq1}');
      assert.equal(el.tag, 'mtext');
    });

    it('parses \\eqref', () => {
      const children = renderInner('\\eqref{eq1}');
      const str = renderToString('\\eqref{eq1}');
      assert.ok(str.includes('('));
      assert.ok(str.includes(')'));
    });

    it('parses \\htmlStyle (passes through body)', () => {
      const el = renderSingle('\\htmlStyle{color:red}{x}');
      assert.equal(el.tag, 'mi');
    });

    it('parses \\char', () => {
      const el = renderSingle('\\char"41');
      assert.equal(el.tag, 'mtext');
      assert.deepEqual(el.children, ['A']);
    });

    it('parses \\unicode', () => {
      const el = renderSingle('\\unicode{41}');
      assert.equal(el.tag, 'mtext');
      assert.deepEqual(el.children, ['A']);
    });
  });

  describe('\\tag command', () => {
    it('parses \\tag{1}', () => {
      const str = renderToString('x = 1 \\tag{1}');
      assert.ok(str.includes('('));
      assert.ok(str.includes(')'));
    });

    it('parses \\tag*{1}', () => {
      const str = renderToString('x = 1 \\tag*{1}');
      assert.ok(str.includes('('));
    });
  });

  describe('comprehensive no-merror verification', () => {
    it('produces no merror for any supported command', () => {
      // Exhaustive list of all commands that should NOT produce merror
      const expressions = [
        // AMS symbols
        '\\eth', '\\mho', '\\Finv', '\\Game', '\\digamma', '\\varkappa',
        '\\hslash', '\\circledS', '\\circledR', '\\lozenge', '\\blacklozenge',
        '\\blacktriangle', '\\blacktriangledown', '\\blacksquare', '\\square',
        '\\bigstar', '\\sphericalangle', '\\measuredangle', '\\diagup',
        '\\diagdown', '\\maltese',
        // AMS relations
        '\\lll', '\\ggg', '\\lessgtr', '\\gtrless',
        '\\trianglelefteq', '\\trianglerighteq',
        '\\vartriangleleft', '\\vartriangleright',
        '\\between', '\\pitchfork', '\\backepsilon',
        '\\smallsmile', '\\smallfrown', '\\smile', '\\frown',
        '\\Subset', '\\Supset', '\\sqsubset', '\\sqsupset',
        '\\bumpeq', '\\Bumpeq', '\\doteq', '\\doteqdot',
        '\\fallingdotseq', '\\risingdotseq', '\\eqcirc', '\\circeq',
        '\\triangleq', '\\thicksim', '\\thickapprox',
        '\\backsim', '\\backsimeq',
        '\\vDash', '\\Vdash', '\\Vvdash',
        // AMS negated relations
        '\\nleq', '\\ngeq', '\\nless', '\\ngtr',
        '\\nprec', '\\nsucc', '\\subsetneq', '\\supsetneq',
        '\\nsubseteq', '\\nsupseteq',
        '\\ntriangleleft', '\\ntriangleright',
        '\\ntrianglelefteq', '\\ntrianglerighteq',
        // AMS arrows
        '\\twoheadrightarrow', '\\twoheadleftarrow',
        '\\rightarrowtail', '\\leftarrowtail',
        '\\rightrightarrows', '\\leftleftarrows',
        '\\rightleftarrows', '\\leftrightarrows',
        '\\Rsh', '\\Lsh', '\\circlearrowleft', '\\circlearrowright',
        '\\curvearrowleft', '\\curvearrowright',
        '\\multimap', '\\upuparrows', '\\downdownarrows',
        '\\upharpoonright', '\\upharpoonleft',
        '\\downharpoonright', '\\downharpoonleft',
        '\\rightleftharpoons', '\\leftrightharpoons',
        // AMS binary operators
        '\\boxplus', '\\boxminus', '\\boxtimes', '\\boxdot',
        '\\intercal', '\\veebar', '\\barwedge', '\\doublebarwedge',
        '\\curlywedge', '\\curlyvee', '\\ltimes', '\\rtimes',
        '\\leftthreetimes', '\\rightthreetimes',
        '\\circleddash', '\\circledast', '\\circledcirc',
        '\\centerdot', '\\divideontimes', '\\dotplus',
        '\\Cap', '\\Cup', '\\doublecap', '\\doublecup',
        // Extensible arrows
        '\\xrightarrow{x}', '\\xleftarrow{x}', '\\xlongequal{x}',
        '\\xmapsto{x}', '\\xleftrightarrow{x}',
        '\\xRightarrow{x}', '\\xLeftarrow{x}',
        '\\xhookleftarrow{x}', '\\xhookrightarrow{x}',
        '\\xtwoheadrightarrow{x}', '\\xtwoheadleftarrow{x}',
        '\\xrightharpoondown{x}', '\\xrightharpoonup{x}',
        '\\xleftharpoondown{x}', '\\xleftharpoonup{x}',
        '\\xrightleftharpoons{x}', '\\xleftrightharpoons{x}',
        // Layout
        '\\smash{x}', '\\smash[b]{x}', '\\smash[t]{x}',
        '\\vphantom{x}', '\\hphantom{x}',
        '\\mathclap{x}', '\\mathllap{x}', '\\mathrlap{x}',
        '\\hspace{1em}',
        '\\rule{1em}{2em}',
        '\\raisebox{2pt}{x}',
        // Fractions
        '\\cfrac{1}{2}',
        '\\genfrac{(}{)}{0pt}{}{n}{k}',
        // Mod
        '\\pmod{p}', '\\bmod', '\\mod{p}', '\\pod{p}',
        // Cancel
        '\\cancel{x}', '\\bcancel{x}', '\\xcancel{x}',
        // Color
        '\\textcolor{red}{x}', '\\colorbox{yellow}{x}',
        '\\fcolorbox{red}{yellow}{x}',
        // Accents
        '\\overparen{x}', '\\underparen{x}',
        '\\overbracket{x}', '\\underbracket{x}',
        // Integrals
        '\\smallint', '\\iiiint', '\\idotsint',
        // Misc
        '\\sout{x}', '\\prescript{a}{b}{X}',
        '\\mathinner{x}', '\\LaTeX', '\\TeX', '\\KaTeX',
        '\\href{url}{x}', '\\url{url}',
        '\\label{eq1}', '\\ref{eq1}', '\\eqref{eq1}',
        '\\htmlStyle{a}{x}', '\\htmlClass{a}{x}',
        '\\htmlId{a}{x}', '\\htmlData{a}{x}',
        '\\char"41', '\\unicode{41}',
        // Environments
        '\\begin{dcases} x & y \\\\ a & b \\end{dcases}',
        '\\begin{rcases} x & y \\\\ a & b \\end{rcases}',
        '\\begin{matrix*} a & b \\\\ c & d \\end{matrix*}',
        '\\begin{equation} x \\end{equation}',
        '\\begin{gather} x \\\\ y \\end{gather}',
        '\\begin{multline} x \\\\ y \\end{multline}',
        '\\begin{split} a &= b \\end{split}',
      ];

      for (const expr of expressions) {
        const str = renderToString(expr);
        assert.ok(
          !str.includes('<merror>'),
          `Expression "${expr}" should not produce merror, got: ${str.slice(0, 200)}`
        );
      }
    });
  });

  describe('braket/physics commands', () => {
    it('\\bra produces angle bracket and vert', () => {
      const els = renderInner('\\bra{\\psi}');
      assert.ok(els.length >= 3);
      assert.deepEqual(els[0].children, ['\u27E8']);
      assert.deepEqual(els[els.length - 1].children, ['|']);
    });

    it('\\ket produces vert and angle bracket', () => {
      const els = renderInner('\\ket{\\psi}');
      assert.ok(els.length >= 3);
      assert.deepEqual(els[0].children, ['|']);
      assert.deepEqual(els[els.length - 1].children, ['\u27E9']);
    });

    it('\\braket splits on |', () => {
      const str = renderToString('\\braket{\\phi|\\psi}');
      assert.ok(str.includes('\u27E8'));
      assert.ok(str.includes('\u27E9'));
      assert.ok(!str.includes('<merror'));
    });

    it('\\Braket works like \\braket', () => {
      const str = renderToString('\\Braket{\\phi|\\psi}');
      assert.ok(str.includes('\u27E8'));
      assert.ok(str.includes('\u27E9'));
      assert.ok(!str.includes('<merror'));
    });

    it('\\Set produces curly braces with separator', () => {
      const str = renderToString('\\Set{x | x > 0}');
      assert.ok(str.includes('{'));
      assert.ok(str.includes('}'));
      assert.ok(!str.includes('<merror'));
    });

    it('\\abs wraps in | delimiters', () => {
      const els = renderInner('\\abs{x}');
      assert.ok(els.length >= 3);
      assert.deepEqual(els[0].children, ['|']);
      assert.deepEqual(els[els.length - 1].children, ['|']);
    });

    it('\\norm wraps in double-bar delimiters', () => {
      const els = renderInner('\\norm{x}');
      assert.ok(els.length >= 3);
      assert.deepEqual(els[0].children, ['\u2016']);
      assert.deepEqual(els[els.length - 1].children, ['\u2016']);
    });

    it('\\qty wraps in parentheses', () => {
      const els = renderInner('\\qty{x}');
      assert.ok(els.length >= 3);
      assert.deepEqual(els[0].children, ['(']);
      assert.deepEqual(els[els.length - 1].children, [')']);
    });
  });

  describe('derivative commands', () => {
    it('\\dv produces fraction with d', () => {
      const el = renderSingle('\\dv{f}{x}');
      assert.equal(el.tag, 'mfrac');
      const num = el.children[0] as MathMLElement;
      const denom = el.children[1] as MathMLElement;
      assert.equal(num.tag, 'mrow');
      assert.equal(denom.tag, 'mrow');
      // Numerator contains d and f
      const numFirst = num.children[0] as MathMLElement;
      assert.deepEqual(numFirst.children, ['d']);
    });

    it('\\pdv produces fraction with partial', () => {
      const el = renderSingle('\\pdv{f}{x}');
      assert.equal(el.tag, 'mfrac');
      const num = el.children[0] as MathMLElement;
      const numFirst = num.children[0] as MathMLElement;
      assert.deepEqual(numFirst.children, ['\u2202']);
    });
  });

  describe('chemistry (\\ce)', () => {
    it('\\ce{H2O} produces element symbols and numbers', () => {
      const str = renderToString('\\ce{H2O}');
      assert.ok(!str.includes('<merror'));
      assert.ok(str.includes('>H<'));
      assert.ok(str.includes('>2<'));
      assert.ok(str.includes('>O<'));
    });

    it('\\ce handles reactions with arrows', () => {
      const str = renderToString('\\ce{2H2 + O2 -> 2H2O}');
      assert.ok(!str.includes('<merror'));
      assert.ok(str.includes('\u2192') || str.includes('→'));
    });

    it('\\ce handles complex formulas', () => {
      const str = renderToString('\\ce{CO2 + H2O}');
      assert.ok(!str.includes('<merror'));
    });
  });
});
