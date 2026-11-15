// Accuracy sampler: replays randomized emulator key sequences (tools/emubt.json) and measures how often the
// screen is identical, and for decimal results how many leading digits agree.
const J = await fetch('tools/emubt.json?' + Date.now()).then((r) => r.json());
const D = await import('../lcddata.js');
const G = Object.entries(D.F9);
function dec(s, top, sh) { // read a right-aligned line of the big font; returns { out, miss }
  let out = '', miss = 0;
  for (let k = 0; k < 18; k++) {
    const x0 = sh - 6 * k; if (x0 < 0) break;
    let blank = true, best = null;
    for (let j = 0; j < 9; j++) for (let i = 0; i < 6; i++) if (s[(top + j) * 105 + x0 + i] === '1') blank = false;
    if (blank) { out = ' ' + out; continue; }
    for (const [c, rows] of G) {
      let ok = true;
      for (let j = 0; j < 9 && ok; j++) for (let i = 0; i < 6; i++) if ((s[(top + j) * 105 + x0 + i] === '1' ? 1 : 0) !== (((rows[j] || 0) >> (5 - i)) & 1)) { ok = false; break; }
      if (ok) { best = c; break; }
    }
    if (best === null) miss++;
    out = (best === null ? '?' : best) + out;
  }
  return { out: out.trim(), miss };
}
function readResult(s) {
  let b = null;
  for (let sh = 94; sh <= 100; sh++) {
    const r = dec(s, 21, sh);
    if (!b || r.miss < b.miss || (r.miss === b.miss && r.out.replace(/\?/g, '').length > b.out.replace(/\?/g, '').length)) b = r;
  }
  return b.miss === 0 && b.out ? b.out : null;
}
const sig = (t) => (t || '').replace(/[^0-9]/g, '').replace(/^0+/, '');
const lead = (a, b) => { let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++; return i; };
export function run() {
  const rows = [];
  for (const n of Object.keys(J.tests)) {
    window.__sc.reset();
    let err = null;
    try { window.__sc.keys(J.tests[n]); } catch (e) { err = e.message; }
    const d = window.__sc.dump().dots, e = J.emu[n];
    let diff = 0; for (let i = 0; i < d.length; i++) if (d[i] !== e[i]) diff++;
    const et = readResult(e), ot = readResult(d);
    rows.push({ n, cat: J.cat[n], diff, et, ot, err });
  }
  return rows;
}
export function stats(rows = run()) {
  const by = {};
  const add = (k, r) => { const o = (by[k] ||= { n: 0, exact: 0, dec: 0, decSame: 0, dec1: 0, decWorse: 0 }); o.n++; if (!r.diff) o.exact++; if (r.et && r.ot && /^-?[0-9.]+$/.test(r.et.replace(/[−\-]/g, '')) && /^-?[0-9.]+$/.test(r.ot.replace(/[−\-]/g, ''))) { o.dec++; const a = sig(r.et), b = sig(r.ot), L = lead(a, b), m = Math.max(a.length, b.length); if (a === b) o.decSame++; else if (L >= m - 1) o.dec1++; else o.decWorse++; } };
  for (const r of rows) { add(r.cat, r); add('ALL', r); }
  return by;
}
export function bad(rows = run()) { return rows.filter((r) => r.diff).map((r) => `${r.n}:${r.diff}${r.et || r.ot ? ` emu=${r.et} our=${r.ot}` : ''}`); }
