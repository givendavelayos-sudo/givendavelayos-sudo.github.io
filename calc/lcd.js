// Dot-matrix LCD: a 105×32 grid of dots plus a strip of status icons, drawn like the real F-789SGA.
// Fonts and fixed screens come from lcddata.js (copied dot-for-dot from the official emulator).
import { F9, F6, F5, X10, X10N, SCREENS, ICONS, KPAGES, KTITLE, UPAGES } from './lcddata.js';
export { FXL, EQH, FXH, NAMES, FQH, BLK, TERR, TEN } from './lcddata.js';
import { F4 } from './lcddata.js';
if (!F4['1']) F4['1'] = [24, 8, 8, 28]; // "1" of the matrix-size title (not in the captures)

export const W = 105, H = 32;
export const LEFT = 6, RIGHT = 101; // text area: 16 cells of 6 dots

// ---------------- dot buffer ----------------
export class Buf {
  constructor() { this.d = new Uint8Array(W * H); }
  clear() { this.d.fill(0); }
  set(x, y, v = 1) { if (x >= 0 && x < W && y >= 0 && y < H) this.d[y * W + x] = v ? 1 : 0; }
  get(x, y) { return x >= 0 && x < W && y >= 0 && y < H ? this.d[y * W + x] : 0; }
  xor(x, y) { if (x >= 0 && x < W && y >= 0 && y < H) this.d[y * W + x] ^= 1; }
  fill(x0, y0, x1, y1, v = 1) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.set(x, y, v); }
  invert(x0, y0, x1, y1) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.xor(x, y); }
  hline(x0, x1, y) { for (let x = x0; x <= x1; x++) this.set(x, y); }
  vline(x, y0, y1) { for (let y = y0; y <= y1; y++) this.set(x, y); }
  bits(rows, w, x, y, op = 'or') { // rows: ints, MSB = left
    rows.forEach((r, j) => { for (let i = 0; i < w; i++) if (r & (1 << (w - 1 - i))) op === 'xor' ? this.xor(x + i, y + j) : this.set(x + i, y + j); });
  }
  hex(str, y0 = 0, x0 = 0) { // packed rows: 27 hex digits per 105-dot row
    const n = str.length / 27;
    for (let r = 0; r < n; r++) {
      const s = str.slice(r * 27, r * 27 + 27);
      for (let k = 0; k < 27; k++) {
        const v = parseInt(s[k], 16);
        for (let b = 0; b < 4; b++) if (v & (8 >> b)) this.set(x0 + k * 4 + b, y0 + r);
      }
    }
  }
  screen(name) { this.hex(SCREENS[name]); }
}
// crop columns x0..x1 from a packed band into a box-drawable bitmap
function hexRows(str) {
  const n = str.length / 27, out = [];
  for (let r = 0; r < n; r++) {
    const row = [];
    for (let k = 0; k < 27; k++) { const v = parseInt(str[r * 27 + k], 16); for (let b = 0; b < 4; b++) row.push(v & (8 >> b) ? 1 : 0); }
    out.push(row);
  }
  return out;
}

// ---------------- fonts ----------------
// Extra small-font glyphs the menus never show (drawn to match the captured style).
const p = (...rows) => rows.map((r) => parseInt(r.padEnd(6, '.').replace(/#/g, '1').replace(/\./g, '0'), 2));
const F6X = {
  '+': p('.....', '..#', '..#', '#####', '..#', '..#', '', ''),
  '.': p('', '', '', '', '##', '##', '', ''),
  ',': p('', '', '', '', '.#', '.#', '#', ''),
  '÷': p('', '..#', '', '#####', '', '..#', '', ''),
  'π': p('', '#####', '.#.#', '.#.#', '.#.#', '#..##', '', ''),
  '!': p('..#', '..#', '..#', '..#', '', '..#', '', ''),
  '%': p('##..#', '##.#', '..#', '.#', '#.##', '#..##', '', ''),
  '°': p('###', '#.#', '###', '', '', '', '', ''),
  '▶': p('#', '##', '###', '##', '#', '', '', ''),
  '∠': p('...#', '..#', '.#', '#', '#####', '', '', ''),
  'θ': p('.###', '#...#', '#####', '#...#', '.###', '', '', ''),
  'f': p('..##', '.#', '####', '.#', '.#', '.#', '', ''),
  'z': p('', '', '#####', '...#', '.#', '#####', '', ''),
  'K': p('#...#', '#..#', '###', '#..#', '#...#', '#...#', '', ''),
  'W': p('#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#', '', ''),
  'Z': p('#####', '...#', '..#', '.#', '#', '#####', '', ''),
  'σ': p('', '.####', '#..#', '#...#', '#...#', '.###', '', ''),
  'Σ': p('#####', '#', '.#', '#', '#', '#####', '', ''),
  '^': p('..#', '.#.#', '#...#', '', '', '', '', ''),
  '√': p('...##', '...#', '...#', '#.#', '.##', '..#', '', ''),
  '⌟': p('', '', '#', '#', '#', '####', '', ''),
  '▪': p('', '', '.##', '.##', '', '', '', ''),
  '×': F6['×'] || p('', '#...#', '.#.#', '..#', '.#.#', '#...#', '', ''),
  '−': p('', '', '', '.###', '', '', '', ''),
  '=': p('', '', '#####', '', '#####', '', '', ''),
};
const ALIAS6 = { 'ⅈ': 'i', 'ℯ': 'e', '−': '-', 'ᴇ': 'E', 'ℙ': 'P', 'ℂ': 'C', 'x̄': 'x' };
const ALIAS9 = { '⁻': '-', 'ʳ': 'r', 'ᵍ': 'g' };
// 3×5 font for table/grid cells (row numbers, headers, values)
const q = (...rows) => rows.map((r) => parseInt(r.padEnd(3, '.').replace(/#/g, '1').replace(/\./g, '0'), 2));
export const F3 = {
  0: q('###', '#.#', '#.#', '#.#', '###'), 1: q('.#', '.#', '.#', '.#', '.#'), 2: q('###', '..#', '###', '#', '###'),
  3: q('###', '..#', '###', '..#', '###'), 4: q('#.#', '#.#', '#.#', '###', '..#'), 5: q('###', '#', '###', '..#', '###'),
  6: q('###', '#', '###', '#.#', '###'), 7: q('###', '..#', '..#', '..#', '..#'), 8: q('###', '#.#', '###', '#.#', '###'),
  9: q('###', '#.#', '###', '..#', '###'), '.': q('', '', '', '##', '##'), '-': q('', '', '###', '', ''),
  E: q('###', '#', '###', '#', '###'), X: q('#.#', '#.#', '.#', '#.#', '#.#'), Y: q('#.#', '#.#', '.#', '.#', '.#'),
  F: q('###', '#', '###', '#', '#'), R: q('##', '#.#', '##', '#.#', '#.#'), Q: q('###', '#.#', '#.#', '##', '.##'),
  '(': q('.#', '#', '#', '#', '.#'), ')': q('#', '.#', '.#', '.#', '#'), a: q('', '##', '.##', '#.#', '###'),
  b: q('#', '#', '##', '#.#', '##'), c: q('', '', '###', '#', '###'), d: q('..#', '..#', '.##', '#.#', '.##'),
  e: q('', '###', '###', '#', '###'), n: q('', '##', '#.#', '#.#', '#.#'), s: q('', '.##', '#', '..#', '##'),
  B: q('##', '#.#', '##', '#.#', '##'), C: q('.##', '#', '#', '#', '.##'), D: q('##', '#.#', '#.#', '#.#', '##'),
};
const F9X = { 'H': p('#...#', '#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#', '#...#'), '∏': p('######', '.#..#', '.#..#', '.#..#', '.#..#', '.#..#', '.#..#', '.#..#', '.#..#') };
const r8 = (...rows) => rows.map((r) => parseInt(r.padEnd(8, '.').replace(/#/g, '1').replace(/\./g, '0'), 2));
const BIG = {
  'Σ': r8('########', '.#.....#', '..#', '...#', '....#', '...#', '..#', '.#.....#', '########'),
  '∏': r8('########', '.#....#', '.#....#', '.#....#', '.#....#', '.#....#', '.#....#', '.#....#', '.#....#'),
};
const BOLD = (g) => g && g.map((r) => r | (r >> 1));
// BASE-N hex digits are bold; they use the full-width letters Ａ–Ｆ as their character codes
const HEXB = Object.fromEntries('ABCDEF'.split('').map((c, i) => { const fw = String.fromCharCode(0xff21 + i); return [fw, F9[fw] || BOLD(F9[c])]; }));
export const hexBold = (s) => s.replace(/[A-F]/g, (c) => String.fromCharCode(0xff21 + c.charCodeAt(0) - 65));
const glyph9 = (c) => HEXB[c] || F9[c] || F9X[c] || F9[ALIAS9[c]];
const glyph6 = (c) => F6[c] || F6X[c] || F6[ALIAS6[c]] || F6X[ALIAS6[c]];

// draw a string in the big (L), small (S) or tiny (T = 3×5) font; returns width in dots
export function text(b, s, x, y, f = 'L') {
  let cx = x;
  for (const c of [...s.normalize('NFC')]) {
    if (c === ' ') { cx += f === 'T' ? 4 : 6; continue; }
    if (f === 'T') { const g = F3[c]; if (g) b.bits(g, 3, cx, y); cx += 4; continue; }
    if (f === 'F4') { const g = F4[c]; if (g) b.bits(g, 6, cx, y); else if (F3[c]) b.bits(F3[c], 3, cx + 1, y - 1); cx += 6; continue; }
    if (f === 'L') {
      const g = glyph9(c);
      if (g) b.bits(g, 6, cx, y);
      else { const h = glyph6(c); if (h) b.bits(h, 6, cx, y + 3); }
    } else {
      const g = glyph6(c);
      if (g) b.bits(g, 6, cx, y);
    }
    cx += 6;
  }
  return cx - x;
}
export const textW = (s, f = 'L') => [...s.normalize('NFC')].length * (f === 'T' ? 4 : 6);
export function digits5(b, s, x, y) { [...s].forEach((c, k) => F5[c] && b.bits(F5[c], 6, x + 6 * k, y)); }
// right-aligned text ending at column xr (inclusive, glyph right edge)
export function textR(b, s, xr, y, f = 'L') { const w = textW(s, f); return text(b, s, xr - w + (f === 'T' ? 2 : 2), y, f); }

// ---------------- layout boxes ----------------
// A box has width w (includes one trailing blank column), up/dn = rows above/below the axis row,
// and draw(b, x, ay). L text: rows ay-4..ay+4. S text: rows ay-2..ay+3.
const MET = { L: { up: 4, dn: 4 }, S: { up: 2, dn: 3 } };
export const box = {
  text(s, f = 'L') {
    const m = MET[f];
    return { w: textW(s, f), up: m.up, dn: m.dn, f, s, draw(b, x, ay) { text(b, s, x, ay - m.up, f); } };
  },
  bits(rows, w, h, f = 'L') { // bitmap box, top aligned with the font's top row
    const m = MET[f];
    return { w: w + 1, up: m.up, dn: Math.max(m.dn, h - m.up - 1), draw(b, x, ay) { rows.forEach((r, j) => r.forEach((v, i) => v && b.set(x + i, ay - m.up + j))); } };
  },
  empty(f = 'L') { // input slot "□"
    return f === 'L'
      ? { w: 6, up: 4, dn: 4, draw(b, x, ay) { for (let i = 0; i < 5; i++) { b.set(x + i, ay - 4); b.set(x + i, ay + 4); } for (let j = -4; j <= 4; j++) { b.set(x, ay + j); b.set(x + 4, ay + j); } } }
      : { w: 6, up: 2, dn: 3, draw(b, x, ay) { for (let i = 0; i < 5; i++) { b.set(x + i, ay - 2); b.set(x + i, ay + 3); } for (let j = -2; j <= 3; j++) { b.set(x, ay + j); b.set(x + 4, ay + j); } } };
  },
  gap(w) { return { w, up: 0, dn: 0, draw() {} }; },
  shift(bx, dy) { return { ...bx, up: bx.up - dy, dn: bx.dn + dy, draw: (b, x, ay) => bx.draw(b, x, ay + dy) }; },
  row(items) {
    // items: boxes; a box with .sup is raised relative to the box before it
    let w = 0, up = 0, dn = 0;
    const placed = [];
    let prevUp = null, afterSup = false;
    for (const it of items) {
      let bx = it;
      if (afterSup) { w += 1; afterSup = false; } // one blank column after a superscript
      if (it.sup) {
        const pu = prevUp ?? MET[it.ctx || 'L'].up;
        bx = box.shift(it.sup, 3 - pu - it.sup.dn);
      }
      placed.push({ bx, x: w });
      w += bx.w; up = Math.max(up, bx.up); dn = Math.max(dn, bx.dn);
      if (!it.caret) { prevUp = bx.up; afterSup = !!it.sup; }
    }
    fixParens(placed);
    for (const { bx } of placed) { up = Math.max(up, bx.up); dn = Math.max(dn, bx.dn); }
    return { w, up, dn, draw(b, x, ay) { for (const P of placed) P.bx.draw(b, x + P.x, ay); } };
  },
  sup(content, ctx = 'L') { return { w: content.w, up: 0, dn: 0, sup: content, ctx }; },
  frac(n, d) {
    const inner = Math.max(n.w, d.w) - 1, bw = inner + 2;
    return {
      w: bw + 1, up: n.up + n.dn + 2, dn: d.up + d.dn + 2,
      draw(b, x, ay) {
        b.hline(x, x + bw - 1, ay);
        n.draw(b, x + 1 + Math.floor((inner - (n.w - 1)) / 2), ay - 2 - n.dn);
        d.draw(b, x + 1 + Math.floor((inner - (d.w - 1)) / 2), ay + 2 + d.up);
      },
    };
  },
  sqrt(c, index = null) {
    const iw = index ? Math.max(0, index.w - 2) : 0;
    const cw = c.w - 1;
    const ih = index ? index.up + index.dn + 1 : 0;
    return {
      w: iw + 5 + cw + 3, up: c.up + 2 + Math.max(0, ih - 4), dn: c.dn,
      draw(b, x, ay) {
        x += iw;
        const top = ay - c.up - 2, bot = ay + c.dn, h = bot - top + 1, half = Math.floor(h / 2);
        b.hline(x + 3, x + 5 + cw + 1, top);
        b.vline(x + 3, top, top + half - 1); b.vline(x + 2, top + half, bot);
        b.set(x, bot - 2); b.set(x + 1, bot - 1);
        c.draw(b, x + 5, ay);
        if (index) index.draw(b, x - iw + 1, top + 3 - index.dn);
      },
    };
  },
  abs(c) {
    return { w: c.w + 10, up: c.up + 1, dn: c.dn, draw(b, x, ay) { b.vline(x + 2, ay - c.up - 1, ay + c.dn); c.draw(b, x + 6, ay); b.vline(x + c.w + 8, ay - c.up - 1, ay + c.dn); } };
  },
  sub(c) { return box.shift(c, 1 + c.up); }, // subscript: top one row below the axis
  bigop(sym, upper, lower, f) { // Σ / ∏ (8 dots wide) with limits above and below
    const g = { w: 9, draw(b, x, ay) { b.bits(BIG[sym], 8, x, ay - 4); } };
    const cw = Math.max(g.w, upper.w, lower.w);
    return {
      w: cw, up: 4 + 1 + upper.up + upper.dn + 1, dn: 4 + 1 + lower.up + lower.dn + 1,
      draw(b, x, ay) {
        g.draw(b, x + Math.floor((cw - g.w) / 2), ay);
        upper.draw(b, x + Math.floor((cw - upper.w) / 2), ay - 5 - upper.dn - 1);
        lower.draw(b, x, ay + 5 + lower.up + 1);
      },
    };
  },
  integral(body, lo, hi, f) { // ∫ with limits at its top and bottom right, then the body and "dx"
    const lw = Math.max(lo.w, hi.w), up = Math.max(10, body.up + 1), dn = Math.max(8, body.dn + 1);
    const dx = box.text('dx', f);
    return {
      w: 8 + lw + body.w + dx.w, up, dn,
      draw(b, x, ay) {
        const top = ay - up, bot = ay + dn;
        b.set(x + 3, top); b.set(x + 4, top + 1); b.vline(x + 2, top + 1, bot - 1); b.set(x + 1, bot); b.set(x, bot - 1);
        hi.draw(b, x + 6, top + 1 + hi.up); lo.draw(b, x + 6, bot - lo.dn);
        body.draw(b, x + 7 + lw, ay); dx.draw(b, x + 8 + lw + body.w, ay);
      },
    };
  },
  x10neg(exp) { // with a negative exponent the minus sits above the "10" (drawn one row shorter)
    const minus = { w: 5, up: 2, dn: 3, draw(b, x, ay) { b.hline(x, x + 3, ay); } };
    return [{ w: 7, up: 2, dn: 4, draw(b, x, ay) { b.bits(X10N, 11, x, ay); } }, box.sup(box.row([minus, box.text(exp, 'S')]))];
  },
  x10() { return { w: 12, up: 2, dn: 4, draw(b, x, ay) { b.bits(X10, 11, x, ay); } }; },
  paren(ch, f) {
    const m = MET[f];
    const bx = { w: 6, up: m.up, dn: m.dn, paren: ch, f, dx: 0, draw(b, x, ay) { drawParen(b, ch, x + bx.dx, ay - bx.up, ay + bx.dn); } };
    return bx;
  },
};
function drawParen(b, ch, x, top, bot) {
  if (ch === '(') { b.set(x + 3, top); b.set(x + 2, top + 1); b.vline(x + 1, top + 2, bot - 2); b.set(x + 2, bot - 1); b.set(x + 3, bot); }
  else { b.set(x, top); b.set(x + 1, top + 1); b.vline(x + 2, top + 2, bot - 2); b.set(x + 1, bot - 1); b.set(x, bot); }
}
function fixParens(placed) {
  const st = [];
  const span = (i, j) => {
    let up = MET[placed[i].bx.f].up, dn = MET[placed[i].bx.f].dn;
    for (let k = i + 1; k < j; k++) { up = Math.max(up, placed[k].bx.up); dn = Math.max(dn, placed[k].bx.dn); }
    placed[i].bx.up = up; placed[i].bx.dn = dn;
    if (j < placed.length) { placed[j].bx.up = up; placed[j].bx.dn = dn; }
  };
  placed.forEach((P, i) => {
    if (P.bx.paren === '(') st.push(i);
    else if (P.bx.paren === ')' && st.length) span(st.pop(), i);
  });
  while (st.length) span(st.pop(), placed.length);
}

// caret: a zero-width box that records where the cursor goes
export function caret(out, f) {
  const m = MET[f];
  return { w: 0, up: m.up, dn: m.dn, caret: true, draw(b, x, ay) { out.x = x; out.top = ay - m.up; out.bot = ay + m.dn; } };
}
// split display text into boxes, turning ( and ) into growable parens
export function textBoxes(s, f, out = []) {
  let run = '';
  const flush = () => { if (run) out.push(box.text(run, f)); run = ''; };
  for (const c of s) {
    if (c === '(' || c === ')') { flush(); out.push(box.paren(c, f)); } else run += c;
  }
  flush();
  return out;
}

// ---------------- constants / unit pickers ----------------
export const KP = KPAGES.map((pg) => ({ rows: hexRows(pg.bits), items: pg.items }));
export const KPAGE_OF = []; // constant index -> [page, item]
KP.forEach((pg, pi) => pg.items.forEach((_, k) => KPAGE_OF.push([pi, k])));
export function constBox(i) { // the constant's own symbol bitmap (9 rows, big-font height)
  const [pi, k] = KPAGE_OF[i], pg = KP[pi], [x0, x1] = pg.items[k];
  let a = x0, z = x1;
  const col = (x) => pg.rows.some((r) => r[x]);
  while (a < z && !col(a)) a++;
  while (z > a && !col(z)) z--;
  return box.bits(pg.rows.map((r) => r.slice(a, z + 1)), z - a + 1, 9, 'L');
}
export function drawConstPage(b, page, sel, num) {
  b.hex(KTITLE, 0);
  if (num != null) digits5(b, num, 84, 0); else { digits5(b, '00', 84, 0); b.hline(83, 94, 6); }
  b.hex(KPAGES[page].bits, 8);
  if (sel != null) { const [x0, x1] = KP[page].items[sel]; b.hline(x0, x1, 17); }
}
export const UP = UPAGES.map((pg) => ({ ...pg }));
// unit names as laid out on each CONVT page (6-dot cells from column 6), in CONV_CATS order
const ULINES = [['feet m mil mm in', 'cm yd mile km'], ['ft² yd² m² mile²', 'km² ha acres'], ['°F °C'],
  ['gal liter B.gal', 'Pint fl.oz'], ['Tr.oz oz lb Kg g'], ['J cal.f'], ['atm kPa mmHg', 'cmH2O'], ['m/s km/h']];
const UITEMS = ULINES.map((lines) => lines.flatMap((ln, li) => {
  const out = []; let k = 0;
  for (const w of ln.split(' ')) { out.push([li, 6 + 6 * k - 1, 6 + 6 * (k + [...w].length) - 2]); k += [...w].length + 1; }
  return out;
}));
export function drawUnitPage(b, cat, sel, src) {
  // choosing the source unit: title + two unit lines (rows 10, 21); choosing the target: the title
  // goes, everything moves up 11 rows, the source is inverted and line 3 shows the converted value
  const pg = UPAGES[cat], rows = hexRows(pg.units), target = src != null, items = UITEMS[cat];
  if (!target) b.hex(pg.title, 0);
  rows.forEach((row, r) => { if (r !== 7) row.forEach((v, x) => v && b.set(x, target ? r - 1 : r + 10)); });
  const top = (ln) => (target ? (ln ? 10 : -1) : (ln ? 21 : 10));
  if (sel != null) { const [ln, x0, x1] = items[sel]; b.hline(x0, x1, top(ln) + 7); }
  if (target) { const [ln, x0, x1] = items[src]; b.invert(x0, Math.max(0, top(ln)), x1, top(ln) + 5); }
}

// ---------------- painting ----------------
const ICON_ROW = 1; // icons sit in pixel rows 1..12 of the 213×80 frame
export function paint(cv, b, icons, opt = {}) {
  const r = cv.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const u = Math.max(1, Math.floor((r.width * dpr) / 213));
  const PW = 213 * u, PH = 80 * u;
  if (cv.width !== PW || cv.height !== PH) { cv.width = PW; cv.height = PH; }
  const g = cv.getContext('2d');
  const css = getComputedStyle(cv);
  const on = css.getPropertyValue('--dot').trim() || '#000';
  const off = css.getPropertyValue('--dot-off').trim() || 'rgba(0,0,0,.035)';
  g.clearRect(0, 0, PW, PH);
  const gap = u >= 6 ? 1 : 0; // solid dots like the emulator; only a hairline gap on big screens
  const s = 2 * u - gap;
  g.globalAlpha = opt.alpha ?? 1;
  if (!opt.off) {
    g.fillStyle = off;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (!b.d[j * W + i]) g.fillRect((1 + 2 * i) * u, (14 + 2 * j) * u, s, s);
  }
  g.fillStyle = on;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (b.d[j * W + i]) g.fillRect((1 + 2 * i) * u, (14 + 2 * j) * u, s, s);
  const ig = 0;
  for (const name of icons) {
    const ic = ICONS[name];
    if (!ic) continue;
    const [x0, w, rows] = ic;
    rows.forEach((row, y) => { for (let i = 0; i < w; i++) if (row & (1 << (w - 1 - i))) g.fillRect((x0 + i) * u, (ICON_ROW + y) * u, u - ig, u - ig); });
  }
  g.globalAlpha = 1;
}
