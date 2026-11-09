import * as E from './engine.js';

const { isC, isM, isV } = E.types;
const $ = (id) => document.getElementById(id);
const lcd = $('lcd'), ind = $('ind'), screen = $('screen'), keysEl = $('keys');

// ---------------- saved state ----------------
const DEFAULTS = () => ({
  mode: 'COMP',
  setup: { io: 'math', angle: 'deg', disp: 'norm', dispN: 1, frac: 'dc', cplx: 'abi', freq: false },
  vars: { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, X: 0, Y: 0, M: 0 },
  ans: 0, base: 10,
  stat: { type: 'Lin', data: [], freq: false },
  mats: { MatA: null, MatB: null, MatC: null, MatAns: null },
  vecs: { VctA: null, VctB: null, VctC: null, VctD: null, VctAns: null },
  eqn: { type: 0, coef: [] },
  table: { fx: ['X', '²'], start: 1, end: 5, step: 1 },
  hist: [],
});
let S = DEFAULTS();
try {
  const saved = JSON.parse(localStorage.getItem('sc789') || 'null');
  if (saved) S = { ...S, ...saved, setup: { ...S.setup, ...saved.setup }, vars: { ...S.vars, ...saved.vars } };
} catch { /* fresh start */ }
const save = () => { try { localStorage.setItem('sc789', JSON.stringify(S)); } catch { /* private mode */ } };

// ---------------- runtime UI state ----------------
const ui = { shift: false, alpha: false, hyp: false, sto: false, rcl: false, off: false, stack: [], histIdx: null };
const top = () => ui.stack[ui.stack.length - 1];
const push = (s) => ui.stack.push(s);
const closeMenus = () => { while (ui.stack.length > 1 && top().menu) ui.stack.pop(); };
const isMath = () => S.setup.io === 'math' && S.mode !== 'BASE';
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
  if (ed.toks.length > 190) return;
  if (a.startsWith('tm:')) {
    const parts = E.TEMPLATES[a.slice(3)].parts;
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
    if (!st || st.idx !== 0 || (st.name !== 'frac' && st.name !== 'mixed')) continue;
    const P = E.findParts(ed.toks, i);
    if (ed.cur > P[P.length - 1]) continue;
    let slot = 0;
    for (let k = 1; k < P.length; k++) if (ed.cur > P[k]) slot = k;
    const n = P.length - 1, num = n - 2, den = n - 1;
    if (dir === 'down' && slot === num) { ed.cur = P[den] + 1; return true; }
    if (dir === 'up' && slot === den) { ed.cur = P[num] + 1; return true; }
  }
  return false;
}
// shared editing keys for any screen with an editor
function editKey(ed, a) {
  if (a.startsWith('tok:') || a.startsWith('tm:')) edInsert(ed, a);
  else if (a === 'DEL') edDel(ed);
  else if (a === 'LEFT') { if (ed.cur > 0) ed.cur--; }
  else if (a === 'RIGHT') { if (ed.cur < ed.toks.length) ed.cur++; }
  else return false;
  return true;
}

// ---------------- drawing expressions ----------------
const CUR = '<span class="cur"></span>';
function tokHTML(t) {
  const s = E.tokText(t);
  if (t === '-' || t === '+' || t === '×' || t === '÷') return `<span style="margin:0 .08em">${s}</span>`;
  return s;
}
function renderToks(toks, cur, math) {
  function slot(s, e) {
    if (s === e) return math ? `<span class="box">${cur === s ? CUR : ''}</span>` : cur === s ? CUR : '';
    let h = '', i = s;
    while (i < e) {
      if (cur === i) h += CUR;
      const st = E.STRUCT[toks[i]];
      if (st && st.idx === 0) {
        const P = E.findParts(toks, i);
        h += tm(st.name, P);
        i = P[P.length - 1] + 1;
      } else { h += tokHTML(toks[i]); i++; }
    }
    if (cur === e) h += CUR;
    return h;
  }
  function tm(name, P) {
    const sl = (k) => slot(P[k] + 1, P[k + 1]);
    if (!math) {
      const lin = E.TEMPLATES[name].lin;
      let h = lin[0];
      for (let k = 0; k < P.length - 1; k++) h += sl(k) + lin[k + 1];
      return h;
    }
    const fr = (a, b) => `<span class="fr"><span class="nu">${a}</span><span class="de">${b}</span></span>`;
    switch (name) {
      case 'frac': return fr(sl(0), sl(1));
      case 'mixed': return sl(0) + fr(sl(1), sl(2));
      case 'sqrt': return `<span class="rt"><span class="rs">√</span><span class="rb">${sl(0)}</span></span>`;
      case 'cbrt': return `<span class="rt"><span class="ri">3</span><span class="rs">√</span><span class="rb">${sl(0)}</span></span>`;
      case 'nroot': return `<span class="rt"><span class="ri">${sl(0)}</span><span class="rs">√</span><span class="rb">${sl(1)}</span></span>`;
      case 'pow': return `<span class="sp">${sl(0)}</span>`;
      case 'ten': return `10<span class="sp">${sl(0)}</span>`;
      case 'exp': return `<i>e</i><span class="sp">${sl(0)}</span>`;
      case 'logab': return `<span class="lg">log<sub>${sl(0)}</sub></span>(${sl(1)})`;
      case 'abs': return `<span class="ab">${sl(0)}</span>`;
      case 'integ': return `<span class="big">∫</span><span class="lims"><span>${sl(2)}</span><span>${sl(1)}</span></span>${sl(0)}<i>dx</i>`;
      case 'diff': return `${fr('d', 'dx')}(${sl(0)})<span class="lims"><span>&nbsp;</span><span>x=${sl(1)}</span></span>`;
      case 'sum': return `<span class="lims" style="align-items:center"><span>${sl(2)}</span><span style="font-size:1.9em;line-height:.9">Σ</span><span>x=${sl(1)}</span></span>(${sl(0)})`;
    }
    return '';
  }
  return slot(0, toks.length);
}

// ---------------- drawing results ----------------
const minus = (s) => s.replace(/-/g, '−');
function mant(f) {
  const m = minus(f.m);
  return f.e === null ? m : `${m}<span style="font-size:.62em;margin-left:.1em">×10</span><span class="sp">${minus(String(f.e))}</span>`;
}
const fr = (a, b) => `<span class="fr"><span class="nu">${a}</span><span class="de">${b}</span></span>`;
function exactHTML(ef) {
  const math = isMath();
  const sign = (n) => (n < 0 ? '−' : '');
  if (ef.type === 'frac') {
    let { n, d } = ef;
    if (S.setup.frac === 'ab' && Math.abs(n) > d) {
      const w = Math.trunc(Math.abs(n) / d), r = Math.abs(n) % d;
      return math ? `${sign(n)}${w}${fr(r, d)}` : `${sign(n)}${w}⌟${r}⌟${d}`;
    }
    return math ? sign(n) + fr(Math.abs(n), d) : `${sign(n)}${Math.abs(n)}⌟${d}`;
  }
  if (ef.type === 'surd') {
    const top = `${ef.a === 1 ? '' : ef.a}<span class="rt"><span class="rs">√</span><span class="rb">${ef.b}</span></span>`;
    const s = ef.sign < 0 ? '−' : '';
    if (ef.d === 1) return s + top;
    return math ? s + fr(top, ef.d) : `${s}${top}⌟${ef.d}`;
  }
  const n = Math.abs(ef.n), top = `${n === 1 ? '' : n}π`;
  if (ef.d === 1) return sign(ef.n) + top;
  return math ? sign(ef.n) + fr(top, ef.d) : `${sign(ef.n)}${top}⌟${ef.d}`;
}
function baseStr(x) {
  x |= 0;
  if (S.base === 10) return minus(String(x));
  return (x >>> 0).toString(S.base).toUpperCase();
}
function realHTML(x, res) {
  if (S.mode === 'BASE') return baseStr(x);
  if (res.dms) return E.fmtDMS(x);
  if (res.eng !== null && res.eng !== undefined) return mant(E.fmtReal(x, S.setup, res.eng));
  if (res.exact) {
    const ef = E.exactForm(x);
    if (ef && (isMath() || res.forceFrac)) return exactHTML(ef);
  }
  return mant(E.fmtReal(x, S.setup));
}
const DEG = { deg: Math.PI / 180, rad: 1, gra: Math.PI / 200 };
function cplxHTML(z, res) {
  const polar = z.form === 'polar' || (z.form !== 'rect' && S.setup.cplx === 'polar');
  const r = { ...res, eng: null, dms: false };
  if (polar) {
    const m = Math.hypot(z.re, z.im), th = +(Math.atan2(z.im, z.re) / DEG[S.setup.angle]).toPrecision(12);
    return `${realHTML(+m.toPrecision(15), r)}∠${realHTML(th, r)}`;
  }
  let h = '';
  if (z.re !== 0 || z.im === 0) h += realHTML(z.re, r);
  if (z.im !== 0) {
    h += z.im < 0 ? '−' : z.re !== 0 ? '+' : '';
    const a = Math.abs(z.im);
    h += (a === 1 ? '' : realHTML(a, r)) + '<i>i</i>';
  }
  return h;
}
function short(x) {
  if (typeof x !== 'number') return '';
  const f = E.fmtReal(+x.toPrecision(6), { disp: 'norm', dispN: 1 });
  return minus(f.m) + (f.e === null ? '' : 'ᴇ' + minus(String(f.e)));
}
function matHTML(m) {
  return `<span class="mat"><table>${m.map((r) => `<tr>${r.map((x) => `<td>${short(x)}</td>`).join('')}</tr>`).join('')}</table></span>`;
}
const textLen = (h) => h.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').length;
function pfactHTML(n) {
  const out = [];
  for (let p = 2; p * p <= n; p += p === 2 ? 1 : 2) {
    let e = 0;
    while (n % p === 0) { n /= p; e++; }
    if (e) out.push(e > 1 ? `${p}<span class="sp">${e}</span>` : `${p}`);
  }
  if (n > 1) out.push(String(n));
  return out.join('×');
}
function valueHTML(v, res) {
  if (res.pfact && typeof v === 'number') return pfactHTML(v);
  if (typeof v === 'number') {
    if (S.mode === 'CPLX' && S.setup.cplx === 'polar') return cplxHTML({ re: v, im: 0 }, res);
    return realHTML(v, res);
  }
  if (isC(v)) return cplxHTML(v, res);
  if (isM(v)) return matHTML(v.mat);
  if (isV(v)) return matHTML([v.vec]);
  return '';
}
function resultHTML(res) {
  if (res.msg) return `<div class="out sm">${res.msg}</div>`;
  if (res.multi) {
    return `<div class="multi">${res.multi.map(([k, v]) => `<div><span>${k}=</span><span class="ex">${valueHTML(v, res)}</span></div>`).join('')}</div>`;
  }
  const inner = valueHTML(res.v, res);
  const n = textLen(inner);
  const cls = isM(res.v) || isV(res.v) ? 'xs' : n > 20 ? 'xs' : n > 13 ? 'sm' : '';
  const tag = S.mode === 'BASE' ? `<span class="tag">${{ 10: 'Dec', 16: 'Hex', 2: 'Bin', 8: 'Oct' }[S.base]}</span>` : '';
  return `<div class="out ${cls}">${tag}<span class="ex">${inner}</span></div>`;
}
const mkRes = (v, o = {}) => ({ v, exact: !o.force, eng: null, dms: !!o.dms, multi: o.multi || null, note: o.note || '' });
const errHTML = (msg) => `<div class="msg">${msg}<small>[AC] :Cancel<br>[◀][▶]:Goto</small></div>`;

// ---------------- main calculation screen ----------------
const calc = {
  ed: newEd(), res: null, err: null, calcRun: false,
  render() {
    if (this.err) return errHTML(this.err.msg);
    const note = this.res?.note ? `<span style="margin-left:4px">${this.res.note}</span>` : '';
    let h = `<div class="in"><span class="ex">${renderToks(this.ed.toks, this.res ? -1 : this.ed.cur, isMath())}${note}</span></div>`;
    if (this.res) h += resultHTML(this.res);
    return h;
  },
  fail(e) { this.err = { msg: errOf(e), pos: e?.pos }; this.res = null; },
  key(a) {
    if (this.err) {
      if (a === 'AC') { this.err = null; this.ed = newEd(); }
      else if (a === 'LEFT' || a === 'RIGHT' || a === 'DEL') {
        const pos = this.err.pos;
        this.err = null;
        this.ed.cur = pos != null ? Math.min(pos, this.ed.toks.length) : this.ed.toks.length;
      }
      return;
    }
    const R = this.res;
    if (a !== 'UP' && a !== 'DOWN') ui.histIdx = null;
    switch (a) {
      case 'AC': this.ed = newEd(); this.res = null; this.calcRun = false; return;
      case '=': return R && this.calcRun ? this.startCalc() : this.run(false);
      case '≈': return this.run(true);
      case 'DEL': if (R) { this.res = null; this.ed.cur = this.ed.toks.length; return; } edDel(this.ed); return;
      case 'LEFT': if (R) { this.res = null; this.ed.cur = this.ed.toks.length; return; } if (this.ed.cur > 0) this.ed.cur--; return;
      case 'RIGHT': if (R) { this.res = null; this.ed.cur = 0; return; } if (this.ed.cur < this.ed.toks.length) this.ed.cur++; return;
      case 'UP': case 'DOWN':
        if (!R && this.ed.toks.length && isMath() && fracNav(this.ed, a === 'UP' ? 'up' : 'down')) return;
        return this.hist(a === 'UP' ? -1 : 1);
      case 'SD':
        if (R && !R.msg) {
          if (R.dms || R.eng !== null || R.pfact) { R.dms = false; R.eng = null; R.pfact = false; }
          else { R.exact = !R.exact; R.forceFrac = R.exact && !isMath(); }
        }
        return;
      case 'ABC': S.setup.frac = S.setup.frac === 'ab' ? 'dc' : 'ab'; if (R) R.exact = true; return;
      case 'DMS': if (R) { if (typeof R.v === 'number') { R.dms = !R.dms; R.eng = null; } return; } edInsert(this.ed, 'tok:°'); return;
      case 'DMS2': if (R && typeof R.v === 'number') { R.dms = !R.dms; R.eng = null; } return;
      case 'ENG': case '<ENG':
        if (R && typeof R.v === 'number' && S.mode !== 'BASE') {
          if (R.eng === null) R.eng = E.engExp(R.v) + (a === '<ENG' ? 3 : 0);
          else R.eng += a === 'ENG' ? -3 : 3;
          R.dms = false;
        }
        return;
      case 'PFACT':
        if (!R) return;
        if (typeof R.v === 'number' && Number.isInteger(R.v) && R.v > 1 && R.v < 1e10) { R.pfact = !R.pfact; return; }
        return this.fail(new E.CalcError('Math ERROR'));
      case 'M+': case 'M-': return this.mplus(a === 'M-');
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
    const ast = E.parse(toks, { base: c.base });
    const v = E.evaluate(ast, c);
    if (c.setVars) Object.assign(S.vars, c.setVars);
    return { v, multi: ast.t === 'fn' && c.multi ? c.multi : null };
  },
  run(force) {
    if (!this.ed.toks.length) return;
    try {
      const { v, multi } = this.eval(this.ed.toks);
      setAns(v);
      pushHist(this.ed.toks);
      this.res = mkRes(v, { force, multi, dms: this.ed.toks.includes('°') });
      this.calcRun = false;
    } catch (e) { this.fail(e); }
  },
  hist(dir) {
    const H = S.hist;
    if (!H.length) return;
    if (ui.histIdx === null) ui.histIdx = dir < 0 ? H.length - 1 : 0;
    else ui.histIdx = Math.max(0, Math.min(H.length - 1, ui.histIdx + dir));
    this.ed = newEd(H[ui.histIdx].slice());
    this.res = null;
  },
  store(n) {
    let v = S.ans;
    if (this.ed.toks.length && !this.res) {
      try { v = this.eval(this.ed.toks).v; } catch (e) { return this.fail(e); }
    }
    if (isM(v) || isV(v)) return this.fail(new E.CalcError('Syntax ERROR'));
    S.vars[n] = v;
    setAns(v);
    if (!this.ed.toks.length || this.res) this.ed = newEd(['Ans']);
    this.res = mkRes(v, { note: `→${n}` });
  },
  recall(n) {
    this.ed = newEd([n]);
    this.run(false);
  },
  mplus(minusOp) {
    let v = S.ans;
    if (this.ed.toks.length && !this.res) {
      try { v = this.eval(this.ed.toks).v; } catch (e) { return this.fail(e); }
      pushHist(this.ed.toks);
    }
    try { v = realOf(v); } catch (e) { return this.fail(e); }
    S.vars.M = +(S.vars.M + (minusOp ? -v : v)).toPrecision(15);
    setAns(v);
    if (!this.ed.toks.length || this.res) this.ed = newEd(['Ans']);
    this.res = mkRes(v, { note: minusOp ? 'M−' : 'M+' });
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
          closeMenus();
          ui.stack = [calc];
          try {
            const F = (x) => { const c = ctx(); c.vars = { ...S.vars, [sv]: x }; return realOf(E.evaluate(f, c)); };
            const r = E.solveFor(F, realOf(x0));
            S.vars[sv] = r.x;
            const lr = Math.abs(r.lr) < 1e-13 ? 0 : +r.lr.toPrecision(10);
            this.res = { v: r.x, multi: [[sv, r.x], ['L−R', lr]], exact: false, eng: null, dms: false };
          } catch (e) { this.fail(e); }
        },
        onAC: () => { ui.stack = [calc]; },
      }));
    });
  },
};
function pushHist(toks) {
  const last = S.hist[S.hist.length - 1];
  if (last && last.join('\u0001') === toks.join('\u0001')) return;
  S.hist.push(toks.slice());
  if (S.hist.length > 30) S.hist.shift();
}

// ---------------- prompts ("A?") ----------------
function promptScreen(o) {
  const ed = newEd();
  let err = null;
  return {
    ed,
    render() {
      const show = ed.toks.length || o.value === undefined
        ? renderToks(ed.toks, ed.cur, false)
        : `${typeof o.value === 'number' ? short(+o.value.toPrecision(10)).replace('ᴇ', 'ᴇ') : ''}${CUR}`;
      return `<div class="prompt"><span>${o.label}</span></div>${err ? `<div class="msg" style="font-size:16px">${err}</div>` : ''}<div class="edl"><span class="ex">${show}</span></div>`;
    },
    key(a) {
      err = null;
      if (a === 'AC') {
        if (ed.toks.length) { ed.toks = []; ed.cur = 0; } else (o.onAC || (() => ui.stack.pop()))();
        return;
      }
      if (a === '=') {
        if (!ed.toks.length) { if (o.value !== undefined) o.onValue(o.value); return; }
        try { o.onValue(E.evaluate(E.parse(ed.toks, { base: ctx().base }), ctx())); } catch (e) { err = errOf(e); }
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
    const p = promptScreen({ label: `${n}?`, value: S.vars[n], onValue: (v) => { S.vars[n] = v; next(); }, onAC: () => { ui.stack = [calc]; } });
    p.isAsk = true;
    push(p);
  };
  next();
}

// ---------------- menus ----------------
function menuScreen({ title = '', items, cols = 2, per, id }) {
  per = per || (cols === 2 ? 8 : 5);
  let page = 0;
  const pages = Math.max(1, Math.ceil(items.length / per));
  return {
    menu: true, id,
    render() {
      const vis = items.slice(page * per, page * per + per);
      return `<div class="mtitle"><span>${title}</span><span>${pages > 1 ? `${page + 1}/${pages} ▲▼` : ''}</span></div>
        <div class="menu ${cols === 1 ? 'one' : ''}">${vis.map((it, k) => `<div class="it" data-k="${k + 1}">${k + 1}:${it.label}</div>`).join('')}</div>`;
    },
    key(a) {
      if (a === 'AC') { ui.stack.pop(); return; }
      if (a === 'DOWN' || a === 'RIGHT') { page = (page + 1) % pages; return; }
      if (a === 'UP' || a === 'LEFT') { page = (page - 1 + pages) % pages; return; }
      const m = a.match(/^tok:([1-9])$/);
      if (m) { const it = items[page * per + +m[1] - 1]; if (it) it.run(); }
    },
  };
}
function askDigit(title, min, max, cb) {
  return {
    menu: true,
    render: () => `<div class="msg">${title}<small>Press ${min}~${max}</small></div>`,
    key(a) {
      if (a === 'AC') { ui.stack.pop(); return; }
      const m = a.match(/^tok:(\d)$/);
      if (m && +m[1] >= min && +m[1] <= max) cb(+m[1]);
    },
  };
}
function confirmScreen(text, yes) {
  return {
    menu: true,
    render: () => `<div class="msg">${text}<small>[=] :Yes<br>[AC] :Cancel</small></div>`,
    key(a) { if (a === 'AC') ui.stack.pop(); else if (a === '=') { closeMenus(); yes(); } },
  };
}
const flash = (msg) => { ui.stack = [calc]; calc.ed = newEd(); calc.err = null; calc.res = { msg }; };
const insertAct = (a) => () => { closeMenus(); top().key(a); };
const item = (label, a) => ({ label, run: insertAct(a) });
const subMenu = (label, make) => ({ label: `${label}▸`, run: () => push(make()) });
const set = (label, f) => ({ label, run: () => { f(); closeMenus(); } });

const MODES = [['COMP', 'COMP'], ['CPLX', 'CMPLX'], ['STAT', 'STAT'], ['BASE', 'BASE-N'],
  ['EQN', 'EQN'], ['MATX', 'MATRIX'], ['TABLE', 'TABLE'], ['VCTR', 'VECTOR']];
const modeMenu = () => menuScreen({ id: 'mode', title: 'MODE', items: MODES.map(([m, l]) => ({ label: l, run: () => setMode(m) })) });

function setupMenu() {
  const st = S.setup;
  return menuScreen({
    id: 'setup', title: 'SETUP',
    items: [
      set('MthIO', () => (st.io = 'math')), set('LineIO', () => (st.io = 'line')),
      set('Deg', () => (st.angle = 'deg')), set('Rad', () => (st.angle = 'rad')), set('Gra', () => (st.angle = 'gra')),
      { label: 'Fix', run: () => push(askDigit('Fix 0~9?', 0, 9, (n) => { st.disp = 'fix'; st.dispN = n; closeMenus(); })) },
      { label: 'Sci', run: () => push(askDigit('Sci 0~9?', 0, 9, (n) => { st.disp = 'sci'; st.dispN = n; closeMenus(); })) },
      { label: 'Norm', run: () => push(askDigit('Norm 1~2?', 1, 2, (n) => { st.disp = 'norm'; st.dispN = n; closeMenus(); })) },
      set('a<small>b/c</small>', () => (st.frac = 'ab')), set('d/c', () => (st.frac = 'dc')),
      subMenu('CMPLX', () => menuScreen({ title: 'CMPLX', items: [set('a+b<i>i</i>', () => (st.cplx = 'abi')), set('r∠θ', () => (st.cplx = 'polar'))] })),
      subMenu('STAT', () => menuScreen({ title: 'Frequency?', items: [set('ON', () => (st.freq = true)), set('OFF', () => (st.freq = false))] })),
      { label: 'Reset', run: () => push(confirmScreen('Reset Setup?', () => { S.setup = DEFAULTS().setup; flash('Reset Setup'); })) },
    ],
  });
}
function clrMenu() {
  return menuScreen({
    title: 'CLR', cols: 1,
    items: [
      { label: 'Setup', run: () => push(confirmScreen('Reset Setup?', () => { S.setup = DEFAULTS().setup; flash('Reset Setup'); })) },
      { label: 'Memory', run: () => push(confirmScreen('Clear Memory?', () => { S.vars = DEFAULTS().vars; S.ans = 0; flash('Clear Memory'); })) },
      { label: 'All', run: () => push(confirmScreen('Reset All?', () => { const m = S.mode; S = DEFAULTS(); S.mode = m; buildKeys(); flash('Reset All'); })) },
    ],
  });
}
const drgMenu = () => menuScreen({ title: 'DRG▶', items: [item('°', 'tok:u°'), item('ʳ', 'tok:ur'), item('ᵍ', 'tok:ug')] });
const constMenu = () => menuScreen({
  title: 'CONST', cols: 1,
  items: E.CONSTS.map((c, i) => item(`<i>${c[0]}</i> <small>${c[1]}</small>`, `tok:K:${i}`)),
});
const convMenu = () => menuScreen({ title: 'CONV', items: E.CONVS.map((c, i) => item(`${c[0]}▶${c[1]}`, `tok:V:${i}`)) });

function statVarMenu(title, keys) {
  const paired = S.stat.type !== 'SD';
  const yKeys = ['my', 'sgy', 'ssy', 'Sy', 'Sy2', 'Sxy', 'Sx2y', 'minY', 'maxY'];
  const label = (k) => E.STATVARS[k] || { xh: 'x̂', yh: 'ŷ', xh1: 'x̂₁', xh2: 'x̂₂' }[k];
  return menuScreen({ title, items: keys.filter((k) => paired || !yKeys.includes(k)).map((k) => item(label(k), `tok:${k}`)) });
}
function appsMenu() {
  let items = [];
  switch (S.mode) {
    case 'STAT': {
      const quad = S.stat.type === 'Quad';
      items = [
        { label: 'Type', run: () => { closeMenus(); push(statTypeMenu()); } },
        { label: 'Data', run: () => { ui.stack = [calc]; push(statEditor()); } },
        subMenu('Sum', () => statVarMenu('Sum', ['Sx2', 'Sx', 'n', 'Sy2', 'Sy', 'Sxy', 'Sx3', 'Sx2y', 'Sx4'])),
        subMenu('Var', () => statVarMenu('Var', ['n', 'mx', 'sgx', 'ssx', 'my', 'sgy', 'ssy'])),
      ];
      if (S.stat.type !== 'SD') items.push(subMenu('Reg', () => statVarMenu('Reg', quad ? ['sA', 'sB', 'sC', 'xh1', 'xh2', 'yh'] : ['sA', 'sB', 'r', 'xh', 'yh'])));
      items.push(subMenu('MinMax', () => statVarMenu('MinMax', ['minX', 'maxX', 'minY', 'maxY'])));
      break;
    }
    case 'CPLX':
      items = [item('arg(', 'tok:arg('), item('Conjg(', 'tok:Conjg('), item('▶r∠θ', 'tok:>pol'), item('▶a+b<i>i</i>', 'tok:>rect'), item('<i>i</i>', 'tok:i'), item('∠', 'tok:∠')];
      break;
    case 'BASE':
      items = [item('and', 'tok:and'), item('or', 'tok:or'), item('xor', 'tok:xor'), item('xnor', 'tok:xnor'), item('Not(', 'tok:Not('), item('Neg(', 'tok:Neg('),
        item('DEC', 'base:10'), item('HEX', 'base:16'), item('BIN', 'base:2'), item('OCT', 'base:8')];
      return menuScreen({ title: 'Apps', id: 'apps', items });
    case 'MATX':
      items = [
        { label: 'Dim', run: () => push(pickMenu('Dim', ['MatA', 'MatB', 'MatC'], matDim)) },
        { label: 'Data', run: () => push(pickMenu('Data', ['MatA', 'MatB', 'MatC'], (n) => (S.mats[n] ? (closeMenus(), push(matEditor(n))) : matDim(n)))) },
        item('MatA', 'tok:MatA'), item('MatB', 'tok:MatB'), item('MatC', 'tok:MatC'), item('MatAns', 'tok:MatAns'),
        item('det(', 'tok:det('), item('Trn(', 'tok:Trn('),
      ];
      break;
    case 'VCTR':
      items = [
        { label: 'Dim', run: () => push(pickMenu('Dim', ['VctA', 'VctB', 'VctC', 'VctD'], vecDim)) },
        { label: 'Data', run: () => push(pickMenu('Data', ['VctA', 'VctB', 'VctC', 'VctD'], (n) => (S.vecs[n] ? (closeMenus(), push(vecEditor(n))) : vecDim(n)))) },
        item('VctA', 'tok:VctA'), item('VctB', 'tok:VctB'), item('VctC', 'tok:VctC'), item('VctD', 'tok:VctD'), item('VctAns', 'tok:VctAns'),
        item('Dot(', 'tok:Dot('), item('Angle(', 'tok:Angle('), item('UnitV(', 'tok:UnitV('),
      ];
      break;
  }
  items.push(
    item('log<sub>▫</sub>▫', 'tm:logab'), item('Σ(', 'tm:sum'), item('Pol(', 'tok:Pol('), item('Rec(', 'tok:Rec('),
    item('GCD(', 'tok:GCD('), item('LCM(', 'tok:LCM('), item('Int(', 'tok:Int('), item('Intg(', 'tok:Intg('),
    item('RanInt#(', 'tok:RanInt#('), item('Ran#', 'tok:Ran#'), item('Rnd(', 'tok:Rnd('), item('Abs', 'tm:abs'),
    item('nPr', 'tok:nPr'), item('nCr', 'tok:nCr'), item('d/dx', 'tm:diff'), item('∫dx', 'tm:integ'),
    subMenu('CONST', constMenu), subMenu('CONV', convMenu), subMenu('DRG', drgMenu), item('x!', 'tok:!'),
  );
  return menuScreen({ title: 'Apps', id: 'apps', items });
}
const pickMenu = (title, names, cb) => menuScreen({ title, items: names.map((n) => ({ label: n, run: () => cb(n) })) });

// ---------------- grid editor (STAT / EQN / MATRIX / VECTOR) ----------------
function gridScreen(cfg) {
  const ed = newEd();
  let r = 0, c = 0, topRow = 0, err = null;
  const VIS = 4;
  const scroll = () => { if (r < topRow) topRow = r; if (r >= topRow + VIS) topRow = r - VIS + 1; };
  return {
    ed, grid: true,
    render() {
      const n = cfg.nrows();
      r = Math.min(r, n - 1);
      c = Math.min(c, cfg.cols.length - 1);
      scroll();
      let h = `<table class="grid"><tr><th>${cfg.title || ''}</th>${cfg.cols.map((k) => `<th>${k}</th>`).join('')}</tr>`;
      for (let i = topRow; i < Math.min(n, topRow + VIS); i++) {
        h += `<tr><td class="rn">${cfg.rowLabel ? cfg.rowLabel(i) : i + 1}</td>${cfg.cols.map((_, j) => `<td class="${i === r && j === c ? 'sel' : ''}">${short(cfg.get(i, j))}</td>`).join('')}</tr>`;
      }
      h += '</table>';
      const cur = cfg.get(r, c);
      const line = err || (ed.toks.length ? renderToks(ed.toks, ed.cur, false) : typeof cur === 'number' ? mant(E.fmtReal(cur, { disp: 'norm', dispN: 1 })) : '');
      return h + `<div class="edl"><span class="ex">${line}</span></div>`;
    },
    key(a) {
      err = null;
      if (a === 'AC') {
        if (ed.toks.length) { ed.toks = []; ed.cur = 0; return; }
        cfg.onAC?.();
        return;
      }
      if (a === '=') {
        if (!ed.toks.length) { cfg.onEmptyEq?.(); return; }
        try {
          cfg.set(r, c, realOf(E.evaluate(E.parse(ed.toks, {}), ctx())));
          ed.toks = []; ed.cur = 0;
          if (cfg.down) r = Math.min(r + 1, cfg.nrows() - 1);
          else if (c < cfg.cols.length - 1) c++;
          else if (r < cfg.nrows() - 1) { c = 0; r++; }
        } catch (e) { err = errOf(e); }
        return;
      }
      if (!ed.toks.length) {
        if (a === 'UP') { r = Math.max(0, r - 1); return; }
        if (a === 'DOWN') { r = Math.min(cfg.nrows() - 1, r + 1); return; }
        if (a === 'LEFT') { c = Math.max(0, c - 1); return; }
        if (a === 'RIGHT') { c = Math.min(cfg.cols.length - 1, c + 1); return; }
        if (a === 'DEL' && cfg.del) { cfg.del(r); return; }
      }
      editKey(ed, a);
    },
  };
}

// STAT
const statTypeMenu = () => menuScreen({
  title: 'STAT type',
  items: E.STAT_TYPES.map(([t, l]) => ({ label: l, run: () => { S.stat.type = t; ui.stack = [calc]; push(statEditor()); } })),
});
function statEditor() {
  const keys = () => ['x', ...(S.stat.type !== 'SD' ? ['y'] : []), ...(S.setup.freq ? ['f'] : [])];
  const names = { x: 'x', y: 'y', f: 'FREQ' };
  const cfg = {
    title: '', down: true,
    get cols() { return keys().map((k) => names[k]); },
    nrows: () => Math.min(S.stat.data.length + 1, 80),
    get: (r, c) => S.stat.data[r]?.[keys()[c]],
    set: (r, c, v) => {
      if (r >= S.stat.data.length) S.stat.data.push({ f: 1 });
      S.stat.data[r][keys()[c]] = v;
    },
    del: (r) => { if (r < S.stat.data.length) S.stat.data.splice(r, 1); },
    onAC: () => { ui.stack = [calc]; },
  };
  return gridScreen(cfg);
}

// EQN
const EQN_TYPES = [
  { label: 'a<sub>n</sub>X+b<sub>n</sub>Y=c<sub>n</sub>', rows: 2, cols: ['a', 'b', 'c'] },
  { label: 'a<sub>n</sub>X+b<sub>n</sub>Y+c<sub>n</sub>Z=d<sub>n</sub>', rows: 3, cols: ['a', 'b', 'c', 'd'] },
  { label: 'aX²+bX+c=0', rows: 1, cols: ['a', 'b', 'c'] },
  { label: 'aX³+bX²+cX+d=0', rows: 1, cols: ['a', 'b', 'c', 'd'] },
];
const eqnTypeMenu = () => menuScreen({
  title: 'EQN', cols: 1, per: 4,
  items: EQN_TYPES.map((t, i) => ({
    label: t.label,
    run: () => {
      S.eqn.type = i;
      if (S.eqn.coef.length !== t.rows || S.eqn.coef[0]?.length !== t.cols.length) S.eqn.coef = Array.from({ length: t.rows }, () => Array(t.cols.length).fill(0));
      ui.stack = [calc];
      push(eqnEditor());
    },
  })),
});
function eqnEditor() {
  const t = EQN_TYPES[S.eqn.type];
  return gridScreen({
    cols: t.cols, nrows: () => t.rows,
    get: (r, c) => S.eqn.coef[r][c], set: (r, c, v) => (S.eqn.coef[r][c] = v),
    onEmptyEq: () => push(eqnResult(eqnSolve())),
  });
}
function eqnSolve() {
  const A = S.eqn.coef;
  try {
    if (S.eqn.type < 2) {
      const r = E.solveLinear(A);
      if (r.kind === 'none') return 'No Solution';
      if (r.kind === 'inf') return 'Infinite Sol';
      return r.x.map((v, k) => [['X', 'Y', 'Z'][k], v]);
    }
    if (A[0][0] === 0) return 'Math ERROR';
    return E.polyRoots(A[0].slice()).map((z, k) => [`X${'₁₂₃'[k]}`, z.im === 0 ? z.re : z]);
  } catch (e) { return errOf(e); }
}
function eqnResult(list) {
  let i = 0;
  const res = { exact: true, eng: null, dms: false };
  return {
    render() {
      if (typeof list === 'string') return `<div class="msg">${list}<small>[AC] :Back</small></div>`;
      const [lab, v] = list[i];
      return `<div class="in"><span class="ex">${lab}=</span><span style="margin-left:auto;font-size:12px">${i + 1}/${list.length}</span></div>${resultHTML({ ...res, v })}`;
    },
    key(a) {
      if (typeof list === 'string') { if (a === 'AC' || a === '=') ui.stack.pop(); return; }
      if (a === '=' || a === 'DOWN') { if (i < list.length - 1) i++; else if (a === '=') ui.stack.pop(); return; }
      if (a === 'UP') { if (i > 0) i--; return; }
      if (a === 'AC') { ui.stack.pop(); return; }
      if (a === 'SD') res.exact = !res.exact;
    },
  };
}

// MATRIX & VECTOR
function matDim(n) {
  push(askDigit(`${n} rows? (1~4)`, 1, 4, (rows) => {
    ui.stack.pop();
    push(askDigit(`${n} columns? (1~4)`, 1, 4, (cols) => {
      closeMenus();
      S.mats[n] = Array.from({ length: rows }, () => Array(cols).fill(0));
      push(matEditor(n));
    }));
  }));
}
function matEditor(n) {
  const m = () => S.mats[n];
  return gridScreen({
    title: n.slice(3),
    get cols() { return m()[0].map((_, j) => String(j + 1)); },
    nrows: () => m().length, get: (r, c) => m()[r][c], set: (r, c, v) => (m()[r][c] = v),
    onAC: () => { ui.stack = [calc]; },
  });
}
function vecDim(n) {
  push(askDigit(`${n} dimension? (2~3)`, 2, 3, (d) => {
    closeMenus();
    S.vecs[n] = Array(d).fill(0);
    push(vecEditor(n));
  }));
}
function vecEditor(n) {
  const v = () => S.vecs[n];
  return gridScreen({
    title: n.slice(3),
    get cols() { return v().map((_, j) => String(j + 1)); },
    nrows: () => 1, get: (r, c) => v()[c], set: (r, c, x) => (v()[c] = x),
    onAC: () => { ui.stack = [calc]; },
  });
}

// TABLE
function tableFx() {
  const ed = newEd(S.table.fx.slice());
  let err = null;
  return {
    ed, isFx: true,
    render() {
      return `<div class="prompt"><span>f(X)=</span></div><div class="in"><span class="ex">${renderToks(ed.toks, ed.cur, isMath())}</span></div>${err ? `<div class="out sm">${err}</div>` : ''}`;
    },
    key(a) {
      err = null;
      if (a === 'AC') { ed.toks = []; ed.cur = 0; return; }
      if (a === '=') {
        if (!ed.toks.length) return;
        try { E.parse(ed.toks); } catch (e) { err = errOf(e); return; }
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
  if (n < 1 || n > 30) {
    return { render: () => `<div class="msg">Range ERROR<small>Up to 30 rows<br>[AC] :Back</small></div>`, key: (a) => { if (a === 'AC') ui.stack.pop(); } };
  }
  const ast = E.parse(fx);
  const rows = Array.from({ length: n }, (_, i) => {
    const x = +(start + i * step).toPrecision(12);
    try { const c = ctx(); c.vars = { ...S.vars, X: x }; return [x, realOf(E.evaluate(ast, c))]; } catch { return [x, null]; }
  });
  let r = 0, t = 0;
  return {
    render() {
      if (r < t) t = r;
      if (r >= t + 4) t = r - 3;
      let h = '<table class="grid"><tr><th></th><th>X</th><th>F(X)</th></tr>';
      for (let i = t; i < Math.min(n, t + 4); i++) h += `<tr><td class="rn">${i + 1}</td><td>${short(rows[i][0])}</td><td class="${i === r ? 'sel' : ''}">${rows[i][1] === null ? 'ERROR' : short(rows[i][1])}</td></tr>`;
      const v = rows[r][1];
      return `${h}</table><div class="edl"><span class="ex">${v === null ? 'ERROR' : mant(E.fmtReal(v, S.setup))}</span></div>`;
    },
    key(a) {
      if (a === 'UP') r = Math.max(0, r - 1);
      else if (a === 'DOWN') r = Math.min(n - 1, r + 1);
      else if (a === 'AC') ui.stack.pop();
    },
  };
}

// ---------------- modes ----------------
function setMode(m) {
  S.mode = m;
  calc.ed = newEd(); calc.res = null; calc.err = null;
  ui.stack = [calc];
  buildKeys();
  enterMode(true);
}
function enterMode(fresh) {
  if (S.mode === 'STAT' && fresh) push(statTypeMenu());
  if (S.mode === 'EQN') push(fresh ? eqnTypeMenu() : eqnEditor());
  if (S.mode === 'TABLE') push(tableFx());
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
  inv: { lbl: X + sup('-1'), main: 'tok:⁻¹', s: 'tok:!', sl: '<i>x</i>!' },
  integ: { lbl: '∫<span class="sup">▫</span>▪', main: 'tm:integ', s: 'tm:diff', sl: 'd/dx' },
  eng: { lbl: 'ENG', main: 'ENG', s: '<ENG', sl: '◂ENG', a: 'tok:i', al: '<i>i</i>' },
  frac: { lbl: FRAC_ICON, main: 'tm:frac', s: 'tm:mixed', sl: '▪▫⁄▫', b: 'base:10', bl: 'DEC' },
  sqrt: { lbl: '√▫', main: 'tm:sqrt', s: 'tm:cbrt', sl: '∛▫', b: 'base:16', bl: 'HEX' },
  pow: { lbl: X + sup('▫'), main: 'tm:pow', s: 'tm:nroot', sl: 'ˣ√▫', b: 'base:2', bl: 'BIN' },
  sq: { lbl: X + sup('2'), main: 'tok:²', s: 'tok:³', sl: '<i>x</i>³', b: 'base:8', bl: 'OCT' },
  log: { lbl: 'log', main: 'tok:log(', s: 'tm:ten', sl: '10▫', a: 'tm:logab', al: 'log▪▫' },
  ln: { lbl: 'ln', main: 'tok:ln(', s: 'tm:exp', sl: '<i>e</i>▫' },
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
  dot: { lbl: '·', main: 'tok:.', s: 'tok:Ran#', sl: 'Rand', a: 'tok:RanInt#(', al: 'i-Rand' },
  exp: { lbl: 'EXP', main: 'tok:EE', s: 'tok:π', sl: 'π', a: 'tok:e', al: '<i>e</i>', cls: 'sm' },
  ans: { lbl: 'Ans', main: 'tok:Ans', s: 'DRG', sl: 'DRG▸', cls: 'sm' },
  eq: { lbl: '=', main: '=' },
};
const SHIFT_DIGIT = { 9: ['CLR', 'CLR'], 0: ['tok:Rnd(', 'ROUND'] };
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
        h += `<div class="pad"><button class="u" data-id="UP"><span>︿</span></button><button class="l" data-id="LEFT"><span>〈</span></button><button class="r" data-id="RIGHT"><span>〉</span></button><button class="d" data-id="DOWN"><span>﹀</span></button></div>`;
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
  if (ui.sto || ui.rcl) return k.a || null;
  if (ui.shift) { ui.shift = false; return k.s || null; }
  if (ui.alpha) { ui.alpha = false; return k.a || null; }
  if (S.mode === 'BASE' && k.b) return k.b;
  return k.main;
}
const HYP = { 'tok:sin(': 'tok:sinh(', 'tok:cos(': 'tok:cosh(', 'tok:tan(': 'tok:tanh(', 'tok:asin(': 'tok:asinh(', 'tok:acos(': 'tok:acosh(', 'tok:atan(': 'tok:atanh(' };

function press(id) {
  if (ui.off) { if (id === 'on') { ui.off = false; ui.stack = [calc]; calc.key('AC'); enterMode(false); } render(); return; }
  if (id === 'shift') { ui.shift = !ui.shift; ui.alpha = false; render(); return; }
  if (id === 'alpha') { ui.alpha = !ui.alpha; ui.shift = false; render(); return; }
  const pending = ui.sto ? 'store' : ui.rcl ? 'recall' : null;
  let a = resolve(id);
  ui.sto = ui.rcl = false;
  if (pending) {
    if (a && a.startsWith('var:')) { ui.stack = [calc]; calc.err = null; calc[pending](a.slice(4)); }
    finish(); return;
  }
  if (!a) { render(); return; }
  if (a === 'HYP') { ui.hyp = !ui.hyp; render(); return; }
  if (ui.hyp) { a = HYP[a] || a; ui.hyp = false; }
  if (a.startsWith('var:')) a = 'tok:' + a.slice(4);
  switch (a) {
    case 'ON': ui.stack = [calc]; calc.key('AC'); calc.err = null; enterMode(false); return finish();
    case 'OFF': ui.off = true; return finish();
    case 'MODE': if (top().id === 'mode') ui.stack.pop(); else push(modeMenu()); return finish();
    case 'SETUP': push(setupMenu()); return finish();
    case 'APPS': if (top().id === 'apps') ui.stack.pop(); else push(appsMenu()); return finish();
    case 'CONST': push(constMenu()); return finish();
    case 'CONV': push(convMenu()); return finish();
    case 'CLR': push(clrMenu()); return finish();
    case 'DRG': push(drgMenu()); return finish();
    case 'INS': return finish();
    case 'STO': case 'RCL':
      if (top() === calc) ui[a === 'STO' ? 'sto' : 'rcl'] = true;
      return finish();
  }
  top().key(a);
  finish();
}
let saveTimer = 0;
function finish() {
  render();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 250);
}

// ---------------- rendering ----------------
function indHTML() {
  const st = S.setup;
  const parts = [
    ['S', ui.shift, true], ['A', ui.alpha, true], ['M', S.vars.M !== 0], ['STO', ui.sto], ['RCL', ui.rcl],
    ['STAT', S.mode === 'STAT'], ['CMPLX', S.mode === 'CPLX'], ['MAT', S.mode === 'MATX'], ['VCT', S.mode === 'VCTR'],
    ['hyp', ui.hyp], ['D', st.angle === 'deg', true], ['R', st.angle === 'rad', true], ['G', st.angle === 'gra', true],
    ['FIX', st.disp === 'fix'], ['SCI', st.disp === 'sci'], ['Math▲', isMath()],
  ];
  return parts.filter((p) => p[1]).map(([t, , inv]) => `<span class="on ${inv ? 'inv' : ''}">${t}</span>`).join('');
}
function render() {
  lcd.classList.toggle('off', ui.off);
  if (ui.off) { screen.innerHTML = ''; ind.innerHTML = ''; return; }
  ind.innerHTML = indHTML();
  screen.innerHTML = top().render();
  const c = screen.querySelector('.cur');
  if (c) c.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  keysEl.querySelector('[data-id="shift"]')?.classList.toggle('down', ui.shift);
  keysEl.querySelector('[data-id="alpha"]')?.classList.toggle('down', ui.alpha);
}

// ---------------- input wiring ----------------
const REPEAT = new Set(['del', 'UP', 'DOWN', 'LEFT', 'RIGHT']);
let repeatT = 0;
keysEl.addEventListener('pointerdown', (ev) => {
  const b = ev.target.closest('[data-id]');
  if (!b) return;
  ev.preventDefault();
  const id = b.dataset.id;
  if (id !== 'shift' && id !== 'alpha') b.classList.add('down');
  try { navigator.vibrate?.(8); } catch { /* not supported */ }
  press(id);
  clearTimeout(repeatT);
  if (REPEAT.has(id)) {
    const rep = () => { press(id); repeatT = setTimeout(rep, 85); };
    repeatT = setTimeout(rep, 450);
  }
});
const release = (ev) => {
  clearTimeout(repeatT);
  keysEl.querySelectorAll('.kb.down, .pad .down').forEach((b) => {
    if ((b.dataset.id === 'shift' && ui.shift) || (b.dataset.id === 'alpha' && ui.alpha)) return;
    b.classList.remove('down');
  });
  void ev;
};
['pointerup', 'pointercancel', 'pointerleave'].forEach((t) => keysEl.addEventListener(t, release));
keysEl.addEventListener('contextmenu', (e) => e.preventDefault());

screen.addEventListener('click', (ev) => {
  const it = ev.target.closest('.it');
  if (it) { top().key('tok:' + it.dataset.k); finish(); }
});

// laptop keyboard
const KB = {
  '+': 'add', '-': 'sub', '*': 'mul', '/': 'div', '(': 'lp', ')': 'rp', '.': 'dot', ',': 'dot',
  Enter: 'eq', '=': 'eq', Backspace: 'del', Escape: 'ac', Delete: 'ac',
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

// ---------------- start ----------------
buildKeys();
ui.stack = [calc];
enterMode(false);
render();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {}));
}
