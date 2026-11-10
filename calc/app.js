import * as E from './engine.js';
import * as L from './lcd.js';

const { isC, isM, isV } = E.types;
const { box } = L;
const $ = (id) => document.getElementById(id);
const cv = $('lcd'), keysEl = $('keys');
const B = new L.Buf();

// ---------------- saved state ----------------
const DEFAULTS = () => ({
  mode: 'COMP',
  setup: { io: 'math', angle: 'deg', disp: 'norm', dispN: 1, frac: 'dc', cplx: 'abi', freq: false, point: 'dot', contrast: 5 },
  vars: { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, X: 0, Y: 0, M: 0, m0: 0, m1: 0, m2: 0, m3: 0, m4: 0, m5: 0, m6: 0, m7: 0, m8: 0, m9: 0 },
  ans: 0, base: 10,
  stat: { type: 'Lin', data: [] },
  mats: { MatA: null, MatB: null, MatC: null, MatD: null, MatAns: null },
  vecs: { VctA: null, VctB: null, VctC: null, VctD: null, VctAns: null },
  eqn: { type: 0, coef: [] },
  table: { fx: [], start: 1, end: 5, step: 1 },
  hist: [],
});
let S = DEFAULTS();
try {
  const saved = JSON.parse(localStorage.getItem('sc789') || 'null');
  if (saved) S = { ...S, ...saved, setup: { ...S.setup, ...saved.setup }, vars: { ...S.vars, ...saved.vars }, mats: { ...S.mats, ...saved.mats } };
} catch { /* fresh start */ }
S.hist = (S.hist || []).filter((h) => h && Array.isArray(h.t)); // older saves kept plain token lists
const save = () => { try { localStorage.setItem('sc789', JSON.stringify(S)); } catch { /* private mode */ } };

// ---------------- runtime UI state ----------------
const ui = { shift: false, alpha: false, sto: false, rcl: false, off: false, stack: [], histIdx: null, blink: true };
const top = () => ui.stack[ui.stack.length - 1];
const push = (s) => ui.stack.push(s);
const toCalc = () => { ui.stack = [calc]; };
const LINE_MODES = ['STAT', 'MATX', 'VCTR', 'EQN'];
const isMath = () => S.setup.io === 'math' && S.mode !== 'BASE' && !LINE_MODES.includes(S.mode);
const ctx = () => ({
  angle: S.setup.angle, cplx: S.mode === 'CPLX', base: S.mode === 'BASE' ? S.base : 0,
  vars: S.vars, ans: S.ans, stat: { ...S.stat, freq: S.setup.freq }, mats: S.mats, vecs: S.vecs, setup: S.setup,
});
function realOf(v) {
  if (typeof v === 'number') return v;
  if (isC(v) && Math.abs(v.im) < 1e-12) return v.re;
  throw new E.CalcError('Math ERROR');
}
function setAns(v) {
  S.ans = v;
  if (isM(v)) S.mats.MatAns = v.mat;
  if (isV(v)) S.vecs.VctAns = v.vec;
}
const errOf = (e) => (e instanceof E.CalcError ? e.kind : (console.error(e), 'Math ERROR'));

// ---------------- expression editor ----------------
const newEd = (toks = []) => ({ toks, cur: toks.length });
function edInsert(ed, a) {
  if (ed.toks.length > 99) return;
  // Line mode: a fraction ends at the first non-digit typed after its denominator (1⌟2+1⌟3)
  if (!isMath() && (ed.toks[ed.cur] === 'F>' || ed.toks[ed.cur] === 'MX>') && !/^tok:[0-9.]$/.test(a)) ed.cur++;
  if (a.startsWith('tm:')) {
    const parts = E.TEMPLATES[a.slice(3)].parts;
    // the fraction key takes the number just typed as its numerator (2 ▭ 3 → 2/3)
    let k = ed.cur;
    if (a === 'tm:frac' || a === 'tm:nroot') while (k > 0 && /^[0-9.]$/.test(ed.toks[k - 1])) k--; // number typed just before becomes numerator / root index
    if (k < ed.cur) {
      const num = ed.toks.splice(k, ed.cur - k);
      ed.toks.splice(k, 0, parts[0], ...num, parts[1], parts[2]);
      ed.cur = k + num.length + 2;
      return;
    }
    ed.toks.splice(ed.cur, 0, ...parts);
    ed.cur++;
  } else {
    ed.toks.splice(ed.cur, 0, a.slice(4));
    ed.cur++;
  }
}
function edDel(ed) {
  if (ed.cur === 0) {
    if (ed.toks.length && !E.STRUCT[ed.toks[0]]) ed.toks.splice(0, 1);
    return;
  }
  const t = ed.toks[ed.cur - 1], st = E.STRUCT[t];
  if (st) {
    if (st.idx === 0) {
      const parts = E.findParts(ed.toks, ed.cur - 1);
      for (let k = parts.length - 1; k >= 0; k--) ed.toks.splice(parts[k], 1);
      ed.cur = parts[0];
    } else ed.cur--;
    return;
  }
  ed.toks.splice(ed.cur - 1, 1);
  ed.cur--;
}
function fracNav(ed, dir) {
  for (let i = ed.cur - 1; i >= 0; i--) {
    const st = E.STRUCT[ed.toks[i]];
    if (!st || st.idx !== 0 || !['frac', 'mixed', 'sum', 'prod', 'integ'].includes(st.name)) continue;
    const P = E.findParts(ed.toks, i);
    if (ed.cur > P[P.length - 1]) continue;
    let slot = 0;
    for (let k = 1; k < P.length; k++) if (ed.cur > P[k]) slot = k;
    if (st.name === 'frac' || st.name === 'mixed') {
      const n = P.length - 1, num = n - 2, den = n - 1;
      if (dir === 'down' && slot === num) { ed.cur = P[den] + 1; return true; }
      if (dir === 'up' && slot === den) { ed.cur = P[num] + 1; return true; }
    } else { // Σ ∏ ∫: up = upper limit, down = lower limit
      if (dir === 'up' && slot !== 2) { ed.cur = P[3]; return true; }
      if (dir === 'down' && slot !== 1) { ed.cur = P[2]; return true; }
    }
  }
  return false;
}
function editKey(ed, a) {
  if (a.startsWith('tok:') || a.startsWith('tm:')) edInsert(ed, a);
  else if (a === 'DEL') edDel(ed);
  else if (a === 'LEFT') { if (ed.cur > 0) ed.cur--; }
  else if (a === 'RIGHT') { if (ed.cur < ed.toks.length) ed.cur++; }
  else return false;
  return true;
}

// ---------------- token -> LCD boxes ----------------
const SUPS = { '²': '2', '³': '3', '⁻¹': '-1', ur: 'r', ug: 'g' };
const SHOW = {
  'f(X)=': 'f(X)=', '(−)': '−', '-': '-', EE: 'ᴇ', e: 'ℯ', i: 'ⅈ', nPr: 'ℙ', nCr: 'ℂ', 'u°': 'º', Rand: 'Rand', 'Ran#': 'Rand',
  and: 'and', or: 'or', xor: 'xor', xnor: 'xnor', '>pol': '▶r∠θ', '>rect': '▶a+bⅈ', ':': ':',
  hA: 'Ａ', hB: 'Ｂ', hC: 'Ｃ', hD: 'Ｄ', hE: 'Ｅ', hF: 'Ｆ', pd: 'd', ph: 'h', pb: 'b', po: 'o', xh: 'x̂', yh: 'ŷ', xh1: 'x̂1', xh2: 'x̂2',
};
const FXL_ROWS = L.FXL.map((r) => Array.from({ length: 29 }, (_, i) => (r >> (29 - i)) & 1)); // last column was the cursor
const MEMG = (d) => String.fromCharCode(0xe010 + +d); // underlined memory digit glyphs
function tokBoxes(t, f, out) {
  const nm = f === 'L' && L.NAMES[t];
  if (nm) { const [w, up, rows] = nm; out.push({ w: w + 1, up, dn: rows.length - 1 - up, draw(b, x, ay) { b.bits(rows, w, x, ay - up); } }); return; }
  if (/^m\d$/.test(t)) { out.push(box.text(f === 'L' ? MEMG(t[1]) : t[1], f)); return; }
  if (t.startsWith('STO:')) { const n = t.slice(4); out.push(box.text('→' + (/^m\d$/.test(n) ? MEMG(n[1]) : n), f)); return; }
  if (t === '__FXL') { out.push({ ...box.bits(FXL_ROWS, 29, 9), w: 30 }); return; }
  if (t in SUPS) { out.push(box.sup(box.text(SUPS[t], 'S'), f)); return; }
  const inv = t.match(/^a(sinh?|cosh?|tanh?)\($/);
  if (inv && f === 'L') { out.push(box.text(inv[1] + '\ue001', f)); L.textBoxes('(', f, out); return; }
  if (inv) { out.push(box.text(inv[1], f), box.sup(box.text('-1', 'S'), f)); L.textBoxes('(', f, out); return; }
  if (t.startsWith('K:')) {
    // in a calculation the emulator draws the first letter big and the rest small and low
    const sym = [...E.CONSTS[+t.slice(2)][0]];
    if (f === 'L' && /^[A-Za-z]$/.test(sym[0]) && L.hasBig(sym[0]) && sym.slice(1).every((c) => /[A-Za-z0-9]/.test(c))) {
      out.push(box.text(sym[0], 'L'));
      if (sym.length > 1) out.push(box.shift(box.text(sym.slice(1).join('').replace(/0/g, 'O'), 'S'), 1));
    } else if (f === 'L') out.push(L.constBox(+t.slice(2)));
    else out.push(box.text(sym.join(''), f));
    return;
  }
  if (t.startsWith('V:')) { // unit conversion: ft² with a raised 2, ring-shaped degree sign
    let run = '';
    for (const c of E.tokText(t).replace(/°/g, '˚')) {
      if (c === '²') { if (run) out.push(box.text(run, f)); run = ''; out.push(box.shift(box.text('2', 'S'), -2)); } else run += c; // small 2 level with the top of the letters
    }
    if (run) out.push(box.text(run, f));
    return;
  }
  if (t in E.STATVARS) {
    const s = E.STATVARS[t].replace(/x̄/g, ''), m = s.match(/^(.*?)([²³⁴]?)(y?)$/);
    if (m[2]) { out.push(box.text(m[1], f), box.sup(box.text({ '²': '2', '³': '3', '⁴': '4' }[m[2]], 'S'), f)); if (m[3]) out.push(box.text('y', f)); return; }
  }
  const s = (SHOW[t] ?? E.tokText(t).replace(/<[^>]+>/g, '')).replace(/x̄/g, '');
  L.textBoxes(s, f, out);
}
// lay out tokens s..e; math = textbook form; f = font size (L big, S small)
function lay(toks, s, e, f, cur, out, math, slot = true) {
  const items = [];
  let i = s;
  while (i < e) {
    if (cur === i) items.push(L.caret(out, f));
    const st = E.STRUCT[toks[i]];
    if (st && st.idx === 0) {
      const P = E.findParts(toks, i);
      items.push(...template(toks, st.name, P, f, cur, out, math));
      i = P[P.length - 1] + 1;
    } else { tokBoxes(toks[i], f, items); i++; }
  }
  if (cur === e) items.push(L.caret(out, f));
  if (!math) for (const it of items) if (it.paren === ')') it.dx = 1;
  if (math && slot && !items.some((b) => !b.caret)) {
    const k = items.findIndex((b) => b.caret);
    items.splice(k < 0 ? 0 : k + 1, 0, box.empty(f));
  }
  return box.row(items);
}
function template(toks, name, P, f, cur, out, math) {
  const sl = (k, ff = f) => lay(toks, P[k] + 1, P[k + 1], ff, cur, out, math);
  if (!math) {
    const lin = E.TEMPLATES[name].lin.slice(), items = [];
    if (['abs', 'sqrt', 'cbrt', 'nroot', 'ten', 'exp', 'pow'].includes(name)) lin[lin.length - 1] = '';
    L.textBoxes(lin[0], f, items);
    for (let k = 0; k < P.length - 1; k++) { items.push(sl(k)); L.textBoxes(lin[k + 1], f, items); }
    return items;
  }
  const S_ = 'S';
  switch (name) {
    case 'frac': return [box.frac(sl(0, S_), sl(1, S_))];
    case 'mixed': return [box.shift(sl(0, S_), -1), box.frac(sl(1, S_), sl(2, S_))];
    case 'sqrt': return [box.sqrt(sl(0))];
    case 'cbrt': return [box.sqrt(sl(0), box.text('3', S_))];
    case 'nroot': return [box.sqrt(sl(1), sl(0, S_))];
    case 'pow': return [box.sup(sl(0, S_), f)];
    case 'ten': return [f === 'L' ? { w: 6, up: 4, dn: 4, draw(b, x, ay) { b.bits(L.TEN, 5, x, ay - 2); } } : box.text('10', f), box.sup(sl(0, S_), f)];
    case 'exp': return [box.text('ℯ', f), box.sup(sl(0, S_), f)];
    case 'logab': return [box.text('log', f), box.sub(sl(0, S_)), box.paren('(', f), sl(1), box.paren(')', f)];
    case 'abs': return [box.abs(sl(0))];
    case 'integ': return [box.integral(sl(0), sl(1, S_), sl(2, S_), f)];
    case 'diff': {
      const at = box.row([box.text('x=', S_), sl(1, S_)]);
      const bar = { w: 3, up: 4, dn: 7, draw(b, x, ay) { b.vline(x - 1, ay - 4, ay + 7); } };
      return [box.frac(box.text('d', S_), box.text('dx', S_)), box.paren('(', f), sl(0), box.paren(')', f), bar, { ...box.shift(at, 6 - at.up), tail: true }];
    }
    case 'sum': case 'prod': {
      const lower = box.row([box.text('x=', S_), sl(1, S_)]);
      return [box.bigop(name === 'sum' ? 'Σ' : '∏', sl(2, S_), lower, f), box.paren('(', f), sl(0), box.paren(')', f)];
    }
  }
  return [];
}
function layExpr(toks, cur) {
  const out = {};
  const bx = lay(toks, 0, toks.length, 'L', cur, out, isMath(), false);
  return { bx, out };
}

// draw an expression on the top line with horizontal scrolling; returns the caret (or null)
function drawInput(b, toks, cur, y0 = 0, x0 = L.LEFT) {
  const { bx, out } = layExpr(toks, cur);
  const ay = y0 + bx.up;
  const tmp = new L.Buf();
  let scroll = 0;
  const vis = L.RIGHT - x0 + 1;
  if (bx.w > vis) {
    const probe = new L.Buf();
    bx.draw(probe, 0, ay);
    const cx = cur >= 0 ? out.x ?? bx.w : 0;
    scroll = Math.max(0, Math.min(bx.w - vis, cx - vis + 8));
    if (cx - scroll < 8) scroll = Math.max(0, cx - 8);
  }
  bx.draw(tmp, x0 - scroll, ay);
  for (let y = 0; y < L.H; y++) for (let x = x0 - 1; x <= L.RIGHT; x++) if (tmp.get(x, y)) b.set(x, y);
  if (scroll > 0) { b.fill(0, y0, 12, y0 + bx.up + bx.dn, 0); L.text(b, '⊲', 6, ay - 4); }
  if (bx.w - scroll > vis) { b.fill(96, y0, 104, y0 + bx.up + bx.dn, 0); L.text(b, '⊳', 96, ay - 4); }
  if (cur < 0 || out.x === undefined) return null;
  return { x: out.x - scroll, top: out.top, bot: out.bot };
}
function drawCaret(b, c) {
  if (!c || !ui.blink) return;
  const x = Math.max(L.LEFT - 1, c.x - 1);
  for (let y = Math.max(0, c.top); y <= Math.min(L.H - 1, c.bot); y++) { b.set(x, y); b.set(x + 1, y); }
}

// ---------------- results -> boxes ----------------
const pt = (s) => (S.setup.point === 'comma' ? s.replace('.', ',') : s);
function numBox(f, f2 = 'S') { // formatted real {m, e}
  const m = pt(f.m).replace(/^-/, '−');
  if (f.e === null) return box.text(m, 'L');
  if (f.e < 0) return box.row([box.text(m, 'L'), ...box.x10neg(String(-f.e))]);
  return box.row([box.text(m, 'L'), box.x10(), box.sup(box.text(String(f.e), f2), 'L')]);
}
let mixedNow = false; // F↔D / a b/c↔d/c state of the result being drawn
function exactBox(ef) {
  const math = isMath() || mathOut;
  const fracSet = S.setup.frac;
  S.setup.frac = mixedNow ? (fracSet === 'ab' ? 'dc' : 'ab') : fracSet;
  try { return exactBox2(ef, math); } finally { S.setup.frac = fracSet; }
}
function exactBox2(ef, math) {
  const neg = (n) => (n < 0 ? [box.text('−', 'L')] : []);
  if (!math) {
    if (ef.type === 'frac') {
      const { n, d } = ef;
      if (S.setup.frac === 'ab' && Math.abs(n) > d) return box.text(`${n < 0 ? '-' : ''}${Math.trunc(Math.abs(n) / d)}⌟${Math.abs(n) % d}⌟${d}`);
      return box.text(`${n < 0 ? '-' : ''}${Math.abs(n)}⌟${d}`);
    }
    return null;
  }
  if (ef.type === 'frac') {
    const { n, d } = ef;
    if (S.setup.frac === 'ab' && Math.abs(n) > d) {
      const w = Math.trunc(Math.abs(n) / d), r = Math.abs(n) % d;
      return box.row([...neg(n), box.shift(box.text(String(w), 'S'), -1), box.frac(box.text(String(r), 'S'), box.text(String(d), 'S'))]);
    }
    return box.row([...neg(n), box.frac(box.text(String(Math.abs(n)), 'S'), box.text(String(d), 'S'))]);
  }
  if (ef.type === 'surd2') {
    const items = [];
    ef.terms.forEach((t, i) => {
      const k = Math.abs(t.k);
      items.push(...(t.k < 0 ? [box.text(i ? '-' : '−')] : i ? [box.text('+')] : []));
      if (t.b === 1) items.push(box.text(String(k)));
      else items.push(...(k === 1 ? [] : [box.text(String(k))]), box.sqrt(box.text(String(t.b))));
    });
    return box.row(items);
  }
  if (ef.type === 'surd') {
    const sg = ef.sign < 0 ? [box.text('−')] : [];
    if (ef.d === 1) return box.row([...sg, ...(ef.a === 1 ? [] : [box.text(String(ef.a))]), box.sqrt(box.text(String(ef.b)))]);
    const nu = box.row([...(ef.a === 1 ? [] : [box.text(String(ef.a), 'S')]), box.sqrt(box.text(String(ef.b), 'S'))]);
    return box.row([...sg, box.frac(nu, box.text(String(ef.d), 'S'))]);
  }
  const n = Math.abs(ef.n);
  if (ef.d === 1) return box.row([...neg(ef.n), ...(n === 1 ? [] : [box.text(String(n)), box.gap(1)]), box.text('π')]);
  return box.row([...neg(ef.n), box.frac(box.text(String(n), 'S'), box.text(String(ef.d), 'S')), box.text('π')]);
}
function baseStr(x) {
  x |= 0;
  if (S.base === 10) return String(x).replace('-', '−');
  const s = (x >>> 0).toString(S.base).toUpperCase();
  return S.base === 16 ? L.hexBold(s.padStart(8, '0')) : s.padStart(11, '0');
}
const DMS = (s) => s.replace('−', '-').replace('°', 'º').replace('′', "'").replace('″', '"');
let mathOut = false; // EQN results use textbook form even though EQN input is Line
function realBox(x, res) {
  if (S.mode === 'BASE') return box.text(baseStr(x));
  if (res.dms) return box.text(DMS(E.fmtDMS(x)));
  if (res.eng !== null && res.eng !== undefined) return numBox(E.fmtReal(x, S.setup, res.eng));
  if (res.exact) {
    const ef = E.exactForm(x);
    if (ef && (isMath() || mathOut || ef.type === 'frac') && !(res.noSurd && ef.type.startsWith('surd'))) { const bx = exactBox(ef); if (bx) return bx; }
  }
  return numBox(E.fmtReal(x, S.setup));
}
const DEG = { deg: Math.PI / 180, rad: 1, gra: Math.PI / 200 };
function cplxBox(z, res) {
  const polar = z.form === 'polar' || (z.form !== 'rect' && S.setup.cplx === 'polar');
  const r = { ...res, eng: null, dms: false };
  if (polar) {
    const m = Math.hypot(z.re, z.im), th = +(Math.atan2(z.im, z.re) / DEG[S.setup.angle]).toPrecision(12);
    return box.row([realBox(+m.toPrecision(15), r), box.text('∠'), realBox(th, r)]);
  }
  const items = [];
  if (z.re !== 0 || z.im === 0) items.push(realBox(z.re, r));
  if (z.im !== 0) {
    if (z.im < 0) items.push(box.text('-')); else if (z.re !== 0) items.push(box.text('+'));
    const a = Math.abs(z.im);
    if (a !== 1) items.push(realBox(a, r));
    items.push(box.text('ⅈ'));
  }
  return box.row(items);
}
function pfactBox(n) {
  const items = [];
  for (let p = 2; p * p <= n && p < 1000; p += p === 2 ? 1 : 2) {
    let e = 0;
    while (n % p === 0) { n /= p; e++; }
    if (!e) continue;
    if (items.length) items.push(box.text('×'));
    items.push(box.text(String(p)));
    if (e > 1) items.push(box.sup(box.text(String(e), 'S')));
  }
  if (n > 1) { if (items.length) items.push(box.text('×')); items.push(box.text(n < 1000 ? String(n) : `(${n})`)); }
  return box.row(items);
}
const shortNum = (x) => { const f = E.fmtReal(x, S.setup); return pt(f.m) + (f.e === null ? '' : 'ᴇ' + f.e); };
function valueBox(v, res) {
  if (res.pfact && typeof v === 'number') return pfactBox(v);
  if (typeof v === 'number') {
    if (S.mode === 'CPLX' && S.setup.cplx === 'polar') return cplxBox({ re: v, im: 0 }, res);
    return realBox(v, res);
  }
  if (isC(v)) return cplxBox(v, res);
  return box.text('');
}
// result on the bottom line, right-aligned; multi-results on one line with ▶ when cut off
// BIN results: 8 digits at a time ("1111 1101") with ◀Blk n/m when the number needs more blocks
function drawBin(b, x, blk = 0) {
  const s = ((x | 0) >>> 0).toString(2).padStart(32, '0');
  const need = Math.max(1, Math.ceil(((x | 0) < 0 ? 32 : ((x | 0) >>> 0).toString(2).length) / 8));
  const k = blk % need, bits = s.slice(32 - 8 * (k + 1), 32 - 8 * k);
  if (need > 1) { b.bits(L.BLK, 25, 5, 10); L.text(b, `${k + 1}/${need}`, 32, 11); }
  L.textR(b, 'BIN', 100, 11);
  L.textR(b, bits.slice(0, 4) + ' ' + bits.slice(4), 100, 21);
  return need;
}
function drawResult(b, res) {
  if (res.multi) {
    const s = res.multi.map(([k, v]) => `${k}=${shortNum(v)}`).join(',');
    if (L.textW(s) <= 96) L.textR(b, s, 100, 21); else { L.text(b, s.slice(0, 15), 6, 21); L.text(b, '▶', 96, 21); }
    return;
  }
  if (S.mode === 'BASE' && S.base === 2 && typeof res.v === 'number') { res.blocks = drawBin(b, res.v, res.blk || 0); return; }
  if (S.mode === 'BASE') L.textR(b, { 10: 'DEC', 16: 'HEX', 2: 'BIN', 8: 'OCT' }[S.base], 100, 11);
  mixedNow = !!res.abc; mathOut = S.mode === 'EQN';
  const bx = valueBox(res.v, res);
  mixedNow = false; mathOut = false;
  if (res.more) { bx.draw(b, Math.max(L.LEFT, 96 - bx.w), 29 - bx.dn); L.text(b, '▶', 96, 21); return; }
  const ay = 29 - bx.dn;
  bx.draw(b, Math.max(L.LEFT, 102 - bx.w), ay);
}
const realOrZero = (v) => (typeof v === 'number' ? v : 0);
const mkRes = (v, o = {}) => ({ v, exact: !o.force, eng: null, dms: !!o.dms, multi: o.multi || null, more: !!o.more, noSurd: !!o.noSurd });
function modeTies() {
  const cnt = new Map();
  for (const r of S.stat.data) if (typeof r.x === 'number') cnt.set(r.x, (cnt.get(r.x) || 0) + (S.setup.freq && typeof r.f === 'number' ? r.f : 1));
  const best = Math.max(0, ...cnt.values());
  return [...cnt.values()].filter((c) => c === best).length > 1;
}

// ---------------- error screens ----------------
function errScreen(kind, onGoto) {
  return {
    menu: true, icons: () => modeIcons(),
    draw(b) {
      if (kind === 'Syntax ERROR') b.screen('synErr');
      else if (kind === "Can't Solve") b.screen('cantSolve');
      else if (kind === 'Insufficient MEM') b.screen('insMem');
      else if (kind === 'Math ERROR') b.screen('mathErr');
      else { const tmp = new L.Buf(); tmp.screen('synErr'); for (let y = 16; y < 32; y++) for (let x = 0; x < L.W; x++) if (tmp.get(x, y)) b.set(x, y); L.text(b, kind, 6, 0, 'S'); }
    },
    key(a) {
      if (a === 'AC') { ui.stack.pop(); calc.ed = newEd(); calc.res = null; return; }
      if ((a === 'LEFT' || a === 'RIGHT') && onGoto) { ui.stack.pop(); onGoto(); }
    },
  };
}
function fail(e, onGoto) { push(errScreen(errOf(e), onGoto)); }

// ---------------- main calculation screen ----------------
const calc = {
  ed: newEd(), res: null, calcRun: false, lastErrPos: null,
  draw(b) {
    const c = drawInput(b, this.ed.toks, this.res ? -1 : this.ed.cur);
    if (this.res) drawResult(b, this.res);
    else if (S.mode === 'BASE') { if (S.base === 2) drawBin(b, realOrZero(S.ans)); else { L.textR(b, { 10: 'DEC', 16: 'HEX', 2: 'BIN', 8: 'OCT' }[S.base], 100, 11); L.textR(b, baseStr(S.ans), 100, 21); } }
    else if (LINE_MODES.includes(S.mode) && S.mode !== 'EQN') L.textR(b, '0', 100, 21);
    drawCaret(b, c);
  },
  fail(e) {
    const pos = e?.pos;
    fail(e, () => { this.res = null; this.ed.cur = pos != null ? Math.min(pos, this.ed.toks.length) : this.ed.toks.length; });
  },
  key(a) {
    const R = this.res;
    if (a !== 'UP' && a !== 'DOWN') ui.histIdx = null;
    switch (a) {
      case 'AC': this.ed = newEd(); this.res = null; this.calcRun = false; return;
      case '=': return R && this.calcRun ? this.startCalc() : this.run(false);
      case 'DEL': if (R) return; edDel(this.ed); return;
      case 'LEFT': if (R) { this.res = null; this.ed.cur = this.ed.toks.length; return; } if (this.ed.cur > 0) this.ed.cur--; return;
      case 'RIGHT': if (R) { this.res = null; this.ed.cur = 0; return; } if (this.ed.cur < this.ed.toks.length) this.ed.cur++; return;
      case 'UP': case 'DOWN':
        if (!R && this.ed.toks.length && isMath() && fracNav(this.ed, a === 'UP' ? 'up' : 'down')) return;
        return this.hist(a === 'UP' ? -1 : 1);
      case 'SD':
        if (R && !R.multi) {
          if (R.dms || R.eng !== null || R.pfact) { R.dms = false; R.eng = null; R.pfact = false; }
          else R.exact = !R.exact;
        }
        return;
      case 'ABC': if (R && !R.multi) { R.exact = true; R.abc = !R.abc; } return;
      case 'DMS': if (R) { if (typeof R.v === 'number') { R.dms = !R.dms; R.eng = null; } return; } edInsert(this.ed, 'tok:°'); return;
      case 'ENG': case '<ENG':
        if (R && typeof R.v === 'number' && S.mode !== 'BASE') {
          if (R.eng === null) R.eng = E.engExp(R.v) + (a === '<ENG' ? 3 : 0);
          else R.eng += a === 'ENG' ? -3 : 3;
          R.dms = false;
        }
        return;
      case 'PFACT':
        if (!R) return;
        if (typeof R.v === 'number' && Number.isInteger(R.v) && R.v > 0 && R.v < 1e10) { R.pfact = !R.pfact; return; }
        return this.fail(new E.CalcError('Math ERROR'));
      case 'M+': case 'M-': return this.mplus(a === 'M-');
      case 'BLK': if (R && R.blocks > 1) R.blk = ((R.blk || 0) + 1) % R.blocks; return;
      case 'CALC': return this.startCalc();
      case 'SOLVE': return this.startSolve();
    }
    if (a.startsWith('base:')) { S.base = +a.slice(5); return; }
    if (a.startsWith('tok:') || a.startsWith('tm:')) return this.ins(a);
  },
  ins(a) {
    if (this.res) {
      const t = a.slice(a.startsWith('tm:') ? 3 : 4);
      const op = a === 'tm:pow' || (!a.startsWith('tm:') && E.isOperatorStart(t));
      this.ed = newEd(op ? ['Ans'] : []);
      this.res = null;
      this.calcRun = false;
    }
    edInsert(this.ed, a);
  },
  eval(toks) {
    const c = ctx();
    // ▶r∠θ / ▶a+bi end the calculation: they convert the whole expression
    const conv = { '>pol': 'polar', '>rect': 'rect' }[toks[toks.length - 1]];
    if (conv) toks = toks.slice(0, -1);
    const ast = E.parse(toks, { base: c.base });
    let v = E.evaluate(ast, c);
    if (conv) v = { ...(typeof v === 'number' ? { re: v, im: 0 } : v), form: conv };
    if (c.setVars) Object.assign(S.vars, c.setVars);
    return { v, multi: c.multi || null };
  },
  run(force) {
    if (!this.ed.toks.length) return;
    const last = this.ed.toks[this.ed.toks.length - 1];
    if (last.startsWith('STO:')) { this.ed = newEd(this.ed.toks.slice(0, -1)); this.res = null; return this.store(last.slice(4)); }
    try {
      const { v, multi } = this.eval(this.ed.toks);
      setAns(v);
      pushHist(this.ed.toks, v);
      if (isM(v) || isV(v)) { push(gridView(isM(v) ? 'MatAns' : 'VctAns')); this.res = mkRes(v); return; }
      // Line mode shows decimals unless the input itself had a fraction
      const more = this.ed.toks.includes('smode') && modeTies();
      const noSurd = ['P<', 'N<', 'T<', 'X<'].some((k) => this.ed.toks.includes(k)); // powers give decimals, not root forms
      this.res = mkRes(v, { more, noSurd, force: force || (!isMath() && !this.ed.toks.includes('F<') && !this.ed.toks.includes('MX<')), multi, dms: this.ed.toks.includes('°') });
      this.calcRun = false;
    } catch (e) { this.fail(e); }
  },
  hist(dir) {
    const H = S.hist;
    if (!H.length || S.mode !== 'COMP' && S.mode !== 'CPLX' && S.mode !== 'BASE') return;
    // replay: show an earlier calculation together with its result
    const same = (p, q) => p.join('\u0001') === q.join('\u0001');
    let i;
    if (ui.histIdx === null) {
      if (dir > 0) return;
      i = H.length - 1;
      if (this.res && same(H[i].t, this.ed.toks)) i--; // the newest one is already on screen
      if (i < 0) return;
    } else i = Math.max(0, Math.min(H.length - 1, ui.histIdx + dir));
    ui.histIdx = i;
    this.ed = newEd(H[i].t.slice());
    this.res = H[i].v === undefined ? null : mkRes(H[i].v, { noSurd: ['P<', 'N<', 'T<', 'X<'].some((k) => H[i].t.includes(k)), force: !isMath() && !H[i].t.includes('F<') });
  },
  store(n) {
    let v = S.ans;
    if (this.ed.toks.length && !this.res) {
      try { v = this.eval(this.ed.toks).v; } catch (e) { return this.fail(e); }
    }
    if (isM(v) || isV(v)) return this.fail(new E.CalcError('Syntax ERROR'));
    S.vars[n] = v;
    setAns(v);
    this.ed = newEd([...(this.ed.toks.length && !this.res ? this.ed.toks : ['Ans']), 'STO:' + n]);
    this.res = mkRes(v);
  },
  recall(n) {
    if (this.ed.toks.length && !this.res) { edInsert(this.ed, 'tok:' + n); return; }
    this.ed = newEd([n]); this.run(false);
  },
  mplus(minusOp) {
    let v = S.ans;
    const had = this.ed.toks.length && !this.res;
    if (had) {
      try { v = this.eval(this.ed.toks).v; } catch (e) { return this.fail(e); }
      pushHist(this.ed.toks);
    }
    try { v = realOf(v); } catch (e) { return this.fail(e); }
    S.vars.M = +(S.vars.M + (minusOp ? -v : v)).toPrecision(15);
    setAns(v);
    this.ed = newEd([...(had ? this.ed.toks : ['Ans']), minusOp ? 'M−' : 'M+']);
    this.res = mkRes(v);
  },
  startCalc() {
    const toks = this.ed.toks;
    if (!toks.length) return;
    let target = null, expr = toks;
    if (E.VARS.includes(toks[0]) && toks[1] === '=') { target = toks[0]; expr = toks.slice(2); }
    const vs = [...new Set(expr.filter((t) => E.VARS.includes(t)))];
    this.res = null;
    this.calcRun = true;
    askVars(vs, () => {
      try {
        const { v, multi } = this.eval(expr);
        if (target) S.vars[target] = v;
        setAns(v);
        this.res = mkRes(v, { multi });
      } catch (e) { this.fail(e); }
    });
  },
  startSolve() {
    const toks = this.ed.toks;
    if (!toks.length) return;
    let ast;
    try { ast = E.parse(toks, { allowEq: true }); } catch (e) { return this.fail(e); }
    const f = ast.t === 'eq' ? { t: 'bin', op: '-', l: ast.l, r: ast.r } : ast;
    const all = [...new Set(toks.filter((t) => E.VARS.includes(t)))];
    const sv = all.includes('X') ? 'X' : all[0];
    if (!sv) return this.fail(new E.CalcError('Variable ERROR'));
    this.res = null;
    this.calcRun = false;
    pushHist(toks);
    askVars(all.filter((v) => v !== sv), () => {
      push(promptScreen({
        label: `Solve for ${sv}`, value: S.vars[sv],
        onValue: (x0) => {
          toCalc();
          try {
            const F = (x) => { const c = ctx(); c.vars = { ...S.vars, [sv]: x }; return realOf(E.evaluate(f, c)); };
            const r = E.solveFor(F, realOf(x0));
            S.vars[sv] = r.x;
            setAns(r.x);
            push(solveView(toks, sv, r.x, Math.abs(r.lr) < 1e-13 ? 0 : +r.lr.toPrecision(10)));
          } catch (e) { this.fail(e); }
        },
        onAC: () => { toCalc(); calc.ed = newEd(); },
      }));
    });
  },
};
function pushHist(toks, v) {
  const last = S.hist[S.hist.length - 1];
  const keep = typeof v === 'number' || isC(v) ? v : undefined;
  if (last && last.t.join('\u0001') === toks.join('\u0001')) { last.v = keep; return; }
  S.hist.push({ t: toks.slice(), v: keep });
  if (S.hist.length > 30) S.hist.shift();
}
function solveView(toks, sv, x, lr) {
  return {
    draw(b) {
      const { bx } = layExpr(toks, -1);
      drawInput(b, toks, -1, Math.min(0, 10 - (bx.up + bx.dn + 1))); // the equation must end above the X= line
      L.text(b, `${sv}=`, 6, 11); L.textR(b, shortNum(x), 100, 11);
      L.text(b, 'L-R=', 6, 21); L.textR(b, shortNum(lr), 100, 21);
    },
    key(a) {
      toCalc();
      if (a === '=') return calc.startSolve();
      if (a === 'AC') { calc.ed = newEd(); return; }
      // ◀ / ▶ go back to the equation with the cursor at its end / start
      if (a === 'LEFT') { calc.ed.cur = calc.ed.toks.length; return; }
      if (a === 'RIGHT') { calc.ed.cur = 0; return; }
      calc.key(a);
    },
  };
}

// ---------------- prompts ("B?", "Start?") ----------------
function promptScreen(o) {
  const ed = newEd();
  return {
    ed, isAsk: o.isAsk,
    draw(b) {
      L.text(b, o.label, 6, 0);
      if (ed.toks.length) drawCaret(b, drawInput(b, ed.toks, ed.cur, 11));
      else if (typeof o.value === 'number') L.textR(b, shortNum(+o.value.toPrecision(10)), 100, 21);
    },
    key(a) {
      if (a === 'AC') { if (ed.toks.length) { ed.toks = []; ed.cur = 0; } else (o.onAC || (() => ui.stack.pop()))(); return; }
      if (a === '=') {
        if (!ed.toks.length) { if (o.value !== undefined) o.onValue(o.value); return; }
        try { o.onValue(E.evaluate(E.parse(ed.toks, { base: ctx().base }), ctx())); } catch (e) { fail(e); }
        return;
      }
      editKey(ed, a);
    },
  };
}
function askVars(vs, done) {
  let i = 0;
  const next = () => {
    if (top() !== calc && top().isAsk) ui.stack.pop();
    if (i >= vs.length) { done(); return; }
    const n = vs[i++];
    push(promptScreen({ label: `${n}?`, value: S.vars[n], isAsk: true, onValue: (v) => { S.vars[n] = v; next(); }, onAC: toCalc }));
  };
  next();
}

// ---------------- menus (fixed screens copied from the emulator) ----------------
// pages: [{ scr, items: {1: fn, ...} }]
function menu(pages, o = {}) {
  let page = 0;
  return {
    menu: true, id: o.id,
    icons: () => (pages.length > 1 ? [page === 0 ? 'down' : 'up'] : []),
    draw(b) { b.screen(pages[page].scr); },
    key(a) {
      if (a === 'AC') { (o.onAC || (() => ui.stack.pop()))(); return; }
      if (pages.length > 1 && (a === 'DOWN' || a === 'UP')) { page = a === 'DOWN' ? Math.min(pages.length - 1, page + 1) : Math.max(0, page - 1); return; }
      const m = a.match(/^tok:([1-9])$/);
      if (m) { const fn = pages[page].items[m[1]]; if (fn) fn(); }
    },
  };
}
const closeMenus = () => { while (ui.stack.length > 1 && top().menu) ui.stack.pop(); };
const ins = (a) => () => { closeMenus(); top().key(a); };
const done = (f) => () => { f(); closeMenus(); };
function message(scr, onKey) { return { menu: true, icons: () => [], draw(b) { b.screen(scr); }, key: onKey }; }
function confirm(scr, yes) {
  return message(scr, (a) => { if (a === 'AC') ui.stack.pop(); else if (a === '=') { yes(); toCalc(); push(message('complete', (k) => { if (k === 'AC') toCalc(); })); } });
}

const modeMenu = () => menu([{ scr: 'mode', items: { 1: () => setMode('COMP'), 2: () => setMode('CPLX'), 3: () => setMode('STAT'), 4: () => setMode('BASE'), 5: () => setMode('EQN'), 6: () => setMode('TABLE'), 7: () => setMode('MATX'), 8: () => setMode('VCTR') } }], { id: 'mode' });
function digitPrompt(scr, lo, hi, cb) {
  return message(scr, (a) => {
    if (a === 'AC') { ui.stack.pop(); return; }
    const m = a.match(/^tok:(\d)$/);
    if (m && +m[1] >= lo && +m[1] <= hi) { cb(+m[1]); closeMenus(); }
  });
}
function choice(scr, opts) { // two-option sub-menu
  return { ...message(scr, (a) => { if (a === 'AC') ui.stack.pop(); const m = a.match(/^tok:([12])$/); if (m) { opts[m[1]](); closeMenus(); } }) };
}
function contrastScreen() {
  return message('contrast', (a) => {
    if (a === 'LEFT') S.setup.contrast = Math.max(0, S.setup.contrast - 1);
    else if (a === 'RIGHT') S.setup.contrast = Math.min(9, S.setup.contrast + 1);
    else if (a === 'AC' || a === '=') closeMenus();
  });
}
function setupMenu() {
  const st = S.setup;
  const reset = () => { calc.res = null; S.hist = []; };
  return menu([
    { scr: 'setup1', items: {
      1: done(() => { st.io = 'math'; reset(); }), 2: done(() => { st.io = 'line'; reset(); }),
      3: done(() => (st.angle = 'deg')), 4: done(() => (st.angle = 'rad')), 5: done(() => (st.angle = 'gra')),
      6: () => push(digitPrompt('fix', 0, 9, (n) => { st.disp = 'fix'; st.dispN = n; })),
      7: () => push(digitPrompt('sci', 0, 9, (n) => { st.disp = 'sci'; st.dispN = n; })),
      8: () => push(digitPrompt('norm', 1, 2, (n) => { st.disp = 'norm'; st.dispN = n; })),
    } },
    { scr: 'setup2', items: {
      1: done(() => (st.frac = 'ab')), 2: done(() => (st.frac = 'dc')),
      3: () => push(choice('cplxSet', { 1: () => (st.cplx = 'abi'), 2: () => (st.cplx = 'polar') })),
      4: () => push(choice('freqSet', { 1: () => (st.freq = true), 2: () => (st.freq = false) })),
      5: () => push(choice('dispSet', { 1: () => (st.point = 'dot'), 2: () => (st.point = 'comma') })),
      6: () => push(contrastScreen()),
    } },
  ], { id: 'setup' });
}
function clrMenu() {
  return menu([{ scr: 'clr', items: {
    1: () => push(confirm('clrSetup', () => { S.setup = { ...DEFAULTS().setup, contrast: S.setup.contrast }; })),
    2: () => push(confirm('clrMem', () => { S.vars = DEFAULTS().vars; S.ans = 0; })),
    3: () => push(confirm('clrAll', () => { S = DEFAULTS(); calc.ed = newEd(); calc.res = null; buildKeys(); })),
  } }]);
}
const hypMenu = () => menu([{ scr: 'hyp', items: { 1: ins('tok:sinh('), 2: ins('tok:cosh('), 3: ins('tok:tanh('), 4: ins('tok:asinh('), 5: ins('tok:acosh('), 6: ins('tok:atanh(') } }]);
const drgMenu = () => menu([{ scr: 'drg', items: { 1: ins('tok:u°'), 2: ins('tok:ur'), 3: ins('tok:ug') } }]);

function appsMenu() {
  switch (S.mode) {
    case 'CPLX': return menu([{ scr: 'apps_CPLX', items: { 1: ins('tok:>pol'), 2: ins('tok:>rect'), 3: ins('tok:Arg('), 4: ins('tok:Conjg('), 5: ins('tok:Real('), 6: ins('tok:Imag(') } }], { id: 'apps' });
    case 'BASE': return menu([
      { scr: 'apps_BASE1', items: { 1: ins('tok:and'), 2: ins('tok:or'), 3: ins('tok:xor'), 4: ins('tok:xnor'), 5: ins('tok:Not('), 6: ins('tok:Neg(') } },
      { scr: 'apps_BASE2', items: { 1: ins('tok:pd'), 2: ins('tok:ph'), 3: ins('tok:pb'), 4: ins('tok:po') } },
    ], { id: 'apps' });
    case 'STAT': return statMenu();
    case 'MATX': return menu([
      { scr: 'apps_MATX1', items: { 1: () => push(pickMat((n) => matDim(n))), 2: () => push(pickMat((n) => (S.mats[n] ? (toCalc(), push(gridEdit(n))) : matDim(n)))),
        3: ins('tok:MatA'), 4: ins('tok:MatB'), 5: ins('tok:MatC'), 6: ins('tok:MatD'), 7: ins('tok:MatAns') } },
      { scr: 'apps_MATX2', items: { 1: ins('tok:Det('), 2: ins('tok:Trn('), 3: ins('tok:Ide('), 4: ins('tok:Adj('), 5: ins('tok:Inv(') } },
    ], { id: 'apps' });
    case 'VCTR': return menu([{ scr: 'apps_VCTR', items: { 1: () => push(pickVec((n) => vecDim(n))), 2: () => push(pickVec((n) => (S.vecs[n] ? (toCalc(), push(gridEdit(n))) : vecDim(n)))),
      3: ins('tok:VctA'), 4: ins('tok:VctB'), 5: ins('tok:VctC'), 6: ins('tok:VctD'), 7: ins('tok:VctAns'), 8: ins('tok:▪') } }], { id: 'apps' });
    default: return menu([{ scr: 'apps_COMP', items: { 1: ins('tm:prod'), 2: ins('tm:sum'), 3: ins('tok:Max('), 4: ins('tok:Min('), 5: ins('tok:Q…r('), 6: ins('tok:Mod('), 7: ins('tok:LCM('), 8: ins('tok:GCD(') } }], { id: 'apps' });
  }
}
function editAppsMenu() {
  const mat = S.mode === 'MATX', pick = mat ? pickMat : pickVec, dim = mat ? matDim : vecDim, store = mat ? S.mats : S.vecs;
  return menu([{ scr: 'appsEdit', items: { 1: () => push(pick((n) => dim(n))), 2: () => push(pick((n) => (store[n] ? (toCalc(), push(gridEdit(n))) : dim(n)))) } }], { id: 'apps' });
}
function statMenu() {
  const sd = S.stat.type === 'SD', quad = S.stat.type === 'Quad';
  const v = (t) => ins('tok:' + t);
  const items = {
    1: () => { toCalc(); push(statTypeMenu()); },
    2: () => { toCalc(); push(statEditor()); },
    3: () => push(menu([{ scr: 'statEdit', items: { 1: () => { let g = ui.stack.find((x) => x.grid); closeMenus(); if (!g) { toCalc(); g = statEditor(); push(g); } g.insertRow(); }, 2: () => { S.stat.data = []; toCalc(); push(statEditor()); } } }])),
    4: () => push(menu([{ scr: sd ? 'sum_SD' : 'sum', items: sd ? { 1: v('Sx2'), 2: v('Sx') } : { 1: v('Sx2'), 2: v('Sx'), 3: v('Sy2'), 4: v('Sy'), 5: v('Sxy'), 6: v('Sx3'), 7: v('Sx2y'), 8: v('Sx4') } }])),
    5: () => push(menu([{ scr: sd ? 'var_SD' : 'var', items: sd ? { 1: v('n'), 2: v('mx'), 3: v('sgx'), 4: v('ssx') } : { 1: v('n'), 2: v('mx'), 3: v('sgx'), 4: v('ssx'), 5: v('my'), 6: v('sgy'), 7: v('ssy') } }])),
    6: () => push(menu([{ scr: sd ? 'pts_SD' : 'pts', items: { 1: v('minX'), 2: v('maxX'), ...(sd ? { 3: v('med'), 4: v('smode'), 5: v('sQ1'), 6: v('sQ3'), 7: v('sR') } : { 3: v('minY'), 4: v('maxY') }) } }])),
    7: () => push(menu([{ scr: 'distr', items: { 1: v('P('), 2: v('Q('), 3: v('R('), 4: v('tt') } }])),
  };
  if (!sd) items[8] = () => push(menu([{ scr: quad ? 'reg_Quad' : 'reg', items: quad ? { 1: v('sA'), 2: v('sB'), 3: v('sC'), 4: v('xh1'), 5: v('xh2'), 6: v('yh') } : { 1: v('sA'), 2: v('sB'), 3: v('r'), 4: v('xh'), 5: v('yh') } }]));
  return menu([{ scr: sd ? 'apps_STAT_SD' : 'apps_STAT', items }], { id: 'apps' });
}
const pickMat = (cb) => menu([{ scr: 'matPick', items: { 1: () => cb('MatA'), 2: () => cb('MatB'), 3: () => cb('MatC'), 4: () => cb('MatD') } }]);
const pickVec = (cb) => menu([{ scr: 'vecPick', items: { 1: () => cb('VctA'), 2: () => cb('VctB'), 3: () => cb('VctC'), 4: () => cb('VctD') } }]);

// "MatA(m×n) m×n?" — 4 pages of sizes, drawn with the small font
function matDim(n) {
  let page = 0;
  push({
    menu: true, icons: () => [page === 0 ? 'down' : page === 3 ? 'up' : 'updown'],
    draw(b) {
      const m = 4 - page;
      L.text(b, `${n}(m×n) m×n?`, 6, 0, 'S');
      for (let k = 0; k < 4; k++) L.text(b, `${k + 1}:${m}×${4 - k}`, 6 + (k % 2) * 48, 8 + 8 * Math.floor(k / 2), 'S');
    },
    key(a) {
      if (a === 'AC') { ui.stack.pop(); return; }
      if (a === 'DOWN') page = Math.min(3, page + 1); else if (a === 'UP') page = Math.max(0, page - 1);
      const k = a.match(/^tok:([1-4])$/);
      if (k) { const rows = 4 - page, cols = 5 - +k[1]; S.mats[n] = Array.from({ length: rows }, () => Array(cols).fill(0)); toCalc(); push(gridEdit(n)); }
    },
  });
}
function vecDim(n) {
  push({
    menu: true, icons: () => [],
    draw(b) { L.text(b, `${n}(m) m?`, 6, 0, 'S'); L.text(b, '1:3', 6, 8, 'S'); L.text(b, '2:2', 54, 8, 'S'); },
    key(a) {
      if (a === 'AC') { ui.stack.pop(); return; }
      const k = a.match(/^tok:([12])$/);
      if (k) { S.vecs[n] = Array(k[1] === '1' ? 3 : 2).fill(0); toCalc(); push(gridEdit(n)); }
    },
  });
}

// ---------------- CONVT and C-VALUE pickers ----------------
function convPicker() {
  let cat = 0, sel = 0, src = null;
  const units = () => E.CONV_CATS[cat].units.length;
  const input = calc.res ? ['Ans'] : calc.ed.toks.slice();
  const val = () => { try { return realOf(calc.eval(input.length ? input : ['Ans']).v); } catch { return null; } };
  return {
    menu: true, icons: () => (src == null ? ['updown'] : modeIcons()),
    draw(b) {
      L.drawUnitPage(b, cat, sel, src);
      if (src != null) {
        const x = val();
        if (x === null) L.textR(b, 'ERROR', 100, 21);
        else { const y = E.convert(x, cat, src, sel); L.textR(b, isFinite(y) ? shortNum(+y.toPrecision(10)) : 'ERROR', 100, 21); }
      }
    },
    key(a) {
      if (a === 'AC') { ui.stack.pop(); return; }
      if (a === 'RIGHT') sel = (sel + 1) % units();
      else if (a === 'LEFT') sel = (sel + units() - 1) % units();
      else if ((a === 'DOWN' || a === 'UP') && src == null) { cat = (cat + (a === 'DOWN' ? 1 : 7)) % 8; sel = 0; }
      else if (a === '=') {
        if (src == null) { src = sel; return; }
        if (sel === src) return;
        ui.stack.pop();
        if (calc.res) { calc.ed = newEd(['Ans']); calc.res = null; }
        calc.ed.toks.splice(calc.ed.cur, 0, `V:${cat}:${src}:${sel}`); calc.ed.cur++;
      }
    },
  };
}
function constPicker() {
  let page = 0, sel = null, num = '';
  return {
    menu: true, icons: () => modeIcons().concat(['updown']),
    draw(b) {
      L.drawConstPage(b, page, sel, num ? num.padEnd(2, '_').replace('_', '') : sel != null ? String(L.KP.slice(0, page).reduce((s, p) => s + p.items.length, 0) + sel + 1).padStart(2, '0') : null);
      if (sel != null) { const i = L.KP.slice(0, page).reduce((s, p) => s + p.items.length, 0) + sel; const bx = numBox(E.fmtReal(E.CONSTS[i][1], S.setup)); bx.draw(b, 102 - bx.w, 29 - bx.dn); }
    },
    key(a) {
      const n = L.KP[page].items.length;
      if (a === 'AC') { ui.stack.pop(); return; }
      if (a === 'DOWN' || a === 'UP') { page = (page + (a === 'DOWN' ? 1 : 16)) % 17; sel = null; num = ''; return; }
      if (a === 'RIGHT') { if (sel == null) sel = 0; else if (sel < n - 1) sel++; else { page = (page + 1) % 17; sel = 0; } num = ''; return; }
      if (a === 'LEFT') { if (sel == null || sel === 0) { page = (page + 16) % 17; sel = L.KP[page].items.length - 1; } else sel--; num = ''; return; }
      const d = a.match(/^tok:(\d)$/);
      if (d && sel == null) { num = (num + d[1]).slice(-2); return; }
      if (a === '=') {
        let i;
        if (sel != null) i = L.KP.slice(0, page).reduce((s, p) => s + p.items.length, 0) + sel;
        else if (num && +num >= 1 && +num <= 79) i = +num - 1;
        else return;
        ui.stack.pop();
        calc.ins(`tok:K:${i}`);
      }
    },
  };
}

// ---------------- grids: STAT data, EQN, MATRIX, VECTOR, TABLE ----------------
const cellStr = (x) => {
  if (typeof x !== 'number') return '';
  if (x === 0) return '0';
  const f = E.fmtReal(x, { disp: 'norm', dispN: 1 });
  let s = f.m + (f.e === null ? '' : 'E' + f.e);
  // cells cut long values off (3.666666 shows 3.6666), they do not round
  if (s.length > 6) s = f.e === null ? s.slice(0, 6).replace(/\.$/, '') : (+f.m).toPrecision(2) + 'E' + f.e;
  return s;
};
// style: 'stat' | 'table' | 'eqn' | 'mat'
function gridScreen(cfg) {
  const ed = newEd();
  let r = 0, c = 0, topRow = 0, left = 0;
  const VIS = 3;
  return {
    ed, grid: true, icons: () => modeIcons(),
    home() { r = c = topRow = left = 0; },
    insertRow() { cfg.ins?.(r); },
    draw(b) {
      const n = cfg.nrows(), cols = cfg.cols();
      r = Math.min(r, n - 1); c = Math.min(c, cols.length - 1);
      if (r < topRow) topRow = r; if (r >= topRow + VIS) topRow = r - VIS + 1;
      if (c < left) left = c; if (c >= left + 3) left = c - 2;
      const st = cfg.style, nv = Math.min(3, cols.length - left);
      const y0 = st === 'mat' ? 6 : 6;
      if (cfg.title) L.text(b, cfg.title, 7, 0, 'F4');
      // separators / brackets
      if (st === 'stat' || st === 'table') {
        b.vline(15, 0, 22);
        for (let j = 0; j < nv; j++) b.vline(43 + 28 * j, 0, 22);
      } else {
        const bot = y0 + 6 * Math.min(VIS, n - topRow) - 2;
        const lastVis = topRow + VIS >= n;
        b.vline(15, 5, bot); if (left === 0) { b.set(16, 5); if (lastVis) b.set(16, bot); }
        const xr = 15 + 28 * nv;
        if (left + nv >= cols.length) { const rx = Math.min(99, xr); b.vline(rx, 5, bot); b.set(rx - 1, 5); if (lastVis) b.set(rx - 1, bot); }
      }
      for (let j = 0; j < nv; j++) {
        const lab = cols[left + j];
        if (!lab) continue;
        const cx = 27 + 28 * j;
        if (lab === 'F(X)') { b.bits(L.FXH, 18, 47, 0); continue; }
        if (lab === 'FREQ') { b.bits(L.FQH, 18, 47 + 28 * (j - 1), 0); continue; }
        if (st === 'eqn') { const h = L.EQH[lab]; if (h) b.bits(h[1], h[2], 26 + 28 * j, 0); else L.text(b, lab, 26 + 28 * j, -1, 'S'); } else if (st !== 'mat') L.text(b, lab, cx - Math.floor((lab.length * 4 - 1) / 2), 0, 'T');
      }
      if (st === 'stat') for (let k = 0; k < VIS; k++) L.textR(b, String(topRow + k + 1), 13, y0 + 6 * k, 'T');
      for (let i = topRow; i < Math.min(n, topRow + VIS); i++) {
        const y = y0 + 6 * (i - topRow);
        if (st !== 'mat' && st !== 'stat' && !(st === 'eqn' && n === 1)) L.textR(b, String(i + 1), 13, y, 'T');
        for (let j = 0; j < nv; j++) {
          const val = cfg.get(i, left + j), xr = 40 + 28 * j;
          if (val === null && st === 'table') { b.bits(L.TERR, 19, xr - 18, y); if (i === r && left + j === c) b.invert(17 + 28 * j, y - 1, 40 + 28 * j, y + 4); continue; }
          const s = cellStr(val);
          L.text(b, s, xr - s.length * 4 + 2, y, 'T');
          if (i === r && left + j === c) b.invert(17 + 28 * j, y - 1, 40 + 28 * j, y + 4);
        }
      }
      if (ed.toks.length) drawCaret(b, drawInput(b, ed.toks, ed.cur, 23));
      else {
        const v = cfg.get(r, c), ef = st === 'mat' && typeof v === 'number' ? E.exactForm(v) : null;
        if (ef && ef.type === 'frac') L.textR(b, `${ef.n < 0 ? '−' : ''}${Math.abs(ef.n)}⌟${ef.d}`, 100, 24, 'S');
        else if (typeof v === 'number') L.textR(b, shortNum(v).replace(/^-/, '−'), 100, 24, 'S');
      }
    },
    key(a) {
      if (a === 'AC') {
        if (ed.toks.length) { ed.toks = []; ed.cur = 0; return; }
        if (cfg.onAC) { if (cfg.onAC() === 'home') r = c = topRow = left = 0; } else toCalc();
        return;
      }
      if (cfg.readonly) { if (['UP', 'DOWN', 'LEFT', 'RIGHT'].includes(a)) this.move(a); return; }
      if (a === '=') {
        if (!ed.toks.length) { cfg.onEmptyEq?.(); return; }
        try {
          cfg.set(r, c, realOf(E.evaluate(E.parse(ed.toks, {}), ctx())));
          ed.toks = []; ed.cur = 0;
          if (cfg.down) r = Math.min(r + 1, cfg.nrows() - 1);
          else if (c < cfg.cols().length - 1) c++;
          else if (r < cfg.nrows() - 1) { c = 0; r++; }
        } catch (e) { fail(e); }
        return;
      }
      if (!ed.toks.length) {
        if (['UP', 'DOWN', 'LEFT', 'RIGHT'].includes(a)) { this.move(a); return; }
        if (a === 'DEL' && cfg.del) { cfg.del(r); return; }
      }
      editKey(ed, a);
    },
    move(a) {
      if (a === 'UP') r = Math.max(0, r - 1);
      else if (a === 'DOWN') r = Math.min(cfg.nrows() - 1, r + 1);
      else if (a === 'LEFT') c = Math.max(0, c - 1);
      else c = Math.min(cfg.cols().length - 1, c + 1);
    },
  };
}
const statTypeMenu = () => menu([{ scr: 'statType', items: Object.fromEntries(E.STAT_TYPES.map(([t], i) => [i + 1, () => { S.stat.type = t; S.stat.data = []; toCalc(); push(statEditor()); }])) }]);
function statEditor() {
  const keys = () => ['x', ...(S.stat.type !== 'SD' ? ['y'] : []), ...(S.setup.freq ? ['f'] : [])];
  return gridScreen({
    style: 'stat', down: true,
    cols: () => keys().map((k) => ({ x: 'X', y: 'Y', f: 'FREQ' }[k])),
    nrows: () => Math.min(S.stat.data.length + 1, 40),
    get: (r, c) => S.stat.data[r]?.[keys()[c]],
    set: (r, c, v) => { if (r >= S.stat.data.length) S.stat.data.push({ f: 1 }); S.stat.data[r][keys()[c]] = v; },
    del: (r) => { if (r < S.stat.data.length) S.stat.data.splice(r, 1); },
    ins: (r) => { S.stat.data.splice(Math.min(r, S.stat.data.length), 0, { x: 0, ...(S.stat.type !== 'SD' ? { y: 0 } : {}), f: 1 }); },
  });
}
const EQN_TYPES = [
  { rows: 2, cols: ['a', 'b', 'c'] }, { rows: 3, cols: ['a', 'b', 'c', 'd'] }, { rows: 4, cols: ['a', 'b', 'c', 'd', 'e'] },
  { rows: 1, cols: ['a', 'b', 'c'] }, { rows: 1, cols: ['a', 'b', 'c', 'd'] }, { rows: 1, cols: ['a', 'b', 'c', 'd', 'e'] },
];
const eqnPick = (i) => () => {
  const t = EQN_TYPES[i];
  S.eqn.type = i;
  if (S.eqn.coef.length !== t.rows || S.eqn.coef[0]?.length !== t.cols.length) S.eqn.coef = Array.from({ length: t.rows }, () => Array(t.cols.length).fill(0));
  toCalc(); push(eqnEditor());
};
const eqnTypeMenu = () => menu([{ scr: 'eqn1', items: { 1: eqnPick(0), 2: eqnPick(1), 3: eqnPick(2) } }, { scr: 'eqn2', items: { 1: eqnPick(3), 2: eqnPick(4), 3: eqnPick(5) } }]);
function eqnEditor() {
  const t = EQN_TYPES[S.eqn.type];
  return gridScreen({
    style: 'eqn', cols: () => t.cols, nrows: () => t.rows,
    get: (r, c) => S.eqn.coef[r][c], set: (r, c, v) => (S.eqn.coef[r][c] = v),
    onEmptyEq: () => { const res = eqnSolve(); if (typeof res === 'string') fail(new E.CalcError(res)); else push(eqnResult(res)); },
    onAC: () => { S.eqn.coef = S.eqn.coef.map((row) => row.map(() => 0)); return 'home'; },
  });
}
function eqnSolve() {
  const A = S.eqn.coef;
  try {
    if (S.eqn.type < 3) {
      const r = E.solveLinear(A);
      if (r.kind === 'none' || r.kind === 'inf') return 'Math ERROR';
      return r.x.map((v, k) => [(S.eqn.type === 2 ? ['W', 'X', 'Y', 'Z'] : ['X', 'Y', 'Z'])[k], v]);
    }
    if (A[0][0] === 0) return 'Math ERROR';
    let roots = E.polyRoots(A[0].slice()).map((z) => (Math.abs(z.im) <= 1e-7 * Math.max(1, Math.abs(z.re)) ? z.re : z));
    const near = (p, q) => Math.abs(p - q) <= 1e-9 * Math.max(1, Math.abs(p));
    if (roots.length === 1) return [['X', roots[0]]];
    if (roots.length === 2 && typeof roots[0] === 'number' && typeof roots[1] === 'number' && near(roots[0], roots[1])) return [['X', roots[0]]];
    if (roots.length === 4) { // quartic: real roots ascending, then complex ones by imaginary then real part, largest first
      const re = roots.filter((z) => typeof z === 'number').sort((p, q) => p - q);
      const cx = roots.filter((z) => typeof z !== 'number').sort((p, q) => (near(q.im, p.im) ? q.re - p.re : q.im - p.im));
      roots = [...re, ...cx];
    }
    return roots.map((z, k) => [`X${k + 1}`, z]);
  } catch (e) { return errOf(e); }
}
function eqnResult(list) {
  let i = 0;
  const res = { exact: true, eng: null, dms: false };
  return {
    icons: () => modeIcons().concat(list.length > 1 ? [i === 0 ? 'down' : i === list.length - 1 ? 'up' : 'updown'] : []),
    draw(b) {
      const [lab, v] = list[i];
      const m = lab.match(/^([A-Z])(\d?)$/);
      L.text(b, m[1], 6, 0);
      let x = 12;
      if (m[2]) { L.text(b, m[2], 12, 3, 'S'); x = 18; }
      L.text(b, '=', x, 0);
      drawResult(b, { ...res, v });
    },
    key(a) {
      if (a === '=' || a === 'DOWN') { if (i < list.length - 1) i++; else if (a === '=') { ui.stack.pop(); top().home?.(); } return; }
      if (a === 'UP') { if (i > 0) i--; return; }
      if (a === 'AC') { ui.stack.pop(); top().home?.(); return; }
      if (a === 'SD') res.exact = !res.exact;
    },
  };
}
function gridEdit(n) {
  const isMat = n.startsWith('Mat');
  const get = () => (isMat ? S.mats[n] : S.vecs[n]);
  const m = get();
  const rows = isMat ? m.length : 1, cols = isMat ? m[0].length : m.length;
  return gridScreen({
    style: 'mat', title: `${n}:${isMat ? `${rows}X${cols}` : cols}`,
    cols: () => Array(cols).fill(''), nrows: () => rows,
    get: (r, c) => (isMat ? get()[r][c] : get()[c]),
    set: (r, c, v) => { if (isMat) get()[r][c] = v; else get()[c] = v; },
    readonly: n.endsWith('Ans'),
  });
}
const gridView = (n) => gridEdit(n);

// TABLE
function tableFx() {
  const ed = newEd(S.table.fx.slice());
  return {
    ed, isFx: true,
    draw(b) { drawCaret(b, drawInput(b, ['__FXL', ...ed.toks], ed.cur + 1)); },
    key(a) {
      if (a === 'AC') { ed.toks = []; ed.cur = 0; return; }
      if (a === '=') {
        if (!ed.toks.length) return;
        try { E.parse(ed.toks); } catch (e) { fail(e); return; }
        S.table.fx = ed.toks.slice();
        const T = S.table;
        const p3 = () => promptScreen({ label: 'Step?', value: T.step, onValue: (v) => { T.step = realOf(v); ui.stack.pop(); push(tableView()); } });
        const p2 = () => promptScreen({ label: 'End?', value: T.end, onValue: (v) => { T.end = realOf(v); ui.stack.pop(); push(p3()); } });
        push(promptScreen({ label: 'Start?', value: T.start, onValue: (v) => { T.start = realOf(v); ui.stack.pop(); push(p2()); } }));
        return;
      }
      if (a === 'UP' || a === 'DOWN') return;
      editKey(ed, a);
    },
  };
}
function tableView() {
  const { start, end, step, fx } = S.table;
  const n = step > 0 ? Math.floor((end - start) / step + 1e-9) + 1 : 0;
  if (n < 1 || n > 30) return errScreen('Insufficient MEM', () => ui.stack.pop());
  const ast = E.parse(fx);
  const rows = Array.from({ length: n }, (_, i) => {
    const x = +(start + i * step).toPrecision(12);
    try { const c = ctx(); c.vars = { ...S.vars, X: x }; return [x, realOf(E.evaluate(ast, c))]; } catch { return [x, null]; }
  });
  const g = gridScreen({
    style: 'table', cols: () => ['X', 'F(X)'], nrows: () => n, get: (r, c) => rows[r][c],
    set() {}, onAC: () => { ui.stack.pop(); if (top().isFx) top().ed.cur = 0; },
  });
  const key = g.key.bind(g);
  g.key = (a) => { if (['UP', 'DOWN', 'LEFT', 'RIGHT'].includes(a)) g.move(a); else if (a === 'AC') { ui.stack.pop(); if (top().isFx) top().ed.cur = 0; } else void key; };
  return g;
}

// ---------------- modes ----------------
function setMode(m) {
  S.mode = m;
  calc.ed = newEd(); calc.res = null;
  S.hist = [];
  toCalc();
  buildKeys();
  enterMode(true);
}
function enterMode(fresh) {
  if (S.mode === 'STAT') push(fresh ? statTypeMenu() : statEditor());
  if (S.mode === 'EQN') push(fresh ? eqnTypeMenu() : eqnEditor());
  if (S.mode === 'TABLE') push(tableFx());
  if (S.mode === 'MATX' && fresh) push(pickMat((n) => matDim(n)));
  if (S.mode === 'VCTR' && fresh) push(pickVec((n) => vecDim(n)));
}

// ---------------- keypad ----------------
// Layout and labels follow the real F-789SGA: gold = SHIFT, blue = ALPHA, green = BASE-N mode.
const sup = (s) => `<span class="sup">${s}</span>`;
const X = '<i class="x">x</i>';
const FRAC_ICON = '<span class="fr kfr"><span class="nu">□</span><span class="de">□</span></span>';
const K = {
  shift: { lbl: '', cls: 'dk', main: 'SHIFT', sl: 'Shift', lc: 'c' },
  alpha: { lbl: '', cls: 'dk', main: 'ALPHA', al: 'Alpha', lc: 'c' },
  mode: { lbl: 'MODE', cls: 'dk', main: 'MODE', s: 'SETUP', sl: 'SET-UP', lc: 'c' },
  on: { lbl: 'ON', cls: 'dk', main: 'ON' },
  apps: { lbl: '', cls: 'lt', main: 'APPS', wrap: 'appsk', sl: 'Apps', lc: 'c' },
  conv: { lbl: 'CONVT', cls: 'lt sm', main: 'CONV', s: 'CONST', sl: 'C-VALUE', lc: 'c' },
  calc: { lbl: 'CALC', main: 'CALC', s: 'SOLVE', sl: 'Solve', a: 'tok:=', al: '=' },
  inv: { lbl: X + sup('-1'), main: 'tok:⁻¹', s: 'tok:!', sl: '<i>x</i>!', a: 'tok::', al: ':' },
  integ: { lbl: '∫<span class="sup">▫</span>▪', main: 'tm:integ', s: 'tm:diff', sl: 'd/dx', al: 'L', c: 'tok:∠', cs: 'tok:∠' }, // CMPLX: ∫ (with or without Shift) types ∠
  eng: { lbl: 'ENG', main: 'ENG', s: '<ENG', sl: '◂ENG', c: 'tok:i', al: '<i>i</i>' },
  frac: { lbl: FRAC_ICON, main: 'tm:frac', s: 'tm:mixed', sl: '▪▫⁄▫', b: 'base:10', bl: 'DEC' },
  sqrt: { lbl: '√▫', main: 'tm:sqrt', s: 'tm:cbrt', sl: '∛▫', b: 'base:16', bl: 'HEX' },
  pow: { lbl: X + sup('▫'), main: 'tm:pow', s: 'tm:nroot', sl: 'ˣ√▫', b: 'base:2', bl: 'BIN' },
  sq: { lbl: X + sup('2'), main: 'tok:²', s: 'tok:³', sl: '<i>x</i>³', b: 'base:8', bl: 'OCT' },
  log: { lbl: 'log', main: 'tok:log(', s: 'tm:ten', sl: '10▫', a: 'tm:logab', al: 'log▪▫' },
  ln: { lbl: 'ln', main: 'tok:ln(', s: 'tm:exp', sl: '<i>e</i>▫', a: 'BLK', al: '◂Blk' },
  neg: { lbl: '(−)', main: 'tok:(−)', a: 'var:A', al: 'A', b: 'tok:hA' },
  dms: { lbl: '°′″', main: 'DMS', s: 'PFACT', sl: 'PFact', a: 'var:B', al: 'B', b: 'tok:hB' },
  hyp: { lbl: 'hyp', main: 'HYP', a: 'var:C', al: 'C', b: 'tok:hC' },
  sin: { lbl: 'sin', main: 'tok:sin(', s: 'tok:asin(', sl: 'sin⁻¹', a: 'var:D', al: 'D', b: 'tok:hD' },
  cos: { lbl: 'cos', main: 'tok:cos(', s: 'tok:acos(', sl: 'cos⁻¹', a: 'var:E', al: 'E', b: 'tok:hE' },
  tan: { lbl: 'tan', main: 'tok:tan(', s: 'tok:atan(', sl: 'tan⁻¹', a: 'var:F', al: 'F', b: 'tok:hF' },
  rcl: { lbl: 'RCL', main: 'RCL', s: 'STO', sl: 'STO' },
  abs: { lbl: 'Abs', main: 'tm:abs' },
  lp: { lbl: '(', main: 'tok:(', s: 'tok:%', sl: '%' },
  rp: { lbl: ')', main: 'tok:)', s: 'tok:,', sl: ',', a: 'var:X', al: 'X' },
  sd: { lbl: 'F↔D', main: 'SD', s: 'ABC', sl: '<i>a</i><small>b/c</small>↔<i>d</i>/<i>c</i>', a: 'var:Y', al: 'Y' },
  mplus: { lbl: 'M+', main: 'M+', s: 'M-', sl: 'M-', a: 'var:M', al: 'M' },
  del: { lbl: 'DEL', main: 'DEL', s: 'INS', sl: 'Insert', cls: 'sm' },
  ac: { lbl: 'CA', main: 'AC', s: 'OFF', sl: 'OFF', cls: 'sm ca' },
  mul: { lbl: '×', main: 'tok:×', s: 'tok:nPr', sl: 'nPr' },
  div: { lbl: '÷', main: 'tok:÷', s: 'tok:nCr', sl: 'nCr' },
  add: { lbl: '+', main: 'tok:+', s: 'tok:Pol(', sl: 'Pol(' },
  sub: { lbl: '−', main: 'tok:-', s: 'tok:Rec(', sl: 'Rec(' },
  dot: { lbl: '·', main: 'tok:.', s: 'tok:Rand', sl: 'Rand', a: 'tok:i~Rand(', al: 'i-Rand' },
  exp: { lbl: 'EXP', main: 'tok:EE', s: 'tok:π', sl: 'π', a: 'tok:e', al: '<i>e</i>', cls: 'sm' },
  ans: { lbl: 'Ans', main: 'tok:Ans', s: 'DRG', sl: 'DRG▸', cls: 'sm' },
  eq: { lbl: '=', main: '=' },
};
const SHIFT_DIGIT = { 9: ['CLR', 'CLR'], 0: ['tok:Round(', 'ROUND'] };
for (let d = 0; d <= 9; d++) K[d] = { lbl: String(d), main: `tok:${d}`, s: SHIFT_DIGIT[d]?.[0], sl: SHIFT_DIGIT[d]?.[1] };

const LAYOUT = {
  top: ['shift', 'alpha', 'PAD', 'mode', 'on', 'apps', '', '', 'conv', 'calc', 'inv', 'integ', 'eng'],
  fn: ['frac', 'sqrt', 'pow', 'sq', 'log', 'ln', 'neg', 'dms', 'hyp', 'sin', 'cos', 'tan', 'rcl', 'abs', 'lp', 'rp', 'sd', 'mplus'],
  main: ['7', '8', '9', 'del', 'ac', '4', '5', '6', 'mul', 'div', '1', '2', '3', 'add', 'sub', '0', 'dot', 'exp', 'ans', 'eq'],
};
function buildKeys() {
  let h = '';
  for (const [sec, ids] of Object.entries(LAYOUT)) {
    h += `<div class="sec ${sec}">`;
    for (const id of ids) {
      if (id === '') { h += '<div class="k gap"></div>'; continue; }
      if (id === 'PAD') {
        const chev = (d) => `<svg viewBox="0 0 10 10" aria-hidden="true"><path d="${d}"/></svg>`;
        h += `<div class="pad"><div class="sq"><button class="u" data-id="UP" aria-label="up">${chev('M2 7 5 3 8 7')}</button><button class="l" data-id="LEFT" aria-label="left">${chev('M7 2 3 5 7 8')}</button><button class="r" data-id="RIGHT" aria-label="right">${chev('M3 2 7 5 3 8')}</button><button class="d" data-id="DOWN" aria-label="down">${chev('M2 3 5 7 8 3')}</button></div></div>`;
        continue;
      }
      const k = K[id];
      const lab = `<span class="s">${k.sl || ''}</span>${k.bl ? `<span class="g">${k.bl}</span>` : ''}<span class="a">${k.al || ''}</span>`;
      h += `<div class="k ${k.wrap || ''}"><div class="lb ${k.lc || ''}">${lab}</div><button class="kb ${k.cls || ''}" data-id="${id}"><span>${k.lbl}</span></button></div>`;
    }
    h += '</div>';
  }
  keysEl.innerHTML = h;
}
function resolve(id) {
  if (['UP', 'DOWN', 'LEFT', 'RIGHT'].includes(id)) { ui.shift = ui.alpha = false; return id; }
  const k = K[id];
  if (ui.sto || ui.rcl) return k.a || (/^tok:\d$/.test(k.main) ? 'var:m' + k.main.slice(4) : null);
  if (ui.shift) { ui.shift = false; if (S.mode === 'CPLX' && k.cs) return k.cs; return k.s || null; }
  if (ui.alpha) { ui.alpha = false; return k.a || null; }
  if (S.mode === 'BASE' && k.b) return k.b;
  if (S.mode === 'BASE' && id === 'dot') return null; // no decimal point in BASE-N
  if (S.mode === 'CPLX' && k.c) return k.c;
  return k.main;
}

let idleT = 0;
const IDLE_MS = 7 * 60 * 1000; // auto power-off after about 7 minutes, like the real one
function wake() { clearTimeout(idleT); idleT = setTimeout(() => { ui.off = true; render(); }, IDLE_MS); }

function press(id) {
  wake();
  ui.blink = true; restartBlink();
  if (ui.off) { if (id === 'on') { ui.off = false; S.hist = []; toCalc(); calc.ed = newEd(); calc.res = null; enterMode(false); } render(); return; }
  if ((id === 'shift' || id === 'alpha') && (ui.sto || ui.rcl)) ui.sto = ui.rcl = false;
  if (id === 'shift') { ui.shift = !ui.shift; ui.alpha = false; render(); return; }
  if (id === 'alpha') { ui.alpha = !ui.alpha; ui.shift = false; render(); return; }
  const pending = ui.sto ? 'store' : ui.rcl ? 'recall' : null;
  const a = resolve(id);
  ui.sto = ui.rcl = false;
  if (pending) {
    if (a && a.startsWith('var:')) { toCalc(); calc[pending](a.slice(4)); }
    finish(); return;
  }
  if (!a) { render(); return; }
  const act = a.startsWith('var:') ? 'tok:' + a.slice(4) : a;
  switch (act) {
    case 'ON': toCalc(); calc.key('AC'); enterMode(false); return finish();
    case 'OFF': ui.off = true; return finish();
    case 'MODE': if (top().id === 'mode') ui.stack.pop(); else if (top().id !== 'apps') push(modeMenu()); return finish(); // MODE is ignored while the Apps menu is open
    case 'SETUP': push(setupMenu()); return finish();
    case 'APPS': {
      const t0 = top();
      if (t0.id === 'apps') ui.stack.pop();
      else if (S.mode === 'TABLE') { /* Apps does nothing in TABLE */ }
      else if (S.mode === 'EQN') { if (t0.grid) { toCalc(); push(eqnTypeMenu()); } } // back to the equation type list
      else if (t0.grid && (S.mode === 'MATX' || S.mode === 'VCTR')) push(editAppsMenu()); // inside the editor: Dim and Data only
      else if (t0 === calc || t0.grid) push(appsMenu());
      return finish();
    }
    case 'CONST': if (top() === calc) push(constPicker()); return finish();
    case 'CONV': if (top() === calc) push(convPicker()); return finish();
    case 'CLR': push(clrMenu()); return finish();
    case 'DRG': push(drgMenu()); return finish();
    case 'HYP': push(hypMenu()); return finish();
    case 'INS': return finish();
    case 'STO': case 'RCL':
      if (top() === calc) ui[act === 'STO' ? 'sto' : 'rcl'] = true;
      return finish();
  }
  top().key(act);
  finish();
}
let saveTimer = 0;
function finish() {
  render();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 250);
}

// ---------------- rendering ----------------
function modeIcons() {
  const st = S.setup, out = [];
  if (S.vars.M !== 0) out.push('M');
  const tag = { STAT: 'STAT', CPLX: 'CPLX', MATX: 'MATX', VCTR: 'VCTR', EQN: 'EQN' }[S.mode];
  if (tag) out.push(tag);
  if (S.mode !== 'BASE') out.push({ deg: 'D', rad: 'R', gra: 'G' }[st.angle]);
  if (st.disp === 'fix') out.push('FIX');
  if (st.disp === 'sci') out.push('SCI');
  if ((st.io === 'line' && S.mode !== 'BASE') || ['STAT', 'MATX', 'VCTR'].includes(S.mode)) out.push('LINE');
  return out;
}
function icons() {
  const t = top();
  const out = t.icons ? t.icons() : modeIcons();
  if (ui.shift) out.push('S');
  if (ui.alpha) out.push('A');
  if (ui.sto) out.push('STO');
  if (ui.rcl) out.push('RCL');
  if (t === calc && S.hist.length && ['COMP', 'CPLX', 'BASE'].includes(S.mode)) out.push('up');
  return out;
}
function render() {
  B.clear();
  if (!ui.off) top().draw(B);
  const k = S.setup.contrast;
  L.paint(cv, B, ui.off ? [] : icons(), { alpha: Math.min(1, 0.6 + k * 0.08), off: ui.off });
  keysEl.querySelector('[data-id="shift"]')?.classList.toggle('down', ui.shift);
  keysEl.querySelector('[data-id="alpha"]')?.classList.toggle('down', ui.alpha);
}
// blinking cursor
let blinkT = 0;
function restartBlink() {
  clearInterval(blinkT);
  blinkT = setInterval(() => { ui.blink = !ui.blink; if (!ui.off) render(); }, 500);
}

// ---------------- input wiring ----------------
const REPEAT = new Set(['del', 'UP', 'DOWN', 'LEFT', 'RIGHT']);
let repeatT = 0;
let audio = null;
function click() {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    const o = audio.createOscillator(), g = audio.createGain();
    o.type = 'square'; o.frequency.value = 2400;
    g.gain.setValueAtTime(0.03, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.025);
    o.connect(g).connect(audio.destination); o.start(); o.stop(audio.currentTime + 0.03);
  } catch { /* no audio */ }
}
keysEl.addEventListener('pointerdown', (ev) => {
  const b = ev.target.closest('[data-id]');
  if (!b) return;
  ev.preventDefault();
  const id = b.dataset.id;
  if (id !== 'shift' && id !== 'alpha') b.classList.add('down');
  try { navigator.vibrate?.(8); } catch { /* not supported */ }
  if (localStorage.getItem('sc789-sound') === '1') click();
  press(id);
  clearTimeout(repeatT);
  if (REPEAT.has(id)) {
    const rep = () => { press(id); repeatT = setTimeout(rep, 85); };
    repeatT = setTimeout(rep, 450);
  }
});
const release = () => {
  clearTimeout(repeatT);
  keysEl.querySelectorAll('.kb.down, .pad .down').forEach((b) => {
    if ((b.dataset.id === 'shift' && ui.shift) || (b.dataset.id === 'alpha' && ui.alpha)) return;
    b.classList.remove('down');
  });
};
['pointerup', 'pointercancel', 'pointerleave'].forEach((t) => keysEl.addEventListener(t, release));
keysEl.addEventListener('contextmenu', (e) => e.preventDefault());
// tap the LCD frame's sound dot to toggle the key click
$('snd')?.addEventListener('click', () => {
  const on = localStorage.getItem('sc789-sound') !== '1';
  try { localStorage.setItem('sc789-sound', on ? '1' : '0'); } catch { /* ignore */ }
  $('snd').classList.toggle('on', on);
  if (on) click();
});
try { $('snd')?.classList.toggle('on', localStorage.getItem('sc789-sound') === '1'); } catch { /* ignore */ }

// laptop keyboard
const KB = {
  '+': 'add', '-': 'sub', '*': 'mul', '/': 'div', '(': 'lp', ')': 'rp', '.': 'dot', ',': 'dot',
  Enter: 'eq', '=': 'eq', Backspace: 'del', Escape: 'ac', Delete: 'del', ' ': 'ac',
  ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT', '^': 'pow',
  s: 'sin', c: 'cos', t: 'tan', l: 'ln', g: 'log', r: 'sqrt', q: 'sq', f: 'frac', a: 'ans', e: 'exp',
  Shift: 'shift', Alt: 'alpha', m: 'mode',
};
document.addEventListener('keydown', (ev) => {
  if (ev.metaKey || ev.ctrlKey) return;
  const id = /^[0-9]$/.test(ev.key) ? ev.key : KB[ev.key];
  if (!id) return;
  ev.preventDefault();
  press(id);
});
window.addEventListener('resize', () => render());

// ---------------- start ----------------
buildKeys();
toCalc();
enterMode(false);
render();
restartBlink();
wake();
// for automated tests: replay key names and read back the dots and icons
window.__sc = {
  reset() { S = DEFAULTS(); calc.ed = newEd(); calc.res = null; ui.shift = ui.alpha = ui.sto = ui.rcl = ui.off = false; toCalc(); buildKeys(); render(); },
  keys(list) { for (const k of list.split(/\s+/).filter(Boolean)) press({ up: 'UP', down: 'DOWN', left: 'LEFT', right: 'RIGHT' }[k] || k); },
  dump() { ui.blink = true; render(); return { dots: Array.from(B.d).join(''), icons: icons() }; },
};

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {}));
}
