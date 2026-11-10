// Math engine: tokens, parser, evaluator, number formatting.
// An expression is an array of token strings. "Templates" (fraction, root,
// power, ...) are stored as structural tokens so the same token list can be
// drawn in textbook (Math) or one-line (Line) form.

export class CalcError extends Error {
  constructor(kind, pos) { super(kind); this.kind = kind; this.pos = pos; }
}
const fail = (k = 'Math ERROR') => { throw new CalcError(k); };

// ---------- templates ----------
export const TEMPLATES = {
  frac:  { parts: ['F<', 'F|', 'F>'], lin: ['', '⌟', ''] },
  mixed: { parts: ['MX<', 'MX|', 'MX/', 'MX>'], lin: ['', '⌟', '⌟', ''] },
  sqrt:  { parts: ['R<', 'R>'], lin: ['√(', ')'] },
  cbrt:  { parts: ['C<', 'C>'], lin: ['³√(', ')'] },
  nroot: { parts: ['N<', 'N|', 'N>'], lin: ['', 'ˣ√(', ')'] },
  pow:   { parts: ['P<', 'P>'], lin: ['^(', ')'] },
  ten:   { parts: ['T<', 'T>'], lin: ['10^(', ')'] },
  exp:   { parts: ['X<', 'X>'], lin: ['e^(', ')'] },
  logab: { parts: ['L<', 'L|', 'L>'], lin: ['log(', ',', ')'] },
  abs:   { parts: ['A<', 'A>'], lin: ['Abs(', ')'] },
  integ: { parts: ['I<', 'I|', 'I/', 'I>'], lin: ['∫(', ',', ',', ')'] },
  diff:  { parts: ['D<', 'D|', 'D>'], lin: ['d/dx(', ',', ')'] },
  sum:   { parts: ['S<', 'S|', 'S/', 'S>'], lin: ['Σ(', ',', ',', ')'] },
  prod:  { parts: ['PR<', 'PR|', 'PR/', 'PR>'], lin: ['∏(', ',', ',', ')'] },
};
export const STRUCT = {};
for (const [name, t] of Object.entries(TEMPLATES))
  t.parts.forEach((p, i) => (STRUCT[p] = { name, idx: i, last: i === t.parts.length - 1 }));

// indices of [open, sep..., close] for the template opened at toks[i]
export function findParts(toks, i) {
  const name = STRUCT[toks[i]].name;
  const out = [i];
  let depth = 0;
  for (let j = i + 1; j < toks.length; j++) {
    const s = STRUCT[toks[j]];
    if (!s) continue;
    if (depth === 0 && s.name === name && s.idx > 0) {
      out.push(j);
      if (s.last) return out;
      continue;
    }
    if (s.idx === 0) depth++;
    else if (s.last) depth--;
  }
  return out; // should not happen: templates are inserted whole
}

// ---------- token catalogue ----------
export const VARS = ['A', 'B', 'C', 'D', 'E', 'F', 'X', 'Y', 'M'];
export const FUNCS = {
  'sin(': 'sin(', 'cos(': 'cos(', 'tan(': 'tan(',
  'asin(': 'sin⁻¹(', 'acos(': 'cos⁻¹(', 'atan(': 'tan⁻¹(',
  'sinh(': 'sinh(', 'cosh(': 'cosh(', 'tanh(': 'tanh(',
  'asinh(': 'sinh⁻¹(', 'acosh(': 'cosh⁻¹(', 'atanh(': 'tanh⁻¹(',
  'log(': 'log(', 'ln(': 'ln(', 'Pol(': 'Pol(', 'Rec(': 'Rec(',
  'GCD(': 'GCD(', 'LCM(': 'LCM(', 'Int(': 'Int(', 'Intg(': 'Intg(',
  'i~Rand(': 'i~Rand(', 'Round(': 'Round(', 'Not(': 'Not(', 'Neg(': 'Neg(',
  'P(': 'P(', 'Q(': 'Q(', 'R(': 'R(', 'Max(': 'Max(', 'Min(': 'Min(', 'Mod(': 'Mod(', 'Q…r(': 'Q…r(',
  // Line-mode forms: ∫(f,a,b[,tol])  d/dx(f,a[,tol])  Σ(f,a,b)  ∏(f,a,b)
  '∫(': '∫(', 'd/dx(': 'd/dx(', 'Σ(': 'Σ(', '∏(': '∏(',
  'Det(': 'Det(', 'Trn(': 'Trn(', 'Ide(': 'Ide(', 'Adj(': 'Adj(', 'Inv(': 'Inv(',
  'Dot(': 'Dot(', 'Angle(': 'Angle(', 'UnitV(': 'UnitV(',
  'Arg(': 'Arg(', 'Conjg(': 'Conjg(', 'Real(': 'Real(', 'Imag(': 'Imag(', 'Abs(': 'Abs(',
  // old token names, still accepted (shown with the Canon name)
  'RanInt#(': 'i~Rand(', 'Rnd(': 'Round(', 'det(': 'Det(', 'arg(': 'Arg(',
};
// legacy token → canonical token (used by the evaluator)
const FN_ALIAS = { 'RanInt#(': 'i~Rand(', 'Rnd(': 'Round(', 'det(': 'Det(', 'arg(': 'Arg(' };
export const STATVARS = {
  n: 'n', mx: 'x̄', sgx: 'σx', ssx: 'sx', Sx: 'Σx', Sx2: 'Σx²', my: 'ȳ', sgy: 'σy', ssy: 'sy',
  Sy: 'Σy', Sy2: 'Σy²', Sxy: 'Σxy', Sx3: 'Σx³', Sx2y: 'Σx²y', Sx4: 'Σx⁴',
  med: 'med', smode: 'mode', sQ1: 'Q1', sQ3: 'Q3', sR: 'R',
  minX: 'minX', maxX: 'maxX', minY: 'minY', maxY: 'maxY', sA: 'A', sB: 'B', sC: 'C', r: 'r',
};
const STATPOST = { xh: 'x̂', yh: 'ŷ', xh1: 'x̂₁', xh2: 'x̂₂' };
export const MATVEC = ['MatA', 'MatB', 'MatC', 'MatD', 'MatAns','VctA', 'VctB', 'VctC', 'VctD', 'VctAns'];
const POSTFIX = {
  '²': '²', '³': '³', '⁻¹': '⁻¹', '!': '!', '%': '%', 'u°': '°', 'ur': 'ʳ', 'ug': 'ᵍ',
  '>pol': '▶r∠θ', '>rect': '▶a+bi', tt: '▶t', ...STATPOST,
};
const BINOPS = { '+': '+', '-': '−', '×': '×', '÷': '÷', '▪': '▪', nPr: 'P', nCr: 'C', '∠': '∠',
  and: ' and ', or: ' or ', xor: ' xor ', xnor: ' xnor ' };

// ---------- constants & conversions ----------
// C-VALUE: [symbol, value], index 0 = item 01 (CODATA 2010, as Canon uses).
// Constant values are used at full precision (never rounded).
export const CONSTS = [
  ['mp', 1.672621777e-27], ['mn', 1.674927351e-27], ['me', 9.10938291e-31],
  ['mμ', 1.883531475e-28], ['a0', 0.52917721092e-10], ['h', 6.62606957e-34],
  ['μN', 5.05078353e-27], ['μB', 927.400968e-26], ['ħ', 1.054571726e-34],
  ['α', 7.2973525698e-3], ['re', 2.8179403267e-15], ['λc', 2.4263102389e-12],
  ['γp', 2.675222005e8], ['λcp', 1.32140985623e-15], ['λcn', 1.3195909068e-15],
  ['R∞', 10973731.568539], ['u', 1.660538921e-27], ['μp', 1.410606743e-26],
  ['μe', -928.476430e-26], ['μn', -0.96623647e-26], ['μμ', -4.49044807e-26],
  ['F', 96485.3365], ['e', 1.602176565e-19], ['NA', 6.02214129e23],
  ['k', 1.3806488e-23], ['Vm', 22.413968e-3], ['R', 8.3144621],
  ['c0', 299792458], ['c1', 3.74177153e-16], ['c2', 1.4387770e-2],
  ['σ', 5.670373e-8], ['ε0', 8.854187817e-12], ['μ0', 12.566370614e-7],
  ['φ0', 2.067833758e-15], ['g', 9.80665], ['G0', 7.7480917346e-5],
  ['Z0', 376.730313461], ['t', 273.15], ['G', 6.67384e-11],
  ['atm', 101325], ['gp', 5.585694713], ['λ̄cn', 0.21001941568e-15],
  ['lP', 1.616199e-35], ['tP', 5.39106e-44], ['mP', 2.17651e-8],
  ['mu', 1.660538921e-27], ['eV', 1.602176565e-19], ['NAh', 3.9903127176e-10],
  ['b', 2.8977721e-3], ['a', 543.1020504e-12], ['Eh', 4.35974434e-18],
  ['n0', 2.6867805e25], ['G0⁻¹', 12906.4037217], ['KJ', 483597.870e9],
  ['RK', 25812.8074434], ['λ̄c', 386.15926800e-15], ['σe', 0.6652458734e-28],
  ['ae', 1.15965218076e-3], ['ge', -2.00231930436153], ['γe', 1.760859708e11],
  ['aμ', 1.16592091e-3], ['gμ', -2.0023318418], ['λcμ', 11.73444103e-15],
  ['λ̄cμ', 1.867594294e-15], ['λcτ', 0.697787e-15], ['λ̄cτ', 0.111056e-15],
  ['mτ', 3.16747e-27], ['λ̄cp', 0.21030891047e-15], ["μ'p", 1.410570499e-26],
  ['gn', -3.82608545], ['γn', 1.83247179e8], ['md', 3.34358348e-27],
  ['μd', 0.433073489e-26], ['mh', 5.00641234e-27], ["μ'h", -1.074553044e-26],
  ["γ'h", 2.037894659e8], ['mα', 6.64465675e-27], ["γ'p", 2.675153268e8],
  ["σ'p", 25.694e-6],
];

// CONVT: each unit is [symbol, r] where r = how many of that unit equal ONE of
// the category's first unit (values measured on the Canon emulator).
export const CONV_CATS = [
  { name: 'distance', units: [['feet', 1], ['m', 0.3048], ['mil', 12000], ['mm', 304.8], ['in', 12],
    ['cm', 30.48], ['yd', 1 / 3], ['mile', 1 / 5280], ['km', 3.048e-4]] },
  { name: 'area', units: [['ft²', 1], ['yd²', 0.1111111058], ['m²', 0.09290304], ['mile²', 3.587006581e-8],
    ['km²', 9.290304e-8], ['ha', 9.290304e-6], ['acres', 2.295684353e-5]] },
  { name: 'temp.', units: [['°F', null], ['°C', null]] }, // affine, special-cased
  { name: 'capacity', units: [['gal', 1], ['liter', 3.785412], ['B.gal', 0.8326742321], ['Pint', 8],
    ['fl.oz', 128.0000054]] },
  { name: 'weight', units: [['Tr.oz', 1], ['oz', 1.097143091], ['lb', 0.06857143109], ['Kg', 0.03110348],
    ['g', 31.10348]] },
  { name: 'energy', units: [['J', 1], ['cal.f', 0.2389029576]] },
  { name: 'pressure', units: [['atm', 1], ['kPa', 101.325], ['mmHg', 759.99982], ['cmH2O', 1033.227453]] },
  { name: 'speed', units: [['m/s', 1], ['km/h', 3.6]] },
];
export function convert(x, cat, from, to) {
  const c = CONV_CATS[cat];
  if (!c || !c.units[from] || !c.units[to]) fail('Syntax ERROR');
  if (from === to) return x;
  if (c.units[from][1] === null) { // temperature: 0 = °F, 1 = °C
    return clean(from === 0 ? ((x - 32) * 5) / 9 : (x * 9) / 5 + 32);
  }
  return clean((x * c.units[to][1]) / c.units[from][1]);
}
// Legacy flat list (old `V:<n>` tokens): [fromSym, toSym, cat, from, to], every ordered pair.
export const CONVS = [];
CONV_CATS.forEach((c, k) => c.units.forEach((u, i) => c.units.forEach((w, j) => {
  if (i !== j) CONVS.push([u[0], w[0], k, i, j]);
})));
// `V:<cat>:<from>:<to>` (or legacy `V:<n>`) → [cat, from, to]
function convOf(t) {
  const p = t.slice(2).split(':').map(Number);
  if (p.length === 3) return p;
  const c = CONVS[p[0]];
  if (!c) fail('Syntax ERROR');
  return c.slice(2);
}

// ---------- token text ----------
const TXT = {
  '(−)': '−', EE: 'ᴇ', Ans: 'Ans', 'π': 'π', e: '<i>e</i>', i: '<i>i</i>', Rand: 'Rand', 'Ran#': 'Rand', '=': '=',
  ',': ',', '(': '(', ')': ')', '.': '.', '°': '°',
  hA: 'A', hB: 'B', hC: 'C', hD: 'D', hE: 'E', hF: 'F',
};
export function tokText(t) {
  if (t in TXT) return TXT[t];
  if (t in FUNCS) return FUNCS[t];
  if (t in POSTFIX) return POSTFIX[t];
  if (t in BINOPS) return BINOPS[t];
  if (t in STATVARS) return STATVARS[t];
  if (/^m\d$/.test(t)) return t.slice(1);
  if (t in PREFIX) return t[1];
  if (t.startsWith('K:')) return `<span class="ks">${CONSTS[+t.slice(2)][0]}</span>`;
  if (t.startsWith('V:')) {
    const [k, i, j] = convOf(t), u = CONV_CATS[k].units;
    return `${u[i][0]}▶${u[j][0]}`;
  }
  return t;
}
export const isOperatorStart = (t) =>
  t in BINOPS || t in POSTFIX || t === 'P<' || t.startsWith('V:');

// ---------- parser ----------
const isDigitTok = (t) => t !== undefined && (/^[0-9.]$/.test(t) || /^h[A-F]$/.test(t));
const PREFIX = { pd: 10, ph: 16, pb: 2, po: 8 }; // BASE-N: d/h/b/o in front of one number
function startsPrimary(t) {
  if (t === undefined) return false;
  if (isDigitTok(t) || t === 'EE' || t in PREFIX) return true;
  if (STRUCT[t]) return STRUCT[t].idx === 0 && STRUCT[t].name !== 'pow';
  return t === '(' || t in FUNCS || VARS.includes(t) || /^m\d$/.test(t) || t === 'Ans' || t === 'π' || t === 'e' ||
    t === 'i' || t === 'Rand' || t === 'Ran#' || t.startsWith('K:') || t in STATVARS || MATVEC.includes(t);
}

export function parse(toks, opts = {}) {
  let p = 0;
  const peek = () => toks[p];
  const err = () => new CalcError('Syntax ERROR', p);
  const expect = (t) => {
    if (toks[p] === t) { p++; return; }
    if (toks[p] === undefined && t === ')') return; // closing brackets may be left off
    throw err();
  };
  const bin = (op, l, r) => ({ t: 'bin', op, l, r });

  function logic() {
    let l = and();
    while (['or', 'xor', 'xnor'].includes(peek())) { const op = toks[p++]; l = bin(op, l, and()); }
    return l;
  }
  function and() {
    let l = sum();
    while (peek() === 'and') { p++; l = bin('and', l, sum()); }
    return l;
  }
  function sum() {
    let l = prod();
    while (peek() === '+' || peek() === '-') { const op = toks[p++]; l = bin(op, l, prod()); }
    return l;
  }
  function prod() {
    let l = combo();
    while (peek() === '×' || peek() === '÷' || peek() === '▪') { const op = toks[p++]; l = bin(op, l, combo()); }
    return l;
  }
  function combo() {
    let l = neg();
    while (['nPr', 'nCr', '∠'].includes(peek())) { const op = toks[p++]; l = bin(op, l, neg()); }
    return l;
  }
  function neg() {
    if (peek() === '(−)') { p++; return { t: 'neg', a: neg() }; }
    return implied();
  }
  function implied() {
    let l = postfix();
    while (startsPrimary(peek())) l = bin('imul', l, postfix());
    return l;
  }
  function postfix() {
    let v = primary();
    for (;;) {
      const t = peek();
      if (t === 'P<') { p++; const e = logic(); expect('P>'); v = { t: 'pow', a: v, b: e }; }
      else if (t !== undefined && (t in POSTFIX || t.startsWith('V:'))) { p++; v = { t: 'post', op: t, a: v }; }
      else break;
    }
    return v;
  }
  function number() {
    let s = '';
    const pre = PREFIX[peek()];
    if (pre) p++;
    while (isDigitTok(peek())) s += toks[p++].replace(/^h/, '');
    if (opts.base) {
      const bse = pre || opts.base;
      if (s === '' || s.includes('.') || peek() === 'EE') throw err();
      for (const ch of s) if (parseInt(ch, 16) >= bse) throw err();
      const v = parseInt(s, bse);
      if (bse === 10 ? v > 2147483647 : v > 0xffffffff) fail();
      return { t: 'num', v: v | 0 };
    }
    if ((s.match(/\./g) || []).length > 1 || s === '.') throw err();
    let v = s === '' ? 1 : parseFloat(s);
    if (peek() === 'EE') {
      p++;
      let sign = '';
      if (peek() === '(−)' || peek() === '-') { sign = '-'; p++; }
      let es = '';
      while (/^[0-9]$/.test(peek() || '')) es += toks[p++];
      if (es === '') throw err();
      v = parseFloat((s || '1') + 'e' + sign + es);
    } else if (s === '') throw err();
    if (peek() === '°') { // degrees-minutes-seconds: 1°30°15°
      p++;
      let total = v;
      for (const div of [60, 3600]) {
        if (!isDigitTok(peek())) break;
        let s2 = '';
        while (isDigitTok(peek())) s2 += toks[p++];
        total += parseFloat(s2) / div;
        if (peek() === '°') p++; else break;
      }
      return { t: 'num', v: total, dms: true };
    }
    return { t: 'num', v };
  }
  function primary() {
    const t = peek();
    if (t === undefined) throw err();
    if (isDigitTok(t) || t === 'EE' || t in PREFIX) return number();
    if (STRUCT[t]) {
      const s = STRUCT[t];
      if (s.idx !== 0 || s.name === 'pow') throw err();
      const parts = TEMPLATES[s.name].parts;
      p++;
      const slots = [];
      for (let i = 1; i < parts.length; i++) { slots.push(logic()); expect(parts[i]); }
      return { t: 'tm', name: s.name, slots };
    }
    p++;
    if (t === '(') { const e = logic(); expect(')'); return e; }
    if (t in FUNCS) {
      const args = [logic()];
      while (peek() === ',') { p++; args.push(logic()); }
      expect(')');
      return { t: 'fn', f: FN_ALIAS[t] || t, args };
    }
    if (VARS.includes(t) || /^m\d$/.test(t)) return { t: 'var', n: t };
    if (t === 'Ans') return { t: 'ans' };
    if (t === 'π' || t === 'e' || t === 'i' || t.startsWith('K:')) return { t: 'const', n: t };
    if (t === 'Rand' || t === 'Ran#') return { t: 'rand' };
    if (t in STATVARS) return { t: 'stat', n: t };
    if (MATVEC.includes(t)) return { t: 'mv', n: t };
    p--;
    throw err();
  }

  if (!toks.length) throw err();
  let ast = logic();
  if (peek() === '=' && opts.allowEq) { p++; ast = { t: 'eq', l: ast, r: logic() }; }
  if (p < toks.length) throw err();
  return ast;
}

// ---------- value helpers ----------
const isC = (v) => v !== null && typeof v === 'object' && 're' in v;
const isM = (v) => v !== null && typeof v === 'object' && 'mat' in v;
const isV = (v) => v !== null && typeof v === 'object' && 'vec' in v;
const C = (re, im) => ({ re, im });
const toC = (v) => (typeof v === 'number' ? C(v, 0) : v);
const simp = (v) => (isC(v) && Math.abs(v.im) < 1e-14 * Math.max(1, Math.abs(v.re)) && !v.form ? v.re : v);
const clean = (v) => (v === 0 || !isFinite(v) ? v : +v.toPrecision(15));
function chk(v) {
  if (typeof v === 'number') { if (!isFinite(v) || Math.abs(v) >= 1e100) fail(); return v; }
  if (isC(v)) { chk(v.re); chk(v.im); }
  return v;
}
function real(v) {
  v = simp(v);
  if (typeof v !== 'number') fail();
  return v;
}
const isInt = (x) => Number.isInteger(x) || Math.abs(x - Math.round(x)) < 1e-10 * Math.max(1, Math.abs(x));

// decimal rounding (half away from zero) on the 15-digit decimal value, so 1.005 → 1.01
function decRound(x, n) {
  if (x === 0 || !isFinite(x)) return x;
  const [m, e] = Math.abs(+x.toPrecision(15)).toExponential().split('e');
  const r = Math.round(+(m + 'e' + (+e + n)));
  return Math.sign(x) * +(r + 'e' + -n);
}
function sigRound(x, n) {
  if (x === 0 || !isFinite(x)) return x;
  return decRound(x, n - 1 - Math.floor(Math.log10(Math.abs(+x.toPrecision(15)))));
}

function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; }

// complex
const cadd = (a, b) => C(a.re + b.re, a.im + b.im);
const csub = (a, b) => C(a.re - b.re, a.im - b.im);
const cmul = (a, b) => C(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
function cdiv(a, b) {
  const d = b.re * b.re + b.im * b.im;
  if (d === 0) fail();
  return C((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d);
}
const cabs = (a) => Math.hypot(a.re, a.im);
function cpow(a, b) {
  if (b.im === 0 && Number.isInteger(b.re) && Math.abs(b.re) <= 64) {
    let r = C(1, 0), base = a, n = Math.abs(b.re);
    while (n) { if (n & 1) r = cmul(r, base); base = cmul(base, base); n >>= 1; }
    return b.re < 0 ? cdiv(C(1, 0), r) : r;
  }
  if (a.re === 0 && a.im === 0) return C(0, 0);
  const lr = Math.log(cabs(a)), th = Math.atan2(a.im, a.re);
  const mr = Math.exp(lr * b.re - th * b.im), ang = lr * b.im + th * b.re;
  return C(clean(mr * Math.cos(ang)), clean(mr * Math.sin(ang)));
}

// matrices / vectors
const dims = (m) => [m.length, m[0].length];
function mmul(a, b) {
  const [r1, c1] = dims(a), [r2, c2] = dims(b);
  if (c1 !== r2) fail('Dimension ERROR');
  const out = [];
  for (let i = 0; i < r1; i++) {
    out.push([]);
    for (let j = 0; j < c2; j++) { let s = 0; for (let k = 0; k < c1; k++) s += a[i][k] * b[k][j]; out[i].push(clean(s)); }
  }
  return out;
}
export function mdet(m) {
  const [r, c] = dims(m);
  if (r !== c) fail('Dimension ERROR');
  const a = m.map((row) => row.slice());
  let det = 1;
  for (let i = 0; i < r; i++) {
    let piv = i;
    for (let k = i + 1; k < r; k++) if (Math.abs(a[k][i]) > Math.abs(a[piv][i])) piv = k;
    if (a[piv][i] === 0) return 0;
    if (piv !== i) { [a[i], a[piv]] = [a[piv], a[i]]; det = -det; }
    det *= a[i][i];
    for (let k = i + 1; k < r; k++) {
      const f = a[k][i] / a[i][i];
      for (let j = i; j < r; j++) a[k][j] -= f * a[i][j];
    }
  }
  return clean(det);
}
function minv(m) {
  const [r, c] = dims(m);
  if (r !== c) fail('Dimension ERROR');
  const a = m.map((row, i) => [...row, ...row.map((_, j) => (i === j ? 1 : 0))]);
  for (let i = 0; i < r; i++) {
    let piv = i;
    for (let k = i + 1; k < r; k++) if (Math.abs(a[k][i]) > Math.abs(a[piv][i])) piv = k;
    if (Math.abs(a[piv][i]) < 1e-14) fail();
    [a[i], a[piv]] = [a[piv], a[i]];
    const d = a[i][i];
    for (let j = 0; j < 2 * r; j++) a[i][j] /= d;
    for (let k = 0; k < r; k++) {
      if (k === i) continue;
      const f = a[k][i];
      for (let j = 0; j < 2 * r; j++) a[k][j] -= f * a[i][j];
    }
  }
  return a.map((row) => row.slice(r).map(clean));
}
const mtrn = (m) => m[0].map((_, j) => m.map((row) => row[j]));
function mide(m) {
  const [r, c] = dims(m);
  if (r !== c) fail('Dimension ERROR');
  return m.map((row, i) => row.map((_, j) => (i === j ? 1 : 0)));
}
function madj(m) { // adjugate = transpose of the cofactor matrix
  const [r, c] = dims(m);
  if (r !== c) fail('Dimension ERROR');
  if (r === 1) return [[1]];
  const minor = (i, j) => m.filter((_, k) => k !== i).map((row) => row.filter((_, l) => l !== j));
  return m.map((_, i) => m.map((__, j) => {
    const v = ((i + j) % 2 ? -1 : 1) * mdet(minor(j, i));
    return v === 0 ? 0 : clean(v);
  }));
}
const vdot = (a, b) => { if (a.length !== b.length) fail('Dimension ERROR'); return clean(a.reduce((s, x, i) => s + x * b[i], 0)); };
const vnorm = (a) => Math.hypot(...a);
function vcross(a, b) {
  if (a.length !== b.length) fail('Dimension ERROR');
  const [x1, y1, z1 = 0] = a, [x2, y2, z2 = 0] = b;
  return [y1 * z2 - z1 * y2, z1 * x2 - x1 * z2, x1 * y2 - y1 * x2].map(clean);
}
const mapM = (m, f) => m.map((r) => r.map(f));

function add(a, b, sign = 1) {
  if (typeof a === 'number' && typeof b === 'number') return a + sign * b;
  if (isM(a) && isM(b)) {
    if (a.mat.length !== b.mat.length || a.mat[0].length !== b.mat[0].length) fail('Dimension ERROR');
    return { mat: a.mat.map((r, i) => r.map((x, j) => clean(x + sign * b.mat[i][j]))) };
  }
  if (isV(a) && isV(b)) {
    if (a.vec.length !== b.vec.length) fail('Dimension ERROR');
    return { vec: a.vec.map((x, i) => clean(x + sign * b.vec[i])) };
  }
  if (isM(a) || isM(b) || isV(a) || isV(b)) fail();
  return simp(sign === 1 ? cadd(toC(a), toC(b)) : csub(toC(a), toC(b)));
}
function mul(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return a * b;
  if (isM(a) && isM(b)) return { mat: mmul(a.mat, b.mat) };
  if (isM(a) && typeof b === 'number') return { mat: mapM(a.mat, (x) => x * b) };
  if (typeof a === 'number' && isM(b)) return { mat: mapM(b.mat, (x) => x * a) };
  if (isV(a) && isV(b)) return { vec: vcross(a.vec, b.vec) };
  if (isV(a) && typeof b === 'number') return { vec: a.vec.map((x) => x * b) };
  if (typeof a === 'number' && isV(b)) return { vec: b.vec.map((x) => x * a) };
  if (isM(a) && isV(b)) return { vec: mmul(a.mat, b.vec.map((x) => [x])).map((r) => r[0]) };
  if (isM(a) || isM(b) || isV(a) || isV(b)) fail('Syntax ERROR');
  return simp(cmul(toC(a), toC(b)));
}
function div(a, b) {
  if (typeof b === 'number') {
    if (b === 0) fail();
    if (typeof a === 'number') return a / b;
    if (isM(a)) return { mat: mapM(a.mat, (x) => x / b) };
    if (isV(a)) return { vec: a.vec.map((x) => x / b) };
  }
  if (isM(a) || isM(b) || isV(a) || isV(b)) fail('Syntax ERROR');
  return simp(cdiv(toC(a), toC(b)));
}

// real power with odd roots of negatives, like a calculator does
function rpow(a, b, cplx) {
  if (a < 0 && !Number.isInteger(b)) {
    for (let q = 3; q < 100; q += 2) {
      const pq = b * q;
      if (Math.abs(pq - Math.round(pq)) < 1e-12) {
        const r = Math.pow(-a, b);
        return Math.round(pq) % 2 === 0 ? r : -r;
      }
    }
    if (cplx) return simp(cpow(C(a, 0), C(b, 0)));
    fail();
  }
  if (a === 0 && b < 0) fail();
  return Math.pow(a, b);
}
function power(a, b, ctx) {
  if (isM(a)) {
    b = real(b);
    if (!Number.isInteger(b) || b < -1) fail('Syntax ERROR');
    if (b === -1) return { mat: minv(a.mat) };
    let r = a.mat.map((row, i) => row.map((_, j) => (i === j ? 1 : 0)));
    if (dims(a.mat)[0] !== dims(a.mat)[1]) fail('Dimension ERROR');
    for (let k = 0; k < b; k++) r = mmul(r, a.mat);
    return { mat: r };
  }
  if (isV(a) || isV(b) || isM(b)) fail('Syntax ERROR');
  if (typeof a === 'number' && typeof b === 'number') return rpow(a, b, ctx.cplx);
  return simp(cpow(toC(a), toC(b)));
}

// ---------- statistics ----------
export const STAT_TYPES = [
  ['SD', '1-VAR'], ['Lin', 'A+BX'], ['Quad', '_+CX²'], ['Log', 'ln X'],
  ['eExp', 'e^X'], ['abExp', 'A•B^X'], ['Pwr', 'A•X^B'], ['Inv', '1/X'],
];
// median, quartiles, mode and range of 1-variable data (with frequencies)
function order1(rows, useF) {
  const v = [];
  for (const r of rows) { const f = useF && typeof r.f === 'number' ? r.f : 1; for (let k = 0; k < f; k++) v.push(r.x); }
  v.sort((a, b) => a - b);
  const medOf = (a) => { const m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
  const h = v.length >> 1;
  const out = { med: medOf(v), sR: v[v.length - 1] - v[0] };
  if (v.length > 1) { out.sQ1 = medOf(v.slice(0, h)); out.sQ3 = medOf(v.slice(v.length - h)); }
  const cnt = new Map(); let best = 0;
  for (const x of v) { const c = (cnt.get(x) || 0) + 1; cnt.set(x, c); best = Math.max(best, c); }
  out.smode = v.find((x) => cnt.get(x) === best);
  return out;
}
// standard normal distribution
function phi(t) { // P(t): probability below t
  const z = Math.abs(t) / Math.SQRT2, k = 1 / (1 + 0.5 * z);
  const e = k * Math.exp(-z * z - 1.26551223 + k * (1.00002368 + k * (0.37409196 + k * (0.09678418 + k * (-0.18628806 + k * (0.27886807 + k * (-1.13520398 + k * (1.48851587 + k * (-0.82215223 + k * 0.17087277)))))))));
  return t >= 0 ? 1 - e / 2 : e / 2;
}
const r5 = (x) => Math.round(x * 1e5) / 1e5; // P( Q( R( show 5 decimals
export function statCompute(stat) {
  const paired = stat.type !== 'SD';
  const rows = stat.data.filter((r) => typeof r.x === 'number' && (!paired || typeof r.y === 'number'));
  const R = { n: 0, Sx: 0, Sx2: 0, Sx3: 0, Sx4: 0, Sy: 0, Sy2: 0, Sxy: 0, Sx2y: 0 };
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const r of rows) {
    const f = stat.freq && typeof r.f === 'number' ? r.f : 1;
    const x = r.x, y = r.y ?? 0;
    R.n += f; R.Sx += f * x; R.Sx2 += f * x * x; R.Sx3 += f * x ** 3; R.Sx4 += f * x ** 4;
    if (paired) { R.Sy += f * y; R.Sy2 += f * y * y; R.Sxy += f * x * y; R.Sx2y += f * x * x * y; }
    if (f > 0) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  }
  Object.assign(R, { minX, maxX, minY, maxY, paired, type: stat.type });
  if (!paired && rows.length) Object.assign(R, order1(rows, stat.freq));
  const n = R.n;
  if (n > 0) {
    R.mx = R.Sx / n;
    R.sgx = Math.sqrt(Math.max(0, R.Sx2 / n - R.mx ** 2));
    if (n > 1) R.ssx = Math.sqrt(Math.max(0, (R.Sx2 - n * R.mx ** 2) / (n - 1)));
    if (paired) {
      R.my = R.Sy / n;
      R.sgy = Math.sqrt(Math.max(0, R.Sy2 / n - R.my ** 2));
      if (n > 1) R.ssy = Math.sqrt(Math.max(0, (R.Sy2 - n * R.my ** 2) / (n - 1)));
    }
  }
  if (paired && n > 0) {
    const t = stat.type;
    if (t === 'Quad') {
      const M = [[n, R.Sx, R.Sx2, R.Sy], [R.Sx, R.Sx2, R.Sx3, R.Sxy], [R.Sx2, R.Sx3, R.Sx4, R.Sx2y]];
      const sol = solveLinear(M);
      if (sol.kind === 'one') [R.sA, R.sB, R.sC] = sol.x.map(clean);
    } else {
      const U = (x) => (t === 'Log' || t === 'Pwr' ? Math.log(x) : t === 'Inv' ? 1 / x : x);
      const W = (y) => (t === 'eExp' || t === 'abExp' || t === 'Pwr' ? Math.log(y) : y);
      let su = 0, sw = 0, suu = 0, sww = 0, suw = 0, bad = false;
      for (const r of rows) {
        const f = stat.freq && typeof r.f === 'number' ? r.f : 1;
        const u = U(r.x), w = W(r.y);
        if (!isFinite(u) || !isFinite(w)) bad = true;
        su += f * u; sw += f * w; suu += f * u * u; sww += f * w * w; suw += f * u * w;
      }
      if (!bad) {
        const den = n * suu - su * su;
        if (den !== 0) {
          const b = (n * suw - su * sw) / den, a = (sw - b * su) / n;
          const rd = Math.sqrt(den * (n * sww - sw * sw));
          R.r = rd ? clean((n * suw - su * sw) / rd) : undefined;
          if (t === 'eExp' || t === 'Pwr') { R.sA = Math.exp(a); R.sB = b; }
          else if (t === 'abExp') { R.sA = Math.exp(a); R.sB = Math.exp(b); }
          else { R.sA = a; R.sB = b; }
          R.sA = clean(R.sA); R.sB = clean(R.sB);
        }
      }
    }
  }
  return R;
}
function statEst(R, op, v) {
  const { sA: A, sB: B, sC: Cc, type: t } = R;
  if (A === undefined) fail();
  if (op === 'yh') {
    switch (t) {
      case 'Lin': return A + B * v;
      case 'Quad': return A + B * v + Cc * v * v;
      case 'Log': if (v <= 0) fail(); return A + B * Math.log(v);
      case 'eExp': return A * Math.exp(B * v);
      case 'abExp': return A * Math.pow(B, v);
      case 'Pwr': return A * rpow(v, B);
      case 'Inv': if (v === 0) fail(); return A + B / v;
    }
  }
  if (t === 'Quad') {
    if (op === 'xh') fail('Syntax ERROR');
    const d = B * B - 4 * Cc * (A - v);
    if (d < 0 || Cc === 0) fail();
    return (-B + (op === 'xh1' ? 1 : -1) * Math.sqrt(d)) / (2 * Cc);
  }
  if (op !== 'xh') fail('Syntax ERROR');
  switch (t) {
    case 'Lin': if (!B) fail(); return (v - A) / B;
    case 'Log': return Math.exp((v - A) / B);
    case 'eExp': return Math.log(v / A) / B;
    case 'abExp': return Math.log(v / A) / Math.log(B);
    case 'Pwr': return rpow(v / A, 1 / B);
    case 'Inv': if (v === A) fail(); return B / (v - A);
  }
  fail();
}

// ---------- linear systems & polynomials ----------
export function solveLinear(M) { // augmented n×(n+1)
  const n = M.length, a = M.map((r) => r.slice());
  let rank = 0;
  const where = Array(n).fill(-1);
  for (let col = 0, row = 0; col < n && row < n; col++) {
    let piv = row;
    for (let i = row; i < n; i++) if (Math.abs(a[i][col]) > Math.abs(a[piv][col])) piv = i;
    if (Math.abs(a[piv][col]) < 1e-12) continue;
    [a[piv], a[row]] = [a[row], a[piv]];
    where[col] = row;
    for (let i = 0; i < n; i++) {
      if (i === row) continue;
      const f = a[i][col] / a[row][col];
      for (let j = col; j <= n; j++) a[i][j] -= f * a[row][j];
    }
    row++; rank++;
  }
  for (let i = rank; i < n; i++) if (Math.abs(a[i][n]) > 1e-10) return { kind: 'none' };
  if (rank < n) return { kind: 'inf' };
  return { kind: 'one', x: where.map((r, c) => clean(a[r][n] / a[r][c])) };
}
export function polyRoots(coef) { // highest degree first, complex results
  while (coef.length > 1 && coef[0] === 0) coef = coef.slice(1);
  const deg = coef.length - 1;
  if (deg < 1) fail();
  if (deg === 1) return [C(clean(-coef[1] / coef[0]), 0)];
  if (deg === 2) {
    const [a, b, c] = coef, d = b * b - 4 * a * c;
    if (Math.abs(d) < 1e-14 * (b * b + Math.abs(4 * a * c))) return [C(clean(-b / (2 * a)), 0)];
    if (d > 0) {
      const q = -(b + Math.sign(b || 1) * Math.sqrt(d)) / 2;
      const r = [q / a, c / q].map(clean).sort((x, y) => y - x);
      return r.map((x) => C(x, 0));
    }
    const re = clean(-b / (2 * a)), im = clean(Math.sqrt(-d) / (2 * Math.abs(a)));
    return [C(re, im), C(re, -im)];
  }
  // Durand–Kerner, then Newton polish
  const lead = coef[0], p = coef.map((c) => c / lead);
  const evalP = (z) => p.reduce((acc, c) => cadd(cmul(acc, z), C(c, 0)), C(0, 0));
  let roots = Array.from({ length: deg }, (_, k) => cpow(C(0.4, 0.9), C(k, 0)));
  for (let it = 0; it < 800; it++) {
    let delta = 0;
    roots = roots.map((z, i) => {
      let den = C(1, 0);
      roots.forEach((w, j) => { if (j !== i) den = cmul(den, csub(z, w)); });
      const nz = csub(z, cdiv(evalP(z), den.re === 0 && den.im === 0 ? C(1e-12, 0) : den));
      delta = Math.max(delta, cabs(csub(nz, z)));
      return nz;
    });
    if (delta < 1e-15) break;
  }
  const scale = Math.max(1, ...roots.map(cabs));
  // multiple roots come out as a tight cluster; the cluster mean is far more accurate
  const group = roots.map((_, i) => i);
  for (let i = 0; i < deg; i++)
    for (let j = i + 1; j < deg; j++)
      if (cabs(csub(roots[i], roots[j])) < 1e-4 * scale) group[j] = group[i];
  const clustered = roots.map((_, i) => group.filter((g) => g === group[i]).length > 1);
  roots = roots.map((z, i) => {
    if (!clustered[i]) return z;
    const mem = roots.filter((_, j) => group[j] === group[i]);
    return C(mem.reduce((s, w) => s + w.re, 0) / mem.length, mem.reduce((s, w) => s + w.im, 0) / mem.length);
  });
  const pz = (z) => { let f = C(0, 0), df = C(0, 0); for (const c of p) { df = cadd(cmul(df, z), f); f = cadd(cmul(f, z), C(c, 0)); } return [f, df]; };
  roots = roots.map((z, i) => {
    if (Math.abs(z.im) < 1e-9 * scale) z = C(z.re, 0);
    if (!clustered[i]) { // Newton polish (stays on the real line for real roots)
      for (let k = 0; k < 6; k++) {
        const [f, df] = pz(z);
        if (df.re === 0 && df.im === 0) break;
        const nz = csub(z, cdiv(f, df));
        z = z.im === 0 ? C(nz.re, 0) : nz;
      }
    }
    // snap last-digit noise when the rounded value fits at least as well
    const cand = C(+z.re.toPrecision(12), +z.im.toPrecision(12));
    if (cabs(pz(cand)[0]) <= cabs(pz(z)[0])) z = cand;
    const tiny = 1e-12 * cabs(z); // e.g. −1e-19 + 1i → i
    if (Math.abs(z.re) < tiny) z = C(0, z.im);
    if (Math.abs(z.im) < tiny) z = C(z.re, 0);
    return C(clean(z.re), clean(z.im));
  });
  // real coefficients → complex roots come in exact conjugate pairs
  const used = new Set();
  roots.forEach((z, i) => {
    if (z.im <= 0 || used.has(i)) return;
    let best = -1;
    roots.forEach((w, j) => {
      if (w.im < 0 && !used.has(j) && (best < 0 || cabs(csub(w, C(z.re, -z.im))) < cabs(csub(roots[best], C(z.re, -z.im))))) best = j;
    });
    if (best < 0) return;
    used.add(i); used.add(best);
    const re = clean((z.re + roots[best].re) / 2), im = clean((z.im - roots[best].im) / 2);
    roots[i] = C(re, im); roots[best] = C(re, -im);
  });
  roots.sort((a, b) => (a.im === 0) !== (b.im === 0) ? (a.im === 0 ? -1 : 1) : b.re - a.re || b.im - a.im);
  return roots;
}

// ---------- evaluation ----------
export function evaluate(ast, ctx) {
  const deg2 = { deg: Math.PI / 180, rad: 1, gra: Math.PI / 200 };
  const toRad = (x) => x * deg2[ctx.angle];
  const fromRad = (x) => x / deg2[ctx.angle];
  const base = ctx.base;
  const wrap = (v) => (base ? (Math.trunc(real(v)) | 0) : chk(v));
  let statR = null;
  const stat = () => (statR ||= statCompute(ctx.stat));

  function trig(f, x) {
    x = real(x);
    if (Math.abs(x) >= 1e10 * (ctx.angle === 'rad' ? 1 : 57)) fail();
    let a = x;
    if (ctx.angle !== 'rad') { const full = ctx.angle === 'deg' ? 360 : 400; a = ((x % full) + full) % full; }
    const r = toRad(a);
    const s = Math.sin(r), c = Math.cos(r);
    const snap = (v) => (Math.abs(v) < 1e-15 ? 0 : clean(v));
    if (f === 'sin') return snap(s);
    if (f === 'cos') return snap(c);
    if (Math.abs(c) < 1e-15) fail();
    return snap(s / c);
  }
  function fact(x) {
    x = real(x);
    if (!isInt(x) || x < 0 || x > 69) fail();
    let r = 1;
    for (let k = 2; k <= Math.round(x); k++) r *= k;
    return r;
  }
  function perm(n, r, comb) {
    n = real(n); r = real(r);
    if (!isInt(n) || !isInt(r) || r < 0 || n < r || n >= 1e10) fail();
    n = Math.round(n); r = Math.round(r);
    if (comb) r = Math.min(r, n - r);
    let v = 1;
    for (let k = 0; k < r; k++) v = comb ? (v * (n - k)) / (k + 1) : v * (n - k);
    return chk(comb ? Math.round(v) : v);
  }
  // Round(: Fix n → n decimals, Sci n → n significant digits, Norm → 10 significant digits
  function rnd(x) {
    x = real(x);
    const s = ctx.setup || {};
    if (s.disp === 'fix') return decRound(x, s.dispN ?? 0);
    return sigRound(x, s.disp === 'sci' ? s.dispN || 10 : 10);
  }
  const withX = (f, x) => real(ev(f, { ...ctx, vars: { ...ctx.vars, X: x } }));

  function integrate(f, a, b) {
    const F = (x) => withX(f, x);
    // adaptive Simpson
    const simpson = (a, b, fa, fm, fb) => ((b - a) / 6) * (fa + 4 * fm + fb);
    let calls = 0;
    function rec(a, b, fa, fm, fb, whole, eps, depth) {
      const m = (a + b) / 2, lm = (a + m) / 2, rm = (m + b) / 2;
      const flm = F(lm), frm = F(rm);
      calls += 2;
      if (calls > 200000) fail('Time Out');
      const left = simpson(a, m, fa, flm, fm), right = simpson(m, b, fm, frm, fb);
      if (depth <= 0 || Math.abs(left + right - whole) <= 15 * eps) return left + right + (left + right - whole) / 15;
      return rec(a, m, fa, flm, fm, left, eps / 2, depth - 1) + rec(m, b, fm, frm, fb, right, eps / 2, depth - 1);
    }
    if (a === b) return 0;
    const fa = F(a), fb = F(b), fm = F((a + b) / 2);
    const v = rec(a, b, fa, fm, fb, simpson(a, b, fa, fm, fb), 1e-11, 40);
    return Math.abs(v) < 1e-12 ? 0 : +v.toPrecision(13);
  }
  function derive(f, x) {
    const F = (t) => withX(f, t);
    const D = (h) => (F(x + h) - F(x - h)) / (2 * h);
    let h = 1e-3 * Math.max(1, Math.abs(x));
    const d1 = D(h), d2 = D(h / 2), d3 = D(h / 4);
    const r1 = (4 * d2 - d1) / 3, r2 = (4 * d3 - d2) / 3;
    const v = (16 * r2 - r1) / 15;
    return Math.abs(v) < 1e-11 ? 0 : +v.toPrecision(11);
  }
  function sigma(f, a, b, product = false) {
    if (!isInt(a) || !isInt(b) || b < a) fail();
    if (b - a > 1e6) fail('Time Out');
    let s = product ? 1 : 0;
    for (let x = Math.round(a); x <= Math.round(b); x++) {
      if (product) { s *= withX(f, x); chk(s); } else s += withX(f, x);
    }
    return clean(s);
  }
  const intArg = (v, lim = 1e10) => {
    v = real(v);
    if (!isInt(v) || Math.abs(v) >= lim) fail();
    return Math.round(v);
  };

  function fn(name, args) {
    if (name === '∫(' || name === 'd/dx(' || name === 'Σ(' || name === '∏(') { // first argument stays an expression of X
      const v = (k) => real(ev(args[k], ctx));
      if (name === 'd/dx(') { if (args.length < 2 || args.length > 3) fail('Syntax ERROR'); return derive(args[0], v(1)); }
      if (args.length < 3 || args.length > (name === '∫(' ? 4 : 3)) fail('Syntax ERROR');
      return name === '∫(' ? integrate(args[0], v(1), v(2)) : sigma(args[0], v(1), v(2), name === '∏(');
    }
    const A = args.map((a) => ev(a, ctx));
    const need = (n) => { if (A.length !== n) fail('Syntax ERROR'); };
    const needMin = (n) => { if (A.length < n) fail('Syntax ERROR'); };
    if (!['Pol(', 'Rec(', 'GCD(', 'LCM(', 'i~Rand(', 'Dot(', 'Angle(', 'log(', 'Max(', 'Min(', 'Mod(', 'Q…r('].includes(name)) need(1);
    const x = A[0];
    switch (name) {
      case 'sin(': return trig('sin', x);
      case 'cos(': return trig('cos', x);
      case 'tan(': return trig('tan', x);
      case 'asin(': case 'acos(': {
        const v = real(x);
        if (v < -1 || v > 1) fail();
        return clean(fromRad(name === 'asin(' ? Math.asin(v) : Math.acos(v)));
      }
      case 'atan(': return clean(fromRad(Math.atan(real(x))));
      case 'sinh(': return clean(Math.sinh(real(x)));
      case 'cosh(': return clean(Math.cosh(real(x)));
      case 'tanh(': return clean(Math.tanh(real(x)));
      case 'asinh(': return clean(Math.asinh(real(x)));
      case 'acosh(': { const v = real(x); if (v < 1) fail(); return clean(Math.acosh(v)); }
      case 'atanh(': { const v = real(x); if (v <= -1 || v >= 1) fail(); return clean(Math.atanh(v)); }
      case 'log(': {
        if (A.length === 2) return logab(A[0], A[1]);
        need(1);
        const v = real(x); if (v <= 0) fail(); return clean(Math.log10(v));
      }
      case 'ln(': { const v = real(x); if (v <= 0) fail(); return clean(Math.log(v)); }
      case 'Pol(': {
        need(2);
        const a = real(A[0]), b = real(A[1]);
        if (a === 0 && b === 0) fail();
        const r = clean(Math.hypot(a, b)), th = clean(fromRad(Math.atan2(b, a)));
        ctx.multi = [['r', r], ['θ', th]]; ctx.setVars = { X: r, Y: th };
        return r;
      }
      case 'Rec(': {
        need(2);
        const r = real(A[0]), th = toRad(real(A[1]));
        const sx = Math.abs(Math.cos(th)) < 1e-15 ? 0 : clean(r * Math.cos(th));
        const sy = Math.abs(Math.sin(th)) < 1e-15 ? 0 : clean(r * Math.sin(th));
        ctx.multi = [['X', sx], ['Y', sy]]; ctx.setVars = { X: sx, Y: sy };
        return sx;
      }
      case 'GCD(': case 'LCM(': { // 2 or 3 positive integers
        if (A.length < 2 || A.length > 3) fail('Syntax ERROR');
        const v = A.map((a) => intArg(a));
        if (v.some((n) => n <= 0)) fail();
        return chk(v.reduce((acc, n) => (name === 'GCD(' ? gcd(acc, n) : (acc / gcd(acc, n)) * n)));
      }
      case 'P(': return r5(phi(real(x)));
      case 'Q(': return r5(Math.abs(phi(real(x)) - 0.5));
      case 'R(': return r5(1 - phi(real(x)));
      case 'Max(': case 'Min(': {
        needMin(2);
        const v = A.map(real);
        return name === 'Max(' ? Math.max(...v) : Math.min(...v);
      }
      case 'Mod(': {
        need(2);
        const a = real(A[0]), b = real(A[1]);
        if (b === 0) return a;
        return clean(a - b * Math.floor(a / b));
      }
      case 'Q…r(': {
        need(2);
        const a = intArg(A[0]), b = intArg(A[1]);
        if (b === 0) fail();
        const q = Math.floor(a / b), r = a - b * q;
        ctx.multi = [['Q', q], ['R', r]]; ctx.setVars = { C: q, D: r };
        return q;
      }
      case 'Int(': return Math.trunc(real(x));
      case 'Intg(': return Math.floor(real(x));
      case 'i~Rand(': {
        need(2);
        const a = real(A[0]), b = real(A[1]);
        if (!isInt(a) || !isInt(b) || a > b) fail();
        return Math.round(a) + Math.floor(Math.random() * (Math.round(b) - Math.round(a) + 1));
      }
      case 'Round(': return rnd(x);
      case 'Not(': return ~real(x) | 0;
      case 'Neg(': return -real(x) | 0;
      case 'Abs(': return absval(x);
      case 'Det(': if (!isM(x)) fail('Syntax ERROR'); return mdet(x.mat);
      case 'Trn(': if (!isM(x)) fail('Syntax ERROR'); return { mat: mtrn(x.mat) };
      case 'Ide(': { const k = typeof x === 'number' ? x : NaN; if (!Number.isInteger(k) || k < 1 || k > 4) fail(); return { mat: Array.from({ length: k }, (_, i) => Array.from({ length: k }, (_, j) => (i === j ? 1 : 0))) }; }
      case 'Adj(': if (!isM(x)) fail('Syntax ERROR'); return { mat: madj(x.mat) };
      case 'Inv(': if (!isM(x)) fail('Syntax ERROR'); return { mat: minv(x.mat) };
      case 'Dot(': need(2); if (!isV(A[0]) || !isV(A[1])) fail('Syntax ERROR'); return vdot(A[0].vec, A[1].vec);
      case 'Angle(': {
        need(2);
        if (!isV(A[0]) || !isV(A[1])) fail('Syntax ERROR');
        const d = vnorm(A[0].vec) * vnorm(A[1].vec);
        if (!d) fail();
        return clean(fromRad(Math.acos(Math.max(-1, Math.min(1, vdot(A[0].vec, A[1].vec) / d)))));
      }
      case 'UnitV(': {
        if (!isV(x)) fail('Syntax ERROR');
        const n = vnorm(x.vec);
        if (!n) fail();
        return { vec: x.vec.map((v) => clean(v / n)) };
      }
      case 'Arg(': { const z = toC(x); if (!isC(z)) fail('Syntax ERROR'); return clean(fromRad(Math.atan2(z.im, z.re))); }
      case 'Conjg(': { const z = toC(x); if (!isC(z)) fail('Syntax ERROR'); return simp(C(z.re, -z.im)); }
      case 'Real(': { const z = toC(x); if (!isC(z)) fail('Syntax ERROR'); return z.re; }
      case 'Imag(': { const z = toC(x); if (!isC(z)) fail('Syntax ERROR'); return z.im; }
    }
    fail('Syntax ERROR');
  }
  function absval(x) {
    if (typeof x === 'number') return Math.abs(x);
    if (isC(x)) return clean(cabs(x));
    if (isV(x)) return clean(vnorm(x.vec));
    if (isM(x)) return { mat: mapM(x.mat, Math.abs) };
    fail();
  }
  function logab(a, x) {
    a = real(a); x = real(x);
    if (a <= 0 || a === 1 || x <= 0) fail();
    return clean(Math.log(x) / Math.log(a));
  }
  function sqrt(x) {
    if (typeof x === 'number') {
      if (x < 0) { if (ctx.cplx) return C(0, clean(Math.sqrt(-x))); fail(); }
      return clean(Math.sqrt(x));
    }
    if (isC(x)) return simp(cpow(x, C(0.5, 0)));
    fail('Syntax ERROR');
  }

  function ev(n, c) {
    if (c !== ctx) return evaluate(n, c);
    switch (n.t) {
      case 'num': return wrap(n.v);
      case 'var': return ctx.vars[n.n] ?? 0;
      case 'ans': return ctx.ans ?? 0;
      case 'rand': return Math.floor(Math.random() * 1000) / 1000;
      case 'const':
        if (n.n === 'π') return Math.PI;
        if (n.n === 'e') return Math.E;
        if (n.n === 'i') { if (!ctx.cplx) fail('Syntax ERROR'); return C(0, 1); }
        return CONSTS[+n.n.slice(2)][1];
      case 'stat': {
        const R = stat(), v = R[n.n];
        if (v === undefined || !isFinite(v)) fail();
        return v;
      }
      case 'mv': {
        const v = n.n.startsWith('Mat') ? ctx.mats[n.n] : ctx.vecs[n.n];
        if (!v) fail('Dimension ERROR');
        return n.n.startsWith('Mat') ? { mat: v } : { vec: v };
      }
      case 'neg': {
        const v = ev(n.a, ctx);
        if (base) return wrap(-v);
        return mul(-1, v);
      }
      case 'pow': { const bs = ev(n.a, ctx); if (isM(bs) || isV(bs)) fail('Syntax ERROR'); return chk(power(bs, ev(n.b, ctx), ctx)); }
      case 'post': {
        const v = ev(n.a, ctx), op = n.op;
        if (op.startsWith('V:')) return chk(convert(real(v), ...convOf(op)));
        switch (op) {
          case '²': return chk(isM(v) ? power(v, 2, ctx) : mul(v, v));
          case '³': return chk(isM(v) ? power(v, 3, ctx) : mul(mul(v, v), v));
          case '⁻¹': return chk(isM(v) ? power(v, -1, ctx) : div(1, v));
          case '!': return chk(fact(v));
          case '%': return div(v, 100);
          case 'u°': return real(v) * (Math.PI / 180) / deg2[ctx.angle];
          case 'ur': return real(v) / deg2[ctx.angle];
          case 'ug': return real(v) * (Math.PI / 200) / deg2[ctx.angle];
          case '>pol': return { ...toC(v), form: 'polar' };
          case '>rect': return { ...toC(v), form: 'rect' };
          case 'xh': case 'yh': case 'xh1': case 'xh2': return chk(statEst(stat(), op, real(v)));
          case 'tt': { const R = stat(); if (!R.sgx) fail(); return chk((real(v) - R.mx) / R.sgx); }
        }
        fail('Syntax ERROR');
      }
      case 'bin': {
        const a = ev(n.l, ctx), b = ev(n.r, ctx);
        if (base) {
          const x = real(a) | 0, y = real(b) | 0;
          const fit = (r) => { if (r > 2147483647 || r < -2147483648) fail(); return r; };
          switch (n.op) {
            case '+': return fit(x + y);
            case '-': return fit(x - y);
            case '×': case 'imul': return fit(x * y);
            case '÷': if (y === 0) fail(); return fit(Math.trunc(x / y));
            case 'and': return x & y;
            case 'or': return x | y;
            case 'xor': return x ^ y;
            case 'xnor': return ~(x ^ y);
          }
          fail('Syntax ERROR');
        }
        switch (n.op) {
          case '+': return chk(add(a, b));
          case '-': return chk(add(a, b, -1));
          case '×': case 'imul': return chk(mul(a, b));
          case '÷': return chk(div(a, b));
          case '▪': if (!isV(a) || !isV(b)) fail('Syntax ERROR'); return vdot(a.vec, b.vec);
          case 'nPr': return perm(a, b, false);
          case 'nCr': return perm(a, b, true);
          case '∠': {
            const r = real(a), th = toRad(real(b));
            return simp(C(clean(r * Math.cos(th)), clean(r * Math.sin(th))));
          }
        }
        fail('Syntax ERROR');
      }
      case 'fn': return chk(fn(n.f, n.args));
      case 'tm': {
        const s = n.slots;
        switch (n.name) {
          case 'frac': return chk(div(ev(s[0], ctx), ev(s[1], ctx)));
          case 'mixed': {
            const w = real(ev(s[0], ctx)), num = real(ev(s[1], ctx)), d = real(ev(s[2], ctx));
            if (d === 0) fail();
            return chk(w < 0 ? w - num / d : w + num / d);
          }
          case 'sqrt': return chk(sqrt(ev(s[0], ctx)));
          case 'cbrt': return chk(clean(Math.cbrt(real(ev(s[0], ctx)))));
          case 'nroot': {
            const k = real(ev(s[0], ctx)), x = real(ev(s[1], ctx));
            if (k === 0) fail();
            if (x < 0) { if (isInt(k) && Math.round(k) % 2) return chk(-clean(Math.pow(-x, 1 / k))); fail(); }
            return chk(clean(Math.pow(x, 1 / k)));
          }
          case 'ten': return chk(rpow(10, real(ev(s[0], ctx))));
          case 'exp': {
            const v = ev(s[0], ctx);
            if (isC(v)) return simp(cpow(C(Math.E, 0), v));
            return chk(clean(Math.exp(real(v))));
          }
          case 'logab': return chk(logab(ev(s[0], ctx), ev(s[1], ctx)));
          case 'abs': return chk(absval(ev(s[0], ctx)));
          case 'integ': return chk(integrate(s[0], real(ev(s[1], ctx)), real(ev(s[2], ctx))));
          case 'diff': return chk(derive(s[0], real(ev(s[1], ctx))));
          case 'sum': return chk(sigma(s[0], real(ev(s[1], ctx)), real(ev(s[2], ctx))));
          case 'prod': return chk(sigma(s[0], real(ev(s[1], ctx)), real(ev(s[2], ctx)), true));
        }
        fail('Syntax ERROR');
      }
      case 'eq': fail('Syntax ERROR');
    }
    fail('Syntax ERROR');
  }
  const v = ev(ast, ctx);
  if (!ctx.cplx && isC(v)) fail();
  return v;
}

// ---------- solver ----------
export function solveFor(F, x0) {
  const f = (x) => { try { return F(x); } catch { return NaN; } };
  const done = (x) => ({ x: clean(x), lr: f(x) });
  let x = x0;
  for (let i = 0; i < 200; i++) {
    const fx = f(x);
    if (!isFinite(fx)) break;
    if (fx === 0) return done(x);
    const h = 1e-7 * Math.max(1, Math.abs(x));
    const d = (f(x + h) - f(x - h)) / (2 * h);
    if (!isFinite(d) || d === 0) break;
    let nx = x - fx / d;
    if (Math.abs(nx - x) <= 1e-14 * Math.max(1, Math.abs(x))) return done(nx);
    if (Math.abs(nx) > 1e99) break;
    x = nx;
  }
  if (isFinite(f(x)) && Math.abs(f(x)) < 1e-10) return done(x);
  // bracket search outward from the guess, then bisect
  let prevX = x0, prev = f(x0);
  for (let step = 0.1, k = 0; k < 400; k++, step *= 1.12) {
    for (const s of [1, -1]) {
      const nx = x0 + s * step, v = f(nx);
      const px = x0 + s * step / 1.12, pv = f(px);
      if (isFinite(v) && isFinite(pv) && Math.sign(v) !== Math.sign(pv)) {
        let lo = px, hi = nx, flo = pv;
        for (let j = 0; j < 200; j++) {
          const mid = (lo + hi) / 2, fm = f(mid);
          if (Math.sign(fm) === Math.sign(flo)) { lo = mid; flo = fm; } else hi = mid;
        }
        const r = (lo + hi) / 2;
        if (Math.abs(f(r)) < 1e-6 * Math.max(1, Math.abs(prev))) return done(r);
      }
    }
  }
  void prevX;
  throw new CalcError("Can't Solve");
}

// ---------- number formatting ----------
// returns {m: mantissa string, e: exponent or null}
export function fmtReal(x, setup, eng = null) {
  if (Object.is(x, -0)) x = 0;
  if (eng !== null) {
    const m = +(x / Math.pow(10, eng)).toPrecision(10);
    return { m: trimZeros(String(m).includes('e') ? m.toFixed(12) : String(m)), e: eng };
  }
  if (x === 0) return { m: setup.disp === 'fix' ? (0).toFixed(setup.dispN) : setup.disp === 'sci' ? sciM(0, setup.dispN) : '0', e: setup.disp === 'sci' ? 0 : null };
  if (setup.disp === 'sci') {
    const s = x.toExponential((setup.dispN || 10) - 1).split('e');
    return { m: s[0], e: +s[1] };
  }
  if (setup.disp === 'fix') {
    if (Math.abs(x) < 1e10) return { m: x.toFixed(setup.dispN), e: null };
  }
  const s = x.toExponential(9).split('e');
  const r = +(s[0] + 'e' + s[1]);
  const lim = setup.disp === 'norm' && setup.dispN === 2 ? 1e-9 : 1e-2;
  if (Math.abs(r) >= 1e10 || Math.abs(r) < lim) return { m: trimZeros(s[0]), e: +s[1] };
  let f = r.toPrecision(10);
  if (f.includes('e')) f = r.toFixed(12);
  return { m: trimZeros(f), e: null };
}
const sciM = (x, n) => x.toExponential((n || 10) - 1).split('e')[0];
function trimZeros(s) { return s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s; }
export function engExp(x) { return x === 0 ? 0 : Math.floor(Math.log10(Math.abs(+x.toPrecision(10))) / 3) * 3; }

export function toFrac(x, maxD = 1e10) {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  let h1 = 1, h0 = 0, k1 = 0, k0 = 1, b = ax;
  for (let i = 0; i < 40; i++) {
    const a = Math.floor(b);
    const h2 = a * h1 + h0, k2 = a * k1 + k0;
    if (k2 > maxD) break;
    h0 = h1; h1 = h2; k0 = k1; k1 = k2;
    if (Math.abs(ax - h1 / k1) <= 1e-12 * Math.max(1, ax)) return [sign * h1, k1];
    const r = b - a;
    if (r < 1e-13) break;
    b = 1 / r;
  }
  return null;
}
const digits = (n) => String(Math.abs(n)).length;
function sqrtSimplify(n) { // n = a²·b
  let a = 1, b = n;
  for (let k = 2; k * k <= b; k++) while (b % (k * k) === 0) { b /= k * k; a *= k; }
  return [a, b];
}
// exact form of a real result for Math mode: fraction, surd or multiple of π
export function exactForm(x) {
  if (!isFinite(x) || Number.isInteger(x) || Math.abs(x) >= 1e10 || Math.abs(x) < 1e-10) return null;
  const f = toFrac(x);
  if (f && f[1] === 1) return null; // a whole number that picked up rounding noise (6.000000000000001)
  if (f && digits(f[0]) + digits(f[1]) <= 10) return { type: 'frac', n: f[0], d: f[1] };
  const fs = toFrac(x * x, 9999);
  if (fs && fs[0] < 1e6) {
    const [p, q] = fs, [a, b] = sqrtSimplify(p * q);
    if (b > 1 && p * q < 1e9) {
      const g = gcd(a, q);
      return { type: 'surd', sign: Math.sign(x), a: a / g, b, d: q / g };
    }
  }
  const fp = toFrac(x / Math.PI, 999);
  if (fp && Math.abs(fp[0]) < 1000) return { type: 'pi', n: fp[0], d: fp[1] };
  return surd2(x);
}
// two-term forms: p√b + q√e (√3+√2) or integer + p√b (1+√2)
const SQF = [2, 3, 5, 6, 7, 10, 11, 13, 14, 15, 17, 19];
function surd2(x) {
  const nearInt = (v) => { const r = Math.round(v); return r !== 0 && Math.abs(v - r) <= 1e-11 * Math.max(1, Math.abs(x)) ? r : null; };
  for (const b of SQF) for (let p = -9; p <= 9; p++) {
    if (!p) continue;
    const rest = x - p * Math.sqrt(b);
    const k = nearInt(rest);
    if (k !== null && Math.abs(k) <= 999) return { type: 'surd2', terms: [{ k, b: 1 }, { k: p, b }] };
    for (const e2 of SQF) {
      if (e2 >= b) break;
      const q = nearInt(rest / Math.sqrt(e2));
      if (q !== null && Math.abs(q) <= 9) return { type: 'surd2', terms: [{ k: p, b }, { k: q, b: e2 }] };
    }
  }
  return null;
}
export function fmtDMS(x) {
  const neg = x < 0;
  let a = Math.abs(x), d = Math.floor(a), mf = (a - d) * 60, m = Math.floor(mf + 1e-9);
  let s = Math.round((mf - m) * 60 * 100) / 100;
  if (s >= 60) { s -= 60; m++; }
  if (m >= 60) { m -= 60; d++; }
  return (neg ? '−' : '') + d + '°' + m + '′' + s + '″';
}
export const types = { isC, isM, isV };
