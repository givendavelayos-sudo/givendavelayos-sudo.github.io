// Temporary smoke test: run many key sequences, report exceptions and the value of Ans.
const T = {
  pow: '2 pow 1 0 eq', fracmix: '1 frac 2 right add 1 frac 3 eq shift sd', dms: '2 dot 5 eq dms', eng: '1 2 3 4 5 eq eng eng',
  sto: '5 shift rcl alpha neg ac alpha neg add 1 eq', mplus: '3 mplus 4 mplus rcl alpha mplus', solve: 'alpha rp sq sub 4 alpha calc 0 shift calc 1 eq eq',
  calcfn: 'alpha rp add 1 calc 5 eq', integ: 'integ alpha rp right 0 right 1 eq', diff: 'shift integ alpha rp sq right 3 eq',
  sum: 'apps 2 alpha rp right 1 right 4 eq', prod: 'apps 1 alpha rp right 1 right 4 eq', pol: 'shift add 1 shift rp 1 rp eq',
  rec: 'shift sub 2 shift rp 6 0 rp eq', ncr: '5 shift div 2 eq', fact: '6 shift inv eq', logab: 'alpha log 2 right 8 eq', ln: 'ln 1 eq',
  abs: 'abs neg 3 eq', round: 'shift 0 2 div 3 eq', const: 'shift conv 2 8 eq eq', convt: '1 0 conv eq right eq eq',
  cplx: 'mode 2 lp 1 add eng rp mul lp 1 sub eng rp eq', cplxPol: 'mode 2 1 add eng eq apps 1 eq', base: 'mode 4 1 5 eq sqrt', baseLogic: 'mode 4 1 2 apps 1 1 0 eq',
  stat1: 'mode 3 1 1 eq 2 eq 3 eq 4 eq ac apps 5 2 eq', stat2: 'mode 3 2 1 eq 2 eq 3 eq right up up 2 eq 4 eq 6 eq ac apps 8 2 eq',
  eqn2: 'mode 5 1 1 eq 1 eq 3 eq 1 eq neg 1 eq 1 eq eq', eqn3: 'mode 5 2 2 eq 4 eq neg 4 eq 2 0 eq 2 eq neg 2 eq 4 eq 8 eq 5 eq neg 2 eq neg 2 eq 2 0 eq eq',
  cubic: 'mode 5 down 2 1 eq neg 6 eq 1 1 eq neg 6 eq eq', quart: 'mode 5 down 3 1 eq 0 eq neg 5 eq 0 eq 4 eq eq',
  matrix: 'mode 7 1 4 ac mode 7 1 down down 2 1 eq 2 eq 3 eq 4 eq ac apps down 1 apps 3 eq', vector: 'mode 8 2 1 eq 2 eq ac apps 3 apps 8 apps 3 eq',
  table: 'mode 6 alpha rp sq eq eq eq eq down down', setupFix: 'shift mode 6 3 1 div 3 eq', setupLine: 'shift mode 2 1 frac 2 eq',
  hyp: 'hyp 4 1 eq', drg: 'shift ans 2 eq', clr: 'shift 9 3 eq ac', off: 'shift ac on 1 eq', contrast: 'shift mode down 6 right right ac',
  scroll: '1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 left left', errGoto: '1 div lp eq right', ins: '1 2 left left 3 eq', hist: '1 add 1 eq 2 add 2 eq up up',
};
export function run() {
  const out = [];
  for (const [n, k] of Object.entries(T)) {
    window.__sc.reset();
    try { window.__sc.keys(k); window.__sc.dump(); out.push(`${n}:ok`); } catch (e) { out.push(`${n}:EXC ${e.message}`); }
  }
  return out.join(' ');
}
export const tests = T;
export function sheet(names = Object.keys(T), cols = 4) {
  document.getElementById('sheet')?.remove();
  const d = document.createElement('div');
  d.id = 'sheet';
  d.style.cssText = 'position:fixed;inset:0;z-index:99;background:#ccc;overflow:auto;display:grid;grid-template-columns:repeat(' + cols + ',max-content);gap:6px;padding:6px;font:11px sans-serif';
  for (const n of names) {
    window.__sc.reset();
    try { window.__sc.keys(T[n] ?? n); } catch { /* shown as is */ }
    const { dots } = window.__sc.dump();
    const c = document.createElement('canvas'); c.width = 210; c.height = 64;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 210, 64); g.fillStyle = '#000';
    for (let i = 0; i < dots.length; i++) if (dots[i] === '1') g.fillRect((i % 105) * 2, Math.floor(i / 105) * 2, 2, 2);
    const w = document.createElement('div'); w.textContent = n; w.appendChild(document.createElement('br')); w.appendChild(c);
    d.appendChild(w);
  }
  document.body.appendChild(d);
  return names.length;
}
