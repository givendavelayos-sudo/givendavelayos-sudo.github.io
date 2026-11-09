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
  'RanInt#(': 'RanInt#(', 'Rnd(': 'Rnd(', 'Not(': 'Not(', 'Neg(': 'Neg(',
  'det(': 'det(', 'Trn(': 'Trn(', 'Dot(': 'Dot(', 'Angle(': 'Angle(', 'UnitV(': 'UnitV(',
  'arg(': 'arg(', 'Conjg(': 'Conjg(', 'Abs(': 'Abs(',
};
export const STATVARS = {
  n: 'n', mx: 'x̄', sgx: 'σx', ssx: 'sx', Sx: 'Σx', Sx2: 'Σx²', my: 'ȳ', sgy: 'σy', ssy: 'sy',
  Sy: 'Σy', Sy2: 'Σy²', Sxy: 'Σxy', Sx3: 'Σx³', Sx2y: 'Σx²y', Sx4: 'Σx⁴',
  minX: 'minX', maxX: 'maxX', minY: 'minY', maxY: 'maxY', sA: 'A', sB: 'B', sC: 'C', r: 'r',
};
const STATPOST = { xh: 'x̂', yh: 'ŷ', xh1: 'x̂₁', xh2: 'x̂₂' };
export const MATVEC = ['MatA', 'MatB', 'MatC', 'MatAns', 'VctA', 'VctB', 'VctC', 'VctD', 'VctAns'];
const POSTFIX = {
  '²': '²', '³': '³', '⁻¹': '⁻¹', '!': '!', '%': '%', 'u°': '°', 'ur': 'ʳ', 'ug': 'ᵍ',
  '>pol': '▶r∠θ', '>rect': '▶a+bi', ...STATPOST,
};
const BINOPS = { '+': '+', '-': '−', '×': '×', '÷': '÷', nPr: 'P', nCr: 'C', '∠': '∠',
  and: ' and ', or: ' or ', xor: ' xor ', xnor: ' xnor ' };

// ---------- constants & conversions ----------
export const CONSTS = [
  ['mp', 'proton mass', 1.67262192369e-27], ['mn', 'neutron mass', 1.67492749804e-27],
  ['me', 'electron mass', 9.1093837015e-31], ['mμ', 'muon mass', 1.883531627e-28],
  ['a₀', 'Bohr radius', 5.29177210903e-11], ['h', 'Planck const', 6.62607015e-34],
  ['μN', 'nuclear magneton', 5.0507837461e-27], ['μB', 'Bohr magneton', 9.2740100783e-24],
  ['ħ', 'reduced Planck', 1.054571817e-34], ['α', 'fine-structure', 7.2973525693e-3],
  ['re', 'electron radius', 2.8179403262e-15], ['λc', 'Compton λ', 2.42631023867e-12],
  ['γp', 'proton gyromag.', 2.6752218744e8], ['λcp', 'proton Compton λ', 1.32140985539e-15],
  ['λcn', 'neutron Compton λ', 1.31959090581e-15], ['R∞', 'Rydberg const', 10973731.56816],
  ['u', 'atomic mass unit', 1.6605390666e-27], ['μp', 'proton mag. mom.', 1.41060679736e-26],
  ['μe', 'electron mag. mom.', -9.2847647043e-24], ['μn', 'neutron mag. mom.', -9.6623651e-27],
  ['μμ', 'muon mag. mom.', -4.4904483e-26], ['F', 'Faraday const', 96485.33212],
  ['e', 'elementary charge', 1.602176634e-19], ['NA', 'Avogadro const', 6.02214076e23],
  ['k', 'Boltzmann const', 1.380649e-23], ['Vm', 'molar volume', 22.41396954e-3],
  ['R', 'gas constant', 8.314462618], ['c₀', 'speed of light', 299792458],
  ['C₁', '1st radiation', 3.741771852e-16], ['C₂', '2nd radiation', 1.438776877e-2],
  ['σ', 'Stefan-Boltzmann', 5.670374419e-8], ['ε₀', 'electric const', 8.8541878128e-12],
  ['μ₀', 'magnetic const', 1.25663706212e-6], ['Φ₀', 'flux quantum', 2.067833848e-15],
  ['g', 'standard gravity', 9.80665], ['G₀', 'conductance qtm', 7.748091729e-5],
  ['Z₀', 'vacuum impedance', 376.730313668], ['t', 'Celsius temp.', 273.15],
  ['G', 'gravitational', 6.6743e-11], ['atm', 'standard atm.', 101325],
  ['mτ', 'tau mass', 3.16754e-27], ['mα', 'alpha mass', 6.6446573357e-27],
  ['RK', 'von Klitzing', 25812.80745], ['KJ', 'Josephson', 483597.8484e9],
];
const conv = (a, b, k) => [[a, b, (x) => x * k], [b, a, (x) => x / k]];
export const CONVS = [
  ...conv('in', 'cm', 2.54), ...conv('ft', 'm', 0.3048), ...conv('yd', 'm', 0.9144),
  ...conv('mile', 'km', 1.609344), ...conv('n mile', 'm', 1852), ...conv('acre', 'm²', 4046.8564224),
  ...conv('gal(US)', 'ℓ', 3.785411784), ...conv('gal(UK)', 'ℓ', 4.54609), ...conv('pc', 'km', 3.0856775814913673e13),
  ...conv('km/h', 'm/s', 1 / 3.6), ...conv('oz', 'g', 28.349523125), ...conv('lb', 'kg', 0.45359237),
  ...conv('atm', 'Pa', 101325), ...conv('mmHg', 'Pa', 133.322387415), ...conv('hp', 'kW', 0.745699872),
  ...conv('kgf/cm²', 'Pa', 98066.5), ...conv('kgf•m', 'J', 9.80665), ...conv('lbf/in²', 'kPa', 6.894757293168),
  ['°F', '°C', (x) => ((x - 32) * 5) / 9], ['°C', '°F', (x) => (x * 9) / 5 + 32],
  ...conv('J', 'cal', 1 / 4.1868), ...conv('eV', 'J', 1.602176634e-19), ...conv('ft•lbf', 'J', 1.3558179483314),
  ...conv('mph', 'km/h', 1.609344), ...conv('L', 'm³', 1e-3), ...conv('kWh', 'MJ', 3.6),
];

// ---------- token text ----------
const TXT = {
  '(−)': '−', EE: 'ᴇ', Ans: 'Ans', 'π': 'π', e: '<i>e</i>', i: '<i>i</i>', 'Ran#': 'Ran#', '=': '=',
  ',': ',', '(': '(', ')': ')', '.': '.', '°': '°',
  hA: 'A', hB: 'B', hC: 'C', hD: 'D', hE: 'E', hF: 'F',
};
export function tokText(t) {
  if (t in TXT) return TXT[t];
  if (t in FUNCS) return FUNCS[t];
  if (t in POSTFIX) return POSTFIX[t];
  if (t in BINOPS) return BINOPS[t];
  if (t in STATVARS) return STATVARS[t];
  if (t.startsWith('K:')) return `<span class="ks">${CONSTS[+t.slice(2)][0]}</span>`;
  if (t.startsWith('V:')) { const c = CONVS[+t.slice(2)]; return `${c[0]}▶${c[1]}`; }
  return t;
}
export const isOperatorStart = (t) =>
  t in BINOPS || t in POSTFIX || t === 'P<' || t.startsWith('V:');

// ---------- parser ----------
const isDigitTok = (t) => t !== undefined && (/^[0-9.]$/.test(t) || /^h[A-F]$/.test(t));
function startsPrimary(t) {
  if (t === undefined) return false;
  if (isDigitTok(t) || t === 'EE') return true;
  if (STRUCT[t]) return STRUCT[t].idx === 0 && STRUCT[t].name !== 'pow';
  return t === '(' || t in FUNCS || VARS.includes(t) || t === 'Ans' || t === 'π' || t === 'e' ||
    t === 'i' || t === 'Ran#' || t.startsWith('K:') || t in STATVARS || MATVEC.includes(t);
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
    while (peek() === '×' || peek() === '÷') { const op = toks[p++]; l = bin(op, l, combo()); }
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
    while (isDigitTok(peek())) s += toks[p++].replace(/^h/, '');
    if (opts.base) {
      if (s === '' || s.includes('.') || peek() === 'EE') throw err();
      for (const ch of s) if (parseInt(ch, 16) >= opts.base) throw err();
      return { t: 'num', v: parseInt(s, opts.base) | 0 };
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
    if (isDigitTok(t) || t === 'EE') return number();
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
      return { t: 'fn', f: t, args };
    }
    if (VARS.includes(t)) return { t: 'var', n: t };
    if (t === 'Ans') return { t: 'ans' };
    if (t === 'π' || t === 'e' || t === 'i' || t.startsWith('K:')) return { t: 'const', n: t };
    if (t === 'Ran#') return { t: 'rand' };
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
  if (isM(a) || isM(b) || isV(a) || isV(b)) fail('Syntax ERROR');
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
  roots = roots.map((z) => {
    let re = z.re, im = z.im;
    if (Math.abs(im) < 1e-9 * scale) {
      im = 0;
      for (let k = 0; k < 4; k++) { // Newton on the real line
        let f = 0, df = 0;
        for (const c of p) { df = df * re + f; f = f * re + c; }
        if (df) re -= f / df;
      }
    }
    return C(clean(re), clean(im));
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
  function rnd(x) {
    x = real(x);
    const s = ctx.setup;
    if (s.disp === 'fix') return +x.toFixed(s.dispN);
    if (s.disp === 'sci') return +x.toPrecision(s.dispN || 10);
    return +x.toPrecision(10);
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
    return Math.abs(v) < 1e-12 ? 0 : +v.toPrecision(12);
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
  function sigma(f, a, b) {
    if (!isInt(a) || !isInt(b) || b < a) fail();
    if (b - a > 1e6) fail('Time Out');
    let s = 0;
    for (let x = Math.round(a); x <= Math.round(b); x++) s += withX(f, x);
    return clean(s);
  }

  function fn(name, args) {
    const A = args.map((a) => ev(a, ctx));
    const need = (n) => { if (A.length !== n) fail('Syntax ERROR'); };
    if (!['Pol(', 'Rec(', 'GCD(', 'LCM(', 'RanInt#(', 'Dot(', 'Angle(', 'log('].includes(name)) need(1);
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
      case 'GCD(': case 'LCM(': {
        need(2);
        const a = real(A[0]), b = real(A[1]);
        if (!isInt(a) || !isInt(b) || Math.abs(a) >= 1e10 || Math.abs(b) >= 1e10) fail();
        const g = gcd(Math.round(a), Math.round(b));
        return name === 'GCD(' ? g : g === 0 ? 0 : Math.abs(Math.round(a) * Math.round(b)) / g;
      }
      case 'Int(': return Math.trunc(real(x));
      case 'Intg(': return Math.floor(real(x));
      case 'RanInt#(': {
        need(2);
        const a = real(A[0]), b = real(A[1]);
        if (!isInt(a) || !isInt(b) || a > b) fail();
        return Math.round(a) + Math.floor(Math.random() * (Math.round(b) - Math.round(a) + 1));
      }
      case 'Rnd(': return rnd(x);
      case 'Not(': return ~real(x) | 0;
      case 'Neg(': return -real(x) | 0;
      case 'Abs(': return absval(x);
      case 'det(': if (!isM(x)) fail('Syntax ERROR'); return mdet(x.mat);
      case 'Trn(': if (!isM(x)) fail('Syntax ERROR'); return { mat: mtrn(x.mat) };
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
      case 'arg(': { const z = toC(x); if (!isC(z)) fail('Syntax ERROR'); return clean(fromRad(Math.atan2(z.im, z.re))); }
      case 'Conjg(': { const z = toC(x); if (!isC(z)) fail('Syntax ERROR'); return simp(C(z.re, -z.im)); }
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
        return CONSTS[+n.n.slice(2)][2];
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
      case 'pow': return chk(power(ev(n.a, ctx), ev(n.b, ctx), ctx));
      case 'post': {
        const v = ev(n.a, ctx), op = n.op;
        if (op.startsWith('V:')) return chk(CONVS[+op.slice(2)][2](real(v)));
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
        }
        fail('Syntax ERROR');
      }
      case 'bin': {
        const a = ev(n.l, ctx), b = ev(n.r, ctx);
        if (base) {
          const x = real(a) | 0, y = real(b) | 0;
          switch (n.op) {
            case '+': return (x + y) | 0;
            case '-': return (x - y) | 0;
            case '×': case 'imul': return Math.imul(x, y);
            case '÷': if (y === 0) fail(); return (x / y) | 0;
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

export function toFrac(x, maxD = 99999) {
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
