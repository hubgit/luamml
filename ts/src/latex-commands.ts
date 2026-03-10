/**
 * LaTeX math command tables.
 *
 * Maps LaTeX command names to Unicode characters and MathML element types.
 */

export interface SymbolDef {
  /** Unicode character(s) */
  char: string;
  /** MathML element type */
  element: 'mi' | 'mo';
}

/** LaTeX command → Unicode symbol mapping. */
export const symbols: Record<string, SymbolDef> = {
  // Greek lowercase
  alpha:      { char: '\u03B1', element: 'mi' },
  beta:       { char: '\u03B2', element: 'mi' },
  gamma:      { char: '\u03B3', element: 'mi' },
  delta:      { char: '\u03B4', element: 'mi' },
  epsilon:    { char: '\u03F5', element: 'mi' },
  varepsilon: { char: '\u03B5', element: 'mi' },
  zeta:       { char: '\u03B6', element: 'mi' },
  eta:        { char: '\u03B7', element: 'mi' },
  theta:      { char: '\u03B8', element: 'mi' },
  vartheta:   { char: '\u03D1', element: 'mi' },
  iota:       { char: '\u03B9', element: 'mi' },
  kappa:      { char: '\u03BA', element: 'mi' },
  lambda:     { char: '\u03BB', element: 'mi' },
  mu:         { char: '\u03BC', element: 'mi' },
  nu:         { char: '\u03BD', element: 'mi' },
  xi:         { char: '\u03BE', element: 'mi' },
  pi:         { char: '\u03C0', element: 'mi' },
  varpi:      { char: '\u03D6', element: 'mi' },
  rho:        { char: '\u03C1', element: 'mi' },
  varrho:     { char: '\u03F1', element: 'mi' },
  sigma:      { char: '\u03C3', element: 'mi' },
  varsigma:   { char: '\u03C2', element: 'mi' },
  tau:        { char: '\u03C4', element: 'mi' },
  upsilon:    { char: '\u03C5', element: 'mi' },
  phi:        { char: '\u03D5', element: 'mi' },
  varphi:     { char: '\u03C6', element: 'mi' },
  chi:        { char: '\u03C7', element: 'mi' },
  psi:        { char: '\u03C8', element: 'mi' },
  omega:      { char: '\u03C9', element: 'mi' },

  // Greek uppercase
  Gamma:      { char: '\u0393', element: 'mi' },
  Delta:      { char: '\u0394', element: 'mi' },
  Theta:      { char: '\u0398', element: 'mi' },
  Lambda:     { char: '\u039B', element: 'mi' },
  Xi:         { char: '\u039E', element: 'mi' },
  Pi:         { char: '\u03A0', element: 'mi' },
  Sigma:      { char: '\u03A3', element: 'mi' },
  Upsilon:    { char: '\u03A5', element: 'mi' },
  Phi:        { char: '\u03A6', element: 'mi' },
  Psi:        { char: '\u03A8', element: 'mi' },
  Omega:      { char: '\u03A9', element: 'mi' },

  // Binary operators
  times:        { char: '\u00D7', element: 'mo' },
  div:          { char: '\u00F7', element: 'mo' },
  cdot:         { char: '\u22C5', element: 'mo' },
  ast:          { char: '\u2217', element: 'mo' },
  star:         { char: '\u22C6', element: 'mo' },
  circ:         { char: '\u2218', element: 'mo' },
  bullet:       { char: '\u2219', element: 'mo' },
  pm:           { char: '\u00B1', element: 'mo' },
  mp:           { char: '\u2213', element: 'mo' },
  cap:          { char: '\u2229', element: 'mo' },
  cup:          { char: '\u222A', element: 'mo' },
  vee:          { char: '\u2228', element: 'mo' },
  lor:          { char: '\u2228', element: 'mo' },
  wedge:        { char: '\u2227', element: 'mo' },
  land:         { char: '\u2227', element: 'mo' },
  oplus:        { char: '\u2295', element: 'mo' },
  ominus:       { char: '\u2296', element: 'mo' },
  otimes:       { char: '\u2297', element: 'mo' },
  oslash:       { char: '\u2298', element: 'mo' },
  odot:         { char: '\u2299', element: 'mo' },
  setminus:     { char: '\u2216', element: 'mo' },
  dagger:       { char: '\u2020', element: 'mo' },
  ddagger:      { char: '\u2021', element: 'mo' },
  amalg:        { char: '\u2A3F', element: 'mo' },
  wr:           { char: '\u2240', element: 'mo' },
  triangleleft: { char: '\u25C3', element: 'mo' },
  triangleright:{ char: '\u25B9', element: 'mo' },

  // Relations
  leq:        { char: '\u2264', element: 'mo' },
  le:         { char: '\u2264', element: 'mo' },
  geq:        { char: '\u2265', element: 'mo' },
  ge:         { char: '\u2265', element: 'mo' },
  neq:        { char: '\u2260', element: 'mo' },
  ne:         { char: '\u2260', element: 'mo' },
  approx:     { char: '\u2248', element: 'mo' },
  equiv:      { char: '\u2261', element: 'mo' },
  sim:        { char: '\u223C', element: 'mo' },
  simeq:      { char: '\u2243', element: 'mo' },
  cong:       { char: '\u2245', element: 'mo' },
  propto:     { char: '\u221D', element: 'mo' },
  prec:       { char: '\u227A', element: 'mo' },
  succ:       { char: '\u227B', element: 'mo' },
  preceq:     { char: '\u2AAF', element: 'mo' },
  succeq:     { char: '\u2AB0', element: 'mo' },
  subset:     { char: '\u2282', element: 'mo' },
  supset:     { char: '\u2283', element: 'mo' },
  subseteq:   { char: '\u2286', element: 'mo' },
  supseteq:   { char: '\u2287', element: 'mo' },
  sqsubseteq: { char: '\u2291', element: 'mo' },
  sqsupseteq: { char: '\u2292', element: 'mo' },
  in:         { char: '\u2208', element: 'mo' },
  notin:      { char: '\u2209', element: 'mo' },
  ni:         { char: '\u220B', element: 'mo' },
  mid:        { char: '\u2223', element: 'mo' },
  nmid:       { char: '\u2224', element: 'mo' },
  parallel:   { char: '\u2225', element: 'mo' },
  perp:       { char: '\u22A5', element: 'mo' },
  vdash:      { char: '\u22A2', element: 'mo' },
  dashv:      { char: '\u22A3', element: 'mo' },
  models:     { char: '\u22A8', element: 'mo' },
  ll:         { char: '\u226A', element: 'mo' },
  gg:         { char: '\u226B', element: 'mo' },
  coloneqq:   { char: '\u2254', element: 'mo' },

  // Arrows
  rightarrow:       { char: '\u2192', element: 'mo' },
  to:               { char: '\u2192', element: 'mo' },
  leftarrow:        { char: '\u2190', element: 'mo' },
  gets:             { char: '\u2190', element: 'mo' },
  leftrightarrow:   { char: '\u2194', element: 'mo' },
  Rightarrow:       { char: '\u21D2', element: 'mo' },
  implies:          { char: '\u21D2', element: 'mo' },
  Leftarrow:        { char: '\u21D0', element: 'mo' },
  impliedby:        { char: '\u21D0', element: 'mo' },
  Leftrightarrow:   { char: '\u21D4', element: 'mo' },
  iff:              { char: '\u21D4', element: 'mo' },
  uparrow:          { char: '\u2191', element: 'mo' },
  downarrow:        { char: '\u2193', element: 'mo' },
  updownarrow:      { char: '\u2195', element: 'mo' },
  Uparrow:          { char: '\u21D1', element: 'mo' },
  Downarrow:        { char: '\u21D3', element: 'mo' },
  Updownarrow:      { char: '\u21D5', element: 'mo' },
  mapsto:           { char: '\u21A6', element: 'mo' },
  hookrightarrow:   { char: '\u21AA', element: 'mo' },
  hookleftarrow:    { char: '\u21A9', element: 'mo' },
  nearrow:          { char: '\u2197', element: 'mo' },
  searrow:          { char: '\u2198', element: 'mo' },
  nwarrow:          { char: '\u2196', element: 'mo' },
  swarrow:          { char: '\u2199', element: 'mo' },
  rightharpoonup:   { char: '\u21C0', element: 'mo' },
  rightharpoondown: { char: '\u21C1', element: 'mo' },
  leftharpoonup:    { char: '\u21BC', element: 'mo' },
  leftharpoondown:  { char: '\u21BD', element: 'mo' },
  longrightarrow:   { char: '\u27F6', element: 'mo' },
  longleftarrow:    { char: '\u27F5', element: 'mo' },
  longleftrightarrow: { char: '\u27F7', element: 'mo' },
  Longrightarrow:   { char: '\u27F9', element: 'mo' },
  Longleftarrow:    { char: '\u27F8', element: 'mo' },
  Longleftrightarrow: { char: '\u27FA', element: 'mo' },
  longmapsto:       { char: '\u27FC', element: 'mo' },

  // Big operators
  sum:      { char: '\u2211', element: 'mo' },
  prod:     { char: '\u220F', element: 'mo' },
  coprod:   { char: '\u2210', element: 'mo' },
  int:      { char: '\u222B', element: 'mo' },
  iint:     { char: '\u222C', element: 'mo' },
  iiint:    { char: '\u222D', element: 'mo' },
  oint:     { char: '\u222E', element: 'mo' },
  bigcup:   { char: '\u22C3', element: 'mo' },
  bigcap:   { char: '\u22C2', element: 'mo' },
  bigvee:   { char: '\u22C1', element: 'mo' },
  bigwedge: { char: '\u22C0', element: 'mo' },
  bigoplus: { char: '\u2A01', element: 'mo' },
  bigotimes:{ char: '\u2A02', element: 'mo' },
  bigsqcup: { char: '\u2A06', element: 'mo' },
  biguplus: { char: '\u2A04', element: 'mo' },
  bigodot:  { char: '\u2A00', element: 'mo' },

  // Miscellaneous symbols
  infty:    { char: '\u221E', element: 'mi' },
  partial:  { char: '\u2202', element: 'mo' },
  nabla:    { char: '\u2207', element: 'mo' },
  forall:   { char: '\u2200', element: 'mo' },
  exists:   { char: '\u2203', element: 'mo' },
  nexists:  { char: '\u2204', element: 'mo' },
  neg:      { char: '\u00AC', element: 'mo' },
  lnot:     { char: '\u00AC', element: 'mo' },
  emptyset: { char: '\u2205', element: 'mi' },
  varnothing: { char: '\u2205', element: 'mi' },
  ell:      { char: '\u2113', element: 'mi' },
  wp:       { char: '\u2118', element: 'mi' },
  Re:       { char: '\u211C', element: 'mi' },
  Im:       { char: '\u2111', element: 'mi' },
  aleph:    { char: '\u2135', element: 'mi' },
  hbar:     { char: '\u210F', element: 'mi' },
  imath:    { char: '\u0131', element: 'mi' },
  jmath:    { char: '\u0237', element: 'mi' },
  prime:    { char: '\u2032', element: 'mo' },
  angle:    { char: '\u2220', element: 'mo' },
  triangle: { char: '\u25B3', element: 'mo' },
  top:      { char: '\u22A4', element: 'mo' },
  bot:      { char: '\u22A5', element: 'mo' },
  flat:     { char: '\u266D', element: 'mo' },
  natural:  { char: '\u266E', element: 'mo' },
  sharp:    { char: '\u266F', element: 'mo' },
  clubsuit: { char: '\u2663', element: 'mi' },
  diamondsuit: { char: '\u2662', element: 'mi' },
  heartsuit:   { char: '\u2661', element: 'mi' },
  spadesuit:   { char: '\u2660', element: 'mi' },
  surd:     { char: '\u221A', element: 'mo' },
  checkmark:{ char: '\u2713', element: 'mo' },
  complement: { char: '\u2201', element: 'mo' },

  // Dots
  ldots:  { char: '\u2026', element: 'mo' },
  cdots:  { char: '\u22EF', element: 'mo' },
  vdots:  { char: '\u22EE', element: 'mo' },
  ddots:  { char: '\u22F1', element: 'mo' },
  dots:   { char: '\u2026', element: 'mo' },

  // Delimiter symbols (when not used with \left/\right)
  langle:   { char: '\u27E8', element: 'mo' },
  rangle:   { char: '\u27E9', element: 'mo' },
  lfloor:   { char: '\u230A', element: 'mo' },
  rfloor:   { char: '\u230B', element: 'mo' },
  lceil:     { char: '\u2308', element: 'mo' },
  rceil:     { char: '\u2309', element: 'mo' },
  lbrace:   { char: '{', element: 'mo' },
  rbrace:   { char: '}', element: 'mo' },
  lvert:    { char: '|', element: 'mo' },
  rvert:    { char: '|', element: 'mo' },
  lVert:    { char: '\u2016', element: 'mo' },
  rVert:    { char: '\u2016', element: 'mo' },
};

/** Accent command definitions. */
export interface AccentDef {
  /** Unicode combining character */
  char: string;
  /** Whether the accent goes over (true) or under (false) the base */
  over: boolean;
}

export const accents: Record<string, AccentDef> = {
  hat:        { char: '\u0302', over: true },
  widehat:    { char: '\u0302', over: true },
  tilde:      { char: '\u0303', over: true },
  widetilde:  { char: '\u0303', over: true },
  bar:        { char: '\u0304', over: true },
  overline:   { char: '\u0305', over: true },
  vec:        { char: '\u20D7', over: true },
  overrightarrow: { char: '\u2192', over: true },
  overleftarrow:  { char: '\u2190', over: true },
  dot:        { char: '\u02D9', over: true },
  ddot:       { char: '\u00A8', over: true },
  dddot:      { char: '\u20DB', over: true },
  breve:      { char: '\u02D8', over: true },
  check:      { char: '\u02C7', over: true },
  acute:      { char: '\u00B4', over: true },
  grave:      { char: '\u0060', over: true },
  mathring:   { char: '\u02DA', over: true },
  underline:  { char: '\u0332', over: false },
  underbrace: { char: '\u23DF', over: false },
  overbrace:  { char: '\u23DE', over: true },
};

/** Whether an accent should be stretchy. */
export const wideAccents = new Set([
  'widehat', 'widetilde', 'overline', 'overrightarrow', 'overleftarrow',
  'underline', 'underbrace', 'overbrace',
]);

/** Named math operators (upright, no limits by default). */
export const operatorNames = new Set([
  'arccos', 'arcsin', 'arctan', 'arg', 'cos', 'cosh', 'cot', 'coth',
  'csc', 'deg', 'dim', 'exp', 'hom', 'ker', 'lg', 'ln', 'log',
  'sec', 'sin', 'sinh', 'tan', 'tanh',
]);

/** Named math operators with movable limits (display mode: over/under). */
export const operatorNamesWithLimits = new Set([
  'det', 'gcd', 'inf', 'lim', 'liminf', 'limsup', 'max', 'min',
  'Pr', 'sup',
]);

/** Big operators that take limits. */
export const bigOperators = new Set([
  'sum', 'prod', 'coprod', 'bigcup', 'bigcap', 'bigvee', 'bigwedge',
  'bigoplus', 'bigotimes', 'bigsqcup', 'biguplus', 'bigodot',
]);

/** Delimiter command → Unicode mapping (for \left/\right). */
export const delimiters: Record<string, string> = {
  '(': '(',
  ')': ')',
  '[': '[',
  ']': ']',
  '{': '{',
  '}': '}',
  '|': '|',
  '\\|': '\u2016',
  '.': '',   // invisible delimiter
  '/': '/',
  '\\': '\\',
  langle: '\u27E8',
  rangle: '\u27E9',
  lfloor: '\u230A',
  rfloor: '\u230B',
  lceil: '\u2308',
  rceil: '\u2309',
  lbrace: '{',
  rbrace: '}',
  lvert: '|',
  rvert: '|',
  lVert: '\u2016',
  rVert: '\u2016',
  uparrow: '\u2191',
  downarrow: '\u2193',
  updownarrow: '\u2195',
  Uparrow: '\u21D1',
  Downarrow: '\u21D3',
  Updownarrow: '\u21D5',
};

/** mathvariant values for \mathXX commands. */
export const fontCommands: Record<string, string> = {
  mathrm: 'normal',
  mathbf: 'bold',
  mathit: 'italic',
  mathsf: 'sans-serif',
  mathtt: 'monospace',
  mathbb: 'double-struck',
  mathcal: 'script',
  mathscr: 'script',
  mathfrak: 'fraktur',
};
