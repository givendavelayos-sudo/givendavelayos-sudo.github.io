// Source adapters. Each turns external data into Ace records and reports problems
// instead of guessing. Nothing here stores passwords or tokens.
import { mk, parseLocal, hash } from './engine.js';

/* ------------------------------------------------------------ CSV */
export function parseCSV(text) {
  const rows = []; let row = [], f = '', q = false;
  text = String(text).replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; continue; }
    if (c === '"') q = true;
    else if (c === ',' || c === '\t') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
    else f += c;
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim() !== '')).map(r => r.map(x => x.trim()));
}

const SYN = {
  subject: ['subject', 'course', 'class', 'course title', 'subject title', 'descriptive title', 'title', 'course code', 'subject code'],
  section: ['section', 'block', 'group', 'class code'],
  date: ['date', 'class date', 'day date'],
  day: ['day', 'days', 'weekday'],
  start: ['start', 'start time', 'time start', 'from', 'time in'],
  end: ['end', 'end time', 'time end', 'to', 'time out'],
  time: ['time', 'schedule', 'time slot', 'period'],
  location: ['room', 'location', 'venue', 'place', 'building'],
  platform: ['platform', 'link', 'meeting link', 'zoom', 'online link', 'url'],
  mode: ['mode', 'format', 'modality', 'delivery', 'type'],
  instructor: ['instructor', 'teacher', 'faculty', 'professor', 'name', 'instructor name', 'email', 'instructor email'],
  status: ['status', 'remarks', 'note', 'notes'],
  id: ['id', 'uid', 'event id', 'schedule id'],
  role: ['role', 'lead', 'lead instructor', 'designation', 'position', 'is lead'],
  term: ['term', 'semester', 'period', 'academic period', 'school year', 'sy'],
  from: ['start date', 'effective', 'from date', 'valid from'],
  to: ['end date', 'until', 'to date', 'valid until'],
};
/** Map header names → column index. Explicit mapping wins over synonyms. */
export function detectColumns(header, explicit = {}) {
  const h = header.map(x => x.toLowerCase().trim()), cols = {};
  for (const [k, names] of Object.entries(SYN)) {
    if (explicit[k] != null && explicit[k] !== '') { const i = h.indexOf(String(explicit[k]).toLowerCase().trim()); if (i >= 0) { cols[k] = i; continue; } }
    const i = h.findIndex(x => names.includes(x));
    if (i >= 0 && !Object.values(cols).includes(i)) cols[k] = i;
  }
  return cols;
}

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
/** Dates as YYYY-MM-DD, M/D/YYYY (Philippine usage is month-first), or "Nov 12, 2026". */
export function parseDate(s) {
  s = String(s || '').trim(); let m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return { y: +m[1], m: +m[2], d: +m[3] };
  if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/))) return { y: +m[3] < 100 ? 2000 + +m[3] : +m[3], m: +m[1], d: +m[2] };
  if ((m = s.match(/([A-Za-z]{3,})\.?\s+(\d{1,2}),?\s+(\d{4})/))) {
    const w = m[1].toLowerCase(), mo = MONTHS[w.slice(0, 4)] || MONTHS[w.slice(0, 3)];
    if (mo) return { y: +m[3], m: mo, d: +m[2] };
  }
  return null;
}
/** "8:30 AM", "08:30", "1:00pm", "13:00". `hint` = meridiem of the range's end, used when start has none. */
export function parseTime(s, hint) {
  // Philippine notation: "12:00 NN" = noon, "12:00 MN" = midnight
  const n = String(s || '').trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(nn|n\.n\.|noon|mn|m\.n\.|midnight)$/i);
  if (n) return /^(nn|n\.n\.|noon)$/i.test(n[3]) ? { h: 12, mi: +(n[2] || 0), ap: 'p' } : { h: 0, mi: +(n[2] || 0), ap: 'a' };
  const m = String(s || '').trim().match(/^(\d{1,2})(?::(\d{2}))?\s*([ap])?\.?\s*m?\.?$/i);
  if (!m) return null;
  let h = +m[1]; const mi = +(m[2] || 0), ap = (m[3] || hint || '').toLowerCase();
  if (ap === 'p' && h < 12) h += 12;
  if (ap === 'a' && h === 12) h = 0;
  if (h > 23 || mi > 59) return null;
  return { h, mi, ap: m[3] ? m[3].toLowerCase() : null };
}
export function parseRange(s) {
  const parts = String(s || '').split(/\s*(?:-|–|—|to)\s*/i);
  if (parts.length !== 2) return null;
  const end = parseTime(parts[1]); if (!end) return null;
  const start = parseTime(parts[0], end.ap);
  if (!start) return null;
  // "11:00-1:00 PM" → start 11 AM, not 11 PM
  if (!/[ap]/i.test(parts[0]) && end.ap && start.h * 60 + start.mi > end.h * 60 + end.mi && start.h >= 12) start.h -= 12;
  return { start, end };
}

const ONLINE = /online|zoom|meet|teams|virtual|remote|async|sync/i;
/** Rows (with header) → sessions. Rows that cannot be read are returned as `skipped` with a reason. */
export function rowsToSessions(rows, { mapping = {}, identity = null } = {}) {
  if (!rows.length) return { sessions: [], skipped: [], cols: {} };
  const cols = detectColumns(rows[0], mapping), sessions = [], skipped = [];
  if (cols.subject == null) return { sessions, skipped: [{ row: 1, reason: 'No subject/course column found in header' }], cols };
  rows.slice(1).forEach((r, i) => {
    const g = k => cols[k] != null ? (r[cols[k]] || '').trim() : '';
    if (identity && cols.instructor != null && !matchesIdentity(g('instructor'), identity).match) return; // someone else's class
    const date = parseDate(g('date'));
    let range = g('start') && g('end') ? { start: parseTime(g('start'), parseTime(g('end'))?.ap), end: parseTime(g('end')) } : parseRange(g('time'));
    if (!date) return skipped.push({ row: i + 2, reason: `Unreadable date “${g('date')}”` });
    if (!range || !range.start || !range.end) return skipped.push({ row: i + 2, reason: `Unreadable time “${g('time') || g('start') + '-' + g('end')}”` });
    const start = mk(date.y, date.m, date.d, range.start.h, range.start.mi);
    let end = mk(date.y, date.m, date.d, range.end.h, range.end.mi);
    if (end <= start) end += 864e5;
    const mode = g('mode'), plat = g('platform'), loc = g('location');
    const online = ONLINE.test(mode) || (!loc && !!plat) || ONLINE.test(loc);
    const st = g('status').toLowerCase();
    sessions.push({
      externalId: g('id') || null, subject: g('subject'), section: g('section'), start, end,
      location: online ? '' : loc, platform: plat || (online ? loc : ''), format: online ? 'online' : 'in_person',
      instructor: g('instructor'), status: /cancel|suspend|no class/.test(st) ? 'cancelled' : 'scheduled', remarks: g('status'),
    });
  });
  return { sessions, skipped, cols };
}

/* ------------------------------------------------------------ ICS */
export function parseICS(text) {
  const lines = String(text).replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/);
  const out = []; let ev = null;
  const val = l => l.slice(l.indexOf(':') + 1).replace(/\\n/g, '\n').replace(/\\([,;\\])/g, '$1');
  const dt = l => {
    const v = val(l), params = l.slice(0, l.indexOf(':'));
    const m = v.match(/^(\d{4})(\d\d)(\d\d)(?:T(\d\d)(\d\d)(\d\d)?(Z)?)?/); if (!m) return NaN;
    if (m[7]) return Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0));
    const tz = (params.match(/TZID=([^;:]+)/) || [])[1];
    if (tz && tz !== 'Asia/Manila') return NaN; // refuse to guess other zones
    return mk(+m[1], +m[2], +m[3], +(m[4] || 0), +(m[5] || 0)); // floating or Manila
  };
  for (const l of lines) {
    if (l === 'BEGIN:VEVENT') ev = {};
    else if (l === 'END:VEVENT') { if (ev && ev.subject && !Number.isNaN(ev.start)) { if (!ev.end || Number.isNaN(ev.end)) ev.end = ev.start + 36e5; out.push(ev); } ev = null; }
    else if (ev) {
      const k = l.split(/[;:]/)[0];
      if (k === 'SUMMARY') ev.subject = val(l).trim();
      else if (k === 'DTSTART') ev.start = dt(l);
      else if (k === 'DTEND') ev.end = dt(l);
      else if (k === 'LOCATION') { const v = val(l).trim(); if (ONLINE.test(v) || /^https?:/.test(v)) { ev.platform = v; ev.format = 'online'; } else { ev.location = v; ev.format = 'in_person'; } }
      else if (k === 'UID') ev.externalId = val(l).trim();
      else if (k === 'STATUS') ev.status = /CANCELLED/i.test(val(l)) ? 'cancelled' : 'scheduled';
      else if (k === 'URL' && !ev.platform) ev.platform = val(l).trim();
    }
  }
  return out.map(e => ({ section: '', location: '', platform: '', format: 'in_person', status: 'scheduled', ...e }));
}

/* ------------------------------------------------------------ identity & lead sheet */
const toks = s => String(s || '').toLowerCase().replace(/[^a-z0-9@._ ]/g, ' ').split(/\s+/).filter(t => t.length > 1);
/** exact = email/ID or full-name match; partial = some name tokens only (→ unverified). */
export function matchesIdentity(cell, identity) {
  const c = String(cell || '').toLowerCase().trim();
  if (!c || !identity) return { match: false };
  const ids = [identity.email, identity.employeeId].filter(Boolean).map(x => x.toLowerCase().trim());
  if (ids.some(x => c === x || c.split(/[\s,;/]+/).includes(x))) return { match: true, exact: true };
  const want = toks(identity.name), have = new Set(toks(c.replace(/,/g, ' ')));
  if (!want.length) return { match: false };
  const hit = want.filter(t => have.has(t)).length;
  if (hit === want.length) return { match: true, exact: true };
  if (hit >= 1 && want.length >= 2 && hit >= want.length - 1) return { match: true, exact: false };
  return { match: false };
}

/**
 * Read lead-instructor assignments for `identity` from sheet rows.
 * The sheet's real layout decides what a "lead" row is: either a role column whose value is one of
 * cfg.leadRoleValues, or (if there is no role column) the sheet is a list of leads only — flagged.
 */
export function rowsToAssignments(rows, identity, { mapping = {}, leadValues = [] } = {}) {
  const warnings = [];
  if (!rows.length) return { assignments: [], warnings: ['Sheet is empty'] };
  const cols = detectColumns(rows[0], mapping);
  if (cols.instructor == null) return { assignments: [], warnings: ['No instructor column found — set the column name in Sources'], cols };
  if (cols.subject == null) return { assignments: [], warnings: ['No subject column found — set the column name in Sources'], cols };
  if (cols.role == null) warnings.push('No role column: every row for you is treated as a lead assignment (unverified)');
  const lv = leadValues.map(x => x.toLowerCase());
  const out = [];
  rows.slice(1).forEach((r, i) => {
    const m = matchesIdentity(r[cols.instructor], identity);
    if (!m.match) return;
    const role = cols.role != null ? (r[cols.role] || '').trim() : '';
    const isLead = cols.role == null ? null : lv.includes(role.toLowerCase());
    if (isLead === false) return;
    const term = cols.term != null ? r[cols.term] : '';
    const verified = m.exact && isLead === true;
    const reasons = [];
    if (!m.exact) reasons.push(`name only partly matches “${r[cols.instructor]}”`);
    if (isLead === null) reasons.push('no role column');
    out.push({ subject: r[cols.subject], section: cols.section != null ? r[cols.section] : '', term, role: role || 'lead', from: cols.from != null ? r[cols.from] : '', to: cols.to != null ? r[cols.to] : '',
      verified, reasons, row: i + 2, raw: r[cols.instructor] });
  });
  if (!out.length) warnings.push('No rows matched your identity — check the name/email in Sources');
  return { assignments: out, warnings, cols };
}

/* ------------------------------------------------------------ colour-coded topic grid (your lead sheet) */
// Layout (from the real sheet): row 1 = week-start dates ("Nov 9"), row 2 = "Week 5", column B = track #,
// body cells = "Topic\nZAA & GDL" (or "Topic by ZBB & ZAA"). In a cell containing your initials:
// neon-blue (cyan) background → you are LEAD; any other colour → SUPPORT.
const MON_RE = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})$/i;
const INIT = '[A-Z]{2,4}';
const LIST = `${INIT}(?:\\s*(?:&|and|,|\\/|<3|\\+)\\s*${INIT})*`;
const LIST_LINE = new RegExp(`^(?:by\\s+)?(${LIST})$`);
const LIST_TAIL = new RegExp(`\\s+(?:by\\s+)?(${INIT}(?:\\s*(?:&|and|,|\\/|<3|\\+)\\s*${INIT})+)$`);
const BY_TAIL = new RegExp(`\\s+by\\s+(${LIST})$`);

export const rgb = c => ({ r: c?.red || 0, g: c?.green || 0, b: c?.blue || 0 });
export const hex = c => '#' + [c.r, c.g, c.b].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
/** Neon blue / cyan (#00FFFF family). Royal blue #0000FF is NOT neon blue. */
export function colorClass(c) {
  const { r, g, b } = c;
  if (r > .9 && g > .9 && b > .9) return 'white';
  if (r <= .35 && g >= .8 && b >= .8) return 'neon_blue';
  if (r <= .5 && g >= .6 && b >= .6) return 'near_neon_blue'; // ambiguous → unverified
  return 'other';
}
/** Split a cell into topic, instructor initials and detail lines. */
export function splitCell(text) {
  const lines = String(text || '').split(/\n+/).map(l => l.trim()).filter(Boolean);
  let topic = [], inst = [], detail = [], found = false;
  for (const l of lines) {
    if (found) { detail.push(l); continue; }
    let m = l.match(LIST_LINE);
    if (m && /[&,/+]|and|<3|^by /.test(l) || (m && topic.length)) { inst = m[1]; found = true; continue; }
    m = l.match(BY_TAIL) || l.match(LIST_TAIL);
    if (m) { topic.push(l.slice(0, m.index).trim()); inst = m[1]; found = true; continue; }
    topic.push(l);
  }
  const initials = found ? (inst.match(new RegExp(INIT, 'g')) || []) : [];
  return { topic: topic.join(' ').trim(), initials, detail: detail.join(' ') };
}
function yearFor(mo, d, now) {
  const y = new Date(now + 8 * 36e5).getUTCFullYear();
  return [y - 1, y, y + 1].map(yy => ({ yy, t: mk(yy, mo, d) })).sort((a, b) => Math.abs(a.t - now) - Math.abs(b.t - now))[0].yy;
}
/**
 * Parse Google Sheets API grid data (sheets[i].data[0]) into your teaching units.
 * @param grid  { startRow, startColumn, rowData:[{values:[{formattedValue, effectiveFormat:{backgroundColor}}]}] }
 */
export function parseTopicGrid(grid, { initials, now }) {
  const rows = (grid.rowData || []).map(r => (r.values || []).map(v => ({ text: (v.formattedValue || '').trim(), c: rgb(v.effectiveFormat?.backgroundColor ?? v.userEnteredFormat?.backgroundColor) })));
  const warnings = [], units = [];
  const me = String(initials || '').trim().toUpperCase();
  if (!me) return { units, warnings: ['Set your initials (e.g. GDL) in Sources'] };
  // header rows
  let dateRow = -1, weekRow = -1;
  for (let i = 0; i < Math.min(rows.length, 6); i++) {
    if (dateRow < 0 && rows[i].filter(c => MON_RE.test(c.text)).length >= 2) dateRow = i;
    if (weekRow < 0 && rows[i].filter(c => /^week\b/i.test(c.text)).length >= 2) weekRow = i;
  }
  if (dateRow < 0) return { units, warnings: ['Could not find the row of week dates (e.g. “Nov 9”)'] };
  const width = Math.max(...rows.map(r => r.length));
  const colDate = {};
  for (let j = 0; j < width; j++) {
    const m = (rows[dateRow][j]?.text || '').match(MON_RE);
    if (m) { const mo = MONTHS[m[1].slice(0, 4).toLowerCase()] || MONTHS[m[1].slice(0, 3).toLowerCase()]; colDate[j] = { at: mk(yearFor(mo, +m[2], now), mo, +m[2]), inferred: false }; }
  }
  // columns with a "Week" label but no date: infer from the nearest dated column, 7 days per column
  const weekCols = weekRow >= 0 ? [...Array(width).keys()].filter(j => /^week\b/i.test(rows[weekRow][j]?.text || '')) : Object.keys(colDate).map(Number);
  const dated = weekCols.filter(j => colDate[j]);
  for (const j of weekCols) if (!colDate[j] && dated.length) {
    const ref = dated.reduce((a, b) => Math.abs(b - j) < Math.abs(a - j) ? b : a);
    const steps = weekCols.indexOf(j) - weekCols.indexOf(ref);
    colDate[j] = { at: colDate[ref].at + steps * 7 * 864e5, inferred: true };
  }
  const bodyStart = Math.max(dateRow, weekRow) + 1;
  const me_re = new RegExp(`(^|[^A-Z])${me}([^A-Z]|$)`);
  for (let i = bodyStart; i < rows.length; i++) {
    const track = rows[i].slice(0, 3).map(c => c.text).find(t => /^\d+$/.test(t)) || String(i - bodyStart + 1);
    for (const [js, d] of Object.entries(colDate)) {
      const cell = rows[i][js]; if (!cell || !me_re.test(cell.text)) continue;
      const p = splitCell(cell.text), cls = colorClass(cell.c);
      const role = cls === 'neon_blue' ? 'lead' : 'support';
      const reasons = [];
      if (!p.initials.includes(me)) reasons.push('initials found in text but not in the instructor list');
      if (cls === 'near_neon_blue') reasons.push(`colour ${hex(cell.c)} is close to neon blue`);
      if (d.inferred) reasons.push('week date inferred from neighbouring columns');
      const week = weekRow >= 0 ? rows[weekRow][js]?.text || '' : '';
      units.push({ key: `${E_dayKey(d.at)}|${track}`, weekStart: d.at, week, track, topic: p.topic || cell.text.split('\n')[0], detail: p.detail,
        instructors: p.initials, coInstructors: p.initials.filter(x => x !== me), role, color: hex(cell.c), colorClass: cls, verified: !reasons.length, reasons, cell: `${colName(+js + (grid.startColumn || 0))}${i + 1 + (grid.startRow || 0)}` });
    }
  }
  if (!units.length) warnings.push(`No cells contain “${me}”`);
  return { units: units.sort((a, b) => a.weekStart - b.weekStart), warnings };
}
const E_dayKey = ms => { const d = new Date(ms + 8 * 36e5); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`; };
export const colName = n => { let s = ''; n++; while (n) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s; };


/* ------------------------------------------------------------ evaluations (pasted from the hub page) */
// You copy the evaluation page while signed in and paste it here. We extract scores and comments and
// show everything for review before saving. Student names are not kept; long numbers/emails are masked.
const SCORE_AT_END = /^(.{3,90}?)[\s:|\t-]+([1-5](?:\.\d{1,2})?)(?:\s*(?:\/\s*5(?:\.0+)?|out of 5))?\s*$/i;
export function maskPII(t) { return String(t).replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email]').replace(/\b\d{6,}\b/g, '[id]'); }
export function parseEvalPaste(text) {
  // Handles both "Label 4.62" on one line and the hub layout (label line, then the score on its own line),
  // "73 evaluations · overall average 4.55 out of 5", and numbered comments that may span several lines.
  const raw = String(text || '').replace(/\\n/g, '\n');
  const lines = raw.split(/\r?\n/).map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const criteria = {}, comments = [], unparsed = []; let overall = null, inComments = false, numbered = false, responses = null, overallFound = false;
  const NUM = /^([1-5](?:\.\d{1,2})?)(?:\s*(?:\/\s*5(?:\.0+)?|out of 5))?$/;
  const SKIP = /^(results|instructor|type|batch|section|program|all|show results|students' evaluations are anonymous.*)$/i;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const ov = l.match(/overall (?:average|rating|mean)[^\d]*([1-5](?:\.\d{1,2})?)/i);
    const rc = l.match(/(\d+)\s+(?:evaluations?|responses?|respondents?|evaluators?)\b/i);
    if (ov || (rc && l.length < 80)) { if (ov) { overall = +ov[1]; overallFound = true; } if (rc) responses = +rc[1]; continue; }
    if (/^(comments?|feedback|remarks|suggestions?|student comments?)\b(\s*\(\d+\))?:?$/i.test(l)) { inComments = true; numbered = /^\d{1,3}[.)]\s/.test(lines[i + 1] || ''); continue; }
    if (inComments) {
      const n = l.match(/^(\d{1,3})[.)]\s*(.*)$/);
      const body = (n ? n[2] : l).replace(/^["“”']+|["“”']+$/g, '').trim();
      if (n || !numbered || !comments.length) { if (body && !/^(n\/?a|none|-+|\.)$/i.test(body)) comments.push(maskPII(body)); }
      else if (body) comments[comments.length - 1] += '\n' + maskPII(body); // continuation line of a multi-line comment
      continue;
    }
    const next = lines[i + 1] || '';
    if (!NUM.test(l) && NUM.test(next) && l.length >= 3 && l.length < 120 && !SKIP.test(l)) { // label, then score line
      criteria[l.replace(/[\s:|-]+$/, '')] = +next.match(NUM)[1]; i++; continue;
    }
    const m = l.match(SCORE_AT_END);
    if (m) {
      const label = m[1].replace(/[\s:|-]+$/, '').trim(), v = +m[2];
      if (/overall|general average|average rating|mean rating|total average|final rating/i.test(label)) { overall = v; overallFound = true; } else criteria[label] = v;
      continue;
    }
    unparsed.push(l);
  }
  if (overall == null) { const v = Object.values(criteria); if (v.length) overall = Math.round(v.reduce((a, b) => a + b, 0) / v.length * 100) / 100; }
  return { overall, overallComputed: overall != null && !overallFound, criteria, comments, responses, unparsed };
}

/* ------------------------------------------------------------ hub weekly grid (sections × days) */
// Copying the hub's schedule table gives tab-separated rows:
//   Sections | Time | Mon (Nov 2) | … | Sat (Nov 7)
//   X3 AM    | 7:30 AM - 11:30 AM | | GDL - B | …
// We keep ONLY cells whose instructor is you. Other people's cells are never stored.
const DAY_HDR = /^(mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?\s*(?:\(([^)]*)\))?/i;
export function parseScheduleGrid(text, { initials, weekStart, now = Date.now() }) {
  const me = String(initials || '').trim().toUpperCase();
  const lines = String(text || '').split(/\r?\n/);
  const rows = lines.map(l => l.split('\t').map(c => c.replace(/\s+/g, ' ').trim()));
  const hi = rows.findIndex(r => r.filter(c => DAY_HDR.test(c)).length >= 3);
  if (hi < 0 || !me) return null; // not a grid → caller falls back to the line parser
  const title = rows.slice(0, hi).map(r => r.join(' ').trim()).filter(Boolean).pop() || '';
  const hdr = rows[hi];
  const secCol = Math.max(0, hdr.findIndex(c => /^section/i.test(c)));
  const timeCol = hdr.findIndex(c => /^time/i.test(c));
  const ws = new Date(weekStart + 8 * 36e5);
  const dayCols = [];
  hdr.forEach((c, j) => {
    const m = c.match(DAY_HDR); if (!m) return;
    const d = m[2] && parseDate(m[2].replace(/^(\w+)\s+(\d+)$/, '$1 $2, ' + ws.getUTCFullYear()));
    const idx = (DAYS.indexOf(m[1].slice(0, 3).toLowerCase()) + 6) % 7;
    let at = d ? mk(d.y, d.m, d.d) : mk(ws.getUTCFullYear(), ws.getUTCMonth() + 1, ws.getUTCDate() + idx);
    if (d && Math.abs(at - (weekStart + idx * 864e5)) > 180 * 864e5) at = mk(d.y + (at < weekStart ? 1 : -1), d.m, d.d); // year rollover
    dayCols.push({ j, at });
  });
  const cellRe = new RegExp(`^${me}(?:\\s*[-–—]\\s*([A-Z0-9]{1,3}))?$`);
  const sessions = [], warnings = [];
  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i];
    const time = timeCol >= 0 ? r[timeCol] : r.find(c => parseRange(c));
    const range = parseRange(time || '');
    if (!range) continue; // spacer / note row
    const section = r[secCol] || '';
    const short = r.length < hdr.length - 1; // merged cells or trimmed row → day columns may be shifted
    for (const { j, at } of dayCols) {
      const m = (r[j] || '').toUpperCase().match(cellRe);
      if (!m) continue;
      const p = new Date(at + 8 * 36e5), Y = p.getUTCFullYear(), M = p.getUTCMonth() + 1, D = p.getUTCDate();
      const start = mk(Y, M, D, range.start.h, range.start.mi); let end = mk(Y, M, D, range.end.h, range.end.mi); if (end <= start) end += 864e5;
      const consult = /consult/i.test(section);
      const online = /online|remote/i.test(section);
      const group = m[1] || '';
      sessions.push({
        externalId: `grid:${p.toISOString().slice(0, 10)}|${section.toLowerCase()}|${range.start.h}:${range.start.mi}`,
        subject: consult ? section : `${title || 'Class'}${group ? ' · Group ' + group : ''}`, autoTopic: !consult, group, kind: consult ? 'consultation' : 'class',
        section, start, end, format: online ? 'online' : 'in_person', location: online ? '' : section, platform: online ? 'Online' : '',
        hybrid: /hyb/i.test(section), template: consult ? 'consult' : undefined, status: 'scheduled', weekTitle: title, uncertain: short,
      });
      if (short) warnings.push(`${section} row looks merged — check the day for ${section}`);
    }
  }
  return { sessions, unparsed: [...new Set(warnings)], title, format: 'grid' };
}

/* ------------------------------------------------------------ weekly schedule (pasted from hub "My Schedule") */
const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const RANGE_IN = /(\d{1,2}(?::\d{2})?\s*(?:[ap]\.?\s?m\.?)?)\s*(?:-|–|—|to)\s*(\d{1,2}(?::\d{2})?\s*(?:[ap]\.?\s?m\.?)?)/i;
const LOC = /\b(room|rm\.?|bldg|building|hall|lab|online|zoom|google meet|meet|teams|f2f|face[- ]to[- ]face|onsite|on-site)\b/i;
/** weekStart = Monday of the page's ?week= parameter. Every row is returned for review; nothing is saved silently. */
export function parseSchedulePaste(text, weekStartMs) {
  const lines = String(text || '').split(/\r?\n/).map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const out = [], unparsed = []; let day = null, pending = null;
  const ws = new Date(weekStartMs + 8 * 36e5);
  const dateOf = idx => mk(ws.getUTCFullYear(), ws.getUTCMonth() + 1, ws.getUTCDate() + idx);
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const dm = l.match(/^(sun|mon|tue|wed|thu|fri|sat)[a-z]*\.?\b/i);
    const dd = parseDate(l.replace(/^(sun|mon|tue|wed|thu|fri|sat)[a-z]*,?\s*/i, ''));
    const rm = l.match(RANGE_IN);
    if ((dm || dd) && !rm) {
      if (dd) day = mk(dd.y, dd.m, dd.d); else day = dateOf((DAYS.indexOf(dm[1].toLowerCase()) + 6) % 7);
      continue;
    }
    if (rm) {
      const r = parseRange(`${rm[1]}-${rm[2]}`);
      if (dm && !dd) day = dateOf((DAYS.indexOf(dm[1].toLowerCase()) + 6) % 7);
      if (!r || day == null) { unparsed.push(l); continue; }
      let rest = l.replace(RANGE_IN, '').replace(/^(sun|mon|tue|wed|thu|fri|sat)[a-z]*\.?\s*/i, '').replace(/^[\s|,·:-]+|[\s|,·:-]+$/g, '');
      if (!rest && pending) { rest = pending; pending = null; }
      if (!rest && lines[i + 1] && !RANGE_IN.test(lines[i + 1])) rest = lines[++i];
      const p = new Date(day + 8 * 36e5), Y = p.getUTCFullYear(), M = p.getUTCMonth() + 1, D = p.getUTCDate();
      const start = mk(Y, M, D, r.start.h, r.start.mi); let end = mk(Y, M, D, r.end.h, r.end.mi); if (end <= start) end += 864e5;
      const parts = rest.split(/\s[|·•]\s|\t| — /).map(x => x.trim()).filter(Boolean);
      const locPart = parts.find(x => LOC.test(x)) || '';
      const subject = (parts.filter(x => x !== locPart).join(' · ') || rest || 'Class').trim();
      const online = /online|zoom|meet|teams/i.test(locPart + ' ' + rest);
      out.push({ subject, section: '', start, end, location: online ? '' : locPart, platform: online ? locPart : '', format: online ? 'online' : 'in_person', status: /cancel|no class|suspend/i.test(l) ? 'cancelled' : 'scheduled', raw: l });
      continue;
    }
    if (day != null && l.length < 120) {
      const last = out[out.length - 1];
      if (last && LOC.test(l) && !last.location && !last.platform) { const on = /online|zoom|meet|teams/i.test(l); last[on ? 'platform' : 'location'] = l; if (on) last.format = 'online'; }
      else if (last && last.subject === 'Class') last.subject = l; else pending = l;
    }
    else unparsed.push(l);
  }
  return { sessions: out, unparsed };
}
export function weekFromUrl(url) { const m = String(url || '').match(/[?&]week=(\d{4}-\d\d-\d\d)/); return m ? m[1] : null; }

/* ------------------------------------------------------------ fetching */
/** Turn a normal Google Sheets link into its CSV export URL (works for link-viewable or published sheets). */
export function sheetCsvUrl(url) {
  const u = String(url || '').trim();
  if (/\/pub\?|output=csv|format=csv|tqx=out:csv/.test(u)) return u;
  const m = u.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!m) return u;
  const gid = (u.match(/[#&?]gid=(\d+)/) || [])[1];
  return `https://docs.google.com/spreadsheets/d/${m[1]}/gviz/tq?tqx=out:csv${gid ? '&gid=' + gid : ''}`;
}
export async function fetchText(url, { timeoutMs = 15000 } = {}) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctl.signal, credentials: 'omit', cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const txt = await r.text();
    if (/^\s*<!doctype html|<html/i.test(txt)) throw new Error('Got a web page, not data. The source may need sign-in, or the sheet is not shared/published.');
    return txt;
  } catch (e) {
    throw new Error(e.name === 'AbortError' ? 'Timed out' : /Failed to fetch|NetworkError|Load failed/i.test(e.message) ? 'Blocked by the browser (CORS) or offline. Publish the sheet to the web as CSV, or use the server sync.' : e.message);
  } finally { clearTimeout(t); }
}
/** Detect format and parse a schedule payload. */
export function parseSchedule(text, opts) {
  if (/BEGIN:VCALENDAR/.test(text)) return { sessions: parseICS(text), skipped: [], format: 'ics' };
  return { ...rowsToSessions(parseCSV(text), opts), format: 'csv' };
}
export const newId = p => `${p}_${hash(String(Math.random()) + Date.now())}`;
export { parseLocal };
