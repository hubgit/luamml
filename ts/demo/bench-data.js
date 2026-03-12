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

  // --- AMS symbols ---
  { cat: 'AMS symbols', tex: '\\eth \\mho \\Finv \\Game \\digamma \\varkappa \\hslash' },
  { cat: 'AMS symbols', tex: '\\circledS \\lozenge \\blacklozenge \\blacktriangle \\blacktriangledown \\blacksquare \\square' },
  { cat: 'AMS symbols', tex: '\\bigstar \\sphericalangle \\measuredangle \\diagup \\diagdown \\maltese' },

  // --- AMS binary operators ---
  { cat: 'AMS binary', tex: 'a \\boxplus b \\boxminus c \\boxtimes d \\boxdot e' },
  { cat: 'AMS binary', tex: 'a \\ltimes b \\rtimes c \\leftthreetimes d \\rightthreetimes e' },
  { cat: 'AMS binary', tex: 'a \\curlywedge b \\curlyvee c \\veebar d \\barwedge e' },
  { cat: 'AMS binary', tex: 'a \\circleddash b \\circledast c \\circledcirc d' },
  { cat: 'AMS binary', tex: 'a \\dotplus b \\divideontimes c \\Cap d \\Cup e' },

  // --- AMS relations ---
  { cat: 'AMS relations', tex: 'a \\lll b \\ggg c \\lessgtr d \\gtrless e' },
  { cat: 'AMS relations', tex: 'a \\vartriangleleft b \\vartriangleright c \\trianglelefteq d \\trianglerighteq e' },
  { cat: 'AMS relations', tex: 'a \\Subset b \\Supset c \\sqsubset d \\sqsupset e' },
  { cat: 'AMS relations', tex: 'a \\doteq b \\doteqdot c \\fallingdotseq d \\risingdotseq e' },
  { cat: 'AMS relations', tex: 'a \\backsim b \\backsimeq c \\vDash d \\Vdash e \\Vvdash f' },

  // --- AMS negated relations ---
  { cat: 'AMS negated', tex: 'a \\nleq b \\ngeq c \\nless d \\ngtr e' },
  { cat: 'AMS negated', tex: 'a \\nprec b \\nsucc c \\subsetneq d \\supsetneq e' },
  { cat: 'AMS negated', tex: 'a \\nsubseteq b \\nsupseteq c \\ntriangleleft d \\ntriangleright e' },

  // --- AMS arrows ---
  { cat: 'AMS arrows', tex: '\\twoheadrightarrow \\twoheadleftarrow \\rightarrowtail \\leftarrowtail' },
  { cat: 'AMS arrows', tex: '\\rightrightarrows \\leftleftarrows \\rightleftarrows \\leftrightarrows' },
  { cat: 'AMS arrows', tex: '\\circlearrowleft \\circlearrowright \\curvearrowleft \\curvearrowright' },
  { cat: 'AMS arrows', tex: '\\upuparrows \\downdownarrows \\upharpoonright \\downharpoonleft' },
  { cat: 'AMS arrows', tex: '\\rightleftharpoons \\leftrightharpoons \\Rsh \\Lsh \\multimap' },

  // --- Extensible arrows ---
  { cat: 'Ext arrows', tex: 'A \\xrightarrow{f} B \\xleftarrow{g} C' },
  { cat: 'Ext arrows', tex: 'A \\xrightarrow[\\text{below}]{\\text{above}} B' },
  { cat: 'Ext arrows', tex: 'A \\xRightarrow{\\sim} B \\xLeftarrow{\\cong} C' },
  { cat: 'Ext arrows', tex: 'A \\xmapsto{\\phi} B \\xleftrightarrow{\\sim} C' },
  { cat: 'Ext arrows', tex: 'A \\xhookrightarrow{i} B \\xhookleftarrow{j} C' },

  // --- Fraction variants ---
  { cat: 'Fractions+', tex: '\\cfrac{1}{1 + \\cfrac{1}{2 + \\cfrac{1}{3}}}' },
  { cat: 'Fractions+', tex: '\\genfrac{(}{)}{0pt}{}{n}{k}' },

  // --- Modular arithmetic ---
  { cat: 'Mod arith', tex: 'a \\equiv b \\pmod{n}' },
  { cat: 'Mod arith', tex: 'a \\bmod b' },
  { cat: 'Mod arith', tex: 'a \\mod{n}' },

  // --- Cancel ---
  { cat: 'Cancel', tex: '\\cancel{x} + \\bcancel{y} + \\xcancel{z}' },

  // --- Layout ---
  { cat: 'Layout', tex: '\\smash{\\frac{1}{2}} + \\vphantom{\\frac{1}{2}} x' },
  { cat: 'Layout', tex: '\\hspace{2em} x \\kern1em y' },
  { cat: 'Layout', tex: '\\rule{1em}{0.5em} \\; \\text{gap} \\; \\rule{2em}{0.5em}' },
  { cat: 'Layout', tex: '\\mathclap{\\text{clap}} x \\mathrlap{\\text{rlap}}' },

  // --- Color ---
  { cat: 'Color', tex: '\\textcolor{red}{x^2} + \\textcolor{blue}{y^2}' },
  { cat: 'Color', tex: '\\colorbox{yellow}{E = mc^2}' },
  { cat: 'Color', tex: '\\fcolorbox{red}{lightyellow}{\\frac{a}{b}}' },

  // --- New accents ---
  { cat: 'Accents+', tex: '\\overparen{ABC} + \\underparen{XYZ}' },
  { cat: 'Accents+', tex: '\\overbracket{1+2+3} + \\underbracket{a+b+c}' },

  // --- New environments ---
  { cat: 'Environments', tex: '\\begin{dcases} x & \\text{if } x > 0 \\\\ -x & \\text{otherwise} \\end{dcases}' },
  { cat: 'Environments', tex: '\\begin{rcases} x \\\\ y \\end{rcases} = z' },
  { cat: 'Environments', tex: '\\begin{matrix*} a & b \\\\ c & d \\end{matrix*}' },

  // --- Integrals ---
  { cat: 'Integrals', tex: '\\iiiint_D f \\, dV' },
  { cat: 'Integrals', tex: '\\idotsint_D f' },
  { cat: 'Integrals', tex: '\\smallint f(x) dx' },

  // --- Misc ---
  { cat: 'Misc', tex: '\\sout{\\text{deleted}} \\text{ replaced}' },
  { cat: 'Misc', tex: '\\prescript{14}{6}{C}' },
  { cat: 'Misc', tex: '\\LaTeX \\text{ and } \\TeX' },

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

  // --- Braket/physics ---
  { cat: 'Braket', tex: '\\bra{\\psi}' },
  { cat: 'Braket', tex: '\\ket{\\psi}' },
  { cat: 'Braket', tex: '\\braket{\\phi|\\psi}' },
  { cat: 'Braket', tex: '\\Braket{\\phi|\\psi}' },
  { cat: 'Braket', tex: '\\Set{x | x > 0}' },
  { cat: 'Physics', tex: '\\abs{x}' },
  { cat: 'Physics', tex: '\\norm{x}' },
  { cat: 'Physics', tex: '\\qty{x}' },
  { cat: 'Physics', tex: '\\dv{f}{x}' },
  { cat: 'Physics', tex: '\\pdv{f}{x}' },

  // --- Chemistry ---
  { cat: 'Chemistry', tex: '\\ce{H2O}' },
  { cat: 'Chemistry', tex: '\\ce{2H2 + O2 -> 2H2O}' },
  { cat: 'Chemistry', tex: '\\ce{CO2 + H2O}' },

  // --- Big delimiters ---
  { cat: 'Big delims', tex: '\\bigl( x \\bigr) + \\Bigl[ y \\Bigr]' },
  { cat: 'Big delims', tex: '\\biggl\\{ a + b \\biggr\\} + \\Biggl\\langle c \\Biggr\\rangle' },
  { cat: 'Big delims', tex: '\\big\\| x \\big\\| \\leq \\Big\\| y \\Big\\|' },

  // --- Bold variants ---
  { cat: 'Bold', tex: '\\boldsymbol{\\alpha + \\beta}' },
  { cat: 'Bold', tex: '\\bm{x} \\cdot \\bm{y} = \\|\\bm{x}\\| \\|\\bm{y}\\| \\cos\\theta' },
  { cat: 'Bold', tex: '\\pmb{A} \\pmb{x} = \\pmb{b}' },

  // --- Math strut ---
  { cat: 'Layout', tex: '\\sqrt{\\mathstrut a} + \\sqrt{\\mathstrut b}' },

  // --- Inline macros ---
  { cat: 'Macros', tex: '\\def\\R{\\mathbb{R}} f: \\R \\to \\R' },
  { cat: 'Macros', tex: '\\newcommand\\norm[1]{\\left\\| #1 \\right\\|} \\norm{x - y}' },

  // --- Infix fractions ---
  { cat: 'Infix frac', tex: '{a + b \\over c + d}' },
  { cat: 'Infix frac', tex: '{n \\choose k} = {n-1 \\choose k-1} + {n-1 \\choose k}' },
  { cat: 'Infix frac', tex: '{a \\atop b}' },

  // --- operatorname* ---
  { cat: 'Operators', tex: '\\operatorname*{arg\\,max}_{\\theta} \\mathcal{L}(\\theta)' },

  // --- Additional arrow decorations ---
  { cat: 'Accents+', tex: '\\overleftrightarrow{AB} + \\underleftarrow{CD}' },
  { cat: 'Accents+', tex: '\\underrightarrow{EF} + \\underleftrightarrow{GH}' },

  // ---------------------------------------------------------------------------
  // Famous equations and identities
  // ---------------------------------------------------------------------------

  // --- Euler's identity (already present as e^{iπ}+1=0, add full form) ---
  { cat: 'Famous', tex: 'e^{i\\theta} = \\cos\\theta + i\\sin\\theta' },

  // --- Pythagorean theorem ---
  { cat: 'Famous', tex: 'a^2 + b^2 = c^2' },

  // --- Einstein's mass-energy equivalence ---
  { cat: 'Famous', tex: 'E = mc^2' },

  // --- Einstein field equations ---
  { cat: 'Famous', tex: 'R_{\\mu\\nu} - \\frac{1}{2} R g_{\\mu\\nu} + \\Lambda g_{\\mu\\nu} = \\frac{8\\pi G}{c^4} T_{\\mu\\nu}' },

  // --- Schrödinger equation ---
  { cat: 'Famous', tex: 'i\\hbar \\frac{\\partial}{\\partial t} \\Psi = \\hat{H} \\Psi' },

  // --- Maxwell's equations (divergence form) ---
  { cat: 'Famous', tex: '\\nabla \\cdot \\vec{E} = \\frac{\\rho}{\\varepsilon_0}' },
  { cat: 'Famous', tex: '\\nabla \\cdot \\vec{B} = 0' },

  // --- Cauchy integral formula ---
  { cat: 'Famous', tex: 'f(a) = \\frac{1}{2\\pi i} \\oint_\\gamma \\frac{f(z)}{z - a} \\, dz' },

  // --- Fourier transform ---
  { cat: 'Famous', tex: '\\hat{f}(\\xi) = \\int_{-\\infty}^{\\infty} f(x) e^{-2\\pi i x \\xi} \\, dx' },

  // --- Navier-Stokes ---
  { cat: 'Famous', tex: '\\rho \\left( \\frac{\\partial \\vec{v}}{\\partial t} + \\vec{v} \\cdot \\nabla \\vec{v} \\right) = -\\nabla p + \\mu \\nabla^2 \\vec{v} + \\vec{f}' },

  // --- Stirling's approximation ---
  { cat: 'Famous', tex: 'n! \\sim \\sqrt{2\\pi n} \\left( \\frac{n}{e} \\right)^n' },

  // --- Riemann zeta function ---
  { cat: 'Famous', tex: '\\zeta(s) = \\sum_{n=1}^{\\infty} \\frac{1}{n^s} = \\prod_{p \\text{ prime}} \\frac{1}{1 - p^{-s}}' },

  // --- Taylor series ---
  { cat: 'Famous', tex: 'f(x) = \\sum_{n=0}^{\\infty} \\frac{f^{(n)}(a)}{n!} (x - a)^n' },

  // --- Stokes' theorem ---
  { cat: 'Famous', tex: '\\int_M d\\omega = \\oint_{\\partial M} \\omega' },

  // --- Euler product for pi ---
  { cat: 'Famous', tex: '\\frac{\\pi}{4} = 1 - \\frac{1}{3} + \\frac{1}{5} - \\frac{1}{7} + \\cdots' },

  // --- Dirac equation ---
  { cat: 'Famous', tex: '(i \\gamma^\\mu \\partial_\\mu - m) \\psi = 0' },

  // --- Shannon entropy ---
  { cat: 'Famous', tex: 'H(X) = -\\sum_{i} p(x_i) \\log p(x_i)' },

  // --- Heisenberg uncertainty principle ---
  { cat: 'Famous', tex: '\\Delta x \\, \\Delta p \\geq \\frac{\\hbar}{2}' },

  // --- Boltzmann entropy ---
  { cat: 'Famous', tex: 'S = k_B \\ln \\Omega' },

  // --- Lorentz transformation ---
  { cat: 'Famous', tex: 't\' = \\gamma \\left( t - \\frac{vx}{c^2} \\right), \\quad x\' = \\gamma (x - vt)' },

  // --- Normal distribution ---
  { cat: 'Famous', tex: 'f(x) = \\frac{1}{\\sigma\\sqrt{2\\pi}} e^{-\\frac{(x-\\mu)^2}{2\\sigma^2}}' },

  // --- Determinant via Leibniz formula ---
  { cat: 'Famous', tex: '\\det(A) = \\sum_{\\sigma \\in S_n} \\operatorname{sgn}(\\sigma) \\prod_{i=1}^{n} a_{i,\\sigma(i)}' },

  // --- Residue theorem ---
  { cat: 'Famous', tex: '\\oint_\\gamma f(z) \\, dz = 2\\pi i \\sum_{k} \\operatorname{Res}(f, a_k)' },
];

