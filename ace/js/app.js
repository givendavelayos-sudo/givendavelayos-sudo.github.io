import * as E from './engine.js';
import * as S from './sources.js';

/* ================================================================ store */
const KEY = 'ace.v1';
try { localStorage.removeItem('ace.gkey'); } catch {} // the Google Sheets API key is no longer used
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/13n5Hfh216lruqi4I4wzNvIxEvPX4wkTp83bbMNF3boQ/edit?usp=sharing';
const HUB = { schedule: 'https://hub.gertcrev.com/admin/group-chat/my-schedule', evals: 'https://hub.gertcrev.com/admin/evaluations?show=1&instructor=a5a7af21-c35f-4dd8-b87c-d1c9a35ada32&type=&batch=&section=&program=' };
const blank = () => ({ v: 1, identity: { name: '', initials: 'GDL', email: '' }, cfg: { initials: 'GDL' }, sources: { schedule: {}, sheet: { url: SHEET_URL }, evals: {} },
  sessions: [], units: [], unitHistory: [], changes: [], readiness: {}, arrivals: {}, handouts: {}, exams: {}, assessments: [], duties: [], evals: [], practices: [], snooze: {}, notes: {}, notified: {}, review: [], imports: {} });
let state;
try { state = { ...blank(), ...JSON.parse(localStorage.getItem(KEY) || 'null') }; } catch { state = blank(); }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { toast('Could not save on this device'); } };

/* ================================================================ ui helpers */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const now = () => Date.now();
const cfg = () => E.cfgOf(state);
const pct = x => x == null ? '—' : Math.round(x * 100) + '%';
const I = {
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h14V10"/>',
  week: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  work: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
  growth: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  sources: '<path d="M4 7c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3z"/><path d="M4 7v10c0 1.7 3.6 3 8 3s8-1.3 8-3V7M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', flame: '<path d="M12 3s5 4.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-4 1.5-4S9 12 11 12c0-4 1-9 1-9z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  bell: '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  back: '<path d="M15 18l-6-6 6-6"/>', chev: '<path d="M9 6l6 6-6 6"/>', lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>', _face: '<path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M9 10v1M15 10v1M12 10v3h-1M9.5 16a3.5 3.5 0 0 0 5 0"/>',
  up: '<path d="M6 15l6-6 6 6"/>', down: '<path d="M6 9l6 6 6-6"/>', del: '<path d="M21 5H9l-6 7 6 7h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1z"/><path d="m16 10-4 4M12 10l4 4"/>', alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17v.5"/>', x: '<path d="M6 6l12 12M18 6 6 18"/>',
};
const ico = (n, s = 22) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${I[n]}</svg>`;
let toastT;
function toast(msg) { document.querySelector('.toast')?.remove(); const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.append(t); clearTimeout(toastT); toastT = setTimeout(() => t.remove(), 2600); }

/* ================================================================ actions */
// Manual assessments live in state.assessments; auto lead exams keep their progress in state.exams[id].
function assessRec(id) {
  const m = state.assessments.find(a => a.id === id); if (m) return m;
  if (!E.leadExams(state).some(e => e.id === id)) return null;
  return (state.exams ||= {})[id] ||= { stages: {} };
}
function markTask(id, on = true) {
  const t = now(), parts = id.split(':'), last = parts.at(-1);
  if (id.startsWith('rd:')) { const sid = id.slice(3, id.lastIndexOf(':')); (state.readiness[sid] ||= {}); on ? state.readiness[sid][last] = t : delete state.readiness[sid][last]; }
  else if (id.startsWith('ho:')) {
    const hid = id.slice(0, id.lastIndexOf(':')), h = (state.handouts[hid] ||= { stages: {} });
    if (last === 'submit') { if (on) return confirmSubmit(hid); if (!confirm('Undo this submission?')) return; delete h.submittedAt; delete h.cutoffAt; save(); render(); return; }
    h.stages ||= {}; on ? h.stages[last] = t : delete h.stages[last];
  } else if (id.startsWith('as:')) {
    const a = assessRec(parts[1]); if (!a) return;
    if (last === 'revision') { if (a.revision) a.revision.doneAt = on ? t : null; }
    else if (last === 'submit' && on) return confirmAssessSubmit(a.id);
    else { a.stages ||= {}; on ? a.stages[last] = t : delete a.stages[last]; }
  } else if (id.startsWith('du:')) { const d = state.duties.find(d => d.id === id.slice(3)); if (d) d.doneAt = on ? t : null; }
  save(); render();
}
function confirmSubmit(hid) {
  const h = E.handoutCycles(state, now(), { back: 2, ahead: 4 }).find(x => x.id === hid);
  sheet(`<h2>Confirm submission</h2><p class="muted small">Only mark this submitted once it has actually been sent. Ace never marks a submission on its own.</p>
    <label>Submitted at (Manila time)</label><input type="datetime-local" name="at" value="${E.toLocalInput(now())}">
    <label>Where / how (optional evidence)</label><input name="ev" placeholder="e.g. emailed to coordinator, uploaded to drive">
    <div class="row" style="margin-top:16px"><button class="btn ghost" data-a="close">Cancel</button><button class="btn" data-a="do-submit" data-id="${esc(hid)}" data-cut="${h?.cutoff || ''}">I submitted it</button></div>`);
}
function confirmAssessSubmit(aid) {
  sheet(`<h2>Confirm submission</h2><p class="muted small">Mark only after it was actually submitted.</p><label>Submitted at</label><input type="datetime-local" name="at" value="${E.toLocalInput(now())}">
    <div class="row" style="margin-top:16px"><button class="btn ghost" data-a="close">Cancel</button><button class="btn" data-a="do-asubmit" data-id="${esc(aid)}">I submitted it</button></div>`);
}
function logArrival(sid, status) {
  const s = E.teachingItems(state).find(x => x.id === sid) || state.sessions.find(x => x.id === sid);
  const t = now();
  state.arrivals[sid] = status ? { at: null, status, manual: true } : { at: t, status: E.arrivalStatus(t, s, cfg()) };
  save(); render();
  toast(status ? 'Arrival logged' : ({ early: 'Early — well done. Use the buffer to settle in.', on_time: 'On time. Aim for the early buffer next time.', late: 'Logged as late. Ace will move your leave-by earlier in your mind, not your record.' })[state.arrivals[sid].status]);
}

/* ================================================================ sheets (bottom) */
function sheet(html) { closeSheet(); const d = document.createElement('div'); d.className = 'scrim'; d.innerHTML = `<div class="sheet" role="dialog"><div class="grab"></div>${html}</div>`; d.addEventListener('click', e => { if (e.target === d) closeSheet(); }); document.body.append(d); }
function closeSheet() { document.querySelector('.scrim')?.remove(); }
const formVals = () => Object.fromEntries([...document.querySelectorAll('.sheet [name]')].map(el => [el.name, el.type === 'checkbox' ? el.checked : el.value]));

/* ================================================================ screens */
const TAB_ALIAS = { week: 'schedule', home: 'schedule', today: 'schedule', work: 'tasks', growth: 'performance', sources: 'connections' };
let tab = (location.hash || '#schedule').slice(1); tab = TAB_ALIAS[tab] || tab;
if (!['schedule', 'tasks', 'performance'].includes(tab)) tab = 'schedule'; // Ace opens on your week

/* ================================================================ shared UI pieces (design system) */
function header(title, sub) {
  const n = alerts().filter(isUrgent).length;
  return `<header class="top"><div class="grow"><h1>${esc(title)}</h1>${sub ? `<div class="sub">${esc(sub)}</div>` : ''}</div><div class="top-actions">
    <button class="icon-btn" data-a="alerts" aria-label="Alerts${n ? `, ${n} new` : ''}">${ico('bell', 20)}${n ? `<span class="dot">${n > 9 ? '9+' : n}</span>` : ''}</button>
    <button class="icon-btn" data-a="settings" aria-label="Settings">${ico('gear', 20)}</button></div></header>`;
}
const secH = (title, action = '') => `<div class="sec-h"><h2>${esc(title)}</h2>${action}</div>`;
const emptyCard = (title, text, actions = '') => `<div class="card empty"><b>${esc(title)}</b><span>${text}</span>${actions ? `<div class="empty-actions">${actions}</div>` : ''}</div>`;
const DOW3 = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const dateChip = (ms, cls = '') => { if (!ms) return '<div class="datechip">—</div>'; const p = E.P(ms); return `<div class="datechip ${cls}"><span>${DOW3[p.dow]}</span><b>${p.d}</b></div>`; };
const roleTag = (r, verified = true) => r ? `<span class="tag ${r}">${r === 'lead' ? 'Lead' : 'Support'}${verified ? '' : ' ?'}</span>` : '';
const bar = (v, max = 1, cls = '') => `<div class="prog ${cls}"><i style="width:${Math.max(0, Math.min(1, v / max)) * 100}%"></i></div>`;
const KIND = { handout: 'Handout', leadppt: 'Lead PowerPoint', draft: 'Assessment draft', exam: 'Exam', assessment: 'Assessment', duty: 'Lead duty' };
const STATUS = { overdue: ['bad', 'Overdue'], behind: ['amb', 'Behind plan'], soon: ['amb', 'Due soon'], ok: ['', 'On track'], done: ['ok', 'Done'] };
const dueText = (ms, t) => !ms ? 'No due date' : ms < t ? `Was due ${E.fmtDayRel(ms, t)} · ${E.fmtTime(ms)}` : `Due ${E.fmtDayRel(ms, t)} · ${E.fmtTime(ms)}`;
const scoreTxt = v => ui().hideScores ? '••••' : v == null ? '—' : (+v).toFixed(2);
function delivRow(d, t) {
  const [cls, label] = STATUS[d.status];
  const name = d.kind === 'duty' || !d.subject ? d.title : d.subject; // the type is on the line below
  return `<button class="lrow" data-a="deliv" data-id="${esc(d.id)}">${dateChip(d.due, d.status === 'overdue' ? 'bad' : '')}<div class="grow"><div class="l-t">${esc(name)}</div>
    <div class="l-s">${KIND[d.kind]}${d.due ? ' · ' + E.fmtTime(d.due) : ''} · ${d.done ? 'All steps done' : d.next ? 'Next: ' + esc(d.next.label) : ''}</div>${bar(d.doneCount, d.steps.length)}</div><span class="tag ${cls}">${label}</span></button>`;
}

/* ================================================================ Today */
const HOME_CARDS = [['next', 'Next class'], ['today', 'Focus today'], ['upcoming', 'Coming up'], ['performance', 'Performance']];

/* ================================================================ Schedule (week view, modelled on the hub's My Schedule) */
let schedWeek = 0, schedDay = null;
const fmtHrs = n => `${Math.round(n * 10) / 10}h`;
const MON3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const md = ms => { const p = E.P(ms); return `${MON3[p.m - 1]} ${p.d}`; };
const hourOf = ms => { const p = E.P(ms); return p.h + p.mi / 60; };
function schedule() {
  const t = now(), c = cfg(), u = ui(), mon = E.addDays(E.mondayOf(t), schedWeek * 7), end = E.addDays(mon, 7), todayKey = E.dayKey(t);
  const all = E.teachingItems(state);
  const wk = all.filter(s => !s.approx && s.start >= mon && s.start < end).sort((a, b) => a.start - b.start);
  const unit = (state.units || []).find(x => E.dayKey(x.weekStart) === E.dayKey(mon));
  const days = [...Array(7)].map((_, i) => E.addDays(mon, i));
  if (!schedDay || schedDay < E.dayKey(mon) || schedDay >= E.dayKey(end)) schedDay = todayKey >= E.dayKey(mon) && todayKey < E.dayKey(end) ? todayKey : E.dayKey(mon);
  const ofDay = k => wk.filter(s => E.dayKey(s.start) === k);
  const hrs = k => ofDay(k).reduce((n, s) => n + (s.end - s.start) / 36e5, 0);
  const total = wk.reduce((n, s) => n + (s.end - s.start) / 36e5, 0);
  const P = E.P(t), hello = P.h < 12 ? 'Good morning' : P.h < 18 ? 'Good afternoon' : 'Good evening', first = state.identity.name?.split(' ')[0];
  let h = header(`${hello}${first ? ', ' + first : ''}`, E.fmtDay(t));
  // 0 · After-class check (only right after a class, for up to 24 h)
  const db = E.pendingDebrief(state, t);
  if (db) {
    const a = state.debriefs?.[db.id] || {};
    const q = (k, label) => `<div class="db-q"><span>${label}</span><div class="seg sm">${[[true, 'Yes'], [false, 'No']].map(([v, l]) => `<button class="${a[k] === v ? 'on' + (v ? '' : ' bad') : ''}" data-a="db" data-id="${esc(db.id)}" data-k="${k}" data-v="${v}">${l}</button>`).join('')}</div></div>`;
    h += `<div class="card debrief"><div class="row" style="align-items:flex-start"><div class="grow"><div class="eyebrow">How did it go?</div><div class="l-t">${esc(db.section || db.subject)} · ${E.fmtDayRel(db.start, t)} ${E.fmtTime(db.start)}</div><div class="l-s">${esc(db.subject)}</div></div><button class="circle sm" data-a="db-skip" data-id="${esc(db.id)}" aria-label="Skip">${ico('x', 14)}</button></div>
      ${q('onTime', 'Started on time?')}${q('hardTopic', 'Covered the hardest topic?')}${q('posted', 'Posted slides & handouts?')}</div>`;
  }
  // 1 · What am I teaching next?  (+ Am I prepared? when enabled)
  const next = all.find(s => !s.approx && s.end > t && s.kind !== 'consultation');
  const nextWeek = !next && (state.units || []).find(x => x.weekStart + 7 * 864e5 > t);
  if (next) {
    const r = E.readiness(next, state, c), days2 = Math.round((E.startOfDay(next.start) - E.startOfDay(t)) / 864e5), inClass = t >= next.start;
    const chip = inClass ? 'In class now' : days2 === 0 ? `in ${E.fmtDur(next.start - t)}` : days2 === 1 ? 'tomorrow' : `in ${days2} days`;
    const lb = E.leaveBy(next, c), soon = !inClass && next.start - t < 3 * 36e5 && !state.arrivals[next.id];
    h += `<div class="card hero nextcard"><div class="eyebrow">Next class${next.role ? ' · ' + (next.role === 'lead' ? 'Lead' : 'Support') : ''}</div>
      <div class="h-title">${esc(next.subject)}</div>
      <div class="h-meta"><span>${E.fmtDayRel(next.start, t)} · ${E.fmtTime(next.start)}–${E.fmtTime(next.end)}</span><span class="when-chip">${chip}</span></div>
      <div class="h-meta"><span>${esc([next.section, next.location || next.platform].filter(Boolean).join(' · '))}</span></div>
      ${u.todayPrep ? `<div class="prep"><span>Prepared</span>${bar(r.done, r.total)}<b>${r.done}/${r.total}</b></div>` : ''}
      ${soon ? `<div class="h-alert">${ico('clock', 16)} ${next.format === 'online' ? 'Be online by' : 'Leave by'} <b>${E.fmtTime(lb)}</b></div>` : ''}
      <div class="h-actions">${soon ? `<button class="btn light" data-a="arrive" data-id="${esc(next.id)}">I’m here</button>` : ''}<button class="btn ${soon ? 'glass' : 'light'}" data-a="class" data-id="${esc(next.id)}">Prepare</button></div></div>`;
  } else h += `<div class="card hero nextcard"><div class="eyebrow">Next class</div><div class="h-title">Nothing scheduled yet</div><div class="h-meta"><span>${nextWeek ? `Next teaching week: ${esc(nextWeek.topic)} (${nextWeek.role === 'lead' ? 'Lead' : 'Support'}) · week of ${E.fmtDay(nextWeek.weekStart)}. Official schedule not released yet.` : 'Your classes appear here once the official schedule is released.'}</span></div>${nextWeek ? `<div class="h-actions"><button class="btn light" data-a="class" data-id="u:${esc(nextWeek.key)}">Prepare</button></div>` : ''}</div>`;
  // 2 · What must I accomplish soon?  — one row, only when genuinely close (≤ 3 days)
  if (u.showNextDeadline !== false) {
    const d = E.deadlines(state, t, 8).find(x => x.at - t < 3 * 864e5 && x.at > t - 2 * 864e5);
    if (d) { const late = d.at < t, dv = E.deliverables(state, t).find(x => x.id === d.ref || x.id === `as:${d.ref}` || x.id === `lp:${d.ref}`);
      h += `<button class="due-row ${late ? 'bad' : ''}" data-a="${dv ? 'deliv' : 'tab'}" data-id="${esc(dv ? dv.id : 'tasks')}"><span class="due-ico">${ico('clock', 18)}</span><div class="grow"><div class="l-t">${esc(d.title)}</div><div class="l-s">${late ? `Was due ${E.fmtDayRel(d.at, t)} · ${E.fmtTime(d.at)}` : `Due ${E.fmtDayRel(d.at, t)} · ${E.fmtTime(d.at)} · in ${E.fmtDur(d.at - t)}`}</div></div>${ico('chev', 16)}</button>`; }
  }
  // 3 · The week: strip + Week ⇄ Month
  const label = schedWeek === 0 ? 'This week' : schedWeek === 1 ? 'Next week' : schedWeek === -1 ? 'Last week' : `Week of ${E.fmtDay(mon)}`;
  const topic = unit ? `${unit.week} · ${unit.topic}` : wk.find(s => s.weekTitle)?.weekTitle || '';
  h += `<div class="viewtoggle" role="tablist"><button class="${u.schedView !== 'month' ? 'on' : ''}" data-a="sview" data-id="week" role="tab">Week</button><button class="${u.schedView === 'month' ? 'on' : ''}" data-a="sview" data-id="month" role="tab">Month</button></div>`;
  if (u.schedView === 'month') { h += calendarCard(t, c); return h + schedFooter(mon); }
  h += `<div class="card"><div class="head"><div class="grow"><h3>${label}</h3><div class="l-s">${esc(topic || `${E.fmtDay(mon)} – ${E.fmtDay(E.addDays(mon, 6))}`)}${total ? ` · ${fmtHrs(total)} of classes` : ''}</div></div>${unit ? roleTag(unit.role, unit.verified) : ''}
      <div class="row" style="gap:6px"><button class="circle sm" data-a="sweek" data-id="-1" aria-label="Previous week">${ico('back', 16)}</button><button class="circle sm" data-a="sweek" data-id="+1" aria-label="Next week">${ico('chev', 16)}</button></div></div>
    <div class="daystrip light">${days.map(d => { const k = E.dayKey(d), n = hrs(k), p = E.P(d); return `<button class="dchip ${n ? 'has' : ''} ${k === todayKey ? 'today' : ''} ${k === schedDay ? 'sel' : ''}" data-a="sday" data-id="${k}" aria-label="${E.fmtDay(d)}: ${n ? fmtHrs(n) + ' of classes' : 'no classes'}"><b>${DOW3[p.dow].slice(0, 1) + DOW3[p.dow].slice(1, 3).toLowerCase()}</b><span>${E.P(d).d}</span><i>${n ? fmtHrs(n) : 'off'}</i></button>`; }).join('')}</div>`;
  if (!wk.length) h += `<div class="warnbox soft" style="margin-top:12px">${unit ? 'Official schedule not released yet. Your classes appear here once the hub week is out.' : 'No classes this week.'}</div>`;
  else {
    const H0 = Math.min(7, ...wk.map(s => Math.floor(hourOf(s.start)))), H1 = Math.max(21, ...wk.map(s => Math.ceil(hourOf(s.end))));
    const PX = 26, ticks = []; for (let x = H0; x < H1; x += 2) ticks.push(x);
    const lab = x => `${(x % 12) || 12}${x < 12 ? 'a' : 'p'}`;
    h += `<div class="wgrid" style="--hours:${H1 - H0}"><div><div class="wg-head"></div><div class="wg-times">${ticks.map(x => `<span style="top:${(x - H0) * PX}px">${lab(x)}</span>`).join('')}</div></div>
      ${days.map(d => { const k = E.dayKey(d), p = E.P(d), isToday = k === todayKey;
        const blocks = ofDay(k).map(s => `<button class="wblock ${blockKind(s)} ${s.end < t ? 'past' : ''}" style="--c:${blockColor(s)};top:${(hourOf(s.start) - H0) * PX}px;height:${Math.max(18, (s.end - s.start) / 36e5 * PX - 2)}px" data-a="class" data-id="${esc(s.id)}" aria-label="${esc(s.subject)}, ${E.fmtTime(s.start)}"><b>${esc(s.kind === 'consultation' ? 'Consult' : s.format === 'online' ? 'Online' : s.section || 'Class')}</b><span>${esc(s.subject)}</span></button>`).join('');
        const nowLine = isToday && hourOf(t) >= H0 && hourOf(t) <= H1 ? `<i class="nowline" style="top:${(hourOf(t) - H0) * PX}px"></i>` : '';
        return `<div class="wg-col ${isToday ? 'today' : ''} ${k === schedDay ? 'sel' : ''}" data-a="sday" data-id="${k}"><div class="wg-head"><b>${DOW3[p.dow].slice(0, 1)}</b></div><div class="wg-body">${blocks}${nowLine}</div></div>`; }).join('')}</div>`;
  }
  h += `</div>`;
  // 4 · selected day
  const sel = E.parseLocal(schedDay), list = ofDay(schedDay);
  h += `<div class="card"><div class="head"><h3>${E.fmtDay(sel)}</h3>${schedWeek ? '<button class="link" data-a="sweek" data-id="0">This week</button>' : ''}</div>
    <div class="daylist">${list.length ? list.map(s => { const arr = state.arrivals[s.id], past = s.end < t;
      const right = arr ? `<span class="tag ${arr.status === 'late' ? 'bad' : 'ok'}">${arr.status === 'on_time' ? 'On time' : arr.status === 'early' ? 'Early' : 'Late'}</span>` : past ? '<span class="tag">Not logged</span>' : ico('chev', 16);
      return `<button class="lrow ${past ? 'past' : ''}" data-a="class" data-id="${esc(s.id)}"><span class="cbar" style="--c:${blockColor(s)}"></span><div class="grow"><div class="l-t">${E.fmtTime(s.start)}–${E.fmtTime(s.end)} · ${esc(s.kind === 'consultation' ? s.subject : s.format === 'online' ? 'Online' : s.section)}</div><div class="l-s">${esc([s.location, s.kind === 'consultation' ? 'Consultation' : s.subject].filter(Boolean).join(' · '))}${s.group ? ' · Group ' + esc(s.group) : ''}</div></div>${right}</button>`; }).join('')
      : `<div class="empty-line soft">No classes on ${E.fmtDay(sel)}.</div>`}</div></div>`;
  return h + schedFooter(mon);
}
const BLOCK_COLORS = ['#3e7c8c', '#c0582e', '#7a5cc2', '#b5803a', '#3f6fc4', '#b5476f'];
function blockColor(s) {
  if (s.format === 'online') return '#2f8f6a';
  if (s.kind === 'consultation') return '#6b7a72';
  const k = String(s.section || s.subject || '').replace(/\s*(AM|PM|EV|EVE)$/i, ''); let h = 0;
  for (const ch of k) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return BLOCK_COLORS[h % BLOCK_COLORS.length];
}
const blockKind = s => s.kind === 'consultation' ? 'consult' : s.format === 'online' ? 'online' : '';
const schedFooter = mon => `<div class="link-row"><button class="link" data-a="sched-menu" data-week="${E.dayKey(mon)}">${ico('plus', 14)} Update schedule</button></div>`;

/* ---------- iPhone alarms (via the Shortcuts app: web apps can't create Clock alarms themselves) */
const alarmCfg = () => ({ bathMin: 90, leaveMin: 30, shortcut: 'Ace Alarms', ...(ui().alarms || {}) });
function alarmPlan(s) {
  const c = cfg(), a = alarmCfg(), leave = E.leaveBy(s, c), online = s.format === 'online';
  const what = online ? 'log in' : 'leave';
  return { leave, online, items: [
    { at: leave - a.bathMin * 6e4, label: `Ace · Take a bath — ${what} by ${E.fmtTime(leave)}` },
    { at: leave - a.leaveMin * 6e4, label: `Ace · ${online ? 'Log in' : 'Leave'} in ${a.leaveMin} min (${E.fmtTime(leave)}) — ${s.section || s.subject}` },
  ].filter(x => a[x.label.includes('bath') ? 'bathMin' : 'leaveMin'] > 0) };
}
// Alarms are for leaving home, so only the first class of each day gets them.
const firstOfDay = s => !E.teachingItems(state).some(x => !x.approx && x.id !== s.id && E.dayKey(x.start) === E.dayKey(s.start) && x.start < s.start);
const firstClassToday = s => E.teachingItems(state).filter(x => !x.approx && E.dayKey(x.start) === E.dayKey(s.start)).sort((a, b) => a.start - b.start)[0];
const nextClassForAlarms = t => E.teachingItems(state).find(s => !s.approx && s.kind !== 'consultation' && firstOfDay(s) && E.leaveBy(s, cfg()) > t);
// Clock alarms have no date: they ring at the next occurrence of the time, so only hand them over within 24 h.
const alarmsReady = (plan, t) => plan.items.length && plan.items.every(x => x.at > t && x.at - t < 24 * 36e5);
const pad2 = n => String(n).padStart(2, '0');
const alarmLine = x => { const p = E.P(x.at); return `${p.y}-${pad2(p.m)}-${pad2(p.d)} ${pad2(p.h)}:${pad2(p.mi)}|${x.label}`; };
function setAlarms(s) {
  if (!firstOfDay(s)) s = firstClassToday(s);
  const t = now(), plan = alarmPlan(s);
  if (!alarmsReady(plan, t)) {
    const first = plan.items[0]?.at || plan.leave, from = first - 24 * 36e5;
    return toast(first <= t ? 'Too late for these alarms' : `iPhone alarms can be set from ${E.fmtDayRel(from, t)} ${E.fmtTime(from)} (24 h before)`);
  }
  const url = `shortcuts://run-shortcut?name=${encodeURIComponent(alarmCfg().shortcut)}&input=text&text=${encodeURIComponent(plan.items.map(alarmLine).join('\n'))}`;
  (window.__aceOpen || (u => { location.href = u; }))(url); // hook lets tests see the hand-off
  toast('Opening Shortcuts to set your alarms…');
}
const alarmButton = s => { const plan = alarmPlan(s), ready = alarmsReady(plan, now());
  return `<button class="srow alarm-row" data-a="alarms" data-id="${esc(s.id)}"><div class="grow"><div class="s-l">Set iPhone alarms</div><div class="s-s">${plan.items.map(x => `${E.fmtTime(x.at)} ${x.label.includes('bath') ? 'bath' : plan.online ? 'log in soon' : 'leave soon'}`).join(' · ')}${ready ? '' : ' · available 24 h before'}</div></div>${ico('clock', 18)}</button>`; };

/* ---------- calendar: lead/support weeks + what to do each day (past days too) */
let calMonth = 0, calDay = null;
function calendarCard(t, c) {
  const P0 = E.P(t); let y = P0.y, m = P0.m + calMonth; while (m > 12) { m -= 12; y++; } while (m < 1) { m += 12; y--; }
  const first = E.mk(y, m, 1), next = m === 12 ? E.mk(y + 1, 1, 1) : E.mk(y, m + 1, 1);
  const g0 = E.mondayOf(first), weeks = Math.ceil((next - g0) / (7 * 864e5)), g1 = E.addDays(g0, weeks * 7), todayKey = E.dayKey(t);
  const items = E.calendarItems(state, g0, g1, t), byDay = {};
  for (const it of items) (byDay[E.dayKey(it.at)] ||= []).push(it);
  if (!calDay || calDay < E.dayKey(g0) || calDay >= E.dayKey(g1)) calDay = todayKey >= E.dayKey(first) && todayKey < E.dayKey(next) ? todayKey : E.dayKey(first);
  const dot = it => it.doneAt ? 'done' : it.official ? (it.at < t ? 'missed' : 'due') : 'step';
  let rows = '';
  for (let w = 0; w < weeks; w++) {
    const mon = E.addDays(g0, w * 7), role = E.weekRole(state, mon);
    rows += `<div class="cal-row ${role ? role.role : ''}"><div class="cal-wk">${role ? `<b>${esc(role.week.replace('Week ', 'W'))}</b><span>${role.role === 'lead' ? 'Lead' : 'Sup'}</span>` : ''}</div>`;
    for (let i = 0; i < 7; i++) {
      const d = E.addDays(mon, i), k = E.dayKey(d), its = byDay[k] || [], inMonth = d >= first && d < next;
      const dots = [...new Set(its.map(dot))].sort((a, b) => ['missed', 'due', 'step', 'done'].indexOf(a) - ['missed', 'due', 'step', 'done'].indexOf(b)).slice(0, 3);
      rows += `<button class="cal-d ${inMonth ? '' : 'out'} ${k === todayKey ? 'today' : ''} ${k === calDay ? 'sel' : ''}" data-a="cday" data-id="${k}" aria-label="${E.fmtDay(d)}${its.length ? ', ' + its.length + ' items' : ''}"><span>${E.P(d).d}</span><i>${dots.map(x => `<em class="${x}"></em>`).join('')}</i></button>`;
    }
    rows += '</div>';
  }
  const sel = E.parseLocal(calDay), selRole = E.weekRole(state, E.mondayOf(sel)), list = byDay[calDay] || [];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `<div class="card cal"><div class="head"><h3>${MONTHS[m - 1]} ${y}</h3><div class="row" style="gap:6px"><button class="circle sm" data-a="cmon" data-id="-1" aria-label="Previous month">${ico('back', 16)}</button><button class="circle sm" data-a="cmon" data-id="1" aria-label="Next month">${ico('chev', 16)}</button></div></div>
    <div class="cal-row cal-h"><div class="cal-wk"></div>${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(x => `<div>${x}</div>`).join('')}</div>${rows}
    <div class="cal-legend"><span class="lg lead">Lead week</span><span class="lg support">Support week</span><span><em class="due"></em>Deadline</span><span><em class="step"></em>Step</span><span><em class="done"></em>Done</span></div>
    <div class="cal-sel"><div class="l-t">${E.fmtDay(sel)}</div><div class="l-s">${selRole ? `${esc(selRole.week)} · ${esc(selRole.topic)} · ${selRole.role === 'lead' ? 'you are lead' : 'support'}` : 'No teaching assignment this week'}</div>
    ${list.length ? list.map(it => `<button class="tick ${it.doneAt ? 'on' : ''} ${dot(it) === 'missed' ? 'missed' : ''}" data-a="${it.doneAt ? 'untask' : 'task'}" data-id="${esc(it.task)}"><span class="box">${ico('check', 15)}</span><span class="lbl">${esc(it.title)}<span class="hint">${it.official ? 'Deadline' : 'Step'} · ${E.fmtTime(it.at)}${it.kind === 'prep' ? ' · ' + esc(it.ctx) : ''}${it.doneAt ? ' · done ' + E.fmtDayRel(it.doneAt, t) : dot(it) === 'missed' ? ' · not marked done' : ''}</span></span></button>`).join('')
      : '<div class="empty-line soft">Nothing due this day.</div>'}</div></div>`;
}

/* ================================================================ Tasks */
function tasks() {
  const t = now(), all = E.deliverables(state, t), m = E.mondayOf(t);
  let h = header('Tasks', 'Handouts, PowerPoints, exams and duties');
  const groups = [['Overdue', d => !d.done && d.due && d.due < t], ['This week', d => !d.done && d.due >= t && d.due < E.addDays(m, 7)], ['Next week', d => !d.done && d.due >= E.addDays(m, 7) && d.due < E.addDays(m, 14)], ['Later', d => !d.done && (!d.due || d.due >= E.addDays(m, 14))], ['Done', d => d.done]];
  let any = false;
  for (const [name, f] of groups) { const l = all.filter(f); if (!l.length) continue; any = true; h += secH(name) + `<div class="card list">${l.map(d => delivRow(d, t)).join('')}</div>`; }
  const ex = Object.entries(state.excluded || {});
  if (ex.length) h += `<details class="card excl"><summary>${ex.length} not assigned to you ${ico('chev', 12)}</summary>${ex.map(([k, v]) => `<div class="lrow"><div class="grow"><div class="l-t small">${esc(exclTitle(k))}</div><div class="l-s">${esc(v.reason || 'Not assigned to you')} · ${E.fmtAgo(v.at, t)}</div></div><button class="btn sec sm" data-a="restore" data-id="${esc(k)}">Restore</button></div>`).join('')}</details>`;
  if (!any) h += emptyCard('No tasks yet', 'Handouts, lead PowerPoints and lead exams appear automatically from your lead sheet.');
  const c = cfg();
  h += `<button class="btn sec wide" data-a="add-deliv">${ico('plus', 16)} Add a deliverable</button>
    <button class="rules-note" data-a="panel" data-id="rules">Lead week: handout Wed before · PowerPoint Sat ${E.fmtTime(E.atTime(t, c.leadPptTime))} before · mastery Sun. Every teaching week: assessment draft that Wed ${E.fmtTime(E.atTime(t, c.examTime))} ${ico('chev', 12)}</button>`;
  return h;
}
function exclTitle(k) {
  let m;
  if ((m = k.match(/^ho:(\d{4}-\d\d-\d\d):(.+)$/))) return `${m[2].replace(/\b\w/g, c => c.toUpperCase())} handout · due ${E.fmtDay(E.parseLocal(m[1]))}`;
  if ((m = k.match(/^lp:u:(\d{4}-\d\d-\d\d)/))) return `Lead PowerPoint · week of ${E.fmtDay(E.parseLocal(m[1]))}`;
  if ((m = k.match(/^as:lx\|(\d{4}-\d\d-\d\d)/))) return `Assessment draft · week of ${E.fmtDay(E.parseLocal(m[1]))}`;
  return k;
}
function delivSheet(id) {
  const t = now(), d = E.deliverables(state, t).find(x => x.id === id); if (!d) return;
  const [cls, label] = STATUS[d.status];
  sheet(`<div class="row"><div class="eyebrow grow">${KIND[d.kind]}</div><span class="tag ${cls}">${label}</span></div><h2>${esc(d.title)}</h2>
    <div class="muted small">${dueText(d.due, t)}${d.verified ? '' : ' · date unverified'} · ${esc(d.note || '')}</div>${(d.flags || []).map(f => `<div class="warnbox">${esc(f)}</div>`).join('')}
    <div style="margin:14px 0 4px">${bar(d.doneCount, d.steps.length)}</div>
    <div class="steps">${d.steps.map(s => `<button class="tick ${s.doneAt ? 'on' : ''}" data-a="${s.doneAt ? 'untask' : 'task'}" data-id="${esc(s.task)}" data-back="${esc(id)}"><span class="box">${ico('check', 15)}</span><span class="lbl">${esc(s.label)}<span class="hint">${s.doneAt ? 'Done ' + E.fmtDayRel(s.doneAt, t) + ' · ' + E.fmtTime(s.doneAt) : (s.official ? 'Official deadline · ' : 'Suggested · ') + E.fmtDayRel(s.target, t) + ' ' + E.fmtTime(s.target)}</span></span></button>`).join('')}</div>
    <div class="muted small" style="margin-top:10px">Ace never marks something submitted on its own — tick “Submitted” only after you actually submit.</div>
    <div class="row" style="margin-top:14px;gap:8px;flex-wrap:wrap">${d.kind === 'leadppt' ? `<button class="btn sec sm" data-a="class" data-id="${esc(d.unitId)}">Full prep checklist</button>` : ''}
      ${(d.kind === 'exam' || d.kind === 'assessment') && d.done ? `<button class="btn sec sm" data-a="revision" data-id="${esc(d.ref)}">Revision requested</button>` : ''}
      ${d.auto || d.kind === 'handout' || d.kind === 'leadppt' ? `<button class="btn sec sm" data-a="not-mine" data-id="${esc(id)}">Not assigned to me</button>` : ''}
      ${(d.kind === 'assessment' || d.kind === 'exam') && !d.auto ? `<button class="btn sec sm danger" data-a="del-as" data-id="${esc(d.ref)}">Delete</button>` : ''}${d.kind === 'duty' ? `<button class="btn sec sm danger" data-a="del-duty" data-id="${esc(d.ref)}">Delete</button>` : ''}</div>`);
}

/* ================================================================ class checklist */
function classSheet(id) {
  const t = now(), c = cfg(), s = E.teachingItems(state).find(x => x.id === id) || E.unitItems(state).find(x => x.id === id) || state.sessions.find(x => x.id === id);
  if (!s) return;
  const r = E.readiness(s, state, c), arr = state.arrivals[s.id];
  // this week's deliverables for the same topic (handout, PowerPoint, draft)
  const work = s.unit ? E.deliverables(state, t).filter(d => ['handout', 'leadppt', 'draft'].includes(d.kind) && d.subject === s.subject) : [];
  const firstOpen = Object.keys(E.CATS).find(k => r.rows.some(x => x.cat === k && !x.doneAt));
  const groups = Object.entries(E.CATS).map(([k, label]) => { const rows = r.rows.filter(x => x.cat === k); if (!rows.length) return ''; const dn = rows.filter(x => x.doneAt).length;
    return `<details class="cat" ${k === firstOpen ? 'open' : ''}><summary>${label}<span>${dn === rows.length ? '✓ ' : ''}${dn}/${rows.length}</span></summary>
    ${rows.map(x => x.auto ? `<div class="tick on auto"><span class="box">${ico('check', 15)}</span><span class="lbl">${esc(x.label)}<span class="hint">Automatic · ${x.id === 'schedule_ok' ? 'from the official hub schedule' : 'Ace plans your leave-by time'}</span></span></div>` : `<button class="tick ${x.doneAt ? 'on' : ''}" data-a="rd" data-id="${esc(s.id)}" data-item="${x.id}"><span class="box">${ico('check', 15)}</span><span class="lbl">${esc(x.official && s.role === 'lead' ? x.label + ' · lead deadline' : x.label)}<span class="hint">${x.doneAt ? 'Done ' + E.fmtDayRel(x.doneAt, t) : 'By ' + E.fmtDayRel(s.start - x.lead * 36e5, t) + ' ' + E.fmtTime(s.start - x.lead * 36e5)}${s.unit && !E.SESSION_ITEMS.has(x.id) && !s.approx ? ' · shared this week' : ''}</span></span></button>`).join('')}</details>`; }).join('');
  const tpls = Object.entries(c.templates).map(([k, v]) => `<option value="${k}" ${E.templateFor(s, c) === v ? 'selected' : ''}>${esc(v.label)}</option>`).join('');
  sheet(`<div class="row"><div class="eyebrow grow">${s.approx ? 'Topic week' : 'Class'}${s.role ? ' · ' + (s.role === 'lead' ? 'Lead' : 'Support') : ''}</div>${roleTag(s.role)}</div>
    <h2>${esc(s.subject)}</h2><div class="muted small">${s.approx ? `Week of ${E.fmtDay(s.start)} · applies to every class of this topic` : `${E.fmtDay(s.start)} · ${E.fmtTime(s.start)}–${E.fmtTime(s.end)} · ${esc([s.section, s.location || s.platform].filter(Boolean).join(' · '))}`}</div>
    ${work.length ? `<div class="cat-h">This week’s work</div>${work.map(d => { const [cls, lab] = STATUS[d.status]; return `<button class="work-row" data-a="deliv" data-id="${esc(d.id)}"><div class="grow"><div class="l-t small">${esc(KIND[d.kind])}</div><div class="l-s">${dueText(d.due, t)}${d.next && !d.done ? ' · next: ' + esc(d.next.label) : ''}</div></div><span class="tag ${cls}">${lab}</span></button>`; }).join('')}` : ''}
    <div class="cat-h">Preparation <span>${r.done}/${r.total}</span></div>${bar(r.done, r.total)}
    ${groups}
    ${!s.approx && t > s.start - 3 * 36e5 ? `<div class="cat-h">Arrival</div>${arr ? `<div class="row"><span class="tag ${arr.status === 'late' ? 'bad' : 'ok'}">${esc(arr.status.replace('_', ' '))}${arr.at ? ' · ' + E.fmtTime(arr.at) : ''}</span><button class="link" data-a="unarrive" data-id="${esc(s.id)}">Undo</button></div>` :
      `<div class="seg"><button data-a="arrive" data-id="${esc(s.id)}">I’m here</button><button data-a="arrive-m" data-id="${esc(s.id)}" data-st="early">Early</button><button data-a="arrive-m" data-id="${esc(s.id)}" data-st="on_time">On time</button><button data-a="arrive-m" data-id="${esc(s.id)}" data-st="late">Late</button></div>`}` : ''}
    ${!s.approx && s.end > t ? `<div class="cat-h">Alarms</div>${firstOfDay(s) ? alarmButton(s) : `<div class="l-s" style="padding:6px 0">Alarms are set for your first class of the day: ${esc(firstClassToday(s).section || firstClassToday(s).subject)} at ${E.fmtTime(firstClassToday(s).start)}.</div>`}` : ''}
    <div class="link-row" style="margin-top:6px"><button class="link" data-a="checklist-toggle" data-id="${esc(s.id)}">${c.checklist === 'essentials' ? 'Show all items' : 'Show essentials only'}</button></div>
    <details class="more-opts"><summary>Notes & checklist type</summary><label>Notes</label><textarea data-a="note" data-id="${esc(s.id)}" placeholder="Hard parts, questions to expect, what to try…">${esc(state.notes[s.id] || '')}</textarea>
      <label>Checklist type</label><select data-a="tpl" data-id="${esc(s.id)}">${tpls}</select>
      ${s.source?.id === 'user' ? `<button class="btn sec sm danger" style="margin-top:12px" data-a="del-class" data-id="${esc(s.id)}">Delete class</button>` : ''}</details>`);
  // keep the open/closed state of checklist groups while ticking
  document.querySelectorAll('.sheet details.cat').forEach((d, i) => { if (openCats.has(i)) d.open = true; d.addEventListener('toggle', () => d.open ? openCats.add(i) : openCats.delete(i)); });
}
const openCats = new Set();

/* ================================================================ Performance */
function focusCard(f, ev, i) {
  const th = E.THEMES[f.key], crit = ev.criteria.find(x => E.themeForCriterion(x.name) === f.key), tm = ev.themes.find(x => x.key === f.key);
  return `<div class="card focus-card"><div class="row" style="align-items:flex-start"><span class="rank">${i + 1}</span><div class="grow"><div class="l-t">${esc(th.label)}</div>
    <div class="l-s">${crit ? `${esc(crit.name)} · ${scoreTxt(crit.latest)}` : 'From comments'}${tm?.neg ? ` · ${tm.neg} comment${tm.neg > 1 ? 's' : ''} raise it` : ''}</div>
    ${(() => { const d = E.debriefStats(state, now()), m = { pacing: ['hardTopic', 'covered the hardest topic'], materials: ['posted', 'posted materials'], punctuality: ['onTime', 'started on time'] }[f.key]; const r = m && d[m[0]]; return r ? `<div class="l-s habit">Your recent classes: ${m[1]} in ${r.yes} of ${r.n}</div>` : ''; })()}</div></div>
    ${th.tips.slice(0, 2).map(tip => { const ad = state.practices.some(p => p.text === tip && !p.archived); return `<div class="action"><span>${esc(tip)}</span>${ad ? '<span class="tag ok">Adopted</span>' : `<button class="btn sec sm" data-a="adopt" data-k="${f.key}" data-tip="${esc(tip)}">Adopt</button>`}</div>`; }).join('')}
    ${tm?.quotes.length ? `<details><summary>What students said (${tm.quotes.length}) · Ace’s reading</summary>${tm.quotes.map(q => `<div class="quote">“${esc(q)}”</div>`).join('')}</details>` : ''}</div>`;
}
function performance() {
  const t = now(), ev = E.analyzeEvals(state.evals);
  let improve = [];
  let h = header('Performance', 'Evaluations, habits and what to improve');
  h += sealedCard();
  if (!ev) { if (!pendingSealed().length) h += emptyCard('No evaluation yet', 'Import your evaluation results to see your scores and what to improve first.', `<button class="btn sm" data-a="merge">Import file</button><button class="btn sec sm" data-a="paste-eval">Paste from hub</button>`); }
  else {
    const last = state.evals.slice().sort((a, b) => (a.date || '').localeCompare(b.date || '')).at(-1);
    h += `<div class="card summary"><div class="perf-score big"><b>${scoreTxt(ev.latest?.v)}</b><span>of 5</span></div><div class="grow"><div class="l-t">${esc(last.period || 'Latest evaluation')}</div>
      <div class="l-s">${last.responses ? last.responses + ' responses · ' : ''}${ev.prev ? `${ev.latest.v >= ev.prev.v ? '▲' : '▼'} ${Math.abs(ev.latest.v - ev.prev.v).toFixed(2)} vs previous` : 'first evaluation in Ace'}</div>
      <div style="margin-top:8px">${bar(ev.latest?.v || 0, 5)}</div><div class="l-s">${ui().hideScores ? '' : `${(5 - (ev.latest?.v || 0)).toFixed(2)} to 5.00`}</div></div></div>`;
    // praise first: what students value (themes they praise + your strongest criteria)
    const praised = ev.themes.filter(x => x.pos > 0 && x.pos >= x.neg).sort((a, b) => b.pos - a.pos);
    const best = ev.criteria.slice().sort((a, b) => b.latest - a.latest).filter(c => c.latest >= 4.6).slice(0, 3);
    const quotes = E.praiseQuotes(state.evals, 3);
    if (praised.length || best.length) h += secH('What students praise') + `<div class="card praise"><div class="eyebrow">Your strengths</div>
      ${praised.length ? `<div class="p-list">${praised.slice(0, 5).map(x => `<span>${esc(x.label)} · ${x.pos}</span>`).join('')}</div>` : ''}
      ${best.length ? `<div class="l-s" style="margin-top:10px">Highest scores: ${best.map(c => `${esc(c.name)} <b>${scoreTxt(c.latest)}</b>`).join(' · ')}</div>` : ''}
      ${quotes.map(q => `<div class="quote">“${esc(q)}”</div>`).join('')}</div>`;
    h += secH('Scores by criterion') + `<div class="card list">${ev.criteria.map(c => `<div class="lrow crit"><div class="grow"><div class="l-t">${esc(c.name)}</div>${bar(c.latest, 5, c.latest < 4.5 ? 'amb' : '')}</div><b class="score">${scoreTxt(c.latest)}</b></div>`).join('')}</div>`;
    improve = E.focusAreas(ev).slice(0, 3).map(f => ({ f, ev }));
  }
  const j = E.journey(state, t);
  const dbs = E.debriefStats(state, t);
  const hab = [['Started on time', j.lead.punctual, `${j.logged} class${j.logged === 1 ? '' : 'es'}`], ['Covered the hard topic', dbs.hardTopic?.pct ?? null, dbs.hardTopic ? `${dbs.hardTopic.yes} of ${dbs.hardTopic.n}` : ''], ['Materials posted', dbs.posted?.pct ?? null, dbs.posted ? `${dbs.posted.yes} of ${dbs.posted.n}` : ''], ['Ready at class start', j.lead.readyAtStart, `${j.classes} class${j.classes === 1 ? '' : 'es'}`], ['Submitted on time', j.lead.responsibility, 'handouts & exams']].filter(x => x[1] != null);
  h += secH('Habits · last 30 days') + (hab.length ? `<div class="card stats">${hab.map(([l, v, n]) => `<div class="stat"><b>${pct(v)}</b><span>${l}</span><small>${n}</small></div>`).join('')}</div>`
    : `<div class="card"><div class="empty-line">After each class, Ace asks three quick questions on the Week screen. Your answers build these habits.</div></div>`);
  const pr = state.practices.filter(p => !p.archived);
  if (pr.length) h += secH('Practices you’re applying') + `<div class="card list">${pr.map(p => `<div class="lrow"><div class="grow"><div class="l-t small">${esc(p.text)}</div><div class="l-s">Applied ${p.applied.length}× ${p.applied.length ? '· last ' + E.fmtAgo(p.applied.at(-1), t) : ''}</div></div><button class="btn sec sm" data-a="apply" data-id="${esc(p.id)}">+1</button><button class="circle sm" data-a="unadopt" data-id="${esc(p.id)}" aria-label="Stop tracking">${ico('x', 14)}</button></div>`).join('')}</div>`;
  if (state.evals.length) h += secH('Evaluations', '<button class="link" data-a="paste-eval">Add</button>') + `<div class="card list">${state.evals.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')).map(e => `<div class="lrow"><div class="grow"><div class="l-t">${esc(e.period || e.date)}</div><div class="l-s">${esc(e.date)} · ${Object.keys(e.criteria || {}).length} criteria · ${(e.comments || []).length} comments · ${esc(e.source || '')}</div></div><b class="score">${scoreTxt(e.overall)}</b><button class="circle sm" data-a="del-eval" data-id="${esc(e.id)}" aria-label="Delete">${ico('x', 14)}</button></div>`).join('')}</div>`;
  if (improve.length) h += secH('What to improve') + `<div class="improve-note">From your scores and comments — pick one thing to work on next class.</div>` + improve.map(({ f, ev }, i) => focusCard(f, ev, i)).join('');
  return h;
}

/* ================================================================ Connections (Settings) */
function connectionsHTML() {
  const t = now(), c = cfg(), sh = state.sources.sheet, sc = state.sources.schedule;
  const fr = x => { const f = E.freshness(x, c, t); return `<span class="tag ${f.state === 'live' ? 'ok' : f.state === 'failed' ? 'bad' : 'amb'}">${esc(f.state === 'live' ? 'Up to date' : f.state === 'failed' ? 'Failed' : f.state === 'never' ? 'Not connected' : 'Outdated')}</span>`; };
  const wk = E.dayKey(E.mondayOf(t)), wk2 = E.dayKey(E.addDays(E.mondayOf(t), 7));
  const hist = (state.unitHistory || []).filter(h => h.type !== 'imported').slice(-4).reverse();
  const open = (state.review || []).filter(r => !r.resolvedAt);
  const imp = Object.values(state.imports || {}).filter(v => v.report?.units && (v.report.units.added || v.report.units.updated || v.report.units.unchanged)).sort((a, b) => b.at - a.at)[0];
  return `<div class="card"><div class="head"><h3>Lead & support weeks</h3><span class="tag ${(state.units || []).length ? 'ok' : 'amb'}">${(state.units || []).length ? 'From screenshots' : 'None yet'}</span></div>
    <div class="muted small">Send a screenshot of the lead-instructor sheet in your Claude chat whenever it changes; Ace is updated from it (cells with <b>${esc(c.initials || '—')}</b>: neon blue = Lead, other colours = Support).</div>
    <div class="small" style="margin-top:10px">${(state.units || []).length} teaching weeks · ${(state.units || []).filter(u => u.role === 'lead').length} lead${imp ? ` · last updated ${E.fmtAgo(imp.at, t)}` : ''}</div>
    ${hist.length ? `<div class="cat-h">Recent changes</div>${hist.map(x => `<div class="small" style="padding:3px 0">${esc(x.type)} · ${esc(x.topic)} <span class="muted">${E.fmtAgo(x.at, t)}</span></div>`).join('')}` : ''}</div>
  <div class="card" style="margin-top:12px"><div class="head"><h3>Class schedule (hub)</h3>${fr(sc)}</div>
    <div class="muted small">The hub needs your login, so Ace never stores your password. Open your week, Select All → Copy, then paste. Only your classes are kept, and you review them before saving.</div>
    <div class="row" style="margin-top:10px;gap:8px"><a class="btn sec sm" target="_blank" rel="noopener" href="${HUB.schedule}?week=${wk}">Open this week</a><a class="btn sec sm" target="_blank" rel="noopener" href="${HUB.schedule}?week=${wk2}">Open next week</a></div>
    <button class="btn wide" style="margin-top:10px" data-a="paste-sched">Paste schedule</button>
    <button class="link" style="margin-top:10px" data-a="file-sched">Import a CSV or .ics file instead</button></div>
  <div class="card" style="margin-top:12px"><div class="head"><h3>Evaluations (hub)</h3>${state.evals.length ? '<span class="tag ok">Imported</span>' : '<span class="tag amb">None yet</span>'}</div>
    <div class="muted small">Copy your results page and paste it, or import a file. Emails and ID numbers are masked. Results sent to Claude are shipped encrypted and unlocked in Performance with your passcode.</div>
    <div class="row" style="margin-top:10px;gap:8px"><a class="btn sec sm" target="_blank" rel="noopener" href="${HUB.evals}">Open results</a><button class="btn sec sm" data-a="paste-eval">Paste</button><button class="btn sec sm" data-a="merge">Import file</button></div></div>
  ${Object.values(state.imports || {}).some(v => v.report) || open.length ? `<div class="card" style="margin-top:12px"><div class="head"><h3>Imported evidence</h3></div>
    ${Object.entries(state.imports || {}).filter(([, v]) => v.report).map(([k, v]) => `<div class="small" style="padding:4px 0"><b>${esc(v.label || k)}</b><div class="muted">${esc(importSummary(v.report))} · ${E.fmtAgo(v.at, t)}</div></div>`).join('')}
    ${open.map(r => `<div class="lrow"><div class="grow"><div class="l-t small">${esc(r.title)}</div><div class="l-s">${esc(r.detail || '')}</div></div><button class="btn sec sm" data-a="review-ok" data-id="${esc(r.id)}">OK</button></div>`).join('')}
    <div class="muted small" style="margin-top:6px">Screenshot data is evidence, not a live source. Sync the sheet and paste the hub schedule to confirm it.</div></div>` : ''}`;
}

/* ================================================================ settings, alerts, lock */
function rulesHTML() {
  const c = cfg();
  return `<div class="card">
    <div class="two"><div><label>Handout cutoff (Wed before the week)</label><input type="time" data-f="cfg.cutoffTime" value="${esc(c.cutoffTime)}"></div><div><label>&nbsp;</label><label class="row" style="margin:12px 0 0;color:var(--text)"><input type="checkbox" style="width:auto" data-f="cfg.cutoffVerified" ${c.cutoffVerified ? 'checked' : ''}> Confirmed</label></div></div>
    <label>Handouts needed for my…</label><div class="seg"><button class="${c.handoutRoles.includes('lead') ? 'on' : ''}" data-a="hrole" data-id="lead">Lead weeks</button><button class="${c.handoutRoles.includes('support') ? 'on' : ''}" data-a="hrole" data-id="support">Support weeks</button></div>
    <label class="row" style="color:var(--text)"><input type="checkbox" style="width:auto" data-f="cfg.handoutRolesVerified" ${c.handoutRolesVerified ? 'checked' : ''}> Confirmed with coordinator</label>
    <div class="two"><div><label>Lead PowerPoint: days before Monday (2 = Sat)</label><input type="number" min="0" data-f="cfg.leadPptDaysBefore" value="${c.leadPptDaysBefore}"></div><div><label>…due at</label><input type="time" data-f="cfg.leadPptTime" value="${esc(c.leadPptTime)}"></div></div>
    <div class="two"><div><label>Arrive early (min)</label><input type="number" data-f="cfg.arriveEarlyMin" value="${c.arriveEarlyMin}"></div><div><label>Travel time (min)</label><input type="number" data-f="cfg.travelMin" value="${c.travelMin}"></div></div>
    <div class="two"><div><label>Online setup buffer (min)</label><input type="number" data-f="cfg.onlineSetupMin" value="${c.onlineSetupMin}"></div><div><label>Prep time per day (min)</label><input type="number" data-f="cfg.dailyMinutes" value="${c.dailyMinutes}"></div></div>
    <div class="two">${['lead', 'support'].map(r => `<div><label>${r === 'lead' ? 'Lead' : 'Support'} weeks are taught</label><select data-f="cfg.${r}Format"><option value="in_person" ${c[r + 'Format'] === 'in_person' ? 'selected' : ''}>In person</option><option value="online" ${c[r + 'Format'] === 'online' ? 'selected' : ''}>Online</option></select></div>`).join('')}</div>
    <div class="two"><div><label>Assessment draft due (that week’s Wed)</label><input type="time" data-f="cfg.examTime" value="${esc(c.examTime)}"></div><div><label>Draft effort (hours)</label><input type="number" step="0.5" data-f="cfg.examEffortH" value="${c.examEffortH}"></div></div>
    <label>Holidays (YYYY-MM-DD, comma separated)</label><input data-f="cfg.holidays" value="${esc(c.holidays.join(', '))}">
    <label>Moved or skipped cutoff</label><div class="two"><input type="date" id="ovDate" placeholder="Normal Wednesday"><input type="datetime-local" id="ovTo"></div>
    <div class="row" style="margin-top:8px;gap:8px"><button class="btn ghost sm" data-a="ov-set">Move to new time</button><button class="btn ghost sm" data-a="ov-skip">No handout that week</button></div>
    ${Object.entries(c.cutoffOverrides).map(([k, v]) => `<div class="small" style="margin-top:6px">${esc(k)} → ${esc(v)} <button class="link" data-a="ov-del" data-id="${esc(k)}">remove</button></div>`).join('')}</div>`;
}
/* ---------- preferences (stored with your data; exported in backups) */
const UI_DEF = { theme: 'system', accent: '', hideScores: false, clock24: false, home: { order: HOME_CARDS.map(x => x[0]), hidden: {} },
  notif: { leave: true, deadlines: true, leadppt: true, changes: true, morning: false, morningTime: '06:30' }, dismissed: {} };
function ui() {
  const u = (state.ui ||= {});
  for (const [k, v] of Object.entries(UI_DEF)) if (u[k] === undefined) u[k] = JSON.parse(JSON.stringify(v));
  u.home.hidden ||= {};
  if (!u.mig065) { u.home.hidden.today = true; u.mig065 = true; } // you asked to hide Today's reminders (turn back on in Settings → Home screen)
  if (!u.mig066) { u.home.hidden.today = true; u.home.hidden.upcoming = true; u.todayPrep = false; u.mig066 = true; } // …all of them, for now
  u.home.order = [...new Set([...(u.home.order || []).filter(k => HOME_CARDS.some(x => x[0] === k)), ...UI_DEF.home.order])];
  u.notif = { ...UI_DEF.notif, ...u.notif };
  return u;
}
const ACCENTS = [['Green', ''], ['Teal', '#2f9e95'], ['Blue', '#4f8fe0'], ['Indigo', '#6b6fe0'], ['Purple', '#9a63d6'], ['Pink', '#d45d92'], ['Orange', '#d9843a'], ['Gold', '#c9a13a']];
function mixHex(a, b, w) { const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); const x = p(a), y = p(b); return '#' + x.map((v, i) => Math.round(v * (1 - w) + y[i] * w).toString(16).padStart(2, '0')).join(''); }
const mq = matchMedia('(prefers-color-scheme: light)');
function applyTheme() {
  const u = ui(), el = document.documentElement, t = u.theme === 'system' ? (mq.matches ? 'light' : 'dark') : u.theme;
  el.dataset.theme = t;
  if (u.accent && /^#[0-9a-f]{6}$/i.test(u.accent)) {
    el.style.setProperty('--green', u.accent);
    el.style.setProperty('--green-2', t === 'light' ? mixHex(u.accent, '#000000', .12) : mixHex(u.accent, '#ffffff', .3));
    el.style.setProperty('--green-soft', `color-mix(in srgb, ${u.accent} 22%, var(--bg))`);
  } else ['--green', '--green-2', '--green-soft'].forEach(v => el.style.removeProperty(v));
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', { light: '#f3f6f4', amoled: '#000000' }[t] || '#0d1210');
  E.setClock24(!!u.clock24);
  try { localStorage.setItem('ace.theme', t); localStorage.setItem('ace.accent', u.accent || ''); } catch {}
}
mq.addEventListener?.('change', () => { if (ui().theme === 'system') { applyTheme(); render(); } });

/* ---------- alerts (the bell) */
function alerts() {
  const t = now(), c = cfg(), u = ui(), out = [];
  const add = (id, o) => { if (!u.dismissed[id]) out.push({ id, ...o }); };
  for (const x of (state.changes || []).filter(x => !x.seen)) {
    const s = x.after || x.before;
    add(`ch:${x.key}:${x.at}`, { tone: x.type === 'added' ? '' : x.type === 'changed' ? 'amb' : 'bad', icon: 'week', change: x,
      title: `${{ added: 'New class', changed: 'Class changed', cancelled: 'Class cancelled', missing: 'Class no longer listed' }[x.type]} · ${s.subject}`,
      sub: `${E.fmtDay(s.start)} · ${E.fmtTime(s.start)}${x.fields ? ' · ' + x.fields.join(', ') : ''}${x.type === 'missing' ? ' · unconfirmed' : ''}`, act: 'tab', actId: 'schedule', label: 'View' });
  }
  const first = state.sources.sheet.firstOk || 0;
  for (const h of (state.unitHistory || []).filter(h => ['added', 'changed', 'removed'].includes(h.type) && t - h.at < 14 * 864e5 && h.at > first)) {
    const lead = h.role === 'lead' || h.to?.role === 'lead';
    add(`uh:${h.key}:${h.at}`, { tone: lead ? 'lead' : 'amb', icon: 'sources',
      title: h.type === 'added' ? `${h.role === 'lead' ? 'New lead week' : 'New support week'} · ${h.topic}` : h.type === 'removed' ? `Removed from the sheet · ${h.topic}` : `${h.topic} · ${Object.entries(h.to || {}).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' · ')}`,
      sub: `Week of ${E.fmtDay(h.weekStart)}`, act: 'tab', actId: 'tasks', label: 'Open' });
  }
  for (const d of E.deadlines(state, t, 12)) if (d.at - t < 48 * 36e5) add(`dl:${d.kind}:${d.ref}:${d.at}`, { tone: d.at < t ? 'bad' : 'amb', icon: 'clock', title: d.title,
    sub: d.at < t ? `Passed ${E.fmtDur(t - d.at)} ago — confirm once submitted` : `Due ${E.fmtDayRel(d.at, t)} ${E.fmtTime(d.at)} · in ${E.fmtDur(d.at - t)}`, act: 'tab', actId: 'tasks', label: 'Open' });
  const next = E.teachingItems(state).find(s => !s.approx && s.end > t);
  if (next && next.start - t < 24 * 36e5) {
    const r = E.readiness(next, state, c);
    if (r.pct < 1) add(`rd:${next.id}:${E.dayKey(t)}`, { tone: next.start - t < 6 * 36e5 ? 'bad' : 'amb', icon: 'check', title: `${r.unconfirmed} prep item${r.unconfirmed > 1 ? 's' : ''} open · ${next.subject}`, sub: `Class ${E.fmtDayRel(next.start, t)} ${E.fmtTime(next.start)}`, act: 'class', actId: next.id, label: 'Checklist' });
    const lb = E.leaveBy(next, c);
    if (!state.arrivals[next.id] && lb - t < 3 * 36e5 && next.start > t) add(`lb:${next.id}`, { tone: lb < t ? 'bad' : '', icon: 'clock', title: `${next.format === 'online' ? 'Be online by' : 'Leave by'} ${E.fmtTime(lb)}`, sub: `${next.subject} at ${E.fmtTime(next.start)}`, act: 'class', actId: next.id, label: 'Open' });
  }
  for (const [k, label] of [['schedule', 'Class schedule']]) {
    const f = E.freshness(state.sources[k], c, t);
    if (f.state === 'failed' || f.state === 'stale') add(`sy:${k}:${E.dayKey(t)}`, { tone: f.state === 'failed' ? 'bad' : 'amb', icon: 'sources', title: `${label}: ${f.state === 'failed' ? 'sync failed' : 'may be outdated'}`, sub: f.label, act: 'tab', actId: 'connections', label: 'Update' });
  }
  for (const x of pendingSealed()) add(`sl:${x.id}`, { tone: 'lead', icon: 'lock', title: 'Your evaluation is ready to unlock', sub: 'Enter the passcode from your Claude chat in Performance', act: 'tab', actId: 'performance', label: 'Open' });
  for (const r of state.review || []) if (!r.resolvedAt) add(`rv:${r.id}`, { tone: 'amb', icon: 'alert', title: `Needs review · ${r.title}`, sub: r.detail || '', act: 'review', actId: r.id, label: 'Details', review: r });
  const order = { bad: 0, lead: 1, amb: 2, '': 3 };
  return out.sort((a, b) => order[a.tone] - order[b.tone]);
}
const isUrgent = a => a.tone === 'bad' || a.id.startsWith('lb:') || (a.id.startsWith('dl:') && +a.id.split(':').pop() - Date.now() < 24 * 36e5);
function alertsSheet() {
  const all = alerts(), urgent = all.filter(isUrgent), review = all.filter(a => a.review && !isUrgent(a)), other = all.filter(a => !isUrgent(a) && !a.review);
  const sec = (title, l) => l.length ? `<div class="alert-sec">${title}</div>` + l.map(alertRow).join('') : '';
  sheet(`<div class="row" style="justify-content:space-between"><h2>Alerts</h2>${all.length ? '<button class="link" data-a="alerts-clear">Mark all read</button>' : ''}</div>
    ${all.length ? sec('Needs attention', urgent) + sec('Coming up', other) + sec('For your review', review) : `<div class="empty"><b>All caught up</b>Urgent deadlines, schedule changes and questions about your data show up here.</div>`}`);
}
const alertRow = a => `<div class="alert ${a.tone}"><span class="a-ico">${ico(a.icon, 18)}</span><div class="grow"><div class="a-t">${esc(a.title.replace(/^Needs review · /, ''))}</div><div class="muted small">${esc(a.sub)}</div></div>
      <button class="btn sm ghost" data-a="alert-go" data-id="${esc(a.id)}">${esc(a.label)}</button><button class="circle" style="width:32px;height:32px" data-a="alert-x" data-id="${esc(a.id)}" aria-label="Dismiss">${ico('x', 14)}</button></div>`;
function dismissAlert(id) {
  const a = alerts().find(x => x.id === id);
  ui().dismissed[id] = now();
  if (a?.change) a.change.seen = true;
  const t = now(); for (const [k, v] of Object.entries(ui().dismissed)) if (t - v > 30 * 864e5) delete ui().dismissed[k];
  save();
}

/* ---------- settings panels */
const panels = [];
let setQ = '';
function openPanel(name) { panels.push(name); renderPanel(true); }
function backPanel() { panels.pop(); if (panels.length) renderPanel(true, -1); else closePanel(); }
function closePanel() { panels.length = 0; const p = $('.panel'); if (p) { p.classList.add('out'); setTimeout(() => p.remove(), 230); } render(); }
function renderPanel(anim, dir = 1) {
  let p = $('.panel'); const fresh = !p;
  if (!p) { p = document.createElement('div'); p.className = 'panel'; document.body.append(p); }
  const body = p.querySelector('.panel-body'), keep = body && !anim ? body.scrollTop : 0;
  const [title, html] = PANELS[panels.at(-1)]();
  p.innerHTML = `<div class="panel-top"><button class="icon-btn" data-a="pback" aria-label="Back">${ico(panels.length > 1 ? 'back' : 'x', 20)}</button><h2>${esc(title)}</h2><span style="width:40px"></span></div><div class="panel-body">${html}</div>`;
  p.querySelector('.panel-body').scrollTop = keep;
  if (fresh) p.classList.add('in');
  else if (anim) { p.style.setProperty('--dir', dir); const b2 = p.querySelector('.panel-body'); b2.classList.add('screen-in'); }
  if (panels.at(-1) === 'settings') filterSettings();
}
const grp = (title, rows) => `<div class="group"><div class="group-t">${esc(title)}</div><div class="glist">${rows.join('')}</div></div>`;
const rowLink = (label, sub, a, id = '', extra = '') => `<button class="srow" data-a="${a}" data-id="${esc(id)}"><div class="grow"><div class="s-l">${esc(label)}</div>${sub ? `<div class="s-s">${esc(sub)}</div>` : ''}</div>${extra}${ico('chev', 16)}</button>`;
const rowToggle = (label, sub, path, on) => `<label class="srow"><div class="grow"><div class="s-l">${esc(label)}</div>${sub ? `<div class="s-s">${esc(sub)}</div>` : ''}</div><input type="checkbox" class="switch" data-f="${path}" ${on ? 'checked' : ''}></label>`;
const rowBox = (label, html, sub = '') => `<div class="srow col"><div class="s-l">${esc(label)}</div>${sub ? `<div class="s-s">${esc(sub)}</div>` : ''}${html}</div>`;
const VERSION = '0.8.2';
function importSummary(r) {
  if (!r) return '';
  const x = [];
  if (r.sessions?.added) x.push(`${r.sessions.added} class${r.sessions.added > 1 ? 'es' : ''}`);
  if (r.units?.added) x.push(`${r.units.added} teaching week${r.units.added > 1 ? 's' : ''}`);
  if (r.evals?.added) x.push(`${r.evals.added} evaluation${r.evals.added > 1 ? 's' : ''}`);
  if (r.review) x.push(`${r.review} to review`);
  const same = (r.sessions?.unchanged || 0) + (r.units?.unchanged || 0) + (r.evals?.unchanged || 0);
  if (same) x.push(`${same} already in Ace`);
  if (r.units?.skipped) x.push(`${r.units.skipped} weeks kept from live sheet`);
  return x.join(' · ') || 'nothing new';
}
async function applyImport(data, id, label) {
  const m = E.importMerge(state, data, { now: Date.now() });
  state = m.state; if (id) (state.imports ||= {})[id] = { at: Date.now(), report: m.report, label: label || data.label || id };
  save(); render(); return m.report;
}
/* One-time imports shipped with the app (your screenshot data). Runs once per device; safe to re-run. */
// Private data ships encrypted (public repo): unlocked once on the device with a passcode given in the Claude chat.
const SEALED = [{ url: 'seed/sealed/evaluation-2026-11-06.json', id: 'sealed:evaluation-2026-11-06', label: 'Your evaluation results · Nov 6, 2026', evalId: 'e_hub_2026_11_06' }];
const pendingSealed = () => SEALED.filter(x => !state.imports?.[x.id] && !(state.evals || []).some(e => e.id === x.evalId));
function sealedCard() {
  const p = pendingSealed()[0]; if (!p) return '';
  return `<div class="card unlock"><div class="row"><span class="a-ico">${ico('lock', 18)}</span><div class="grow"><div class="l-t">${esc(p.label)}</div><div class="l-s">Stored encrypted. Enter the passcode from your Claude chat once to add it to Ace.</div></div></div>
    <div class="row" style="margin-top:12px;gap:8px"><input type="password" id="sealpass" placeholder="Passcode" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false"><button class="btn sm" data-a="unseal" data-id="${esc(p.id)}">Unlock</button></div></div>`;
}
// Each screenshot batch you send is shipped as a new file here; every device imports each one once.
const SEEDS = ['seed/gertc-2026-11-06.json', 'seed/gertc-2026-11-06b.json', 'seed/gertc-2026-11-06c.json', 'seed/gertc-2026-11-06d.json', 'seed/gertc-2026-11-06e.json', 'seed/gertc-2026-11-06f.json', 'seed/gertc-2026-11-07g.json', 'seed/gertc-2026-11-07h.json'];
const seedNews = { added: 0, changed: 0 };
async function runSeeds() {
  const firstRun = !Object.keys(state.imports || {}).length;
  for (const url of SEEDS) {
    const id = url.split('/').pop();
    if (state.imports?.[id]) continue;
    try {
      const r = await fetch(url, { cache: 'no-store' }); if (!r.ok) continue;
      const data = await r.json();
      const rep2 = await applyImport(data, id, data.label);
      seedNews.added += (rep2.sessions?.added || 0) + (rep2.units?.added || 0); seedNews.changed += (rep2.sessions?.updated || 0) + (rep2.units?.updated || 0) + (rep2.units?.removed || 0);
    } catch {}
  }
  if (firstRun && seedNews.added) toast('Your GERTC schedule and teaching weeks are loaded');
  else if (seedNews.added + seedNews.changed) toast('Your schedule was updated from your latest screenshots');
  seedNews.added = seedNews.changed = 0;
}
function downloadFile(name, text, type) { const u = URL.createObjectURL(new Blob([text], { type })); const l = document.createElement('a'); l.href = u; l.download = name; document.body.append(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(u), 2000); }
const PANELS = {
  settings() {
    const u = ui(), c = cfg(), L = lock.get(), perm = 'Notification' in window ? Notification.permission : 'unsupported';
    return ['Settings', `<label class="searchbox">${ico('search', 18)}<input id="setq" placeholder="Search settings" value="${esc(setQ)}" autocomplete="off"></label>
      ${grp('Profile', [rowBox('Name', `<input data-f="identity.name" value="${esc(state.identity.name)}" placeholder="e.g. Given Dave Layos">`), rowBox('Initials in schedules', `<input data-f="cfg.initials" value="${esc(c.initials)}" style="text-transform:uppercase" maxlength="4">`, 'Ace keeps only cells with these initials from the hub schedule and the lead sheet.')])}
      ${grp('Connections', [rowLink('Lead & support weeks', `${(state.units || []).length} weeks · from screenshots`, 'panel', 'connections'), rowLink('Class schedule (hub)', (() => { const hub = (state.sessions || []).filter(x => x.source?.id === 'hub'); const last = Math.max(0, ...hub.map(x => x.source?.at || 0)); return hub.length ? `${hub.length} classes · from screenshots${last ? ' · updated ' + E.fmtAgo(last, Date.now()) : ''}` : 'Nothing imported yet'; })(), 'panel', 'connections'), rowLink('Evaluations', state.evals.length ? `${state.evals.length} imported` : 'None imported yet', 'panel', 'connections')])}
      ${grp('Appearance', [rowBox('Theme', `<div class="seg">${[['system', 'System'], ['light', 'Light'], ['dark', 'Dark'], ['amoled', 'AMOLED']].map(([k, l]) => `<button class="${u.theme === k ? 'on' : ''}" data-a="theme" data-id="${k}">${l}</button>`).join('')}</div>`),
        rowBox('App color', `<div class="swatches">${ACCENTS.map(([n, hx]) => `<button class="sw ${u.accent === hx ? 'on' : ''}" style="--c:${hx || '#5a9e5f'}" data-a="accent" data-id="${hx}" aria-label="${n}"></button>`).join('')}<label class="sw custom ${u.accent && !ACCENTS.some(x => x[1] === u.accent) ? 'on' : ''}" style="--c:${u.accent || '#5a9e5f'}" aria-label="Custom color"><input type="color" data-a="accent-custom" value="${u.accent || '#5a9e5f'}"></label></div>`)])}
      ${grp('Week screen', [rowToggle('Next deadline', 'Shows the most pressing deadline when it’s within 3 days', 'ui.showNextDeadline', u.showNextDeadline !== false), rowToggle('Preparation on the next-class card', 'Shows how many prep items are done', 'ui.todayPrep', !!u.todayPrep)])}
      ${grp('Preferences', [rowBox('Preparation checklist', `<div class="seg">${[['essentials', 'Essentials'], ['full', 'Full']].map(([k, l]) => `<button class="${c.checklist === k ? 'on' : ''}" data-a="checklist" data-id="${k}">${l}</button>`).join('')}</div>`, 'Essentials: about 5 key items. Full: every item, including ones Ace confirms itself.'), rowToggle('Hide evaluation scores', 'Shows •••• instead of your scores', 'ui.hideScores', u.hideScores), rowToggle('24-hour time', '13:00 instead of 1:00 PM', 'ui.clock24', u.clock24)])}
      ${grp('Teaching', [rowLink('Teaching rules', `Handouts & drafts Wed ${E.fmtTime(E.atTime(Date.now(), c.cutoffTime))} · PowerPoint Sat ${E.fmtTime(E.atTime(Date.now(), c.leadPptTime))} · buffers`, 'panel', 'rules')])}
      ${grp('Security', [rowToggle('App lock', L?.hash ? 'PIN required when opening Ace' : 'Protect your evaluations with a PIN', 'lock', !!L?.hash),
        ...(L?.hash ? [rowLink('Change PIN', '', 'pin-change')] : [])])}
      ${grp('Notifications', [rowLink('Reminders', perm === 'granted' ? 'On for this device' : perm === 'denied' ? 'Blocked — allow in iPhone Settings → Ace' : 'Tap to allow (open Ace from the Home Screen first)', 'notif'),
        rowToggle('Leave-by / log-in time', '15 minutes before', 'ui.notif.leave', u.notif.leave), rowToggle('Deadlines', 'A day before and 3 hours before each deadline', 'ui.notif.deadlines', u.notif.deadlines),
        rowToggle('Mastery day', 'Sunday morning before each lead week', 'ui.notif.leadppt', u.notif.leadppt), rowToggle('Schedule & role changes', 'When new screenshots change your weeks', 'ui.notif.changes', u.notif.changes),
        rowToggle('After-class check', 'A nudge a few minutes after each class ends', 'ui.notif.debrief', u.notif.debrief !== false),
        rowToggle('Morning plan', 'Your most important task and today’s priorities', 'ui.notif.morning', u.notif.morning), ...(u.notif.morning ? [rowBox('Morning plan time', `<input type="time" data-f="ui.notif.morningTime" value="${esc(u.notif.morningTime)}">`)] : []),
        `<div class="srow col"><div class="s-s">Reminders arrive while Ace is open or recently opened. Background push needs the server phase.</div></div>`])}
      ${(() => { const a = alarmCfg(), n = nextClassForAlarms(Date.now()); return grp('iPhone alarms', [
        ...(n ? [alarmButton(n)] : [`<div class="srow col"><div class="s-s">No upcoming class to set alarms for.</div></div>`]),
        `<div class="srow col"><div class="two"><div><label style="margin-top:0">Bath alarm · min before leaving</label><input type="number" min="0" step="5" data-f="ui.alarms.bathMin" value="${a.bathMin}"></div><div><label style="margin-top:0">Leave alarm · min before</label><input type="number" min="0" step="5" data-f="ui.alarms.leaveMin" value="${a.leaveMin}"></div></div><div class="s-s">0 turns an alarm off. “Leaving” uses your leave-by time (arrive early + travel, in Teaching rules).</div></div>`,
        rowLink('Set up the “Ace Alarms” shortcut', 'One time, about 3 minutes, in the Shortcuts app', 'panel', 'alarms')]); })()}
      ${grp('Calendar', [rowLink('Add classes & deadlines to your calendar', 'Download an .ics file for Google or Apple Calendar', 'ics'), `<div class="srow col"><div class="s-s">Google Calendar: Settings → Import & export → Import the file. Re-import after schedule changes (events update, not duplicate). A live Google Calendar sync needs Google sign-in and isn’t set up yet.</div></div>`])}
      ${grp('Backup & data', [rowLink('Import data file (merge)', 'Adds new records only · never duplicates or overwrites', 'merge'), rowLink('Export backup', 'Save a copy of everything (not your API key or PIN)', 'export'), rowLink('Restore backup (replace all)', 'From an Ace JSON backup', 'import'), `<button class="srow danger" data-a="reset"><div class="grow"><div class="s-l">Erase all data on this device</div></div></button>`])}
      ${grp('Help', [rowLink('How to use Ace', 'Sources, readiness, handouts, growth', 'panel', 'help')])}
      ${grp('About', [`<div class="srow col about"><div class="row"><img src="icon-192.png" width="44" height="44" style="border-radius:11px" alt=""><div><div class="s-l">Ace</div><div class="s-s">Your instructor excellence companion. Version ${VERSION}</div></div></div></div>`, rowLink('What’s new', '', 'panel', 'whatsnew'), rowLink('Check for updates', '', 'update')])}
      
      <div class="empty small" id="noresult" hidden>No settings match “<span></span>”</div>`];
  },

  rules() { return ['Teaching rules', rulesHTML()]; },
  alarms() {
    const step = (n, t, d) => `<div class="card" style="margin-bottom:10px"><div class="row" style="align-items:flex-start"><span class="rank">${n}</span><div class="grow"><div class="l-t">${t}</div><div class="l-s" style="margin-top:4px">${d}</div></div></div></div>`;
    return ['Ace Alarms shortcut', `<div class="muted small" style="margin:0 4px 12px">iPhone only lets the Shortcuts app create Clock alarms. Build this once; after that, “Set iPhone alarms” in Ace does the rest.</div>
      ${step(1, 'Create the shortcut', 'Open <b>Shortcuts</b> → tap <b>+</b> → name it exactly <b>Ace Alarms</b>.<br>If Shortcuts asks you to <b>describe</b> the shortcut, paste: <i>“Make a shortcut named Ace Alarms that receives text. Split the text by new lines. For each line, split it by the | character, then create an alarm whose time is the first part and whose label is the second part.”</i> Then check that its actions match steps 2–4 below.')}
      ${step(2, 'Split the times', 'Add <b>Split Text</b>. Set the text to <b>Shortcut Input</b> and split by <b>New Lines</b>.')}
      ${step(3, 'Repeat for each alarm', 'Add <b>Repeat with Each</b> (item in <b>Split Text</b>). Inside it, add another <b>Split Text</b>: text = <b>Repeat Item</b>, split by <b>Custom</b> “<b>|</b>”.')}
      ${step(4, 'Create the alarm', 'Still inside the repeat, add <b>Get Item from List</b> → <b>First Item</b>, then <b>Create Alarm</b>: time = <b>Item from List</b>. Tap the label field, add another <b>Get Item from List</b> → <b>Last Item</b> and use it as the label.')}
      ${step(5, 'Try it', 'Back in Ace, open your next class → <b>Set iPhone alarms</b>. The first time, iPhone asks to allow Ace to open Shortcuts and to create alarms — allow both. Check the Clock app: the alarms are there.')}
      <div class="muted small" style="margin:6px 4px 0">Each line Ace sends looks like <code>2026-11-09 14:40|Ace · Take a bath — leave by 4:10 PM</code>. iPhone asks once to allow Ace to open Shortcuts.</div>`];
  },
  connections() { return ['Connections', connectionsHTML()]; },
  help() {
    const step = (t, d) => `<div class="card" style="margin-bottom:10px"><h3>${t}</h3><div class="muted small" style="margin-top:6px">${d}</div></div>`;
    return ['How to use Ace', [
      step('1 · Keep your sources current', '<b>Lead & support weeks</b> come from screenshots of the lead-instructor sheet: send a new screenshot in your Claude chat when it changes. Neon-blue GDL cells are Lead weeks; other GDL cells are Support.<br><b>Class schedule</b>: when the official hub week is released, open it, Select All → Copy, then Settings → Connections → Paste schedule. Only your GDL classes are kept.'),
      step('2 · Prepare once per topic', 'Open a class to see its checklist. Slides, solutions and studying are shared by every class of that topic-week. Room, link and buffer are per class.'),
      step('3 · Follow “Most important next”', 'Today ranks everything — readiness, handouts, lead PowerPoints and exams — by official deadline, suggested targets and effort.'),
      step('4 · Your weekly rhythm', '<b>Lead week:</b> handout due the Wednesday before (8 PM) · PowerPoint finalized by Saturday 11:59 PM before · Sunday is for mastery (study the slides, hard concepts, likely questions).<br><b>Every teaching week (lead or support):</b> assessment draft sent by that week’s Wednesday, 8 PM. Mark things done or sent only after you actually do them — the calendar in Schedule shows each day’s items.'),
      step('5 · Be early', 'Leave-by / be-online-by times are on the class card. Tap “I’m here” when you arrive to build your punctuality record.'),
      step('6 · Grow from feedback', 'Growth → Paste from hub. Confirmed scores are shown apart from Ace’s reading of comments. Adopt practices and tap +1 each class you apply them.'),
    ].join('')];
  },
  whatsnew() {
    const v = (n, d, items) => `<div class="card" style="margin-bottom:10px"><div class="row"><b class="grow">Version ${n}</b><span class="muted small">${d}</span></div><ul class="small" style="margin:8px 0 0 18px;padding:0">${items.map(i => `<li style="margin:4px 0">${i}</li>`).join('')}</ul></div>`;
    return ['What’s new', v('0.8.2', 'Nov 7, 2026', ['Alarm setup guide: a ready-to-paste description for the Shortcuts app'])
      + v('0.8.1', 'Nov 7, 2026', ['Set iPhone alarms for the first class of each day: take a bath (1 h 30 before leaving) and leave in 30 minutes — via the Shortcuts app'])
      + v('0.8', 'Nov 7, 2026', ['Essentials checklist: about 5 key items per class (switch to Full in Settings)', 'Ace ticks “Schedule confirmed” and “Arrival buffer planned” itself', 'After each class: three quick questions on the Week screen, which build your habits in Performance'])
      + v('0.7.1', 'Nov 7, 2026', ['Back to the older colours, with AMOLED and app colours in Settings', 'Kept the three tabs: Week, Tasks, Performance', 'Performance highlights what students praise; “What to improve” is at the bottom'])
      + v('0.7', 'Nov 7, 2026', ['GERTC look: navy and yellow, Montserrat and Mulish', 'Three tabs: Week (home), Tasks, Performance', 'Week answers what you teach next, what’s due soon and whether you’re prepared', 'Week ⇄ Month switch instead of two stacked views', 'Prepare: a class shows that week’s handout, PowerPoint and draft, with a grouped checklist', 'The bell badge counts only urgent items; questions about your data wait under “For your review”'])
      + v('0.6.6', 'Nov 7, 2026', ['Today shows no reminders for now: just your next class and your performance. Deadlines stay in Tasks and the calendar; turn reminders back on in Settings → Home screen'])
      + v('0.6.5', 'Nov 7, 2026', ['Schedule is the first tab and opens first', 'Today no longer shows the reminder list (turn it back on in Settings → Home screen)', 'Rooms for L3 (Labangon, 3rd Floor) and K4 (Kysey, 4th Floor)'])
      + v('0.6.4', 'Nov 7, 2026', ['Official hub schedule for Week 5 (Nov 9–15): 6 classes, 24 h'])
      + v('0.6.3', 'Nov 6, 2026', ['Fix: the Fluid Flow 1 handout (your lead week, due Wed Nov 11) is back; support-week handouts never show'])
      + v('0.6.2', 'Nov 6, 2026', ['Assessment drafts are planned inside their teaching week — nothing shows early', '“Not assigned to me” on any handout, PowerPoint or draft (e.g. when the lead instructor already did it); restore it from Tasks'])
      + v('0.6.1', 'Nov 6, 2026', ['Ace now tells you when a new version is available — tap the bar to update'])
      + v('0.6', 'Nov 6, 2026', ['Calendar under your schedule: lead/support weeks, each day’s deadlines and steps, tick them off — past days too', 'Your rhythm: handout Wed before a lead week · PowerPoint Sat 11:59 PM · Sunday mastery · assessment draft every teaching week’s Wed', 'Reminders a day before and 3 hours before each deadline, plus a Sunday mastery nudge'])
      + v('0.5', 'Nov 6, 2026', ['New Schedule: your next class, a Mon–Sun strip with teaching hours, the week at a glance as a time grid, and the selected day’s classes', 'Week 4 classes now show their topics (from your My Schedule screenshot)', 'Your evaluation ships encrypted: unlock it once in Performance with your passcode'])
      + v('0.4.1', 'Nov 6, 2026', ['Lead & support weeks now come only from your screenshots (no Google sign-in or API key)', 'Weeks from Nov 9 show “official schedule not released yet”', 'App lock uses your PIN only'])
      + v('0.4', 'Nov 6, 2026', ['Cleaner app: 4 tabs — Today, Schedule, Tasks, Performance', 'Today shows only your next class, today’s focus and what’s coming up', 'All handouts, lead PowerPoints and exams in one Tasks list with steps', 'Schedule groups classes by teaching week with topic and role', 'Performance: your score, the top 3 things to improve, real habit stats', 'Connections moved into Settings', 'One design system across every screen'])
      + v('0.3', 'Nov 6, 2026', ['Settings with search, like Power', 'Alerts bell: changes, deadlines, sync problems', 'App lock with PIN', 'Themes: System, Light, Dark, AMOLED · app colors', 'Reorder or hide Home cards · hide scores · 24-hour time', 'Choose which reminders you get, plus a morning plan'])
      + v('0.2', 'Nov 6, 2026', ['Reads the hub schedule grid and evaluation page', 'Prep shared across all classes of a topic-week', 'Taglish/Bisaya comment analysis', 'Smoother tab switching']) + v('0.1', 'Nov 6, 2026', ['First release: lead sheet, handouts, exams, readiness, planner, growth'])];
  },
};
function filterSettings() {
  const q = setQ.trim().toLowerCase(), p = $('.panel'); if (!p) return;
  let any = false;
  p.querySelectorAll('.group').forEach(g => {
    let vis = 0; g.querySelectorAll('.srow').forEach(r => { const m = !q || r.textContent.toLowerCase().includes(q) || g.querySelector('.group-t').textContent.toLowerCase().includes(q); r.hidden = !m; if (m) vis++; });
    g.hidden = !vis; if (vis) any = true;
  });
  const nr = p.querySelector('#noresult'); if (nr) { nr.hidden = any; nr.querySelector('span').textContent = setQ; }
}

/* ---------- app lock: PIN (salted SHA-256), device-only */
const LKEY = 'ace.lock';
const lock = { get() { try { return JSON.parse(localStorage.getItem(LKEY) || 'null'); } catch { return null; } }, set(v) { try { v ? localStorage.setItem(LKEY, JSON.stringify(v)) : localStorage.removeItem(LKEY); } catch {} } };
async function sha(x) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(x)); return [...new Uint8Array(b)].map(v => v.toString(16).padStart(2, '0')).join(''); }
const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = x => Uint8Array.from(atob(x), ch => ch.charCodeAt(0));
let pinBuf = '', hiddenAt = 0, locked = false;
function showLock() {
  if (!lock.get()?.hash) return;
  locked = true; pinBuf = '';
  let el = $('.lock'); if (!el) { el = document.createElement('div'); el.className = 'lock'; document.body.append(el); }
  renderLock();
}
function renderLock(err) {
  const L = lock.get(), el = $('.lock'); if (!el || !L) return;
  el.innerHTML = `<img src="icon-192.png" width="64" height="64" style="border-radius:16px" alt=""><div class="l-t">${err ? 'Wrong PIN' : 'Enter your PIN'}</div>
    <div class="pins ${err ? 'shake' : ''}">${Array.from({ length: L.len }, (_, i) => `<i class="${i < pinBuf.length ? 'on' : ''}"></i>`).join('')}</div>
    <div class="keypad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button data-a="pin" data-id="${n}">${n}</button>`).join('')}
    <span></span><button data-a="pin" data-id="0">0</button><button data-a="pin" data-id="del" aria-label="Delete">${ico('del', 24)}</button></div>`;
}
function unlockNow() { locked = false; const el = $('.lock'); if (el) { el.classList.add('out'); setTimeout(() => el.remove(), 250); } render(); }
async function pinKey(k) {
  const L = lock.get(); if (!L) return unlockNow();
  if (k === 'del') pinBuf = pinBuf.slice(0, -1); else if (pinBuf.length < L.len) pinBuf += k;
  renderLock();
  if (pinBuf.length === L.len) { if (await sha(L.salt + pinBuf) === L.hash) unlockNow(); else { pinBuf = ''; renderLock(true); } }
}
function pinSheet(mode) {
  sheet(`<h2>${mode === 'off' ? 'Turn off app lock' : mode === 'change' ? 'Change PIN' : 'Set a PIN'}</h2>
    ${mode !== 'new' ? `<label>Current PIN</label><input type="password" inputmode="numeric" name="cur" maxlength="6" autocomplete="off">` : ''}
    ${mode !== 'off' ? `<label>New PIN (4–6 digits)</label><input type="password" inputmode="numeric" name="p1" maxlength="6" autocomplete="off"><label>Confirm PIN</label><input type="password" inputmode="numeric" name="p2" maxlength="6" autocomplete="off">` : ''}
    <div class="row" style="margin-top:16px"><button class="btn ghost" data-a="close">Cancel</button><button class="btn" data-a="pin-save" data-id="${mode}">${mode === 'off' ? 'Turn off' : 'Save'}</button></div>`);
}
async function pinSave(mode) {
  const v = formVals(), L = lock.get();
  if (mode !== 'new' && (!L || await sha(L.salt + (v.cur || '')) !== L.hash)) return toast('Current PIN is wrong');
  if (mode === 'off') { lock.set(null); closeSheet(); renderPanel(); return toast('App lock off'); }
  if (!/^\d{4,6}$/.test(v.p1 || '')) return toast('PIN must be 4–6 digits');
  if (v.p1 !== v.p2) return toast('PINs do not match');
  const salt = b64(crypto.getRandomValues(new Uint8Array(16)));
  lock.set({ salt, hash: await sha(salt + v.p1), len: v.p1.length });
  closeSheet(); renderPanel(); toast(mode === 'new' ? 'App lock on' : 'PIN changed');
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) hiddenAt = Date.now();
  else if (lock.get()?.hash && !locked && hiddenAt && Date.now() - hiddenAt > 60e3) showLock();
});

/* ================================================================ render */
const TABS = [['schedule', 'Week', 'week'], ['tasks', 'Tasks', 'work'], ['performance', 'Performance', 'growth']];
const scrollMem = {};
/** Tab bar is built once; switching only moves the lens and recolours labels (no rebuild, no flicker). */
function renderTabs() {
  const el = $('#tabs');
  if (!el.dataset.ready) {
    el.innerHTML = '<span class="tab-lens" aria-hidden="true"></span>' + TABS.map(([k, l, ic]) => `<button data-a="tab" data-id="${k}" aria-label="${l}">${ico(ic, 22)}<span>${l}</span></button>`).join('');
    el.dataset.ready = '1';
  }
  el.style.setProperty('--i', TABS.findIndex(x => x[0] === tab)); el.style.setProperty('--n', TABS.length);
  el.querySelectorAll('button').forEach(b => { const on = b.dataset.id === tab; b.classList.toggle('on', on); on ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'); });
}
/** Switch tab like Power: slide the new screen in from the side you tapped, keep each tab's scroll position. */
function openConnections() { setQ = ''; panels.length = 0; openPanel('connections'); }
function go(next) {
  next = TAB_ALIAS[next] || next;
  if (next === 'connections') { closeSheet(); return openConnections(); }
  if (next === tab) { scrollTo({ top: 0, behavior: 'smooth' }); return; }
  const idx = k => TABS.findIndex(x => x[0] === k);
  scrollMem[tab] = scrollY;
  const dir = idx(next) > idx(tab) ? 1 : -1;
  tab = next;
  try { history.replaceState(null, '', '#' + next); } catch {}
  closeSheet(); render();
  const app = $('#app');
  app.style.setProperty('--dir', dir);
  app.classList.remove('screen-in'); void app.offsetWidth; app.classList.add('screen-in');
  scrollTo(0, scrollMem[next] || 0);
}
function render() {
  if (panels.length) renderPanel();
  const screens = { schedule, tasks, performance };
  $('#app').innerHTML = screens[tab]();
  renderTabs();
}

/* ================================================================ import flows */
let pendingImport = null;
/** What a pasted class will show as: the sheet topic of that week when there is exactly one, else the grid label. */
function topicFor(s) {
  if (!s.autoTopic) return s.subject;
  const us = E.unitsForWeek(state, s.start);
  return us.length === 1 ? `${us[0].topic} · ${us[0].role === 'lead' ? 'Lead' : 'Support'}` : s.subject;
}
function reviewSessions(sessions, info, extra = '') {
  pendingImport = { sessions, ...info };
  const t = now();
  sheet(`<h2>Review ${sessions.length} class${sessions.length === 1 ? '' : 'es'}</h2><div class="muted small">Nothing is saved until you confirm. Uncheck anything that isn’t yours.</div>${extra}
    ${sessions.map((s, i) => `<label class="tick on" style="margin:0;color:var(--text)"><input type="checkbox" name="k${i}" checked style="width:auto"><span class="lbl" style="text-decoration:none;color:var(--text)">${esc(topicFor(s))}<span class="hint">${E.fmtDay(s.start)} · ${E.fmtTime(s.start)}–${E.fmtTime(s.end)} · ${esc(s.section || s.location || s.platform || s.format)}${s.group ? ' · Group ' + esc(s.group) : ''}${s.format === 'online' ? ' · Online' : ''}${s.status === 'cancelled' ? ' · CANCELLED' : ''}${s.uncertain ? ' · ⚠︎ check the day' : ''}</span></span></label>`).join('')}
    ${info.unparsed?.length ? `<details style="margin-top:12px"><summary class="muted small">${info.unparsed.length} lines not understood</summary><div class="quote small">${info.unparsed.slice(0, 30).map(esc).join('<br>')}</div></details>` : ''}
    <label class="row" style="color:var(--text)"><input type="checkbox" name="full" style="width:auto" ${info.week ? 'checked' : ''}> This is the complete schedule for ${info.week ? 'the week of ' + E.fmtDay(E.parseLocal(info.week)) : 'these dates'} (lets Ace detect removed classes)</label>
    <div class="row" style="margin-top:16px"><button class="btn ghost" data-a="close">Cancel</button><button class="btn" data-a="commit-sched" ${sessions.length ? '' : 'disabled'}>Save</button></div>`);
}
function commitSchedule() {
  const v = formVals(), t = now(), p = pendingImport;
  const chosen = p.sessions.filter((_, i) => v['k' + i]);
  let ws = -Infinity, we = Infinity;
  if (v.full && chosen.length) { if (p.week) { ws = E.parseLocal(p.week); we = E.addDays(ws, 7); } else { ws = Math.min(...chosen.map(s => E.startOfDay(s.start))); we = E.addDays(Math.max(...chosen.map(s => E.startOfDay(s.start))), 1); } }
  else { ws = we = 0; } // partial paste → never flag missing
  const r = E.mergeSchedule(state.sessions, chosen, { source: { id: 'hub', name: 'Hub schedule', method: p.method }, now: t, windowStart: ws, windowEnd: we });
  state.sessions = r.sessions; state.changes = [...state.changes, ...r.changes.filter(c => c.type !== 'added' || state.sources.schedule.lastOk)].slice(-300);
  Object.assign(state.sources.schedule, { lastOk: t, lastTry: t, error: null, method: p.method });
  save(); closeSheet(); go('schedule');
  const n = r.changes.reduce((o, c) => (o[c.type] = (o[c.type] || 0) + 1, o), {});
  toast(Object.entries(n).map(([k, v]) => `${v} ${k}`).join(' · ') || 'No changes');
}

/* ================================================================ events */
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-a]'); if (!el || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && el.type !== 'button')) return;
  const a = el.dataset.a, id = el.dataset.id;
  const t = now();
  switch (a) {
    case 'tab': go(id); break;
    case 'close': closeSheet(); break;
    case 'task': markTask(id, true); if (!id.endsWith(':submit')) { toast('Done ✓'); if (el.dataset.back) delivSheet(el.dataset.back); } break;
    case 'untask': markTask(id, false); if (el.dataset.back) delivSheet(el.dataset.back); break;
    case 'deliv': delivSheet(id); break;
    case 'not-mine': { const d = E.deliverables(state, t).find(x => x.id === id);
      sheet(`<h2>Not assigned to you?</h2><div class="muted small">${esc(d?.title || '')} will be removed from Today, Tasks, the calendar and reminders. You can restore it in Tasks.</div>
        <label>Why (optional)</label><input name="why" placeholder="e.g. The lead instructor already submitted it">
        <div class="row" style="margin-top:16px"><button class="btn sec" data-a="close">Cancel</button><button class="btn" data-a="not-mine-ok" data-id="${esc(id)}">Remove from my tasks</button></div>`); break; }
    case 'not-mine-ok': { const v = formVals(); (state.excluded ||= {})[id] = { at: t, reason: v.why || 'Not assigned to you', source: 'you' }; save(); closeSheet(); render(); toast('Removed from your tasks'); break; }
    case 'restore': if (state.excluded) delete state.excluded[id]; save(); render(); toast('Restored to your tasks'); break;
    case 'sday': schedDay = id; render(); break;
    case 'sview': ui().schedView = id; save(); render(); break;
    case 'checklist': (state.cfg ||= {}).checklist = id; save(); render(); break;
    case 'alarms': { const s = E.teachingItems(state).find(x => x.id === id); if (s) setAlarms(s); break; }
    case 'checklist-toggle': (state.cfg ||= {}).checklist = cfg().checklist === 'essentials' ? 'full' : 'essentials'; save(); render(); classSheet(id); break;
    case 'db': { const d = ((state.debriefs ||= {})[id] ||= { at: t }); d[el.dataset.k] = el.dataset.v === 'true'; d.at = t;
      if (el.dataset.k === 'onTime' && !state.arrivals[id]) state.arrivals[id] = { at: null, status: d.onTime ? 'on_time' : 'late', manual: true, via: 'after-class check' };
      if (el.dataset.k === 'onTime' && state.arrivals[id]?.via) state.arrivals[id].status = d.onTime ? 'on_time' : 'late';
      if (['onTime', 'hardTopic', 'posted'].every(k => typeof d[k] === 'boolean')) { d.complete = true; toast('Saved. Thank you!'); }
      save(); render(); break; }
    case 'db-skip': (state.debriefSkip ||= {})[id] = t; save(); render(); break;
    case 'sched-menu': sheet(`<h2>Update your schedule</h2><div class="muted small">Send new hub screenshots in your Claude chat, or update it here.</div>
      <button class="srow" data-a="paste-sched" data-week="${esc(el.dataset.week)}" style="margin-top:12px"><div class="grow"><div class="s-l">Paste a hub week</div><div class="s-s">Copy the hub's My Schedule page and paste it</div></div>${ico('chev', 16)}</button>
      <button class="srow" data-a="add-class"><div class="grow"><div class="s-l">Add a class</div><div class="s-s">For a class that isn’t on the hub</div></div>${ico('chev', 16)}</button>
      <button class="srow" data-a="file-sched"><div class="grow"><div class="s-l">Import a CSV or .ics file</div></div>${ico('chev', 16)}</button>`); break;
    case 'cday': calDay = id; render(); break;
    case 'cmon': calMonth += +id; calDay = null; render(); break;
    case 'sweek': if (id === '0') schedWeek = 0; else schedWeek += +id; schedDay = null; render(); break;
    case 'unseal': { const p = SEALED.find(x => x.id === id), inp = $('#sealpass'); if (!p || !inp?.value.trim()) return toast('Enter the passcode');
      el.disabled = true; el.textContent = 'Unlocking…';
      try { const r = await fetch(p.url, { cache: 'no-store' }); if (!r.ok) throw new Error('fetch'); const data = await S.unseal(await r.json(), inp.value); const rep2 = await applyImport(data, p.id, p.label); toast(`Unlocked · ${importSummary(rep2)}`); }
      catch (e) { el.disabled = false; el.textContent = 'Unlock'; inp.value = ''; inp.focus(); toast(/wrong/.test(e.message) ? 'Wrong passcode — check it and try again' : 'Couldn’t load the file — check your connection'); }
      break; }
    case 'connections': openConnections(); break;
    case 'add-deliv': sheet(`<h2>Add a deliverable</h2><div class="muted small">Handouts, lead PowerPoints and lead exams are added automatically from your lead sheet. Add anything else here.</div>
      <label>Type</label><select name="kind" id="dk"><option>Exam</option><option>Quiz</option><option>Assessment</option><option>Problem set</option><option value="duty">Lead duty</option></select>
      <label>Title</label><input name="title" placeholder="e.g. Midterm exam set A"><label>Subject</label><input name="subject">
      <label>Due (Manila time)</label><input type="datetime-local" name="due"><label class="row" style="color:var(--text);font-weight:600"><input type="checkbox" name="verified"> Date confirmed by an official notice</label>
      <label>Estimated effort (hours)</label><input type="number" step="0.5" name="effortH" value="4">
      <button class="btn wide" style="margin-top:16px" data-a="save-deliv">Save</button>`); break;
    case 'save-deliv': { const v = formVals(); if (!v.title) return toast('Add a title'); const due = v.due ? E.parseLocal(v.due) : null;
      if (v.kind === 'duty') state.duties.push({ id: S.newId('d'), title: v.title, subject: v.subject, due, min: Math.round((+v.effortH || .5) * 60), verified: v.verified });
      else { if (!due) return toast('Exams and assessments need a due date'); state.assessments.push({ id: S.newId('a'), title: v.title, kind: v.kind, subject: v.subject, due, dueVerified: v.verified, effortH: +v.effortH || 4, stages: {} }); }
      save(); closeSheet(); render(); toast('Added to Tasks'); break; }
    case 'del-duty': if (confirm('Delete this duty?')) { state.duties = state.duties.filter(x => x.id !== id); save(); closeSheet(); render(); } break;
    case 'snooze': state.snooze[id] = t + 3 * 36e5; save(); render(); break;
    case 'class': classSheet(id); break;
    case 'rd': { const it = el.dataset.item, s = E.teachingItems(state).find(x => x.id === id); const k = s ? E.readinessKey(s, it) : id; (state.readiness[k] ||= {}); state.readiness[k][it] ? delete state.readiness[k][it] : state.readiness[k][it] = t; save(); render(); classSheet(id); break; }
    case 'arrive': logArrival(id); closeSheet(); break;
    case 'arrive-m': logArrival(id, el.dataset.st); closeSheet(); break;
    case 'unarrive': delete state.arrivals[id]; save(); render(); classSheet(id); break;
    case 'do-submit': { const v = formVals(); const h = (state.handouts[id] ||= { stages: {} }); h.submittedAt = E.parseLocal(v.at); h.cutoffAt = +el.dataset.cut || null; h.evidence = v.ev; h.confirmedBy = 'you'; save(); closeSheet(); render(); toast(h.cutoffAt && h.submittedAt > h.cutoffAt ? 'Submitted (after cutoff)' : 'Submitted on time ✓'); break; }
    case 'do-asubmit': { const v = formVals(); const x = assessRec(id); (x.stages ||= {}).submit = E.parseLocal(v.at); save(); closeSheet(); render(); break; }
    case 'add-class': sheet(`<h2>Add a class</h2><label>Subject / topic</label><input name="subject"><div class="two"><div><label>Date</label><input type="date" name="date" value="${E.dayKey(t)}"></div><div><label>Format</label><select name="format"><option value="in_person">In person</option><option value="online">Online</option></select></div></div>
      <div class="two"><div><label>Start</label><input type="time" name="start" value="08:00"></div><div><label>End</label><input type="time" name="end" value="10:00"></div></div><label>Room or link</label><input name="where">
      <button class="btn" style="margin-top:16px" data-a="save-class">Save</button>`); break;
    case 'save-class': { const v = formVals(); if (!v.subject) return toast('Add a subject'); const day = E.parseLocal(v.date); let s0 = E.atTime(day, v.start), s1 = E.atTime(day, v.end); if (s1 <= s0) s1 += 864e5;
      state.sessions.push({ id: S.newId('s'), subject: v.subject, section: '', start: s0, end: s1, format: v.format, location: v.format === 'online' ? '' : v.where, platform: v.format === 'online' ? v.where : '', status: 'scheduled', source: { id: 'user', at: t } }); save(); closeSheet(); render(); break; }
    case 'del-class': state.sessions = state.sessions.filter(s => s.id !== id); save(); closeSheet(); render(); break;
    case 'del-as': if (confirm('Delete this assessment?')) { state.assessments = state.assessments.filter(x => x.id !== id); save(); closeSheet(); render(); } break;
    case 'revision': sheet(`<h2>Revision requested</h2><label>What was asked</label><input name="note"><label>Due</label><input type="datetime-local" name="due"><button class="btn" style="margin-top:16px" data-a="save-rev" data-id="${esc(id)}">Save</button>`); break;
    case 'save-rev': { const v = formVals(); const x = assessRec(id), due = E.allAssessments(state).find(a => a.id === id)?.due; x.revision = { note: v.note, due: v.due ? E.parseLocal(v.due) : due, doneAt: null }; save(); closeSheet(); render(); break; }
    case 'paste-sched': { const wk = el.dataset.week || E.dayKey(E.mondayOf(t)); sheet(`<h2>Paste hub schedule</h2><label>Week (Monday) — from the page’s ?week=</label><input type="date" name="week" value="${wk}"><label>Page text</label><textarea name="txt" rows="8" placeholder="On the hub schedule page: Select All → Copy, then paste here. Only your ${esc(cfg().initials)} classes are kept."></textarea><button class="btn" style="margin-top:12px" data-a="parse-sched">Read classes</button>`); break; }
    case 'parse-sched': { const v = formVals(); const ws = E.parseLocal(v.week); if (Number.isNaN(ws)) return toast('Pick the week'); const monday = E.mondayOf(ws); const g = S.parseScheduleGrid(v.txt, { initials: cfg().initials, weekStart: monday }); const r = g || S.parseSchedulePaste(v.txt, monday);
      if (g && !g.sessions.length) return toast(`No “${cfg().initials}” cells found in that schedule`);
      reviewSessions(r.sessions, { unparsed: r.unparsed, week: E.dayKey(monday), method: 'paste' }); break; }
    case 'file-sched': $('#schedFile').click(); break;
    case 'commit-sched': commitSchedule(); break;
    case 'hrole': { const c = cfg(), r = new Set(c.handoutRoles); r.has(id) ? r.delete(id) : r.add(id); state.cfg.handoutRoles = [...r]; save(); render(); break; }
    case 'ov-set': { const d = $('#ovDate').value, to = $('#ovTo').value; if (!d || !to) return toast('Pick the normal Wednesday and the new time'); (state.cfg.cutoffOverrides ||= {})[d] = to; save(); render(); break; }
    case 'ov-skip': { const d = $('#ovDate').value; if (!d) return toast('Pick the normal Wednesday'); (state.cfg.cutoffOverrides ||= {})[d] = 'skip'; save(); render(); break; }
    case 'ov-del': delete state.cfg.cutoffOverrides[id]; save(); render(); break;
    case 'paste-eval': sheet(`<h2>Paste evaluation</h2><div class="muted small">Open your evaluation results on the hub, select all, copy, and paste. You’ll review before saving.</div><div class="two"><div><label>Period / label</label><input name="period" placeholder="e.g. Batch 12 · Oct 2026"></div><div><label>Date</label><input type="date" name="date" value="${E.dayKey(t)}"></div></div><label>Page text</label><textarea name="txt" rows="8"></textarea><button class="btn" style="margin-top:12px" data-a="parse-eval">Read results</button>`); break;
    case 'parse-eval': { const v = formVals(); const r = S.parseEvalPaste(v.txt); pendingImport = { ...r, period: v.period, date: v.date };
      sheet(`<h2>Review evaluation</h2><div class="muted small">Edit anything that was misread. Only what you save is used.</div><label>Overall${r.overallComputed ? ' (computed average — no overall found)' : ''}</label><input name="overall" type="number" step="0.01" min="1" max="5" value="${r.overall ?? ''}">
        ${Object.entries(r.criteria).map(([k, val], i) => `<div class="two" style="margin-top:8px"><input name="cn${i}" value="${esc(k)}"><input name="cv${i}" type="number" step="0.01" min="1" max="5" value="${val}"></div>`).join('') || '<div class="warnbox">No scores found. Try copying just the results table.</div>'}
        <label>Comments (${r.comments.length}) — one per line</label><textarea name="comments" rows="6">${esc(r.comments.join('\n'))}</textarea>
        <div class="row" style="margin-top:16px"><button class="btn ghost" data-a="close">Cancel</button><button class="btn" data-a="save-eval" data-n="${Object.keys(r.criteria).length}" data-src="hub paste">Save</button></div>`); break; }
    case 'add-eval': { const crit = ['Knowledge of subject', 'Clarity of explanation', 'Student engagement', 'Preparation', 'Punctuality', 'Time management']; pendingImport = { period: '', date: E.dayKey(t) };
      sheet(`<h2>Enter evaluation</h2><div class="two"><div><label>Period</label><input name="period"></div><div><label>Date</label><input type="date" name="date" value="${E.dayKey(t)}"></div></div><label>Overall</label><input name="overall" type="number" step="0.01" min="1" max="5">${crit.map((k, i) => `<div class="two" style="margin-top:8px"><input name="cn${i}" value="${k}"><input name="cv${i}" type="number" step="0.01" min="1" max="5" placeholder="score"></div>`).join('')}
        <label>Comments — one per line</label><textarea name="comments"></textarea><button class="btn" style="margin-top:16px" data-a="save-eval" data-n="${crit.length}" data-src="entered">Save</button>`); break; }
    case 'save-eval': { const v = formVals(), n = +el.dataset.n, criteria = {}; for (let i = 0; i < n; i++) if (v['cn' + i] && v['cv' + i] !== '') criteria[v['cn' + i].trim()] = +v['cv' + i];
      if (v.overall === '' && !Object.keys(criteria).length) return toast('No scores to save');
      state.evals.push({ id: S.newId('e'), period: v.period || pendingImport?.period || '', date: v.date || pendingImport?.date || E.dayKey(t), overall: v.overall === '' ? null : +v.overall, criteria, comments: String(v.comments || '').split('\n').map(x => S.maskPII(x.trim())).filter(Boolean), source: el.dataset.src, savedAt: t });
      save(); closeSheet(); go('performance'); break; }
    case 'del-eval': if (confirm('Delete this evaluation?')) { state.evals = state.evals.filter(x => x.id !== id); save(); render(); } break;
    case 'adopt': state.practices.push({ id: S.newId('p'), key: el.dataset.k, text: el.dataset.tip, adoptedAt: t, applied: [] }); save(); render(); toast('Adopted. Tap +1 each class you apply it.'); break;
    case 'apply': { const p = state.practices.find(p => p.id === id); p.applied.push(t); save(); render(); break; }
    case 'unadopt': { const p = state.practices.find(p => p.id === id); p.archived = true; save(); render(); break; }
    case 'notif': if ('Notification' in window) { const r = await Notification.requestPermission(); toast(r === 'granted' ? 'Reminders on' : 'Not allowed — on iPhone, add Ace to the Home Screen first'); render(); } else toast('On iPhone: Share → Add to Home Screen, then open Ace from there'); break;
    case 'export': { const blob = new Blob([JSON.stringify(state, null, 1)], { type: 'application/json' }); const u = URL.createObjectURL(blob); const l = document.createElement('a'); l.href = u; l.download = `ace-backup-${E.dayKey(t)}.json`; l.click(); setTimeout(() => URL.revokeObjectURL(u), 2000); break; }
    case 'import': if (confirm('Replace ALL Ace data on this device with a backup? (Use “Import data file (merge)” to add without replacing.)')) $('#bk').click(); break;
    case 'merge': $('#mg').click(); break;
    case 'ics': downloadFile(`ace-calendar-${E.dayKey(t)}.ics`, E.toICS(state, t), 'text/calendar'); toast('Calendar file ready — open it to add events'); break;
    case 'alerts': alertsSheet(); break;
    case 'alerts-clear': alerts().forEach(a => dismissAlert(a.id)); closeSheet(); render(); toast('All caught up ✨'); break;
    case 'alert-go': { const a = alerts().find(x => x.id === id); closeSheet(); if (!a) break;
      if (a.review) sheet(`<h2>Needs review</h2><div style="font-weight:700;margin-top:6px">${esc(a.review.title)}</div><div class="muted small" style="margin-top:6px">${esc(a.review.detail || '')}</div>${a.review.source ? `<div class="tag amb" style="margin-top:10px">Source: ${esc(a.review.source)}</div>` : ''}<div class="row" style="margin-top:16px"><button class="btn ghost" data-a="close">Later</button><button class="btn" data-a="review-ok" data-id="${esc(a.review.id)}">Mark reviewed</button></div>`);
      else if (a.act === 'tab') go(a.actId); else if (a.act === 'class') classSheet(a.actId); break; }
    case 'alert-x': dismissAlert(id); render(); alertsSheet(); break;
    case 'review-ok': { const r = (state.review || []).find(x => x.id === id); if (r) r.resolvedAt = t; save(); closeSheet(); render(); toast('Marked reviewed'); break; }
    case 'settings': setQ = ''; panels.length = 0; openPanel('settings'); break;
    case 'panel': openPanel(id); break;
    case 'pback': backPanel(); break;
    case 'theme': ui().theme = id; save(); applyTheme(); render(); break;
    case 'accent': ui().accent = id; save(); applyTheme(); render(); break;
    case 'hmove': { const o = ui().home.order, i = o.indexOf(id), j = i + +el.dataset.d; if (j < 0 || j >= o.length) break; [o[i], o[j]] = [o[j], o[i]]; save(); render(); break; }
    case 'pin': pinKey(id); break;
    case 'pin-change': pinSheet('change'); break;
    case 'pin-save': await pinSave(id); break;
    case 'apply-update': { el.textContent = 'Updating…'; await hardUpdate(); break; }
    case 'update': { toast('Checking for updates…'); await hardUpdate(); break; }
    case 'reset': if (confirm('Erase ALL Ace data on this device? Export a backup first if you might need it.')) { state = blank(); state.imports = Object.fromEntries(SEEDS.map(u => [u.split('/').pop(), { at: t, report: null, label: 'Screenshot import (skipped after erase)' }])); save(); closePanel(); render(); toast('Erased'); } break;
  }
});
document.addEventListener('change', async e => {
  const el = e.target;
  if (el.dataset.f === 'lock') { const on = el.checked; el.checked = !on; pinSheet(on ? 'new' : 'off'); return; }
  if (el.dataset.a === 'accent-custom') { ui().accent = el.value; save(); applyTheme(); render(); return; }
  if (el.dataset.a === 'hshow') { ui().home.hidden[el.dataset.id] = !el.checked; save(); render(); return; }
  if (el.id === 'mg' && el.files[0]) { try { const d = JSON.parse(await el.files[0].text()); const r = await applyImport(d, `file:${el.files[0].name}`, `File · ${el.files[0].name}`); toast(`Merged: ${importSummary(r)}`); } catch { toast('Not an Ace data file'); } el.value = ''; return; }
  if (el.dataset.f) {
    const [root, ...path] = el.dataset.f.split('.'); let o = state[root] ||= {};
    for (const p of path.slice(0, -1)) o = o[p] ||= {};
    let v = el.type === 'checkbox' ? el.checked : el.type === 'number' ? +el.value : el.value;
    if (el.dataset.f === 'cfg.holidays') v = el.value.split(/[,\s]+/).filter(x => /^\d{4}-\d\d-\d\d$/.test(x));
    if (el.dataset.f === 'cfg.initials') v = v.toUpperCase().trim();
    o[path.at(-1)] = v; save(); if (root === 'ui') applyTheme(); render(); return;
  }
  if (el.dataset.a === 'tpl') { const s = state.sessions.find(x => x.id === el.dataset.id); if (s) s.template = el.value; else { (state.cfg.unitTemplates ||= {})[el.dataset.id] = el.value; } save(); render(); classSheet(el.dataset.id); return; }
  if (el.dataset.a === 'note') { state.notes[el.dataset.id] = el.value; save(); return; }
  if (el.id === 'schedFile' && el.files[0]) { const txt = await el.files[0].text(); const r = S.parseSchedule(txt, { identity: { name: state.identity.name, email: state.identity.email } }); reviewSessions(r.sessions, { unparsed: (r.skipped || []).map(x => `Row ${x.row}: ${x.reason}`), method: r.format }); el.value = ''; return; }
  if (el.id === 'bk' && el.files[0]) { try { const d = JSON.parse(await el.files[0].text()); if (!d || d.v !== 1) throw 0; state = { ...blank(), ...d }; save(); render(); toast('Backup restored'); } catch { toast('Not an Ace backup file'); } el.value = ''; }
});
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'sealpass') { e.preventDefault(); document.querySelector('[data-a="unseal"]')?.click(); } });
document.addEventListener('input', e => { if (e.target.id === 'setq') { setQ = e.target.value; filterSettings(); } });
window.addEventListener('hashchange', () => { const h = location.hash.slice(1); const n = TAB_ALIAS[h] || h; if (n && n !== tab && (n === 'connections' || TABS.some(x => x[0] === n))) go(n); });

/* ================================================================ reminders (while open) */
async function notify(key, title, body) {
  if (state.notified[key] || !('Notification' in window) || Notification.permission !== 'granted') return;
  state.notified[key] = now(); save();
  try { const reg = await navigator.serviceWorker?.getRegistration(); reg ? reg.showNotification(title, { body, icon: 'icon-192.png', tag: key }) : new Notification(title, { body }); } catch {}
}
function tick() {
  const t = now(), c = cfg(), n = ui().notif;
  if (n.debrief !== false) { const db = E.pendingDebrief(state, t); if (db && t - db.end >= 5 * 6e4 && t - db.end < 60 * 6e4) notify(`db:${db.id}`, `How did ${db.section || 'class'} go?`, 'Three quick questions in Ace.'); }
  if (n.morning) { const at = E.atTime(t, n.morningTime || '06:30'); if (t >= at && t - at < 3 * 36e5) { const pl = E.plan(state, t); notify(`mp:${E.dayKey(t)}`, pl.next ? `Today: ${pl.next.title}` : 'Today: nothing pressing', `${pl.today.length} priorit${pl.today.length === 1 ? 'y' : 'ies'} · ${pl.minutes} min planned`); } }
  if (n.leave) for (const s of E.activeSessions(state)) { const lb = E.leaveBy(s, c); if (lb - t < 15 * 6e4 && lb - t > -5 * 6e4 && !state.arrivals[s.id]) notify(`lb:${s.id}`, `${s.format === 'online' ? 'Log in' : 'Leave'} by ${E.fmtTime(lb)}`, `${s.subject} starts at ${E.fmtTime(s.start)}`); }
  if (n.deadlines) for (const d of E.deadlines(state, t, 20)) { const left = d.at - t;
    if (left > 3 * 36e5 && left < 24 * 36e5) notify(`dl24:${d.kind}:${d.ref}:${d.at}`, `Tomorrow ${E.fmtTime(d.at)}: ${d.title}`, 'Due in less than a day.');
    if (left > 0 && left <= 3 * 36e5) notify(`dl:${d.kind}:${d.ref}:${d.at}`, `Due ${E.fmtTime(d.at)}: ${d.title}`, 'Confirm in Ace once it is done.'); }
  if (n.leadppt) for (const u of E.unitItems(state)) if (u.role === 'lead') { const sun = E.addDays(u.start, -1), at = E.atTime(sun, '08:00'), r = E.readiness(u, state, c);
    if (t >= at && t < at + 6 * 36e5 && r.rows.some(x => ['studied', 'concepts', 'questions'].includes(x.id) && !x.doneAt)) notify(`ms:${u.id}`, `Mastery day: ${u.subject}`, 'Study the slides, the hard concepts and likely questions before your lead week.'); }
  if (n.leadppt) for (const u of E.unitItems(state)) if (u.role === 'lead' && !state.readiness[u.id]?.slides_final) { const due = E.leadPptDue(u.unit, c); if (due - t < 30 * 36e5 && due > t) notify(`lp:${u.id}`, `Lead PowerPoint due ${E.fmtDayRel(due, t)}`, u.subject); }
  // prune notified keys older than 14 days
  for (const [k, v] of Object.entries(state.notified)) if (t - v > 14 * 864e5) delete state.notified[k];
}

/* ---------- update check: version.json is published with every release */
const newer = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; };
async function checkForUpdate() {
  try {
    const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' }); if (!r.ok) return;
    const { version } = await r.json();
    if (!newer(version, VERSION) || document.querySelector('.update-bar')) return;
    const bar = document.createElement('button'); bar.className = 'update-bar'; bar.dataset.a = 'apply-update';
    bar.innerHTML = `${ico('down', 16)} New version ${esc(version)} available — tap to update`; document.body.append(bar);
  } catch {}
}
async function hardUpdate() {
  try { const reg = await navigator.serviceWorker?.getRegistration(); await reg?.update(); } catch {}
  try { for (const k of await caches.keys()) await caches.delete(k); } catch {} // your data is in localStorage, not these caches
  location.reload();
}
applyTheme();
if (lock.get()?.hash) showLock();
render();
runSeeds();
checkForUpdate(); setInterval(checkForUpdate, 30 * 60e3);
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkForUpdate(); });
tick(); setInterval(() => { tick(); if (!document.querySelector('.scrim, .panel, .lock')) render(); }, 60e3);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { tick(); render(); } });
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
window.__ace = { get state() { return state; }, set state(v) { state = v; save(); render(); }, E, S };
