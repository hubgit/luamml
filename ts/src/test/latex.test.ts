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
      // <math> acts as implicit mrow, so children are spliced in
      const children = renderInner('\\left( x \\right)');
      assert.equal(children.length, 3); // mo( + mi(x) + mo)
      assert.equal(children[0].tag, 'mo');
      assert.equal(children[0].attrs.fence, 'true');
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

    it('parses uppercase Greek', () => {
      const el = renderSingle('\\Omega');
      assert.equal(el.tag, 'mi');
      assert.deepEqual(el.children, ['\u03A9']);
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
    it('parses \\sum with limits', () => {
      const children = renderInner('\\sum_{i=1}^{n}');
      assert.equal(children.length, 1);
      // sum with sub and sup
      assert.equal(children[0].tag, 'msubsup');
    });

    it('parses \\int', () => {
      const children = renderInner('\\int_0^1');
      assert.equal(children[0].tag, 'msubsup');
    });
  });

  describe('named operators', () => {
    it('parses \\sin as mi', () => {
      const el = renderSingle('\\sin');
      assert.equal(el.tag, 'mi');
      assert.deepEqual(el.children, ['sin']);
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
      assert.equal(el.attrs.accent, 'true');
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
});
