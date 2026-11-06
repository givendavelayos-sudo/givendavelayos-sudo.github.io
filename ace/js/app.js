import * as E from './engine.js';
import * as S from './sources.js';

/* ================================================================ store */
const KEY = 'ace.v1', GKEY = 'ace.gkey';
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/13n5Hfh216lruqi4I4wzNvIxEvPX4wkTp83bbMNF3boQ/edit?usp=sharing';
const HUB = { schedule: 'https://hub.gertcrev.com/admin/group-chat/my-schedule', evals: 'https://hub.gertcrev.com/admin/evaluations?show=1&instructor=a5a7af21-c35f-4dd8-b87c-d1c9a35ada32&type=&batch=&section=&program=' };
const blank = () => ({ v: 1, identity: { name: '', initials: 'GDL', email: '' }, cfg: { initials: 'GDL' }, sources: { schedule: {}, sheet: { url: SHEET_URL }, evals: {} },
  sessions: [], units: [], unitHistory: [], changes: [], readiness: {}, arrivals: {}, handouts: {}, exams: {}, assessments: [], duties: [], evals: [], practices: [], snooze: {}, notes: {}, notified: {} });
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
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17v.5"/>', x: '<path d="M6 6l12 12M18 6 6 18"/>',
};
const ico = (n, s = 22) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${I[n]}</svg>`;
let toastT;
function toast(msg) { document.querySelector('.toast')?.remove(); const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.append(t); clearTimeout(toastT); toastT = setTimeout(() => t.remove(), 2600); }
function ring(p, size = 104, label = '') {
  const r = size / 2 - 8, c = 2 * Math.PI * r, v = Math.max(0, Math.min(1, p || 0));
  const col = p == null ? 'var(--faint)' : v >= .9 ? 'var(--green-2)' : v >= .6 ? 'var(--amber)' : 'var(--red)';
  return `<div class="ring" style="width:${size}px;height:${size}px"><svg viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="rgba(255,255,255,.16)" stroke-width="9"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${col}" stroke-width="9" stroke-linecap="round" stroke-dasharray="${c * v} ${c}"/></svg><div class="c">${label}</div></div>`;
}
const badge = (verified, txt) => verified ? `<span class="pill">${esc(txt || 'Verified')}</span>` : `<span class="pill amb">${esc(txt || 'Unverified')}</span>`;
function srcBadge(src) {
  if (!src) return '';
  if (src.id === 'user') return '<span class="pill amb">You entered</span>';
  const f = E.freshness(state.sources[src.id === 'sheet' ? 'sheet' : 'schedule'], cfg(), now());
  return f.state === 'live' ? `<span class="pill">${src.id === 'sheet' ? 'Sheet' : 'Hub'} · ${E.fmtAgo(src.at, now())}</span>` : `<span class="pill amb">Cached</span>`;
}

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
    if (last === 'submit') return confirmSubmit(hid);
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
let tab = (location.hash || '#home').slice(1);
if (!['home', 'week', 'work', 'growth', 'sources'].includes(tab)) tab = 'home';

function header(title, sub) {
  const st = E.streak(state, now());
  return `<div class="top"><div><h1>${esc(title)}</h1><div class="sub">${esc(sub)}</div></div>${st ? `<span class="streak" title="Consecutive teaching days: on time and ≥90% ready">${ico('flame', 18)}${st}</span>` : ''}</div>`;
}
function staleBanner() {
  const c = cfg(), t = now(), out = [];
  const sch = E.freshness(state.sources.schedule, c, t), sh = E.freshness(state.sources.sheet, c, t);
  if (sh.state !== 'live') out.push(`<b>Lead sheet:</b> ${esc(sh.label)}`);
  if (sch.state !== 'live') out.push(`<b>Class times:</b> ${esc(sch.state === 'never' ? 'not imported yet — paste your hub schedule' : sch.label)}`);
  return out.length ? `<button class="warnbox" style="width:100%;text-align:left;margin:0 0 12px" data-a="tab" data-id="sources">${out.join('<br>')} →</button>` : '';
}

function home() {
  const t = now(), c = cfg(), P = E.P(t);
  const hello = P.h < 12 ? 'Good morning' : P.h < 18 ? 'Good afternoon' : 'Good evening';
  const name = state.identity.name?.split(' ')[0];
  const items = E.teachingItems(state).filter(s => s.end > t);
  const next = items[0], pl = E.plan(state, t), dl = E.deadlines(state, t, 5);
  let h = header(`${hello}${name ? ', ' + name : ''}`, E.fmtDay(t)) + staleBanner();

  // Next class readiness
  if (next) {
    const r = E.readiness(next, state, c), arr = state.arrivals[next.id];
    const lb = E.leaveBy(next, c), inClass = t >= next.start && t < next.end;
    const urgent = !next.approx && !arr && t > lb;
    const cls = urgent ? 'late' : (!next.approx && next.start - t < 24 * 36e5 && r.pct < .7) ? 'warn' : '';
    const when = next.approx ? `Week of ${E.fmtDay(next.start)}` : inClass ? 'In progress' : `${E.fmtDayRel(next.start, t)} · ${E.fmtTime(next.start)}–${E.fmtTime(next.end)}`;
    h += `<div class="card hero ${cls}"><div class="row" style="align-items:flex-start"><div class="grow">
      <div class="eyebrow">Next class${next.role ? ' · ' + (next.role === 'lead' ? 'You are lead' : 'Support') : ''}</div>
      <div class="big" style="font-size:clamp(24px,7vw,30px)">${esc(next.subject)}</div>
      <div class="t">${esc(when)}${!next.approx && !inClass ? ` · in ${E.fmtDur(next.start - t)}` : ''}</div></div>
      ${ring(r.pct, 86, `${Math.round(r.pct * 100)}%<small>ready</small>`)}</div>
      <div class="chips">${next.approx ? `<span class="chip">Class time: from hub schedule</span>` : `<span class="chip">${next.format === 'online' ? 'Be online by' : 'Leave by'} <b>${E.fmtTime(lb)}</b></span><span class="chip">${esc(next.location || next.platform || '')}</span>`}
        <span class="chip"><b>${r.done}</b>/${r.total} confirmed</span>${r.unconfirmed ? `<span class="chip">${r.unconfirmed} not yet confirmed</span>` : ''}</div>
      ${r.next ? `<button class="btn" data-a="task" data-id="rd:${esc(next.id)}:${r.next.id}">${ico('check', 18)} Done: ${esc(r.next.label)}</button>` : `<div class="t" style="margin-top:12px">✓ Fully prepared. Use spare time to rehearse your opening.</div>`}
      <div class="row" style="margin-top:10px;gap:8px"><button class="btn ghost sm" style="background:#ffffff26;color:#fff;border:0" data-a="class" data-id="${esc(next.id)}">Open checklist</button>
      ${!next.approx && !arr && t > next.start - 3 * 36e5 && t < next.end ? `<button class="btn sm" style="background:#fff;color:#1c4a21" data-a="arrive" data-id="${esc(next.id)}">I’m here</button>` : ''}
      ${arr ? `<span class="chip">Arrived · ${esc(arr.status.replace('_', ' '))}</span>` : ''}</div></div>`;
  } else h += `<div class="card hero"><div class="eyebrow">Next class</div><div class="big" style="font-size:28px">Nothing scheduled</div><div class="t">Sync your lead sheet and paste your hub schedule to see what’s next.</div><button class="btn" data-a="tab" data-id="sources">Connect sources</button></div>`;

  // Most important next action
  if (pl.next) h += `<div class="card focus" style="margin-top:12px"><div class="eyebrow">Most important next</div><div style="font-weight:800;font-size:17px;margin-top:6px">${esc(pl.next.title)}</div>
    <div class="muted small" style="margin-top:2px">${esc(pl.next.sub)}</div><div class="row" style="margin-top:6px">${pl.next.overdue ? '<span class="pill bad">Overdue target</span>' : `<span class="pill amb">${pl.next.official ? 'Official deadline' : 'Suggested target'} · ${E.fmtDur(pl.next.target - t)}</span>`}<span class="muted small">~${pl.next.min} min</span></div>
    <div class="row" style="margin-top:12px;gap:8px"><button class="btn sm" data-a="task" data-id="${esc(pl.next.id)}">${ico('check', 16)} Done</button><button class="btn ghost sm" data-a="snooze" data-id="${esc(pl.next.id)}">Later today</button></div></div>`;

  // Today's priorities
  const list = pl.today.filter(x => x.id !== pl.next?.id).slice(0, 5);
  h += `<div class="card" style="margin-top:12px"><div class="head"><h3>Today’s priorities</h3><span class="muted small">${pl.minutes} / ${pl.capacity} min</span></div>
    ${list.length ? list.map(taskRow).join('') : `<div class="muted small">${pl.next ? 'Just the one above. Nothing else is pressing.' : 'Nothing pressing. A good day to get ahead on next week.'}</div>`}
    ${pl.later.length ? `<button class="link" style="margin-top:10px" data-a="tab" data-id="work">${pl.later.length} more coming up →</button>` : ''}</div>`;

  // Deadlines
  h += `<div class="card" style="margin-top:12px"><div class="head"><h3>Upcoming deadlines</h3><button class="link" data-a="tab" data-id="work">All</button></div>
    ${dl.length ? dl.map(d => `<div class="item"><div class="grow"><div style="font-weight:700">${esc(d.title)}</div><div class="muted small">${E.fmtDayRel(d.at, t)} · ${E.fmtTime(d.at)} · ${d.at < t ? `<span style="color:var(--red)">passed ${E.fmtDur(t - d.at)} ago — confirm if submitted</span>` : 'in ' + E.fmtDur(d.at - t)}</div></div>
      ${d.kind === 'handout' ? (d.verified ? '' : '<span class="pill amb">Time unverified</span>') : d.kind === 'lead' ? '<span class="pill">Lead</span>' : badge(d.verified, d.verified ? 'Verified date' : 'Unverified')}</div>`).join('') : '<div class="muted small">No deadlines found yet.</div>'}</div>`;

  // Assignments
  const us = (state.units || []).filter(u => u.weekStart + 7 * 864e5 > t).slice(0, 4);
  h += `<div class="card" style="margin-top:12px"><div class="head"><h3>My assignments</h3>${state.sources.sheet.lastOk ? `<span class="muted small">Sheet · ${E.fmtAgo(state.sources.sheet.lastOk, t)}</span>` : ''}</div>
    ${us.length ? us.map(u => `<div class="item"><div class="grow"><div style="font-weight:700">${esc(u.topic)}</div><div class="muted small">${esc(u.week)} · week of ${E.fmtDay(u.weekStart)}${u.coInstructors?.length ? ' · with ' + esc(u.coInstructors.join(', ')) : ''}</div></div>
      <span class="pill ${u.role === 'lead' ? '' : 'amb'}" style="${u.role === 'lead' ? 'background:#00ffff22;color:#5ff' : ''}">${u.role === 'lead' ? 'Lead' : 'Support'}</span>${u.verified ? '' : ' <span class="pill amb">?</span>'}</div>`).join('') : '<div class="muted small">Sync the lead sheet in Sources.</div>'}</div>`;

  // Excellence progress
  const j = E.journey(state, t);
  h += `<div class="tiles" style="margin-top:12px"><button class="tile" data-a="tab" data-id="growth"><div class="n">${pct(j.lead.punctual)}</div><div class="l">On time (30d)</div></button>
    <button class="tile" data-a="tab" data-id="growth"><div class="n">${pct(j.lead.readyAtStart)}</div><div class="l">Ready at start</div></button>
    <button class="tile" data-a="tab" data-id="growth"><div class="n">${j.outcome?.latest != null ? j.outcome.latest.toFixed(2) : '—'}</div><div class="l">Latest eval /5</div></button></div>`;

  // Reflection
  const Q = ['Prepared early is calm on time.', 'Teach the student in the back row.', 'Clarity is a kindness.', 'Excellence is a habit you rehearse, not a mood you wait for.', 'Check the solution as if a student will find the error.', 'Start on time; finish with a summary.', 'Every question asked is a gift. Make it safe to ask.'];
  h += `<p class="muted small" style="text-align:center;margin:22px 10px 4px;font-style:italic">“${Q[Math.floor(t / 864e5) % Q.length]}”</p>`;
  return h;
}
function taskRow(t) {
  return `<button class="tick" data-a="task" data-id="${esc(t.id)}"><span class="box">${ico('check', 16)}</span><span class="lbl">${esc(t.title)}<span class="hint">${esc(t.sub)} · ${t.overdue ? 'overdue' : (t.official ? 'due ' : 'by ') + E.fmtDayRel(t.target, now()) + ' ' + E.fmtTime(t.target)}</span></span>${t.official ? '<span class="pill amb">Official</span>' : ''}</button>`;
}

function week() {
  const t = now(), c = cfg();
  let h = header('Week', 'Classes & teaching weeks') + staleBanner();
  const ch = (state.changes || []).filter(x => !x.seen).slice(-6).reverse();
  if (ch.length) h += `<div class="card" style="margin-bottom:12px;border-color:var(--amber)"><div class="head"><h3>${ico('alert', 18)} Schedule changes</h3><button class="link" data-a="seen">Got it</button></div>
    ${ch.map(x => `<div class="item small"><div class="grow"><b>${esc({ added: 'New', changed: 'Changed', cancelled: 'Cancelled', missing: 'No longer listed (unconfirmed)' }[x.type])}</b> · ${esc((x.after || x.before).subject)} · ${E.fmtDay((x.after || x.before).start)}${x.fields ? ' · ' + esc(x.fields.join(', ')) : ''}</div></div>`).join('')}</div>`;
  const cf = E.conflicts(state, c).filter(x => x.a.start > t - 864e5);
  if (cf.length) h += `<div class="warnbox" style="margin:0 0 12px">${cf.map(x => x.kind === 'overlap' ? `Overlap: ${esc(x.a.subject)} and ${esc(x.b.subject)} on ${E.fmtDay(x.a.start)}` : `Only ${Math.round(x.gapMin)} min between ${esc(x.a.subject)} and ${esc(x.b.subject)} (different rooms)`).join('<br>')}</div>`;
  const items = E.teachingItems(state).filter(s => s.end > t - 864e5 && s.start < t + 35 * 864e5);
  if (!items.length) return h + `<div class="card empty"><b>No classes yet</b>Paste your schedule from the hub or sync the lead sheet in Sources.</div><button class="btn ghost" style="margin-top:12px" data-a="add-class">${ico('plus', 18)} Add a class manually</button>`;
  let lastWeek = '';
  for (const s of items) {
    const wk = E.dayKey(E.mondayOf(s.start));
    if (wk !== lastWeek) { h += `<div class="day-h">Week of ${E.fmtDay(E.mondayOf(s.start))}</div>`; lastWeek = wk; }
    const r = E.readiness(s, state, c), arr = state.arrivals[s.id];
    h += `<button class="card sess" style="width:100%;text-align:left;margin-bottom:10px" data-a="class" data-id="${esc(s.id)}"><div class="sess-h"><div class="grow">
      <div class="sess-t">${esc(s.subject)}</div><div class="sess-m">${s.approx ? `${esc(s.unit?.week || '')} · ${esc(s.section)} · times from hub` : `${E.fmtDayRel(s.start, t)} · ${E.fmtTime(s.start)}–${E.fmtTime(s.end)} · ${esc(s.location || s.platform || (s.format === 'online' ? 'Online' : ''))}`}</div>
      <div class="row" style="gap:6px;margin-top:8px">${s.role ? `<span class="pill ${s.role === 'lead' ? '' : 'amb'}">${s.role === 'lead' ? 'Lead' : 'Support'}</span>` : ''}${srcBadge(s.source)}${arr ? `<span class="pill ${arr.status === 'late' ? 'bad' : ''}">${esc(arr.status.replace('_', ' '))}</span>` : ''}</div></div>
      ${ring(r.pct, 58, `<span style="font-size:14px">${Math.round(r.pct * 100)}%</span>`)}</div></button>`;
  }
  return h + `<button class="btn ghost" data-a="add-class">${ico('plus', 18)} Add a class manually</button>`;
}

function classSheet(id) {
  const t = now(), c = cfg(), s = E.teachingItems(state).find(x => x.id === id) || state.sessions.find(x => x.id === id);
  if (!s) return;
  const r = E.readiness(s, state, c), arr = state.arrivals[s.id];
  const groups = Object.entries(E.CATS).map(([k, label]) => { const rows = r.rows.filter(x => x.cat === k); return rows.length ? `<div class="day-h" style="margin-top:14px">${label} · ${rows.filter(x => x.doneAt).length}/${rows.length}</div>
    ${rows.map(x => `<button class="tick ${x.doneAt ? 'on' : ''}" data-a="rd" data-id="${esc(s.id)}" data-item="${x.id}"><span class="box">${ico('check', 16)}</span><span class="lbl">${esc(x.official && s.role === 'lead' ? x.label + ' (lead deadline)' : x.label)}<span class="hint">${x.doneAt ? 'Confirmed ' + E.fmtDayRel(x.doneAt, t) + ' ' + E.fmtTime(x.doneAt) : 'Not yet confirmed · by ' + E.fmtDayRel(s.start - x.lead * 36e5, t) + ' ' + E.fmtTime(s.start - x.lead * 36e5)}</span></span></button>`).join('')}` : ''; }).join('');
  const tpls = Object.entries(c.templates).map(([k, v]) => `<option value="${k}" ${E.templateFor(s, c) === v ? 'selected' : ''}>${esc(v.label)}</option>`).join('');
  sheet(`<h2>${esc(s.subject)}</h2><div class="muted small">${s.approx ? `Week of ${E.fmtDay(s.start)} · ${esc(s.section)} · ${s.role === 'lead' ? 'Lead (neon blue in sheet)' : 'Support'}${s.unit?.cell ? ' · cell ' + esc(s.unit.cell) : ''}` : `${E.fmtDay(s.start)} · ${E.fmtTime(s.start)}–${E.fmtTime(s.end)} · ${esc(s.location || s.platform)}`}</div>
    ${s.approx ? '<div class="warnbox">Readiness targets count back from the start of this week until the exact class time is imported from the hub.</div>' : ''}
    ${s.unit && !s.unit.verified ? `<div class="warnbox">Unverified: ${esc(s.unit.reasons.join('; '))}</div>` : ''}
    <div class="row" style="margin-top:14px">${ring(r.pct, 70, `<span style="font-size:16px">${Math.round(r.pct * 100)}%</span>`)}<div class="grow small muted">Readiness = items you have confirmed ÷ items in this class’s template (${r.total}). Unconfirmed items count as not ready.</div></div>
    ${groups}
    ${!s.approx && t > s.start - 3 * 36e5 ? `<div class="day-h" style="margin-top:14px">Arrival</div>${arr ? `<div class="row"><span class="pill ${arr.status === 'late' ? 'bad' : ''}">${esc(arr.status.replace('_', ' '))}${arr.at ? ' · ' + E.fmtTime(arr.at) : ''}</span><button class="link" data-a="unarrive" data-id="${esc(s.id)}">Undo</button></div>` :
      `<div class="seg"><button data-a="arrive" data-id="${esc(s.id)}">I’m here now</button><button data-a="arrive-m" data-id="${esc(s.id)}" data-st="early">Was early</button><button data-a="arrive-m" data-id="${esc(s.id)}" data-st="on_time">On time</button><button data-a="arrive-m" data-id="${esc(s.id)}" data-st="late">Late</button></div>`}` : ''}
    <label>Template for this class</label><select data-a="tpl" data-id="${esc(s.id)}">${tpls}</select>
    <label>Notes</label><textarea data-a="note" data-id="${esc(s.id)}" placeholder="Hard parts, student questions to expect, what to try…">${esc(state.notes[s.id] || '')}</textarea>
    ${s.source?.id === 'user' ? `<button class="btn danger" style="margin-top:14px" data-a="del-class" data-id="${esc(s.id)}">Delete class</button>` : ''}`);
}

function work() {
  const t = now(), c = cfg();
  let h = header('Work', 'Handouts, lead duties, assessments');
  const cyc = E.handoutCycles(state, t, { ahead: 2 });
  const byCut = new Map(); for (const x of cyc) (byCut.get(x.cutoffKey) || byCut.set(x.cutoffKey, []).get(x.cutoffKey)).push(x);
  h += `<div class="day-h">Wednesday handouts</div>`;
  if (!c.cutoffVerified) h += `<div class="warnbox" style="margin:0 0 10px">Cutoff time is assumed to be <b>${esc(c.cutoffTime)}</b> — confirm the real time in Sources → Rules.</div>`;
  if (!c.handoutRolesVerified) h += `<div class="warnbox" style="margin:0 0 10px">Handouts are listed for your <b>${esc(c.handoutRoles.join(' + '))}</b> weeks. Confirm in Sources → Rules whether support weeks need one.</div>`;
  if (!byCut.size) h += '<div class="card empty"><b>No handouts due</b>Handouts appear automatically from next week’s classes.</div>';
  for (const [, list] of byCut) {
    const x0 = list[0];
    h += `<div class="card" style="margin-bottom:10px"><div class="head"><div><h3>Due ${E.fmtDayRel(x0.cutoff, t)} · ${E.fmtTime(x0.cutoff)}</h3><div class="muted small">For classes in the week of ${E.fmtDay(x0.weekStart)}${x0.holiday ? ' · ⚠︎ holiday — confirm cutoff' : ''}${x0.overridden ? ' · adjusted' : ''}</div></div>${x0.cutoff < t ? '<span class="pill bad">Past due</span>' : `<span class="pill amb">${E.fmtDur(x0.cutoff - t)}</span>`}</div>
      ${list.map(x => { const st = E.handoutStatus(x); return `<div style="padding:10px 0;border-top:1px solid var(--line)"><div class="row"><b class="grow">${esc(x.subject)}</b><span class="pill ${st === 'submitted' ? '' : st === 'ready' ? '' : 'amb'}">${esc({ not_started: 'Not started', in_progress: 'In progress', ready: 'Ready — not submitted', submitted: 'Submitted' }[st])}</span></div>
        <div class="chips" style="margin-top:8px">${E.HANDOUT_STAGES.map(sg => { const done = sg.id === 'submit' ? x.submittedAt : x.stages[sg.id]; return `<button class="pill ${done ? '' : 'amb'}" style="${done ? '' : 'background:var(--card-2);color:var(--muted)'}" data-a="${done && sg.id !== 'submit' ? 'untask' : 'task'}" data-id="${esc(x.id)}:${sg.id}">${done ? '✓ ' : ''}${esc(sg.label)}${!done && sg.id !== 'submit' ? ' · ' + ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][E.P(E.handoutTarget(x, sg, c)).dow] : ''}</button>`; }).join('')}</div></div>`; }).join('')}
      <div class="muted small" style="margin-top:8px">Mon/Tue labels are suggested milestones, not official deadlines.</div></div>`;
  }
  // Lead PowerPoint
  const leads = E.unitItems(state).filter(u => u.role === 'lead' && u.start + 7 * 864e5 > t);
  h += `<div class="day-h">Lead instructor · PowerPoint (${c.leadPptDaysBefore} days ahead)</div>`;
  h += leads.length ? leads.map(u => { const due = E.leadPptDue(u.unit, c), done = state.readiness[u.id]?.slides_final, draft = state.readiness[u.id]?.slides_draft; return `<div class="card" style="margin-bottom:10px"><div class="row"><div class="grow"><b>${esc(u.subject)}</b><div class="muted small">${esc(u.unit.week)} · teaching week of ${E.fmtDay(u.start)}${u.unit.coInstructors?.length ? ' · with ' + esc(u.unit.coInstructors.join(', ')) : ''}</div></div>${done ? '<span class="pill">Finalized</span>' : due < t ? '<span class="pill bad">Overdue</span>' : `<span class="pill amb">Due ${E.fmtDayRel(due, t)}</span>`}</div>
    <div class="chips"><button class="pill ${draft ? '' : 'amb'}" data-a="rdt" data-id="${esc(u.id)}" data-item="slides_draft">${draft ? '✓ ' : ''}Draft</button><button class="pill ${done ? '' : 'amb'}" data-a="rdt" data-id="${esc(u.id)}" data-item="slides_final">${done ? '✓ ' : ''}Finalized · ${E.fmtDay(due)} ${E.fmtTime(due)}</button><button class="pill" style="background:var(--card-2);color:var(--muted)" data-a="class" data-id="${esc(u.id)}">Full checklist</button></div></div>`; }).join('') : '<div class="card muted small">No lead weeks found in the sheet.</div>';
  // Lead duties (user-defined)
  h += `<div class="day-h">Other lead responsibilities</div><div class="card">${(state.duties || []).filter(d => !d.doneAt).map(d => `<button class="tick" data-a="task" data-id="du:${esc(d.id)}"><span class="box">${ico('check', 16)}</span><span class="lbl">${esc(d.title)}<span class="hint">${esc(d.subject || '')}${d.due ? ' · due ' + E.fmtDay(d.due) + ' ' + E.fmtTime(d.due) : ''}</span></span>${badge(d.verified, d.verified ? 'Confirmed' : 'Unconfirmed')}</button>`).join('') || '<div class="muted small">Ace doesn’t invent lead duties. Add only ones you’ve confirmed with your coordinator.</div>'}
    <button class="btn ghost sm" style="margin-top:10px" data-a="add-duty">${ico('plus', 16)} Add responsibility</button></div>`;
  // Assessments
  h += `<div class="day-h">Assessments & exams</div>`;
  const as = E.allAssessments(state).filter(a => !(a.auto && a.stages?.submit && a.due < t - 7 * 864e5)).sort((a, b) => a.due - b.due);
  h += as.length ? as.map(a => { const p = E.assessmentPlan(a, c); const sub = a.stages?.submit; return `<div class="card" style="margin-bottom:10px"><div class="row"><div class="grow"><b>${esc(a.title)}</b><div class="muted small">${a.auto ? 'Lead exam · from sheet' : esc(a.kind) + ' · ' + esc(a.subject || '')} · due ${E.fmtDay(a.due)} ${E.fmtTime(a.due)} ${a.dueVerified ? '' : '(unverified)'}</div></div>${sub ? '<span class="pill">Submitted</span>' : `<span class="pill amb">${p.start > t ? 'Start ' + E.fmtDayRel(p.start, t) : 'In progress'}</span>`}</div>
      <div class="chips">${p.stages.map(st => `<button class="pill ${st.doneAt ? '' : 'amb'}" style="${st.doneAt ? '' : 'background:var(--card-2);color:var(--muted)'}" data-a="${st.doneAt && st.id !== 'submit' ? 'untask' : 'task'}" data-id="as:${esc(a.id)}:${st.id}">${st.doneAt ? '✓ ' : ''}${esc(st.label)}</button>`).join('')}</div>
      <div class="row" style="margin-top:10px;gap:8px">${sub ? `<button class="btn ghost sm" data-a="revision" data-id="${esc(a.id)}">Revision requested</button>` : ''}${a.auto ? '' : `<button class="btn ghost sm" data-a="del-as" data-id="${esc(a.id)}">Delete</button>`}<span class="muted small grow" style="text-align:right">~${Math.round(p.total / 60 * 10) / 10}h · ${p.days} work days</span></div></div>`; }).join('') : '<div class="card muted small">No assessments yet.</div>';
  h += `<button class="btn ghost" style="margin-top:4px" data-a="add-as">${ico('plus', 18)} Add assessment or exam</button>`;
  return h;
}

function growth() {
  const t = now(), j = E.journey(state, t), ev = E.analyzeEvals(state.evals);
  let h = header('Growth', 'Instructor Excellence Journey');
  h += `<div class="card hero"><div class="eyebrow">Goal</div><div class="big">5.00 <span style="font-size:18px;opacity:.8">/ 5</span></div>
    <div class="t">${ev?.latest ? `Latest evaluation: <b>${ev.latest.v.toFixed(2)}</b>${ev.prev ? ` (${ev.latest.v >= ev.prev.v ? '+' : ''}${(ev.latest.v - ev.prev.v).toFixed(2)} vs previous)` : ''}` : 'Import an evaluation to see your outcome score.'}</div>
    <div class="chips"><span class="chip">Leading = habits you control</span><span class="chip">Outcome = actual evaluation scores</span></div></div>`;
  h += `<div class="card" style="margin-top:12px"><div class="head"><h3>Journey · last ${j.days} days</h3></div>${j.dims.map(d => `<div class="bar-row"><div class="top2"><span>${esc(d.label)}</span><span>${d.lead != null ? pct(d.lead) : '<span class="muted">no data yet</span>'}${d.outcome != null ? ` · <span style="color:var(--gold)">${d.outcome.toFixed(2)}</span>` : ''}</span></div>
    <div class="bar"><i class="${d.lead == null ? '' : d.lead < .6 ? 'vlow' : d.lead < .9 ? 'low' : ''}" style="width:${(d.lead ?? 0) * 100}%"></i></div><div class="muted small" style="margin-top:4px">${esc(d.note)}</div></div>`).join('')}
    <div class="muted small" style="margin-top:12px">Bars = leading indicators from your logged activity. Gold = matching evaluation criterion (confirmed score).</div></div>`;
  // evaluations
  h += `<div class="day-h">Evaluations · confirmed results</div>`;
  if (!ev) h += `<div class="card empty"><b>No evaluations yet</b>Open the hub, copy your evaluation page and paste it here.</div>`;
  else {
    h += `<div class="card">${ev.criteria.map(c => `<div class="bar-row"><div class="top2"><span>${esc(c.name)}</span><span>${c.latest.toFixed(2)}${c.delta != null ? `<span class="delta ${c.delta >= 0 ? 'up' : 'down'}">${c.delta >= 0 ? '▲' : '▼'}${Math.abs(c.delta).toFixed(2)}</span>` : ''}</span></div><div class="bar"><i class="${c.latest < 4.3 ? 'vlow' : c.latest < 4.8 ? 'low' : ''}" style="width:${c.latest / 5 * 100}%"></i></div></div>`).join('')}
      <div class="muted small" style="margin-top:10px">${ev.count} evaluation${ev.count > 1 ? 's' : ''} · ${ev.strengths.length ? 'Strengths: ' + esc(ev.strengths.join(', ')) : 'Gold line = 5.0 target'}</div></div>`;
    // interpretation
    if (ev.themes.length) h += `<div class="day-h">What comments may be saying · interpretation</div><div class="card"><div class="muted small" style="margin-bottom:6px">Keyword-based reading of comments. Not a confirmed finding — read the quotes.</div>${ev.themes.slice(0, 4).map(th => `<div style="padding:10px 0;border-top:1px solid var(--line)"><div class="row"><b class="grow">${esc(th.label)}</b>${th.neg ? `<span class="pill bad">${th.neg} concern${th.neg > 1 ? 's' : ''}</span>` : ''}${th.pos ? `<span class="pill">${th.pos} positive</span>` : ''}</div>${th.quotes.map(q => `<div class="quote">“${esc(q)}”</div>`).join('')}</div>`).join('')}</div>`;
    // development plan
    const keys = [...new Set([...ev.weakest.map(c => E.themeForCriterion(c.name)), ...ev.themes.filter(x => x.neg).map(x => x.key)].filter(Boolean))].slice(0, 3);
    if (keys.length) h += `<div class="day-h">Development plan</div>${keys.map(k => `<div class="card focus" style="margin-bottom:10px"><div class="eyebrow">${esc(E.THEMES[k].label)}</div>${E.THEMES[k].tips.map(tip => { const adopted = state.practices.find(p => p.text === tip && !p.archived); return `<div class="row" style="margin-top:10px"><div class="grow small">${esc(tip)}</div>${adopted ? '<span class="pill">Adopted</span>' : `<button class="btn ghost sm" data-a="adopt" data-k="${k}" data-tip="${esc(tip)}">Adopt</button>`}</div>`; }).join('')}</div>`).join('')}`;
  }
  const pr = state.practices.filter(p => !p.archived);
  if (pr.length) h += `<div class="day-h">Practices I’m applying</div><div class="card">${pr.map(p => `<div class="item"><div class="grow"><div class="small" style="font-weight:700">${esc(p.text)}</div><div class="muted small">${esc(E.THEMES[p.key]?.label || '')} · applied ${p.applied.length}× · last ${p.applied.length ? E.fmtAgo(p.applied.at(-1), t) : 'never'}</div></div><button class="btn sm" data-a="apply" data-id="${esc(p.id)}">+1 today</button><button class="circle" style="width:34px;height:34px" data-a="unadopt" data-id="${esc(p.id)}">${ico('x', 14)}</button></div>`).join('')}</div>`;
  h += `<div class="row" style="margin-top:12px;gap:8px"><button class="btn" data-a="paste-eval">Paste from hub</button><button class="btn ghost" data-a="add-eval">Enter manually</button></div>`;
  if (state.evals.length) h += `<div class="day-h">History</div><div class="card">${state.evals.slice().sort((a, b) => b.date.localeCompare(a.date)).map(e => `<div class="item"><div class="grow"><b>${esc(e.period || e.date)}</b><div class="muted small">${esc(e.date)} · ${Object.keys(e.criteria || {}).length} criteria · ${(e.comments || []).length} comments · ${esc(e.source)}</div></div><b>${e.overall != null ? (+e.overall).toFixed(2) : '—'}</b><button class="circle" style="width:34px;height:34px" data-a="del-eval" data-id="${esc(e.id)}">${ico('x', 14)}</button></div>`).join('')}</div>`;
  return h;
}

function sources() {
  const t = now(), c = cfg(), sh = state.sources.sheet, sc = state.sources.schedule;
  const fr = x => { const f = E.freshness(x, c, t); return `<span class="pill ${f.state === 'live' ? '' : f.state === 'failed' ? 'bad' : 'amb'}">${esc(f.label)}</span>`; };
  const wk = E.dayKey(E.mondayOf(t)), wk2 = E.dayKey(E.addDays(E.mondayOf(t), 7));
  const hist = (state.unitHistory || []).slice(-5).reverse();
  return header('Sources', 'Where Ace gets its information') + `
  <div class="card"><h3>You</h3><div class="two"><div><label>Name</label><input data-f="identity.name" value="${esc(state.identity.name)}" placeholder="Given Dave Layos"></div><div><label>Initials in the sheet</label><input data-f="cfg.initials" value="${esc(c.initials)}" style="text-transform:uppercase"></div></div></div>

  <div class="card" style="margin-top:12px"><div class="head"><h3>Lead instructor sheet</h3>${fr(sh)}</div>
    <div class="muted small">Reads each cell containing <b>${esc(c.initials || '—')}</b>. Neon-blue background → Lead (PowerPoint due ${c.leadPptDaysBefore} days before the week). Any other colour → Support. Read-only.</div>
    <label>Google Sheet link</label><input data-f="sources.sheet.url" value="${esc(sh.url || '')}">
    <label>Google API key · stored only on this device</label><input type="password" data-a="gkey" value="${esc(gkey.get())}" placeholder="Restricted to Sheets API + this site">
    <div class="muted small" style="margin-top:6px">Colours aren’t included in CSV exports, so the Sheets API is required. The sheet must be shared as “Anyone with the link can view”.</div>
    ${sh.error ? `<div class="warnbox">${esc(sh.error)}</div>` : ''}${(sh.warnings || []).map(w => `<div class="warnbox">${esc(w)}</div>`).join('')}
    <button class="btn" style="margin-top:12px" data-a="sync-sheet">Sync now</button>
    ${sh.lastOk ? `<div class="muted small" style="margin-top:8px">${(state.units || []).length} weeks found (${state.units.filter(u => u.role === 'lead').length} lead) · tab “${esc(sh.tab || '')}”</div>` : ''}
    ${hist.length ? `<div class="day-h">Recent changes</div>${hist.map(x => `<div class="small" style="padding:4px 0">${esc(x.type)} · ${esc(x.topic)}${x.fields ? ' · ' + esc(x.fields.map(f => `${f}: ${JSON.stringify(x.from[f])} → ${JSON.stringify(x.to[f])}`).join(', ')) : ''} <span class="muted">${E.fmtAgo(x.at, t)}</span></div>`).join('')}` : ''}</div>

  <div class="card" style="margin-top:12px"><div class="head"><h3>Class schedule · hub</h3>${fr(sc)}</div>
    <div class="muted small">The hub needs your login, so Ace never stores your password. Open your week, select all, copy, and paste it here. You’ll review every class before it’s saved.</div>
    <div class="row" style="margin-top:10px;gap:8px"><a class="btn ghost sm" target="_blank" rel="noopener" href="${HUB.schedule}?week=${wk}">This week</a><a class="btn ghost sm" target="_blank" rel="noopener" href="${HUB.schedule}?week=${wk2}">Next week</a></div>
    <button class="btn" style="margin-top:10px" data-a="paste-sched">Paste schedule</button>
    <button class="link" style="margin-top:10px" data-a="file-sched">Or import a CSV / .ics file</button><input type="file" id="schedFile" accept=".csv,.ics,.txt,text/csv,text/calendar" hidden></div>

  <div class="card" style="margin-top:12px"><h3>Evaluations · hub</h3><div class="muted small" style="margin-top:4px">Copy your evaluation results page and paste it in Growth. Student names aren’t kept; emails and ID numbers are masked.</div>
    <div class="row" style="margin-top:10px;gap:8px"><a class="btn ghost sm" target="_blank" rel="noopener" href="${HUB.evals}">Open evaluations</a><button class="btn sm" data-a="paste-eval">Paste results</button></div></div>

  <div class="card" style="margin-top:12px"><h3>Rules</h3>
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
    ${Object.entries(c.cutoffOverrides).map(([k, v]) => `<div class="small" style="margin-top:6px">${esc(k)} → ${esc(v)} <button class="link" data-a="ov-del" data-id="${esc(k)}">remove</button></div>`).join('')}</div>

  <div class="card" style="margin-top:12px"><h3>Reminders</h3><div class="muted small" style="margin-top:4px">${'Notification' in window ? `Status: ${Notification.permission}. ` : ''}While Ace is open (or recently opened) on this device it reminds you of leave-by times, deadlines within 3 hours and lead PowerPoints due tomorrow. Reliable background push needs the server phase (see docs).</div>
    <button class="btn ghost" style="margin-top:10px" data-a="notif">Enable reminders</button></div>

  <div class="card" style="margin-top:12px"><h3>Your data</h3><div class="muted small" style="margin-top:4px">Everything stays on this device. Export a backup regularly. The API key is never exported.</div>
    <div class="row" style="margin-top:10px;gap:8px"><button class="btn ghost sm" data-a="export">Export backup</button><button class="btn ghost sm" data-a="import">Import backup</button><button class="btn danger sm" data-a="reset">Erase</button></div><input type="file" id="bk" accept=".json,application/json" hidden></div>
  <div class="muted small" style="text-align:center;margin-top:16px">Ace v0.1 · Asia/Manila time</div>`;
}

/* ================================================================ render */
function render() {
  const screens = { home, week, work, growth, sources };
  $('#app').innerHTML = screens[tab]();
  $('#tabs').innerHTML = [['home', 'Today'], ['week', 'Week'], ['work', 'Work'], ['growth', 'Growth'], ['sources', 'Sources']].map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-a="tab" data-id="${k}">${ico(k, 22)}${l}</button>`).join('');
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
    Object.assign(src, { lastOk: t, error: null, warnings, title, tab: tabName });
    const roleUp = m.history.filter(h => h.type === 'changed' && h.to?.role === 'lead');
    toast(roleUp.length ? `New lead week: ${roleUp[0].topic}` : `Sheet synced · ${units.length} weeks`);
  } catch (e) { src.error = e.message; toast('Sync failed — showing last saved data'); }
  save(); render();
}
let pendingImport = null;
function reviewSessions(sessions, info, extra = '') {
  pendingImport = { sessions, ...info };
  const t = now();
  sheet(`<h2>Review ${sessions.length} class${sessions.length === 1 ? '' : 'es'}</h2><div class="muted small">Nothing is saved until you confirm. Uncheck anything that isn’t yours.</div>${extra}
    ${sessions.map((s, i) => `<label class="tick on" style="margin:0;color:var(--text)"><input type="checkbox" name="k${i}" checked style="width:auto"><span class="lbl" style="text-decoration:none;color:var(--text)">${esc(s.subject)}<span class="hint">${E.fmtDay(s.start)} · ${E.fmtTime(s.start)}–${E.fmtTime(s.end)} · ${esc(s.location || s.platform || s.format)}${s.status === 'cancelled' ? ' · CANCELLED' : ''}</span></span></label>`).join('')}
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
  save(); closeSheet(); tab = 'week'; render();
  const n = r.changes.reduce((o, c) => (o[c.type] = (o[c.type] || 0) + 1, o), {});
  toast(Object.entries(n).map(([k, v]) => `${v} ${k}`).join(' · ') || 'No changes');
}

/* ================================================================ events */
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-a]'); if (!el || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && el.type !== 'button')) return;
  const a = el.dataset.a, id = el.dataset.id;
  const t = now();
  switch (a) {
    case 'tab': tab = id; location.hash = id; closeSheet(); render(); scrollTo(0, 0); break;
    case 'close': closeSheet(); break;
    case 'task': markTask(id, true); if (!id.endsWith(':submit')) toast('Done ✓'); break;
    case 'untask': markTask(id, false); break;
    case 'snooze': state.snooze[id] = t + 3 * 36e5; save(); render(); break;
    case 'class': classSheet(id); break;
    case 'rd': { const it = el.dataset.item; (state.readiness[id] ||= {}); state.readiness[id][it] ? delete state.readiness[id][it] : state.readiness[id][it] = t; save(); render(); classSheet(id); break; }
    case 'rdt': { const it = el.dataset.item; (state.readiness[id] ||= {}); state.readiness[id][it] ? delete state.readiness[id][it] : state.readiness[id][it] = t; save(); render(); break; }
    case 'arrive': logArrival(id); closeSheet(); break;
    case 'arrive-m': logArrival(id, el.dataset.st); closeSheet(); break;
    case 'unarrive': delete state.arrivals[id]; save(); render(); classSheet(id); break;
    case 'seen': state.changes.forEach(c => c.seen = true); save(); render(); break;
    case 'do-submit': { const v = formVals(); const h = (state.handouts[id] ||= { stages: {} }); h.submittedAt = E.parseLocal(v.at); h.cutoffAt = +el.dataset.cut || null; h.evidence = v.ev; h.confirmedBy = 'you'; save(); closeSheet(); render(); toast(h.cutoffAt && h.submittedAt > h.cutoffAt ? 'Submitted (after cutoff)' : 'Submitted on time ✓'); break; }
    case 'do-asubmit': { const v = formVals(); const x = assessRec(id); (x.stages ||= {}).submit = E.parseLocal(v.at); save(); closeSheet(); render(); break; }
    case 'add-class': sheet(`<h2>Add a class</h2><label>Subject / topic</label><input name="subject"><div class="two"><div><label>Date</label><input type="date" name="date" value="${E.dayKey(t)}"></div><div><label>Format</label><select name="format"><option value="in_person">In person</option><option value="online">Online</option></select></div></div>
      <div class="two"><div><label>Start</label><input type="time" name="start" value="08:00"></div><div><label>End</label><input type="time" name="end" value="10:00"></div></div><label>Room or link</label><input name="where">
      <button class="btn" style="margin-top:16px" data-a="save-class">Save</button>`); break;
    case 'save-class': { const v = formVals(); if (!v.subject) return toast('Add a subject'); const day = E.parseLocal(v.date); let s0 = E.atTime(day, v.start), s1 = E.atTime(day, v.end); if (s1 <= s0) s1 += 864e5;
      state.sessions.push({ id: S.newId('s'), subject: v.subject, section: '', start: s0, end: s1, format: v.format, location: v.format === 'online' ? '' : v.where, platform: v.format === 'online' ? v.where : '', status: 'scheduled', source: { id: 'user', at: t } }); save(); closeSheet(); render(); break; }
    case 'del-class': state.sessions = state.sessions.filter(s => s.id !== id); save(); closeSheet(); render(); break;
    case 'add-duty': sheet(`<h2>Lead responsibility</h2><div class="muted small">Add only duties you’ve confirmed.</div><label>What</label><input name="title" placeholder="e.g. Review co-instructor’s problem set"><label>Subject</label><input name="subject"><label>Due</label><input type="datetime-local" name="due"><label>Estimated minutes</label><input type="number" name="min" value="30"><label class="row" style="color:var(--text)"><input type="checkbox" name="verified" style="width:auto"> Confirmed with coordinator</label><button class="btn" style="margin-top:16px" data-a="save-duty">Save</button>`); break;
    case 'save-duty': { const v = formVals(); if (!v.title) return; state.duties.push({ id: S.newId('d'), title: v.title, subject: v.subject, due: v.due ? E.parseLocal(v.due) : null, min: +v.min || 30, verified: v.verified }); save(); closeSheet(); render(); break; }
    case 'add-as': sheet(`<h2>Assessment or exam</h2><label>Title</label><input name="title" placeholder="e.g. Hydraulics prelim exam"><div class="two"><div><label>Type</label><select name="kind"><option>Exam</option><option>Quiz</option><option>Assessment</option><option>Problem set</option></select></div><div><label>Subject</label><input name="subject"></div></div>
      <label>Due (Manila)</label><input type="datetime-local" name="due"><label class="row" style="color:var(--text)"><input type="checkbox" name="dueVerified" style="width:auto"> Due date confirmed from an official notice</label><label>Estimated total effort (hours)</label><input type="number" step="0.5" name="effortH" value="6"><button class="btn" style="margin-top:16px" data-a="save-as">Save</button>`); break;
    case 'save-as': { const v = formVals(); if (!v.title || !v.due) return toast('Title and due date needed'); state.assessments.push({ id: S.newId('a'), title: v.title, kind: v.kind, subject: v.subject, due: E.parseLocal(v.due), dueVerified: v.dueVerified, effortH: +v.effortH || 6, stages: {} }); save(); closeSheet(); render(); break; }
    case 'del-as': if (confirm('Delete this assessment?')) { state.assessments = state.assessments.filter(x => x.id !== id); save(); render(); } break;
    case 'revision': sheet(`<h2>Revision requested</h2><label>What was asked</label><input name="note"><label>Due</label><input type="datetime-local" name="due"><button class="btn" style="margin-top:16px" data-a="save-rev" data-id="${esc(id)}">Save</button>`); break;
    case 'save-rev': { const v = formVals(); const x = assessRec(id), due = E.allAssessments(state).find(a => a.id === id)?.due; x.revision = { note: v.note, due: v.due ? E.parseLocal(v.due) : due, doneAt: null }; save(); closeSheet(); render(); break; }
    case 'paste-sched': { const wk = E.dayKey(E.mondayOf(t)); sheet(`<h2>Paste hub schedule</h2><label>Week (Monday) — from the page’s ?week=</label><input type="date" name="week" value="${wk}"><label>Page text</label><textarea name="txt" rows="8" placeholder="Select all on the My Schedule page, copy, paste here"></textarea><button class="btn" style="margin-top:12px" data-a="parse-sched">Read classes</button>`); break; }
    case 'parse-sched': { const v = formVals(); const ws = E.parseLocal(v.week); if (Number.isNaN(ws)) return toast('Pick the week'); const monday = E.mondayOf(ws); const r = S.parseSchedulePaste(v.txt, monday); reviewSessions(r.sessions, { unparsed: r.unparsed, week: E.dayKey(monday), method: 'paste' }); break; }
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
      save(); closeSheet(); tab = 'growth'; render(); break; }
    case 'del-eval': if (confirm('Delete this evaluation?')) { state.evals = state.evals.filter(x => x.id !== id); save(); render(); } break;
    case 'adopt': state.practices.push({ id: S.newId('p'), key: el.dataset.k, text: el.dataset.tip, adoptedAt: t, applied: [] }); save(); render(); toast('Adopted. Tap +1 each class you apply it.'); break;
    case 'apply': { const p = state.practices.find(p => p.id === id); p.applied.push(t); save(); render(); break; }
    case 'unadopt': { const p = state.practices.find(p => p.id === id); p.archived = true; save(); render(); break; }
    case 'notif': if ('Notification' in window) { const r = await Notification.requestPermission(); toast(r === 'granted' ? 'Reminders on' : 'Not allowed — on iPhone, add Ace to the Home Screen first'); render(); } else toast('On iPhone: Share → Add to Home Screen, then open Ace from there'); break;
    case 'export': { const blob = new Blob([JSON.stringify(state, null, 1)], { type: 'application/json' }); const u = URL.createObjectURL(blob); const l = document.createElement('a'); l.href = u; l.download = `ace-backup-${E.dayKey(t)}.json`; l.click(); setTimeout(() => URL.revokeObjectURL(u), 2000); break; }
    case 'import': $('#bk').click(); break;
    case 'reset': if (confirm('Erase all Ace data on this device?')) { state = blank(); save(); render(); } break;
  }
});
document.addEventListener('change', async e => {
  const el = e.target;
  if (el.dataset.f) {
    const [root, ...path] = el.dataset.f.split('.'); let o = state[root] ||= {};
    for (const p of path.slice(0, -1)) o = o[p] ||= {};
    let v = el.type === 'checkbox' ? el.checked : el.type === 'number' ? +el.value : el.value;
    if (el.dataset.f === 'cfg.holidays') v = el.value.split(/[,\s]+/).filter(x => /^\d{4}-\d\d-\d\d$/.test(x));
    if (el.dataset.f === 'cfg.initials') v = v.toUpperCase().trim();
    o[path.at(-1)] = v; save(); render(); return;
  }
  if (el.dataset.a === 'gkey') { gkey.set(el.value.trim()); toast('Key saved on this device'); return; }
  if (el.dataset.a === 'tpl') { const s = state.sessions.find(x => x.id === el.dataset.id); if (s) s.template = el.value; else { (state.cfg.unitTemplates ||= {})[el.dataset.id] = el.value; } save(); render(); classSheet(el.dataset.id); return; }
  if (el.dataset.a === 'note') { state.notes[el.dataset.id] = el.value; save(); return; }
  if (el.id === 'schedFile' && el.files[0]) { const txt = await el.files[0].text(); const r = S.parseSchedule(txt, { identity: { name: state.identity.name, email: state.identity.email } }); reviewSessions(r.sessions, { unparsed: (r.skipped || []).map(x => `Row ${x.row}: ${x.reason}`), method: r.format }); el.value = ''; return; }
  if (el.id === 'bk' && el.files[0]) { try { const d = JSON.parse(await el.files[0].text()); if (!d || d.v !== 1) throw 0; state = { ...blank(), ...d }; save(); render(); toast('Backup restored'); } catch { toast('Not an Ace backup file'); } el.value = ''; }
});
window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if (h && h !== tab && ['home', 'week', 'work', 'growth', 'sources'].includes(h)) { tab = h; render(); } });

/* ================================================================ reminders (while open) */
async function notify(key, title, body) {
  if (state.notified[key] || !('Notification' in window) || Notification.permission !== 'granted') return;
  state.notified[key] = now(); save();
  try { const reg = await navigator.serviceWorker?.getRegistration(); reg ? reg.showNotification(title, { body, icon: 'icon-192.png', tag: key }) : new Notification(title, { body }); } catch {}
}
function tick() {
  const t = now(), c = cfg();
  for (const s of E.activeSessions(state)) { const lb = E.leaveBy(s, c); if (lb - t < 15 * 6e4 && lb - t > -5 * 6e4 && !state.arrivals[s.id]) notify(`lb:${s.id}`, `${s.format === 'online' ? 'Log in' : 'Leave'} by ${E.fmtTime(lb)}`, `${s.subject} starts at ${E.fmtTime(s.start)}`); }
  for (const d of E.deadlines(state, t, 10)) if (d.at - t < 3 * 36e5 && d.at > t) notify(`dl:${d.kind}:${d.ref}`, `Due ${E.fmtTime(d.at)}: ${d.title}`, 'Confirm in Ace once it is submitted.');
  for (const u of E.unitItems(state)) if (u.role === 'lead' && !state.readiness[u.id]?.slides_final) { const due = E.leadPptDue(u.unit, c); if (due - t < 30 * 36e5 && due > t) notify(`lp:${u.id}`, `Lead PowerPoint due ${E.fmtDayRel(due, t)}`, u.subject); }
  // prune notified keys older than 14 days
  for (const [k, v] of Object.entries(state.notified)) if (t - v > 14 * 864e5) delete state.notified[k];
}

render();
tick(); setInterval(() => { tick(); if (!document.querySelector('.scrim')) render(); }, 60e3);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { tick(); render(); } });
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
window.__ace = { get state() { return state; }, set state(v) { state = v; save(); render(); }, E, S };
