// Temporary test harness (not shipped): replays emulator key sequences and diffs the dots.
const J = await fetch('tools/emu.json?' + Date.now()).then((r) => r.json());
const run = (n) => { window.__sc.reset(); window.__sc.keys(J.tests[n]); return window.__sc.dump().dots; };
export function summary() {
  const out = [];
  let ok = 0;
  for (const n of Object.keys(J.tests)) {
    let d;
    try { d = run(n); } catch (e) { out.push(`${n}:EXC(${e.message})`); continue; }
    let c = 0;
    for (let i = 0; i < d.length; i++) if (d[i] !== J.emu[n][i]) c++;
    if (c) out.push(`${n}:${c}`); else ok++;
  }
  return `${ok}/${Object.keys(J.tests).length} exact. ` + out.join(' ');
}
export function icons() { // compare status icons (M is ignored: the emulator kept M set in later captures)
  const out = [];
  for (const n of Object.keys(J.tests)) {
    window.__sc.reset(); window.__sc.keys(J.tests[n]);
    const ours = window.__sc.dump().icons.filter((k) => k !== 'M').sort().join(','), emu = J.icons[n].filter((k) => k !== 'M').sort().join(',');
    if (ours !== emu) out.push(`${n}: emu[${emu}] ours[${ours}]`);
  }
  return out.length + ' icon mismatches\n' + out.join('\n');
}
export function diff(n) {
  const d = run(n), e = J.emu[n];
  let c0 = 105, c1 = 0;
  for (let y = 0; y < 32; y++) for (let x = 0; x < 105; x++) if (d[y * 105 + x] !== e[y * 105 + x]) { c0 = Math.min(c0, x); c1 = Math.max(c1, x); }
  c0 = Math.max(0, c0 - 4); c1 = Math.min(104, c1 + 4);
  const rows = [];
  for (let y = 0; y < 32; y++) {
    let s = '';
    for (let x = c0; x <= c1; x++) { const a = e[y * 105 + x] === '1', b = d[y * 105 + x] === '1'; s += a && b ? '#' : a ? 'E' : b ? 'O' : '.'; }
    if (/[#EO]/.test(s)) rows.push(String(y).padStart(2) + ' ' + s);
  }
  return `${n} cols ${c0}-${c1}\n` + rows.join('\n');
}
// side by side: emulator (left) and SciCalc (right) for each name
export function pairs(names, cols = 2) {
  document.getElementById('sheet')?.remove();
  const d = document.createElement('div');
  d.id = 'sheet';
  d.style.cssText = `position:fixed;inset:0;z-index:99;background:#bbb;overflow:auto;display:grid;grid-template-columns:repeat(${cols},max-content);gap:4px 10px;padding:4px;font:10px sans-serif`;
  const cv = (bits) => {
    const c = document.createElement('canvas'); c.width = 210; c.height = 64;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 210, 64); g.fillStyle = '#000';
    for (let i = 0; i < bits.length; i++) if (bits[i] === '1') g.fillRect((i % 105) * 2, Math.floor(i / 105) * 2, 2, 2);
    return c;
  };
  for (const n of names) {
    const w = document.createElement('div');
    w.append(n, document.createElement('br'), cv(J.emu[n]), ' ', cv(run(n)));
    d.appendChild(w);
  }
  document.body.appendChild(d);
  return names.length;
}
