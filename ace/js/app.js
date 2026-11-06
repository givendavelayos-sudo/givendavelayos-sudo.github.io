import * as E from './engine.js';
import * as S from './sources.js';

/* ================================================================ store */
const KEY = 'ace.v1', GKEY = 'ace.gkey';
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/13n5Hfh216lruqi4I4wzNvIxEvPX4wkTp83bbMNF3boQ/edit?usp=sharing';
const HUB = { schedule: 'https://hub.gertcrev.com/admin/group-chat/my-schedule', evals: 'https://hub.gertcrev.com/admin/evaluations?show=1&instructor=a5a7af21-c35f-4dd8-b87c-d1c9a35ada32&type=&batch=&section=&program=' };
const blank = () => ({ v: 1, identity: { name: '', initials: 'GDL', email: '' }, cfg: { initials: 'GDL' }, sources: { schedule: {}, sheet: { url: SHEET_URL }, evals: {} },
  sessions: [], units: [], unitHistory: [], changes: [], readiness: {}, arrivals: {}, handouts: {}, exams: {}, assessments: [], duties: [], evals: [], practices: [], snooze: {}, notes: {}, notified: {}, review: [], imports: {} });
let state;
try { state = { ...blank(), ...JSON.parse(localStorage.getItem(KEY) || 'null') }; } catch { state = blank(); }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { toast('Could not save on this device'); } };
const gkey = { get: () => { try { return localStorage.getItem(GKEY) || ''; } catch { return ''; } }, set: v => { try { v ? localStorage.setItem(GKEY, v) : localStorage.removeItem(GKEY); } catch {} } };

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
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>', face: '<path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M9 10v1M15 10v1M12 10v3h-1M9.5 16a3.5 3.5 0 0 0 5 0"/>',
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
const TAB_ALIAS = { week: 'schedule', work: 'tasks', growth: 'performance', sources: 'connections' };
let tab = (location.hash || '#home').slice(1); tab = TAB_ALIAS[tab] || tab;
if (!['home', 'schedule', 'tasks', 'performance'].includes(tab)) tab = 'home';

/* ================================================================ shared UI pieces (design system) */
function header(title, sub) {
  const n = alerts().length;
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
const KIND = { handout: 'Handout', leadppt: 'Lead PowerPoint', exam: 'Exam', assessment: 'Assessment', duty: 'Lead duty' };
const STATUS = { overdue: ['bad', 'Overdue'], behind: ['amb', 'Behind plan'], soon: ['amb', 'Due soon'], ok: ['', 'On track'], done: ['ok', 'Done'] };
const dueText = (ms, t) => !ms ? 'No due date' : ms < t ? `Was due ${E.fmtDayRel(ms, t)} · ${E.fmtTime(ms)}` : `Due ${E.fmtDayRel(ms, t)} · ${E.fmtTime(ms)}`;
const scoreTxt = v => ui().hideScores ? '••••' : v == null ? '—' : (+v).toFixed(2);
function taskCtx(x) { return x.kind === 'readiness' ? ['class', x.ref] : x.kind === 'handout' ? ['deliv', x.ref] : x.kind === 'assessment' ? ['deliv', 'as:' + x.ref] : ['deliv', 'du:' + x.ref]; }
function taskRow(x, t, first) {
  const [a, id] = taskCtx(x);
  return `<div class="lrow task ${first ? 'first' : ''}"><button class="box-btn" data-a="task" data-id="${esc(x.id)}" aria-label="Mark done"><span class="box">${ico('check', 15)}</span></button>
    <button class="lmain" data-a="${a}" data-id="${esc(id)}"><div class="l-t">${esc(x.title)}</div><div class="l-s">${esc(x.sub)}</div></button>
    <span class="when ${x.overdue ? 'bad' : ''}">${x.overdue ? 'Overdue' : `${x.official ? 'Due' : 'By'} ${E.fmtDayRel(x.target, t) === 'Today' ? E.fmtTime(x.target) : DOW3[E.P(x.target).dow].slice(0, 1) + DOW3[E.P(x.target).dow].slice(1).toLowerCase()}`}</span></div>`;
}
function delivRow(d, t) {
  const [cls, label] = STATUS[d.status];
  return `<button class="lrow" data-a="deliv" data-id="${esc(d.id)}">${dateChip(d.due, d.status === 'overdue' ? 'bad' : '')}<div class="grow"><div class="l-t">${esc(d.title)}</div>
    <div class="l-s">${KIND[d.kind]}${d.due ? ' · ' + E.fmtTime(d.due) : ''} · ${d.done ? 'All steps done' : d.next ? 'Next: ' + esc(d.next.label) : ''}</div>${bar(d.doneCount, d.steps.length)}</div><span class="tag ${cls}">${label}</span></button>`;
}

/* ================================================================ Today */
const HOME_CARDS = [['next', 'Next class'], ['today', 'Focus today'], ['upcoming', 'Coming up'], ['performance', 'Performance']];
function nextCard(s, t, c) {
  const r = E.readiness(s, state, c), arr = state.arrivals[s.id], lb = E.leaveBy(s, c), inClass = t >= s.start && t < s.end;
  const soon = !s.approx && !arr && s.start - t < 3 * 36e5 && t < s.end, late = soon && t > lb;
  const when = s.approx ? `Week of ${E.fmtDay(s.start)} · class times not imported yet` : inClass ? `In class now · until ${E.fmtTime(s.end)}` : `${E.fmtDayRel(s.start, t)} · ${E.fmtTime(s.start)}–${E.fmtTime(s.end)}${s.section ? ' · ' + s.section : ''}`;
  return `<div class="card hero ${late ? 'late' : ''}"><div class="eyebrow">Next class${s.role ? ' · ' + (s.role === 'lead' ? 'Lead' : 'Support') : ''}</div>
    <div class="h-title">${esc(s.subject)}</div><div class="h-sub">${esc(when)}${arr ? ` · arrived ${esc(arr.status.replace('_', ' '))}` : ''}</div>
    <div class="h-ready"><div class="row"><span>Preparation</span><b>${r.done} of ${r.total}</b></div>${bar(r.done, r.total, 'light')}</div>
    ${soon ? `<div class="h-alert">${ico('clock', 16)} ${s.format === 'online' ? 'Be online by' : 'Leave by'} <b>${E.fmtTime(lb)}</b></div>` : ''}
    <div class="h-actions">${soon ? `<button class="btn light" data-a="arrive" data-id="${esc(s.id)}">I’m here</button>` : r.next ? `<button class="btn light" data-a="task" data-id="rd:${esc(r.next.key)}:${r.next.id}">${ico('check', 16)} ${esc(r.next.label)}</button>` : `<span class="h-done">${ico('check', 16)} Fully prepared</span>`}
      <button class="btn glass" data-a="class" data-id="${esc(s.id)}">Checklist</button></div></div>`;
}
function home() {
  const t = now(), c = cfg(), u = ui(), P = E.P(t), sec = {};
  const hello = P.h < 12 ? 'Good morning' : P.h < 18 ? 'Good afternoon' : 'Good evening', first = state.identity.name?.split(' ')[0];
  const next = E.teachingItems(state).find(s => s.end > t && s.kind !== 'consultation');
  sec.next = next ? nextCard(next, t, c) : `<div class="card hero"><div class="eyebrow">Next class</div><div class="h-title">Nothing scheduled</div><div class="h-sub">Connect your lead sheet and hub schedule to see what’s next.</div><div class="h-actions"><button class="btn light" data-a="connections">Open connections</button></div></div>`;
  // the next class's prep is already on the card above, so Focus today lists everything else
  const pl = E.plan(state, t), rest = pl.today.filter(x => !(next && x.kind === 'readiness' && x.ref === next.id && x.item === E.readiness(next, state, c).next?.id)), list = rest.slice(0, 4), more = pl.later.length + Math.max(0, rest.length - 4);
  const mins = list.reduce((n, x) => n + x.min, 0), dur = mins >= 60 ? `${Math.floor(mins / 60)}h${mins % 60 ? ' ' + (mins % 60) + 'm' : ''}` : `${mins} min`;
  sec.today = secH('Focus today', list.length ? `<span class="muted small">About ${dur} of work</span>` : '') + `<div class="card list">${list.length ? list.map((x, i) => taskRow(x, t, i === 0)).join('') : '<div class="empty-line">Nothing pressing today.</div>'}${more ? `<button class="more" data-a="tab" data-id="tasks">${more} more coming up ${ico('chev', 14)}</button>` : ''}</div>`;
  const dv = E.deliverables(state, t).filter(d => !d.done).slice(0, 3);
  sec.upcoming = secH('Coming up', '<button class="link" data-a="tab" data-id="tasks">All tasks</button>') + `<div class="card list">${dv.length ? dv.map(d => delivRow(d, t)).join('') : '<div class="empty-line">No deliverables due.</div>'}</div>`;
  const ev = E.analyzeEvals(state.evals), fa = E.focusAreas(ev)[0];
  if (ev) {
    const th = fa && E.THEMES[fa.key], crit = fa && ev.criteria.find(x => E.themeForCriterion(x.name) === fa.key);
    sec.performance = secH('Performance') + `<button class="card perf" data-a="tab" data-id="performance"><div class="perf-score"><b>${scoreTxt(ev.latest?.v)}</b><span>of 5</span></div>
      <div class="grow">${th ? `<div class="l-s">Improve next</div><div class="l-t">${esc(th.label)}</div><div class="l-s">${crit ? esc(crit.name) + ' · ' + scoreTxt(crit.latest) : ''}${fa.concerns ? `${crit ? ' · ' : ''}${fa.concerns} comments` : ''}</div>` : '<div class="l-t">No clear weak spot</div>'}</div>${ico('chev', 16)}</button>`;
  }
  return header(`${hello}${first ? ', ' + first : ''}`, E.fmtDay(t)) + u.home.order.filter(k => !u.home.hidden[k] && sec[k]).map(k => `<section class="hsec">${sec[k]}</section>`).join('');
}

/* ================================================================ Schedule */
function schedule() {
  const t = now(), c = cfg(), mon0 = E.mondayOf(t);
  let h = header('Schedule', 'Classes and teaching weeks') + `<div class="toolbar"><button class="btn sec sm" data-a="paste-sched">${ico('plus', 16)} Paste hub week</button><button class="btn sec sm" data-a="add-class">Add class</button></div>`;
  const items = E.teachingItems(state).filter(s => s.start >= mon0 && s.start < E.addDays(mon0, 42));
  const cf = new Set(E.conflicts(state, c).flatMap(x => [x.a.id, x.b.id]));
  let any = false;
  for (let w = 0; w < 6; w++) {
    const mon = E.addDays(mon0, w * 7), wk = items.filter(s => s.start >= mon && s.start < E.addDays(mon, 7));
    const unit = (state.units || []).find(u => E.dayKey(u.weekStart) === E.dayKey(mon));
    if (!wk.length && !unit) continue;
    any = true;
    const label = w === 0 ? 'This week' : w === 1 ? 'Next week' : `Week of ${E.fmtDay(mon)}`;
    const topic = unit ? `${unit.week} · ${unit.topic}` : wk.find(s => s.weekTitle)?.weekTitle || '';
    const real = wk.filter(s => !s.approx);
    h += `<section class="week"><div class="wk-h"><div class="grow"><div class="wk-t">${label}</div>${topic ? `<div class="l-s">${esc(topic)}</div>` : ''}</div>${unit ? roleTag(unit.role, unit.verified) : ''}</div><div class="card list">`;
    for (const s of real) {
      const r = E.readiness(s, state, c), arr = state.arrivals[s.id], past = s.end < t;
      const right = arr ? `<span class="tag ${arr.status === 'late' ? 'bad' : 'ok'}">${esc(arr.status === 'on_time' ? 'On time' : arr.status === 'early' ? 'Early' : 'Late')}</span>` : past ? '<span class="tag">Not logged</span>' : `<span class="pct ${r.pct >= .99 ? 'ok' : ''}">${Math.round(r.pct * 100)}%</span>`;
      h += `<button class="lrow ${past ? 'past' : ''}" data-a="class" data-id="${esc(s.id)}">${dateChip(s.start)}<div class="grow"><div class="l-t">${E.fmtTime(s.start)}–${E.fmtTime(s.end)}${cf.has(s.id) ? ' <span class="tag bad">Overlap</span>' : ''}</div>
        <div class="l-s">${esc([s.kind === 'consultation' ? s.subject : s.section, s.format === 'online' ? 'Online' : '', s.group ? 'Group ' + s.group : ''].filter(Boolean).join(' · ') || s.subject)}</div></div>${right}</button>`;
    }
    if (!real.length && unit) h += `<div class="lrow"><div class="grow"><div class="l-t muted">Class times not imported</div><div class="l-s">Paste this week from the hub to see your exact classes</div></div><button class="btn sec sm" data-a="paste-sched" data-week="${E.dayKey(mon)}">Paste</button></div>`;
    if (unit) h += `<button class="lrow sub" data-a="class" data-id="u:${esc(unit.key)}"><div class="grow l-s">Topic prep · ${E.readiness(E.unitItems(state).find(x => x.id === 'u:' + unit.key), state, c).done} of ${E.readiness(E.unitItems(state).find(x => x.id === 'u:' + unit.key), state, c).total} ready · shared by all classes this week</div>${ico('chev', 14)}</button>`;
    h += `</div></section>`;
  }
  if (!any) h += emptyCard('No classes yet', 'Paste your week from the hub, or connect the lead sheet to see your teaching weeks.', `<button class="btn sm" data-a="paste-sched">Paste hub week</button><button class="btn sec sm" data-a="connections">Connections</button>`);
  return h;
}

/* ================================================================ Tasks */
function tasks() {
  const t = now(), all = E.deliverables(state, t), m = E.mondayOf(t);
  let h = header('Tasks', 'Handouts, PowerPoints, exams and duties');
  const groups = [['Overdue', d => !d.done && d.due && d.due < t], ['This week', d => !d.done && d.due >= t && d.due < E.addDays(m, 7)], ['Next week', d => !d.done && d.due >= E.addDays(m, 7) && d.due < E.addDays(m, 14)], ['Later', d => !d.done && (!d.due || d.due >= E.addDays(m, 14))], ['Done', d => d.done]];
  let any = false;
  for (const [name, f] of groups) { const l = all.filter(f); if (!l.length) continue; any = true; h += secH(name) + `<div class="card list">${l.map(d => delivRow(d, t)).join('')}</div>`; }
  if (!any) h += emptyCard('No tasks yet', 'Handouts, lead PowerPoints and lead exams appear automatically from your lead sheet.');
  const c = cfg();
  h += `<button class="btn sec wide" data-a="add-deliv">${ico('plus', 16)} Add a deliverable</button>
    <button class="rules-note" data-a="panel" data-id="rules">Handouts: Wed ${E.fmtTime(E.atTime(t, c.cutoffTime))} before the teaching week · lead PPT ${c.leadPptDaysBefore} days ahead · lead exam: that week’s Wed ${E.fmtTime(E.atTime(t, c.examTime))} ${ico('chev', 12)}</button>`;
  return h;
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
      ${(d.kind === 'assessment' || d.kind === 'exam') && !d.auto ? `<button class="btn sec sm danger" data-a="del-as" data-id="${esc(d.ref)}">Delete</button>` : ''}${d.kind === 'duty' ? `<button class="btn sec sm danger" data-a="del-duty" data-id="${esc(d.ref)}">Delete</button>` : ''}</div>`);
}

/* ================================================================ class checklist */
function classSheet(id) {
  const t = now(), c = cfg(), s = E.teachingItems(state).find(x => x.id === id) || E.unitItems(state).find(x => x.id === id) || state.sessions.find(x => x.id === id);
  if (!s) return;
  const r = E.readiness(s, state, c), arr = state.arrivals[s.id];
  const groups = Object.entries(E.CATS).map(([k, label]) => { const rows = r.rows.filter(x => x.cat === k); return rows.length ? `<div class="cat-h">${label}<span>${rows.filter(x => x.doneAt).length}/${rows.length}</span></div>
    ${rows.map(x => `<button class="tick ${x.doneAt ? 'on' : ''}" data-a="rd" data-id="${esc(s.id)}" data-item="${x.id}"><span class="box">${ico('check', 15)}</span><span class="lbl">${esc(x.official && s.role === 'lead' ? x.label + ' · lead deadline' : x.label)}<span class="hint">${x.doneAt ? 'Done ' + E.fmtDayRel(x.doneAt, t) : 'By ' + E.fmtDayRel(s.start - x.lead * 36e5, t) + ' ' + E.fmtTime(s.start - x.lead * 36e5)}${s.unit && !E.SESSION_ITEMS.has(x.id) && !s.approx ? ' · shared this week' : ''}</span></span></button>`).join('')}` : ''; }).join('');
  const tpls = Object.entries(c.templates).map(([k, v]) => `<option value="${k}" ${E.templateFor(s, c) === v ? 'selected' : ''}>${esc(v.label)}</option>`).join('');
  sheet(`<div class="row"><div class="eyebrow grow">${s.approx ? 'Topic prep' : 'Class'}${s.role ? ' · ' + (s.role === 'lead' ? 'Lead' : 'Support') : ''}</div>${s.unit && !s.unit.verified ? '<span class="tag amb">Unverified</span>' : ''}</div>
    <h2>${esc(s.subject)}</h2><div class="muted small">${s.approx ? `Week of ${E.fmtDay(s.start)} · applies to every class of this topic` : `${E.fmtDay(s.start)} · ${E.fmtTime(s.start)}–${E.fmtTime(s.end)} · ${esc(s.section || s.location || s.platform || '')}`}</div>
    <div style="margin:14px 0 2px" class="row"><div class="grow">${bar(r.done, r.total)}</div><b class="small">${r.done} of ${r.total}</b></div>
    ${groups}
    ${!s.approx && t > s.start - 3 * 36e5 ? `<div class="cat-h">Arrival</div>${arr ? `<div class="row"><span class="tag ${arr.status === 'late' ? 'bad' : 'ok'}">${esc(arr.status.replace('_', ' '))}${arr.at ? ' · ' + E.fmtTime(arr.at) : ''}</span><button class="link" data-a="unarrive" data-id="${esc(s.id)}">Undo</button></div>` :
      `<div class="seg"><button data-a="arrive" data-id="${esc(s.id)}">I’m here</button><button data-a="arrive-m" data-id="${esc(s.id)}" data-st="early">Early</button><button data-a="arrive-m" data-id="${esc(s.id)}" data-st="on_time">On time</button><button data-a="arrive-m" data-id="${esc(s.id)}" data-st="late">Late</button></div>`}` : ''}
    <details class="more-opts"><summary>Notes & checklist type</summary><label>Notes</label><textarea data-a="note" data-id="${esc(s.id)}" placeholder="Hard parts, questions to expect, what to try…">${esc(state.notes[s.id] || '')}</textarea>
      <label>Checklist type</label><select data-a="tpl" data-id="${esc(s.id)}">${tpls}</select>
      ${s.source?.id === 'user' ? `<button class="btn sec sm danger" style="margin-top:12px" data-a="del-class" data-id="${esc(s.id)}">Delete class</button>` : ''}</details>`);
}

/* ================================================================ Performance */
function focusCard(f, ev, i) {
  const th = E.THEMES[f.key], crit = ev.criteria.find(x => E.themeForCriterion(x.name) === f.key), tm = ev.themes.find(x => x.key === f.key);
  return `<div class="card focus-card"><div class="row" style="align-items:flex-start"><span class="rank">${i + 1}</span><div class="grow"><div class="l-t">${esc(th.label)}</div>
    <div class="l-s">${crit ? `${esc(crit.name)} · ${scoreTxt(crit.latest)}` : 'From comments'}${tm?.neg ? ` · ${tm.neg} comment${tm.neg > 1 ? 's' : ''} raise it` : ''}</div></div></div>
    ${th.tips.slice(0, 2).map(tip => { const ad = state.practices.some(p => p.text === tip && !p.archived); return `<div class="action"><span>${esc(tip)}</span>${ad ? '<span class="tag ok">Adopted</span>' : `<button class="btn sec sm" data-a="adopt" data-k="${f.key}" data-tip="${esc(tip)}">Adopt</button>`}</div>`; }).join('')}
    ${tm?.quotes.length ? `<details><summary>What students said (${tm.quotes.length}) · Ace’s reading</summary>${tm.quotes.map(q => `<div class="quote">“${esc(q)}”</div>`).join('')}</details>` : ''}</div>`;
}
function performance() {
  const t = now(), ev = E.analyzeEvals(state.evals);
  let h = header('Performance', 'Evaluations, habits and what to improve');
  if (!ev) h += emptyCard('No evaluation yet', 'Import your evaluation results to see your scores and what to improve first.', `<button class="btn sm" data-a="merge">Import file</button><button class="btn sec sm" data-a="paste-eval">Paste from hub</button>`);
  else {
    const last = state.evals.slice().sort((a, b) => (a.date || '').localeCompare(b.date || '')).at(-1);
    h += `<div class="card summary"><div class="perf-score big"><b>${scoreTxt(ev.latest?.v)}</b><span>of 5</span></div><div class="grow"><div class="l-t">${esc(last.period || 'Latest evaluation')}</div>
      <div class="l-s">${last.responses ? last.responses + ' responses · ' : ''}${ev.prev ? `${ev.latest.v >= ev.prev.v ? '▲' : '▼'} ${Math.abs(ev.latest.v - ev.prev.v).toFixed(2)} vs previous` : 'first evaluation in Ace'}</div>
      <div style="margin-top:8px">${bar(ev.latest?.v || 0, 5)}</div><div class="l-s">${ui().hideScores ? '' : `${(5 - (ev.latest?.v || 0)).toFixed(2)} to 5.00`}</div></div></div>`;
    const fas = E.focusAreas(ev).slice(0, 3);
    if (fas.length) h += secH('What to improve') + fas.map((f, i) => focusCard(f, ev, i)).join('');
    h += secH('Scores by criterion') + `<div class="card list">${ev.criteria.map(c => `<div class="lrow crit"><div class="grow"><div class="l-t">${esc(c.name)}</div>${bar(c.latest, 5, c.latest < 4.5 ? 'amb' : '')}</div><b class="score">${scoreTxt(c.latest)}</b></div>`).join('')}</div>`;
    const st = ev.themes.filter(x => x.pos > x.neg).map(x => x.label);
    if (st.length) h += `<div class="note-ok">${ico('star', 16)}<span>Students praise your <b>${esc(st.join(', ').toLowerCase())}</b>.</span></div>`;
  }
  const j = E.journey(state, t);
  const hab = [['On time', j.lead.punctual, `${j.logged} arrival${j.logged === 1 ? '' : 's'} logged`], ['Ready at class start', j.lead.readyAtStart, `${j.classes} class${j.classes === 1 ? '' : 'es'}`], ['Submitted on time', j.lead.responsibility, 'handouts & exams']].filter(x => x[1] != null);
  h += secH('Habits · last 30 days') + (hab.length ? `<div class="card stats">${hab.map(([l, v, n]) => `<div class="stat"><b>${pct(v)}</b><span>${l}</span><small>${n}</small></div>`).join('')}</div>`
    : `<div class="card"><div class="empty-line">Tap “I’m here” when you arrive and tick off your prep — your on-time and readiness rates appear here.</div></div>`);
  const pr = state.practices.filter(p => !p.archived);
  if (pr.length) h += secH('Practices you’re applying') + `<div class="card list">${pr.map(p => `<div class="lrow"><div class="grow"><div class="l-t small">${esc(p.text)}</div><div class="l-s">Applied ${p.applied.length}× ${p.applied.length ? '· last ' + E.fmtAgo(p.applied.at(-1), t) : ''}</div></div><button class="btn sec sm" data-a="apply" data-id="${esc(p.id)}">+1</button><button class="circle sm" data-a="unadopt" data-id="${esc(p.id)}" aria-label="Stop tracking">${ico('x', 14)}</button></div>`).join('')}</div>`;
  if (state.evals.length) h += secH('Evaluations', '<button class="link" data-a="paste-eval">Add</button>') + `<div class="card list">${state.evals.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')).map(e => `<div class="lrow"><div class="grow"><div class="l-t">${esc(e.period || e.date)}</div><div class="l-s">${esc(e.date)} · ${Object.keys(e.criteria || {}).length} criteria · ${(e.comments || []).length} comments · ${esc(e.source || '')}</div></div><b class="score">${scoreTxt(e.overall)}</b><button class="circle sm" data-a="del-eval" data-id="${esc(e.id)}" aria-label="Delete">${ico('x', 14)}</button></div>`).join('')}</div>`;
  return h;
}

/* ================================================================ Connections (Settings) */
function connectionsHTML() {
  const t = now(), c = cfg(), sh = state.sources.sheet, sc = state.sources.schedule;
  const fr = x => { const f = E.freshness(x, c, t); return `<span class="tag ${f.state === 'live' ? 'ok' : f.state === 'failed' ? 'bad' : 'amb'}">${esc(f.state === 'live' ? 'Up to date' : f.state === 'failed' ? 'Failed' : f.state === 'never' ? 'Not connected' : 'Outdated')}</span>`; };
  const wk = E.dayKey(E.mondayOf(t)), wk2 = E.dayKey(E.addDays(E.mondayOf(t), 7));
  const hist = (state.unitHistory || []).filter(h => h.type !== 'imported').slice(-4).reverse();
  const open = (state.review || []).filter(r => !r.resolvedAt);
  return `<div class="card"><div class="head"><h3>Lead instructor sheet</h3>${fr(sh)}</div>
    <div class="muted small">${esc(E.freshness(sh, c, t).label)}. Cells with <b>${esc(c.initials || '—')}</b>: neon blue = Lead, other colours = Support. Read-only.</div>
    <label>Google Sheet link</label><input data-f="sources.sheet.url" value="${esc(sh.url || '')}">
    <label>Google API key · stays on this device</label><input type="password" data-a="gkey" value="${esc(gkey.get())}" placeholder="Sheets API key, restricted to this site">
    ${sh.error ? `<div class="warnbox">${esc(sh.error)}</div>` : ''}${(sh.warnings || []).map(w => `<div class="warnbox">${esc(w)}</div>`).join('')}
    <button class="btn wide" style="margin-top:12px" data-a="sync-sheet">Sync now</button>
    ${hist.length ? `<div class="cat-h">Recent changes</div>${hist.map(x => `<div class="small" style="padding:3px 0">${esc(x.type)} · ${esc(x.topic)} <span class="muted">${E.fmtAgo(x.at, t)}</span></div>`).join('')}` : ''}</div>
  <div class="card" style="margin-top:12px"><div class="head"><h3>Class schedule (hub)</h3>${fr(sc)}</div>
    <div class="muted small">The hub needs your login, so Ace never stores your password. Open your week, Select All → Copy, then paste. Only your classes are kept, and you review them before saving.</div>
    <div class="row" style="margin-top:10px;gap:8px"><a class="btn sec sm" target="_blank" rel="noopener" href="${HUB.schedule}?week=${wk}">Open this week</a><a class="btn sec sm" target="_blank" rel="noopener" href="${HUB.schedule}?week=${wk2}">Open next week</a></div>
    <button class="btn wide" style="margin-top:10px" data-a="paste-sched">Paste schedule</button>
    <button class="link" style="margin-top:10px" data-a="file-sched">Import a CSV or .ics file instead</button></div>
  <div class="card" style="margin-top:12px"><div class="head"><h3>Evaluations (hub)</h3>${state.evals.length ? '<span class="tag ok">Imported</span>' : '<span class="tag amb">None yet</span>'}</div>
    <div class="muted small">Copy your results page and paste it, or import a file. Emails and ID numbers are masked.</div>
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
    <div class="two"><div><label>Lead PPT: days before week</label><input type="number" min="0" data-f="cfg.leadPptDaysBefore" value="${c.leadPptDaysBefore}"></div><div><label>…due at</label><input type="time" data-f="cfg.leadPptTime" value="${esc(c.leadPptTime)}"></div></div>
    <div class="two"><div><label>Arrive early (min)</label><input type="number" data-f="cfg.arriveEarlyMin" value="${c.arriveEarlyMin}"></div><div><label>Travel time (min)</label><input type="number" data-f="cfg.travelMin" value="${c.travelMin}"></div></div>
    <div class="two"><div><label>Online setup buffer (min)</label><input type="number" data-f="cfg.onlineSetupMin" value="${c.onlineSetupMin}"></div><div><label>Prep time per day (min)</label><input type="number" data-f="cfg.dailyMinutes" value="${c.dailyMinutes}"></div></div>
    <div class="two">${['lead', 'support'].map(r => `<div><label>${r === 'lead' ? 'Lead' : 'Support'} weeks are taught</label><select data-f="cfg.${r}Format"><option value="in_person" ${c[r + 'Format'] === 'in_person' ? 'selected' : ''}>In person</option><option value="online" ${c[r + 'Format'] === 'online' ? 'selected' : ''}>Online</option></select></div>`).join('')}</div>
    <div class="two"><div><label>Lead exam due (that week’s Wed)</label><input type="time" data-f="cfg.examTime" value="${esc(c.examTime)}"></div><div><label>Exam effort (hours)</label><input type="number" step="0.5" data-f="cfg.examEffortH" value="${c.examEffortH}"></div></div>
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
  for (const [k, label] of [['sheet', 'Lead sheet'], ['schedule', 'Class schedule']]) {
    const f = E.freshness(state.sources[k], c, t);
    if (f.state === 'failed' || f.state === 'stale') add(`sy:${k}:${E.dayKey(t)}`, { tone: f.state === 'failed' ? 'bad' : 'amb', icon: 'sources', title: `${label}: ${f.state === 'failed' ? 'sync failed' : 'may be outdated'}`, sub: f.label, act: 'tab', actId: 'connections', label: 'Update' });
  }
  const unv = (state.units || []).filter(x => !x.verified && x.weekStart + 7 * 864e5 > t).length;
  if (unv) add(`uv:${unv}:${state.sources.sheet.lastOk || 0}`, { tone: 'amb', icon: 'sources', title: `${unv} sheet week${unv > 1 ? 's' : ''} unverified`, sub: 'Sync the lead sheet to confirm lead/support', act: 'tab', actId: 'connections', label: 'Sync' });
  for (const r of state.review || []) if (!r.resolvedAt) add(`rv:${r.id}`, { tone: 'amb', icon: 'alert', title: `Needs review · ${r.title}`, sub: r.detail || '', act: 'review', actId: r.id, label: 'Details', review: r });
  const order = { bad: 0, lead: 1, amb: 2, '': 3 };
  return out.sort((a, b) => order[a.tone] - order[b.tone]);
}
function alertsSheet() {
  const list = alerts();
  sheet(`<div class="row" style="justify-content:space-between"><h2>Alerts</h2>${list.length ? '<button class="link" data-a="alerts-clear">Mark all read</button>' : ''}</div>
    ${list.length ? list.map(a => `<div class="alert ${a.tone}"><span class="a-ico">${ico(a.icon, 18)}</span><div class="grow"><div class="a-t">${esc(a.title)}</div><div class="muted small">${esc(a.sub)}</div></div>
      <button class="btn sm ghost" data-a="alert-go" data-id="${esc(a.id)}">${esc(a.label)}</button><button class="circle" style="width:32px;height:32px" data-a="alert-x" data-id="${esc(a.id)}" aria-label="Dismiss">${ico('x', 14)}</button></div>`).join('')
      : `<div class="empty"><b>All caught up ✨</b>Schedule changes, lead/support changes, deadlines due soon and sync problems show up here.</div>`}`);
}
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
const VERSION = '0.4.0';
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
const SEEDS = ['seed/gertc-2026-11-06.json'];
async function runSeeds() {
  for (const url of SEEDS) {
    const id = url.split('/').pop();
    if (state.imports?.[id]) continue;
    try {
      const r = await fetch(url, { cache: 'no-store' }); if (!r.ok) continue;
      const data = await r.json();
      const rep2 = await applyImport(data, id, data.label);
      toast(`Imported from your screenshots: ${importSummary(rep2)}`);
    } catch {}
  }
}
function downloadFile(name, text, type) { const u = URL.createObjectURL(new Blob([text], { type })); const l = document.createElement('a'); l.href = u; l.download = name; document.body.append(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(u), 2000); }
const PANELS = {
  settings() {
    const u = ui(), c = cfg(), L = lock.get(), perm = 'Notification' in window ? Notification.permission : 'unsupported';
    return ['Settings', `<label class="searchbox">${ico('search', 18)}<input id="setq" placeholder="Search settings" value="${esc(setQ)}" autocomplete="off"></label>
      ${grp('Profile', [rowBox('Name', `<input data-f="identity.name" value="${esc(state.identity.name)}" placeholder="e.g. Given Dave Layos">`), rowBox('Initials in schedules', `<input data-f="cfg.initials" value="${esc(c.initials)}" style="text-transform:uppercase" maxlength="4">`, 'Ace keeps only cells with these initials from the hub schedule and the lead sheet.')])}
      ${grp('Connections', [rowLink('Lead instructor sheet', E.freshness(state.sources.sheet, c, Date.now()).label, 'panel', 'connections'), rowLink('Class schedule (hub)', E.freshness(state.sources.schedule, c, Date.now()).label, 'panel', 'connections'), rowLink('Evaluations', state.evals.length ? `${state.evals.length} imported` : 'None imported yet', 'panel', 'connections')])}
      ${grp('Appearance', [rowBox('Theme', `<div class="seg">${[['system', 'System'], ['light', 'Light'], ['dark', 'Dark'], ['amoled', 'AMOLED']].map(([k, l]) => `<button class="${u.theme === k ? 'on' : ''}" data-a="theme" data-id="${k}">${l}</button>`).join('')}</div>`),
        rowBox('App color', `<div class="swatches">${ACCENTS.map(([n, hx]) => `<button class="sw ${u.accent === hx ? 'on' : ''}" style="--c:${hx || '#5a9e5f'}" data-a="accent" data-id="${hx}" aria-label="${n}"></button>`).join('')}<label class="sw custom ${u.accent && !ACCENTS.some(x => x[1] === u.accent) ? 'on' : ''}" style="--c:${u.accent || '#5a9e5f'}" aria-label="Custom color"><input type="color" data-a="accent-custom" value="${u.accent || '#5a9e5f'}"></label></div>`)])}
      ${grp('Home screen', [rowLink('Cards on Home', `${HOME_CARDS.length - Object.values(u.home.hidden).filter(Boolean).length} shown · reorder or hide`, 'panel', 'home')])}
      ${grp('Preferences', [rowToggle('Hide scores on Home', 'Shows •••• instead of your evaluation score', 'ui.hideScores', u.hideScores), rowToggle('24-hour time', '13:00 instead of 1:00 PM', 'ui.clock24', u.clock24)])}
      ${grp('Teaching', [rowLink('Teaching rules', `Cutoffs ${E.fmtTime(E.atTime(Date.now(), c.cutoffTime))} · lead PPT ${c.leadPptDaysBefore} days ahead · buffers`, 'panel', 'rules')])}
      ${grp('Security', [rowToggle('App lock', L?.hash ? 'PIN required when opening Ace' : 'Protect your evaluations with a PIN', 'lock', !!L?.hash),
        ...(L?.hash ? [rowLink('Change PIN', '', 'pin-change'), `<label class="srow"><div class="grow"><div class="s-l">Face ID unlock</div><div class="s-s">${faceOk ? 'Unlock with your face' : 'Not available on this device or browser'}</div></div><input type="checkbox" class="switch" data-a="faceid" ${L.cred ? 'checked' : ''} ${faceOk ? '' : 'disabled'}></label>`] : [])])}
      ${grp('Notifications', [rowLink('Reminders', perm === 'granted' ? 'On for this device' : perm === 'denied' ? 'Blocked — allow in iPhone Settings → Ace' : 'Tap to allow (open Ace from the Home Screen first)', 'notif'),
        rowToggle('Leave-by / log-in time', '15 minutes before', 'ui.notif.leave', u.notif.leave), rowToggle('Deadlines', 'Handouts, exams, lead duties — 3 hours before', 'ui.notif.deadlines', u.notif.deadlines),
        rowToggle('Lead PowerPoint', 'The day before it’s due', 'ui.notif.leadppt', u.notif.leadppt), rowToggle('Schedule & role changes', 'After a sync finds changes', 'ui.notif.changes', u.notif.changes),
        rowToggle('Morning plan', 'Your most important task and today’s priorities', 'ui.notif.morning', u.notif.morning), ...(u.notif.morning ? [rowBox('Morning plan time', `<input type="time" data-f="ui.notif.morningTime" value="${esc(u.notif.morningTime)}">`)] : []),
        `<div class="srow col"><div class="s-s">Reminders arrive while Ace is open or recently opened. Background push needs the server phase.</div></div>`])}
      ${grp('Calendar', [rowLink('Add classes & deadlines to your calendar', 'Download an .ics file for Google or Apple Calendar', 'ics'), `<div class="srow col"><div class="s-s">Google Calendar: Settings → Import & export → Import the file. Re-import after schedule changes (events update, not duplicate). A live Google Calendar sync needs Google sign-in and isn’t set up yet.</div></div>`])}
      ${grp('Backup & data', [rowLink('Import data file (merge)', 'Adds new records only · never duplicates or overwrites', 'merge'), rowLink('Export backup', 'Save a copy of everything (not your API key or PIN)', 'export'), rowLink('Restore backup (replace all)', 'From an Ace JSON backup', 'import'), `<button class="srow danger" data-a="reset"><div class="grow"><div class="s-l">Erase all data on this device</div></div></button>`])}
      ${grp('Help', [rowLink('How to use Ace', 'Sources, readiness, handouts, growth', 'panel', 'help')])}
      ${grp('About', [`<div class="srow col about"><div class="row"><img src="icon-192.png" width="44" height="44" style="border-radius:11px" alt=""><div><div class="s-l">Ace</div><div class="s-s">Your instructor excellence companion. Version ${VERSION}</div></div></div></div>`, rowLink('What’s new', '', 'panel', 'whatsnew'), rowLink('Check for updates', '', 'update')])}
      
      <div class="empty small" id="noresult" hidden>No settings match “<span></span>”</div>`];
  },
  home() {
    const u = ui();
    return ['Home screen', `<div class="muted small" style="margin:0 4px 10px">Choose which cards appear on Today and in what order.</div><div class="glist">${u.home.order.map((k, i) => `<div class="srow"><div class="grow"><div class="s-l">${esc(HOME_CARDS.find(x => x[0] === k)[1])}</div></div>
      <button class="circle sm" data-a="hmove" data-id="${k}" data-d="-1" ${i ? '' : 'disabled'} aria-label="Move up">${ico('up', 16)}</button><button class="circle sm" data-a="hmove" data-id="${k}" data-d="1" ${i < u.home.order.length - 1 ? '' : 'disabled'} aria-label="Move down">${ico('down', 16)}</button>
      <input type="checkbox" class="switch" data-a="hshow" data-id="${k}" ${u.home.hidden[k] ? '' : 'checked'}></div>`).join('')}</div>`];
  },
  rules() { return ['Teaching rules', rulesHTML()]; },
  connections() { return ['Connections', connectionsHTML()]; },
  help() {
    const step = (t, d) => `<div class="card" style="margin-bottom:10px"><h3>${t}</h3><div class="muted small" style="margin-top:6px">${d}</div></div>`;
    return ['How to use Ace', [
      step('1 · Connect your sources', 'Sources → <b>Lead sheet</b>: add your Google API key and tap Sync now. Neon-blue GDL cells become Lead weeks; other GDL cells are Support.<br>Sources → <b>Class schedule</b>: open the hub week, Select All → Copy, then Paste schedule. Only your GDL classes are kept.'),
      step('2 · Prepare once per topic', 'Open a class to see its checklist. Slides, solutions and studying are shared by every class of that topic-week. Room, link and buffer are per class.'),
      step('3 · Follow “Most important next”', 'Today ranks everything — readiness, handouts, lead PowerPoints and exams — by official deadline, suggested targets and effort.'),
      step('4 · Lead weeks', 'PowerPoint finalized 7 days before the week, handout due the Wednesday before (8 PM), exam due that week’s Wednesday (8 PM). Mark submitted only after you actually submit.'),
      step('5 · Be early', 'Leave-by / be-online-by times are on the class card. Tap “I’m here” when you arrive to build your punctuality record.'),
      step('6 · Grow from feedback', 'Growth → Paste from hub. Confirmed scores are shown apart from Ace’s reading of comments. Adopt practices and tap +1 each class you apply them.'),
    ].join('')];
  },
  whatsnew() {
    const v = (n, d, items) => `<div class="card" style="margin-bottom:10px"><div class="row"><b class="grow">Version ${n}</b><span class="muted small">${d}</span></div><ul class="small" style="margin:8px 0 0 18px;padding:0">${items.map(i => `<li style="margin:4px 0">${i}</li>`).join('')}</ul></div>`;
    return ['What’s new', v('0.4', 'Nov 6, 2026', ['Cleaner app: 4 tabs — Today, Schedule, Tasks, Performance', 'Today shows only your next class, today’s focus and what’s coming up', 'All handouts, lead PowerPoints and exams in one Tasks list with steps', 'Schedule groups classes by teaching week with topic and role', 'Performance: your score, the top 3 things to improve, real habit stats', 'Connections moved into Settings', 'One design system across every screen'])
      + v('0.3', 'Nov 6, 2026', ['Settings with search, like Power', 'Alerts bell: changes, deadlines, sync problems', 'App lock with PIN and Face ID', 'Themes: System, Light, Dark, AMOLED · app colors', 'Reorder or hide Home cards · hide scores · 24-hour time', 'Choose which reminders you get, plus a morning plan'])
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

/* ---------- app lock: PIN (salted SHA-256) + optional Face ID (WebAuthn platform authenticator), device-only */
const LKEY = 'ace.lock';
const lock = { get() { try { return JSON.parse(localStorage.getItem(LKEY) || 'null'); } catch { return null; } }, set(v) { try { v ? localStorage.setItem(LKEY, JSON.stringify(v)) : localStorage.removeItem(LKEY); } catch {} } };
let faceOk = false;
(async () => { try { faceOk = !!(window.PublicKeyCredential && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()); } catch {} })();
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
    ${L.cred && faceOk ? `<button data-a="face-unlock" aria-label="Unlock with Face ID">${ico('face', 26)}</button>` : '<span></span>'}<button data-a="pin" data-id="0">0</button><button data-a="pin" data-id="del" aria-label="Delete">${ico('del', 24)}</button></div>`;
}
function unlockNow() { locked = false; const el = $('.lock'); if (el) { el.classList.add('out'); setTimeout(() => el.remove(), 250); } render(); }
async function pinKey(k) {
  const L = lock.get(); if (!L) return unlockNow();
  if (k === 'del') pinBuf = pinBuf.slice(0, -1); else if (pinBuf.length < L.len) pinBuf += k;
  renderLock();
  if (pinBuf.length === L.len) { if (await sha(L.salt + pinBuf) === L.hash) unlockNow(); else { pinBuf = ''; renderLock(true); } }
}
async function faceUnlock() {
  const L = lock.get(); if (!L?.cred) return;
  try { await navigator.credentials.get({ publicKey: { challenge: crypto.getRandomValues(new Uint8Array(32)), rpId: location.hostname, allowCredentials: [{ type: 'public-key', id: unb64(L.cred), transports: ['internal'] }], userVerification: 'required', timeout: 60000 } }); unlockNow(); }
  catch { toast('Face ID didn’t work — use your PIN'); }
}
async function enableFaceId() {
  try {
    const cred = await navigator.credentials.create({ publicKey: { challenge: crypto.getRandomValues(new Uint8Array(32)), rp: { name: 'Ace', id: location.hostname },
      user: { id: crypto.getRandomValues(new Uint8Array(16)), name: 'ace-lock', displayName: 'Ace app lock' }, pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' }, timeout: 60000, attestation: 'none' } });
    lock.set({ ...lock.get(), cred: b64(cred.rawId) }); toast('Face ID added');
  } catch { toast('Face ID setup was cancelled'); }
  renderPanel();
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
  lock.set({ salt, hash: await sha(salt + v.p1), len: v.p1.length, cred: mode === 'change' ? L?.cred : null });
  closeSheet(); renderPanel(); toast(mode === 'new' ? 'App lock on' : 'PIN changed');
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) hiddenAt = Date.now();
  else if (lock.get()?.hash && !locked && hiddenAt && Date.now() - hiddenAt > 60e3) showLock();
});

/* ================================================================ render */
const TABS = [['home', 'Today', 'home'], ['schedule', 'Schedule', 'week'], ['tasks', 'Tasks', 'work'], ['performance', 'Performance', 'growth']];
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
  const screens = { home, schedule, tasks, performance };
  $('#app').innerHTML = screens[tab]();
  renderTabs();
}

/* ================================================================ import flows */
async function syncSheet() {
  const src = state.sources.sheet, t = now();
  src.lastTry = t;
  try {
    const { grid, title, tab: tabName } = await S.fetchSheetGrid(src.url, gkey.get());
    const { units, warnings } = S.parseTopicGrid(grid, { initials: cfg().initials, now: t });
    const m = E.mergeUnits(state.units, units, { source: { id: 'sheet', name: title }, now: t });
    state.units = m.units; state.unitHistory = [...(state.unitHistory || []), ...m.history].slice(-200);
    Object.assign(src, { lastOk: t, error: null, warnings, title, tab: tabName, method: 'api', firstOk: src.firstOk || t });
    if (ui().notif.changes) for (const h of m.history.filter(h => h.type !== 'added' || src.firstOk !== t)) notify(`uh:${h.key}:${h.at}`, h.type === 'removed' ? `Removed from the sheet: ${h.topic}` : h.to?.role === 'lead' ? `You are now LEAD: ${h.topic}` : `Sheet change: ${h.topic}`, `Week of ${E.fmtDay(h.weekStart)}`);
    const roleUp = m.history.filter(h => h.type === 'changed' && h.to?.role === 'lead');
    toast(roleUp.length ? `New lead week: ${roleUp[0].topic}` : `Sheet synced · ${units.length} weeks`);
  } catch (e) { src.error = e.message; toast('Sync failed — showing last saved data'); }
  save(); render();
}
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
    case 'sync-sheet': el.textContent = 'Syncing…'; await syncSheet(); break;
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
    case 'face-unlock': faceUnlock(); break;
    case 'pin-change': pinSheet('change'); break;
    case 'pin-save': await pinSave(id); break;
    case 'update': { toast('Checking for updates…'); try { const r = await navigator.serviceWorker?.getRegistration(); await r?.update(); } catch {} setTimeout(() => location.reload(), 700); break; }
    case 'reset': if (confirm('Erase ALL Ace data on this device? Export a backup first if you might need it.')) { state = blank(); state.imports = { 'gertc-2026-11-06.json': { at: t, report: null, label: 'Screenshot import (skipped after erase)' } }; save(); closePanel(); render(); toast('Erased'); } break;
  }
});
document.addEventListener('change', async e => {
  const el = e.target;
  if (el.dataset.f === 'lock') { const on = el.checked; el.checked = !on; pinSheet(on ? 'new' : 'off'); return; }
  if (el.dataset.a === 'accent-custom') { ui().accent = el.value; save(); applyTheme(); render(); return; }
  if (el.dataset.a === 'hshow') { ui().home.hidden[el.dataset.id] = !el.checked; save(); render(); return; }
  if (el.dataset.a === 'faceid') { if (el.checked) await enableFaceId(); else { const L = lock.get(); if (L) { delete L.cred; lock.set(L); } toast('Face ID unlock off'); renderPanel(); } return; }
  if (el.id === 'mg' && el.files[0]) { try { const d = JSON.parse(await el.files[0].text()); const r = await applyImport(d, `file:${el.files[0].name}`, `File · ${el.files[0].name}`); toast(`Merged: ${importSummary(r)}`); } catch { toast('Not an Ace data file'); } el.value = ''; return; }
  if (el.dataset.f) {
    const [root, ...path] = el.dataset.f.split('.'); let o = state[root] ||= {};
    for (const p of path.slice(0, -1)) o = o[p] ||= {};
    let v = el.type === 'checkbox' ? el.checked : el.type === 'number' ? +el.value : el.value;
    if (el.dataset.f === 'cfg.holidays') v = el.value.split(/[,\s]+/).filter(x => /^\d{4}-\d\d-\d\d$/.test(x));
    if (el.dataset.f === 'cfg.initials') v = v.toUpperCase().trim();
    o[path.at(-1)] = v; save(); if (root === 'ui') applyTheme(); render(); return;
  }
  if (el.dataset.a === 'gkey') { gkey.set(el.value.trim()); toast('Key saved on this device'); return; }
  if (el.dataset.a === 'tpl') { const s = state.sessions.find(x => x.id === el.dataset.id); if (s) s.template = el.value; else { (state.cfg.unitTemplates ||= {})[el.dataset.id] = el.value; } save(); render(); classSheet(el.dataset.id); return; }
  if (el.dataset.a === 'note') { state.notes[el.dataset.id] = el.value; save(); return; }
  if (el.id === 'schedFile' && el.files[0]) { const txt = await el.files[0].text(); const r = S.parseSchedule(txt, { identity: { name: state.identity.name, email: state.identity.email } }); reviewSessions(r.sessions, { unparsed: (r.skipped || []).map(x => `Row ${x.row}: ${x.reason}`), method: r.format }); el.value = ''; return; }
  if (el.id === 'bk' && el.files[0]) { try { const d = JSON.parse(await el.files[0].text()); if (!d || d.v !== 1) throw 0; state = { ...blank(), ...d }; save(); render(); toast('Backup restored'); } catch { toast('Not an Ace backup file'); } el.value = ''; }
});
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
  if (n.morning) { const at = E.atTime(t, n.morningTime || '06:30'); if (t >= at && t - at < 3 * 36e5) { const pl = E.plan(state, t); notify(`mp:${E.dayKey(t)}`, pl.next ? `Today: ${pl.next.title}` : 'Today: nothing pressing', `${pl.today.length} priorit${pl.today.length === 1 ? 'y' : 'ies'} · ${pl.minutes} min planned`); } }
  if (n.leave) for (const s of E.activeSessions(state)) { const lb = E.leaveBy(s, c); if (lb - t < 15 * 6e4 && lb - t > -5 * 6e4 && !state.arrivals[s.id]) notify(`lb:${s.id}`, `${s.format === 'online' ? 'Log in' : 'Leave'} by ${E.fmtTime(lb)}`, `${s.subject} starts at ${E.fmtTime(s.start)}`); }
  if (n.deadlines) for (const d of E.deadlines(state, t, 10)) if (d.at - t < 3 * 36e5 && d.at > t) notify(`dl:${d.kind}:${d.ref}`, `Due ${E.fmtTime(d.at)}: ${d.title}`, 'Confirm in Ace once it is submitted.');
  if (n.leadppt) for (const u of E.unitItems(state)) if (u.role === 'lead' && !state.readiness[u.id]?.slides_final) { const due = E.leadPptDue(u.unit, c); if (due - t < 30 * 36e5 && due > t) notify(`lp:${u.id}`, `Lead PowerPoint due ${E.fmtDayRel(due, t)}`, u.subject); }
  // prune notified keys older than 14 days
  for (const [k, v] of Object.entries(state.notified)) if (t - v > 14 * 864e5) delete state.notified[k];
}

applyTheme();
if (lock.get()?.hash) showLock();
render();
runSeeds();
tick(); setInterval(() => { tick(); if (!document.querySelector('.scrim, .panel, .lock')) render(); }, 60e3);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { tick(); render(); } });
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
window.__ace = { get state() { return state; }, set state(v) { state = v; save(); render(); }, E, S };
