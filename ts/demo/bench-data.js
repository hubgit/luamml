// Shared test expressions for browser and Node benchmarks.
// Each entry has a category label and a LaTeX string.
export const tests = [
  // --- Basic symbols & arithmetic ---
  { cat: 'Arithmetic', tex: 'a + b - c \\times d \\div e' },
  { cat: 'Arithmetic', tex: '3.14 \\approx \\frac{22}{7}' },

  // --- Greek letters ---
  { cat: 'Greek', tex: '\\alpha \\beta \\gamma \\delta \\epsilon \\zeta \\eta \\theta' },
  { cat: 'Greek', tex: '\\Gamma \\Delta \\Theta \\Lambda \\Xi \\Pi \\Sigma \\Omega' },

  // --- Superscripts & subscripts ---
  { cat: 'Scripts', tex: 'x_i^2 + y_{n+1}^{k-1} + z\'^3' },
  { cat: 'Scripts', tex: 'a_{i_1, i_2, \\ldots, i_n}' },

  // --- Fractions ---
  { cat: 'Fractions', tex: '\\frac{a}{b} + \\frac{c}{d}' },
  { cat: 'Fractions', tex: '\\dfrac{1}{1 + \\dfrac{1}{1 + \\dfrac{1}{x}}}' },
  { cat: 'Fractions', tex: '\\tfrac{1}{2} + \\tfrac{3}{4}' },

  // --- Roots ---
  { cat: 'Roots', tex: '\\sqrt{x^2 + y^2}' },
  { cat: 'Roots', tex: '\\sqrt[3]{27} + \\sqrt[n]{a}' },

  // --- Binomials ---
  { cat: 'Binomials', tex: '\\binom{n}{k} = \\frac{n!}{k!(n-k)!}' },

  // --- Delimiters ---
  { cat: 'Delimiters', tex: '\\left( \\frac{a}{b} \\right)' },
  { cat: 'Delimiters', tex: '\\left\\langle x \\middle| y \\right\\rangle' },
  { cat: 'Delimiters', tex: '\\left\\lfloor \\frac{n}{2} \\right\\rfloor + \\left\\lceil \\frac{n}{2} \\right\\rceil' },
  { cat: 'Delimiters', tex: '\\left\\{ x \\in \\mathbb{R} : x > 0 \\right\\}' },

  // --- Accents ---
  { cat: 'Accents', tex: '\\hat{a} \\tilde{b} \\bar{c} \\vec{v} \\dot{x} \\ddot{y}' },
  { cat: 'Accents', tex: '\\widehat{ABC} + \\widetilde{XYZ}' },
  { cat: 'Accents', tex: '\\overline{z} + \\underline{w}' },
  { cat: 'Accents', tex: '\\overbrace{a+b+c}^{n} + \\underbrace{x+y}_{2}' },
  { cat: 'Accents', tex: '\\overrightarrow{AB} + \\overleftarrow{CD}' },

  // --- Big operators ---
  { cat: 'Big ops', tex: '\\sum_{i=1}^{n} i^2' },
  { cat: 'Big ops', tex: '\\prod_{k=1}^{n} k' },
  { cat: 'Big ops', tex: '\\int_0^\\infty e^{-x} \\, dx' },
  { cat: 'Big ops', tex: '\\iint_D f(x,y) \\, dA' },
  { cat: 'Big ops', tex: '\\bigcup_{i=1}^n A_i \\cap \\bigcap_{j=1}^m B_j' },
  { cat: 'Big ops', tex: '\\bigoplus_{i} V_i \\otimes W_i' },

  // --- Named operators ---
  { cat: 'Operators', tex: '\\sin^2\\theta + \\cos^2\\theta = 1' },
  { cat: 'Operators', tex: '\\lim_{n \\to \\infty} \\left(1 + \\frac{1}{n}\\right)^n = e' },
  { cat: 'Operators', tex: '\\log_2 n \\leq \\ln n \\leq \\log_{10} n' },
  { cat: 'Operators', tex: '\\det(A) = \\max_{x} f(x) - \\min_{x} g(x)' },
  { cat: 'Operators', tex: '\\gcd(a, b) = \\inf S' },
  { cat: 'Operators', tex: '\\limsup_{n} a_n = \\liminf_{n} a_n' },

  // --- Relations ---
  { cat: 'Relations', tex: 'a \\leq b \\geq c \\neq d' },
  { cat: 'Relations', tex: 'A \\subset B \\subseteq C \\supset D \\supseteq E' },
  { cat: 'Relations', tex: 'x \\in S, y \\notin T, z \\ni w' },
  { cat: 'Relations', tex: 'a \\equiv b \\sim c \\simeq d \\cong e \\approx f' },
  { cat: 'Relations', tex: 'a \\prec b \\preceq c \\succ d \\succeq e' },
  { cat: 'Relations', tex: 'p \\parallel q, r \\perp s, t \\mid u' },
  { cat: 'Relations', tex: 'a \\vdash b \\dashv c \\models d' },

  // --- Arrows ---
  { cat: 'Arrows', tex: 'a \\to b \\gets c \\leftrightarrow d' },
  { cat: 'Arrows', tex: 'A \\Rightarrow B \\Leftarrow C \\Leftrightarrow D' },
  { cat: 'Arrows', tex: 'f \\mapsto f(x), g \\hookrightarrow h' },
  { cat: 'Arrows', tex: '\\uparrow \\downarrow \\updownarrow \\Uparrow \\Downarrow' },
  { cat: 'Arrows', tex: '\\nearrow \\searrow \\nwarrow \\swarrow' },
  { cat: 'Arrows', tex: 'a \\longrightarrow b \\Longleftrightarrow c' },
  { cat: 'Arrows', tex: 'A \\implies B \\iff C' },

  // --- Binary operators ---
  { cat: 'Binary ops', tex: 'a \\pm b \\mp c' },
  { cat: 'Binary ops', tex: 'A \\cap B \\cup C \\setminus D' },
  { cat: 'Binary ops', tex: 'a \\wedge b \\vee c' },
  { cat: 'Binary ops', tex: 'a \\oplus b \\otimes c \\odot d' },
  { cat: 'Binary ops', tex: 'a \\dagger b \\ddagger c \\amalg d' },

  // --- Miscellaneous symbols ---
  { cat: 'Symbols', tex: '\\infty \\partial \\nabla \\forall \\exists \\nexists' },
  { cat: 'Symbols', tex: '\\emptyset \\varnothing \\ell \\wp \\Re \\Im \\aleph \\hbar' },
  { cat: 'Symbols', tex: '\\angle \\triangle \\top \\bot \\neg' },
  { cat: 'Symbols', tex: '\\clubsuit \\diamondsuit \\heartsuit \\spadesuit' },

  // --- Dots ---
  { cat: 'Dots', tex: 'a_1, a_2, \\ldots, a_n' },
  { cat: 'Dots', tex: 'a_1 + a_2 + \\cdots + a_n' },

  // --- Font variants ---
  { cat: 'Fonts', tex: '\\mathrm{Hom} \\mathbf{v} \\mathit{f} \\mathsf{T} \\mathtt{code}' },
  { cat: 'Fonts', tex: '\\mathbb{R} \\mathcal{L} \\mathfrak{g} \\mathscr{H}' },

  // --- Text ---
  { cat: 'Text', tex: 'x = 0 \\text{ if and only if } y = 0' },

  // --- Spacing ---
  { cat: 'Spacing', tex: 'a\\,b\\;c\\quad d\\qquad e' },

  // --- Matrices ---
  { cat: 'Matrices', tex: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}' },
  { cat: 'Matrices', tex: '\\begin{bmatrix} 1 & 0 & 0 \\\\ 0 & 1 & 0 \\\\ 0 & 0 & 1 \\end{bmatrix}' },
  { cat: 'Matrices', tex: '\\begin{vmatrix} a & b \\\\ c & d \\end{vmatrix} = ad - bc' },
  { cat: 'Matrices', tex: '\\begin{Vmatrix} x \\\\ y \\end{Vmatrix}' },

  // --- Cases ---
  { cat: 'Cases', tex: '|x| = \\begin{cases} x & \\text{if } x \\geq 0 \\\\ -x & \\text{if } x < 0 \\end{cases}' },

  // --- Aligned ---
  { cat: 'Aligned', tex: '\\begin{aligned} a &= b + c \\\\ d &= e + f \\end{aligned}' },

  // --- Array ---
  { cat: 'Array', tex: '\\begin{array}{lcr} a & b & c \\\\ d & e & f \\end{array}' },

  // --- Over/under ---
  { cat: 'Over/Under', tex: '\\overset{\\sim}{A} + \\underset{0}{\\lim}' },
  { cat: 'Over/Under', tex: '\\stackrel{f}{\\longrightarrow}' },

  // --- Negation ---
  { cat: 'Negation', tex: 'a \\not= b, c \\not\\in D' },

  // --- Color ---
  { cat: 'Color', tex: '\\color{red}{x} + \\color{blue}{y}' },

  // --- Boxed ---
  { cat: 'Boxed', tex: '\\boxed{E = mc^2}' },

  // --- Phantom ---
  { cat: 'Phantom', tex: 'a + \\phantom{b} + c' },

  // --- Styles ---
  { cat: 'Styles', tex: '\\displaystyle \\sum_i x_i' },

  // --- operatorname ---
  { cat: 'Operators', tex: '\\operatorname{Tr}(A) + \\operatorname{rank}(B)' },

  // --- Complex real-world expressions ---
  { cat: 'Real-world', tex: 'e^{i\\pi} + 1 = 0' },
  { cat: 'Real-world', tex: '\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}' },
  { cat: 'Real-world', tex: 'f\'(x) = \\lim_{h \\to 0} \\frac{f(x+h) - f(x)}{h}' },
  { cat: 'Real-world', tex: '\\nabla \\times \\vec{E} = -\\frac{\\partial \\vec{B}}{\\partial t}' },
  { cat: 'Real-world', tex: '\\oint_C \\vec{F} \\cdot d\\vec{r} = \\iint_S (\\nabla \\times \\vec{F}) \\cdot d\\vec{S}' },
  { cat: 'Real-world', tex: '\\sum_{n=0}^{\\infty} \\frac{x^n}{n!} = e^x' },
  { cat: 'Real-world', tex: '\\hat{H}\\psi = E\\psi' },
  { cat: 'Real-world', tex: 'ds^2 = -c^2 dt^2 + dx^2 + dy^2 + dz^2' },
  { cat: 'Real-world', tex: '\\begin{pmatrix} a_{11} & a_{12} \\\\ a_{21} & a_{22} \\end{pmatrix} \\begin{pmatrix} x_1 \\\\ x_2 \\end{pmatrix} = \\begin{pmatrix} b_1 \\\\ b_2 \\end{pmatrix}' },
  { cat: 'Real-world', tex: 'P(A|B) = \\frac{P(B|A) P(A)}{P(B)}' },
  { cat: 'Real-world', tex: '\\frac{\\partial^2 u}{\\partial t^2} = c^2 \\nabla^2 u' },
  { cat: 'Real-world', tex: '\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}' },
];
