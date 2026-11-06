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
  const st = E.streak(state, now()), n = alerts().length;
  return `<div class="top"><div class="grow"><h1>${esc(title)}</h1><div class="sub">${esc(sub)}</div></div><div class="top-actions">
    ${st ? `<span class="streak" title="Consecutive teaching days: on time and ≥90% ready">${ico('flame', 18)}${st}</span>` : ''}
    <button class="icon-btn" data-a="alerts" aria-label="Alerts">${ico('bell', 20)}${n ? `<span class="dot">${n > 9 ? '9+' : n}</span>` : ''}</button>
    <button class="icon-btn" data-a="settings" aria-label="Settings">${ico('gear', 20)}</button></div></div>`;
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
  h += '<!--sec:next-->';
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
      ${r.next ? `<button class="btn" data-a="task" data-id="rd:${esc(r.next.key)}:${r.next.id}">${ico('check', 18)} Done: ${esc(r.next.label)}</button>` : `<div class="t" style="margin-top:12px">✓ Fully prepared. Use spare time to rehearse your opening.</div>`}
      <div class="row" style="margin-top:10px;gap:8px"><button class="btn ghost sm" style="background:#ffffff26;color:#fff;border:0" data-a="class" data-id="${esc(next.id)}">Open checklist</button>
      ${!next.approx && !arr && t > next.start - 3 * 36e5 && t < next.end ? `<button class="btn sm" style="background:#fff;color:#1c4a21" data-a="arrive" data-id="${esc(next.id)}">I’m here</button>` : ''}
      ${arr ? `<span class="chip">Arrived · ${esc(arr.status.replace('_', ' '))}</span>` : ''}</div></div>`;
  } else h += `<div class="card hero"><div class="eyebrow">Next class</div><div class="big" style="font-size:28px">Nothing scheduled</div><div class="t">Sync your lead sheet and paste your hub schedule to see what’s next.</div><button class="btn" data-a="tab" data-id="sources">Connect sources</button></div>`;

  // Most important next action
  h += '<!--sec:focus-->';
  if (pl.next) h += `<div class="card focus" style="margin-top:12px"><div class="eyebrow">Most important next</div><div style="font-weight:800;font-size:17px;margin-top:6px">${esc(pl.next.title)}</div>
    <div class="muted small" style="margin-top:2px">${esc(pl.next.sub)}</div><div class="row" style="margin-top:6px">${pl.next.overdue ? '<span class="pill bad">Overdue target</span>' : `<span class="pill amb">${pl.next.official ? 'Official deadline' : 'Suggested target'} · ${E.fmtDur(pl.next.target - t)}</span>`}<span class="muted small">~${pl.next.min} min</span></div>
    <div class="row" style="margin-top:12px;gap:8px"><button class="btn sm" data-a="task" data-id="${esc(pl.next.id)}">${ico('check', 16)} Done</button><button class="btn ghost sm" data-a="snooze" data-id="${esc(pl.next.id)}">Later today</button></div></div>`;

  // Today's priorities
  h += '<!--sec:priorities-->';
  const list = pl.today.filter(x => x.id !== pl.next?.id).slice(0, 5);
  h += `<div class="card" style="margin-top:12px"><div class="head"><h3>Today’s priorities</h3><span class="muted small">${pl.minutes} / ${pl.capacity} min</span></div>
    ${list.length ? list.map(taskRow).join('') : `<div class="muted small">${pl.next ? 'Just the one above. Nothing else is pressing.' : 'Nothing pressing. A good day to get ahead on next week.'}</div>`}
    ${pl.later.length ? `<button class="link" style="margin-top:10px" data-a="tab" data-id="work">${pl.later.length} more coming up →</button>` : ''}</div>`;

  // Deadlines
  h += '<!--sec:deadlines-->';
  h += `<div class="card" style="margin-top:12px"><div class="head"><h3>Upcoming deadlines</h3><button class="link" data-a="tab" data-id="work">All</button></div>
    ${dl.length ? dl.map(d => `<div class="item"><div class="grow"><div style="font-weight:700">${esc(d.title)}</div><div class="muted small">${E.fmtDayRel(d.at, t)} · ${E.fmtTime(d.at)} · ${d.at < t ? `<span style="color:var(--red)">passed ${E.fmtDur(t - d.at)} ago — confirm if submitted</span>` : 'in ' + E.fmtDur(d.at - t)}</div></div>
      ${d.kind === 'handout' ? (d.verified ? '' : '<span class="pill amb">Time unverified</span>') : d.kind === 'lead' ? '<span class="pill">Lead</span>' : badge(d.verified, d.verified ? 'Verified date' : 'Unverified')}</div>`).join('') : '<div class="muted small">No deadlines found yet.</div>'}</div>`;

  // Assignments
  h += '<!--sec:assignments-->';
  const us = (state.units || []).filter(u => u.weekStart + 7 * 864e5 > t).slice(0, 4);
  h += `<div class="card" style="margin-top:12px"><div class="head"><h3>My assignments</h3>${state.sources.sheet.lastOk ? `<span class="muted small">Sheet · ${E.fmtAgo(state.sources.sheet.lastOk, t)}</span>` : ''}</div>
    ${us.length ? us.map(u => `<div class="item"><div class="grow"><div style="font-weight:700">${esc(u.topic)}</div><div class="muted small">${esc(u.week)} · week of ${E.fmtDay(u.weekStart)}${u.coInstructors?.length ? ' · with ' + esc(u.coInstructors.join(', ')) : ''}</div></div>
      <span class="pill ${u.role === 'lead' ? '' : 'amb'}" style="${u.role === 'lead' ? 'background:#00ffff22;color:#5ff' : ''}">${u.role === 'lead' ? 'Lead' : 'Support'}</span>${u.verified ? '' : ' <span class="pill amb">?</span>'}</div>`).join('') : '<div class="muted small">Sync the lead sheet in Sources.</div>'}</div>`;

  // Improvement focus (from real evaluation data only)
  h += '<!--sec:insight-->';
  const evA = E.analyzeEvals(state.evals), fa = E.focusAreas(evA)[0];
  if (fa) {
    const th = E.THEMES[fa.key], tip = th.tips.find(x => !state.practices.some(p => p.text === x && !p.archived)), crit = evA.criteria.find(c => E.themeForCriterion(c.name) === fa.key);
    h += `<div class="card focus" style="margin-top:12px"><div class="eyebrow">Improvement focus · from your evaluation</div><div style="font-weight:800;font-size:17px;margin-top:6px">${esc(th.label)}</div>
      <div class="muted small" style="margin-top:3px">${crit ? `${esc(crit.name)} · <b>${ui().hideScores ? '••••' : crit.latest.toFixed(2)}</b>` : ''}${crit && fa.concerns ? ' · ' : ''}${fa.concerns ? `${fa.concerns} comment${fa.concerns > 1 ? 's' : ''} mention it` : ''}</div>
      ${tip ? `<div class="quote" style="margin-top:10px">${esc(tip)}</div>` : ''}
      <div class="row" style="margin-top:12px;gap:8px">${tip ? `<button class="btn sm" data-a="adopt" data-k="${fa.key}" data-tip="${esc(tip)}">Adopt this practice</button>` : ''}<button class="btn ghost sm" data-a="tab" data-id="growth">See plan</button></div></div>`;
  }
  // Excellence progress
  h += '<!--sec:progress-->';
  const j = E.journey(state, t);
  h += `<div class="tiles" style="margin-top:12px"><button class="tile" data-a="tab" data-id="growth"><div class="n">${pct(j.lead.punctual)}</div><div class="l">On time (30d)</div></button>
    <button class="tile" data-a="tab" data-id="growth"><div class="n">${pct(j.lead.readyAtStart)}</div><div class="l">Ready at start</div></button>
    <button class="tile" data-a="tab" data-id="growth"><div class="n">${ui().hideScores ? '••••' : j.outcome?.latest != null ? j.outcome.latest.toFixed(2) : '—'}</div><div class="l">Latest eval /5</div></button></div>`;

  // Reflection
  h += '<!--sec:reflection-->';
  const Q = ['Prepared early is calm on time.', 'Teach the student in the back row.', 'Clarity is a kindness.', 'Excellence is a habit you rehearse, not a mood you wait for.', 'Check the solution as if a student will find the error.', 'Start on time; finish with a summary.', 'Every question asked is a gift. Make it safe to ask.'];
  h += `<p class="muted small" style="text-align:center;margin:22px 10px 4px;font-style:italic">“${Q[Math.floor(t / 864e5) % Q.length]}”</p>`;
  return arrangeHome(h);
}
/** Reorder / hide Home cards per Settings → Home screen. */
function arrangeHome(h) {
  const parts = h.split(/<!--sec:(\w+)-->/), head = parts[0], sec = {};
  for (let i = 1; i < parts.length; i += 2) sec[parts[i]] = parts[i + 1];
  const u = ui();
  return head + u.home.order.filter(k => !u.home.hidden[k] && sec[k]).map(k => `<div class="hsec">${sec[k]}</div>`).join('');
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
      <div class="sess-t">${esc(s.subject)}</div><div class="sess-m">${s.approx ? `${esc(s.unit?.week || '')} · ${esc(s.section)} · times from hub` : `${E.fmtDayRel(s.start, t)} · ${E.fmtTime(s.start)}–${E.fmtTime(s.end)} · ${esc(s.section || s.location || s.platform || (s.format === 'online' ? 'Online' : ''))}${s.group ? ' · Group ' + esc(s.group) : ''}`}</div>
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
    ${rows.map(x => `<button class="tick ${x.doneAt ? 'on' : ''}" data-a="rd" data-id="${esc(s.id)}" data-item="${x.id}"><span class="box">${ico('check', 16)}</span><span class="lbl">${esc(x.official && s.role === 'lead' ? x.label + ' (lead deadline)' : x.label)}<span class="hint">${s.unit && !E.SESSION_ITEMS.has(x.id) && !s.approx ? 'Shared by all classes this week · ' : ''}${x.doneAt ? 'Confirmed ' + E.fmtDayRel(x.doneAt, t) + ' ' + E.fmtTime(x.doneAt) : 'Not yet confirmed · by ' + E.fmtDayRel(s.start - x.lead * 36e5, t) + ' ' + E.fmtTime(s.start - x.lead * 36e5)}</span></span></button>`).join('')}` : ''; }).join('');
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
    if (ev.themes.length) h += `<div class="day-h">What comments may be saying · interpretation</div><div class="card"><div class="muted small" style="margin-bottom:6px">Keyword-based reading of comments. Not a confirmed finding — read the quotes.</div>${ev.themes.slice(0, 6).map(th => `<div style="padding:10px 0;border-top:1px solid var(--line)"><div class="row"><b class="grow">${esc(th.label)}</b>${th.neg ? `<span class="pill bad">${th.neg} concern${th.neg > 1 ? 's' : ''}</span>` : ''}${th.pos ? `<span class="pill">${th.pos} positive</span>` : ''}</div>${th.quotes.slice(0, 2).map(q => `<div class="quote">“${esc(q)}”</div>`).join('')}${!th.quotes.length && th.praise[0] ? `<div class="quote" style="border-left:3px solid var(--green)">“${esc(th.praise[0])}”</div>` : ''}</div>`).join('')}</div>
    ${(() => { const st = ev.themes.filter(x => x.pos > x.neg).map(x => x.label); return st.length ? `<div class="card" style="margin-top:10px;border-color:var(--green)"><div class="eyebrow" style="color:var(--green-2)">Strengths students mention</div><div class="small" style="margin-top:6px">${esc(st.join(' · '))}</div></div>` : ''; })()}`;
    // development plan
    const keys = E.focusAreas(ev).slice(0, 4).map(f => f.key);
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

  ${Object.keys(state.imports || {}).length || (state.review || []).some(r => !r.resolvedAt) ? `<div class="card" style="margin-top:12px"><div class="head"><h3>Imported evidence</h3></div>
    ${Object.entries(state.imports || {}).filter(([, v]) => v.report).map(([k, v]) => `<div class="item small"><div class="grow"><b>${esc(v.label || k)}</b><div class="muted">${esc(importSummary(v.report))} · ${E.fmtAgo(v.at, t)}</div></div></div>`).join('')}
    ${(state.review || []).filter(r => !r.resolvedAt).map(r => `<div class="item small"><div class="grow"><b>Review:</b> ${esc(r.title)}<div class="muted">${esc(r.detail || '')}</div></div><button class="btn ghost sm" data-a="review-ok" data-id="${esc(r.id)}">OK</button></div>`).join('')}
    <div class="muted small" style="margin-top:8px">Screenshot data is evidence, not a live source: sync the sheet and paste the hub schedule to verify and update it.</div></div>` : ''}
  <button class="card srclink" data-a="settings" style="margin-top:12px;width:100%;text-align:left"><div class="row"><div class="grow"><b>Teaching rules, reminders, app lock & backup</b><div class="muted small">Now in Settings</div></div>${ico('chev', 18)}</div></button>`;
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
const HOME_CARDS = [['next', 'Next class readiness'], ['focus', 'Most important next'], ['priorities', 'Today’s priorities'], ['deadlines', 'Upcoming deadlines'], ['assignments', 'My assignments'], ['insight', 'Improvement focus'], ['progress', 'Excellence progress'], ['reflection', 'Daily reflection']];
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
      sub: `${E.fmtDay(s.start)} · ${E.fmtTime(s.start)}${x.fields ? ' · ' + x.fields.join(', ') : ''}${x.type === 'missing' ? ' · unconfirmed' : ''}`, act: 'tab', actId: 'week', label: 'View' });
  }
  const first = state.sources.sheet.firstOk || 0;
  for (const h of (state.unitHistory || []).filter(h => ['added', 'changed', 'removed'].includes(h.type) && t - h.at < 14 * 864e5 && h.at > first)) {
    const lead = h.role === 'lead' || h.to?.role === 'lead';
    add(`uh:${h.key}:${h.at}`, { tone: lead ? 'lead' : 'amb', icon: 'sources',
      title: h.type === 'added' ? `${h.role === 'lead' ? 'New lead week' : 'New support week'} · ${h.topic}` : h.type === 'removed' ? `Removed from the sheet · ${h.topic}` : `${h.topic} · ${Object.entries(h.to || {}).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' · ')}`,
      sub: `Week of ${E.fmtDay(h.weekStart)}`, act: 'tab', actId: 'work', label: 'Open' });
  }
  for (const d of E.deadlines(state, t, 12)) if (d.at - t < 48 * 36e5) add(`dl:${d.kind}:${d.ref}:${d.at}`, { tone: d.at < t ? 'bad' : 'amb', icon: 'clock', title: d.title,
    sub: d.at < t ? `Passed ${E.fmtDur(t - d.at)} ago — confirm once submitted` : `Due ${E.fmtDayRel(d.at, t)} ${E.fmtTime(d.at)} · in ${E.fmtDur(d.at - t)}`, act: 'tab', actId: 'work', label: 'Open' });
  const next = E.teachingItems(state).find(s => !s.approx && s.end > t);
  if (next && next.start - t < 24 * 36e5) {
    const r = E.readiness(next, state, c);
    if (r.pct < 1) add(`rd:${next.id}:${E.dayKey(t)}`, { tone: next.start - t < 6 * 36e5 ? 'bad' : 'amb', icon: 'check', title: `${r.unconfirmed} prep item${r.unconfirmed > 1 ? 's' : ''} open · ${next.subject}`, sub: `Class ${E.fmtDayRel(next.start, t)} ${E.fmtTime(next.start)}`, act: 'class', actId: next.id, label: 'Checklist' });
    const lb = E.leaveBy(next, c);
    if (!state.arrivals[next.id] && lb - t < 3 * 36e5 && next.start > t) add(`lb:${next.id}`, { tone: lb < t ? 'bad' : '', icon: 'clock', title: `${next.format === 'online' ? 'Be online by' : 'Leave by'} ${E.fmtTime(lb)}`, sub: `${next.subject} at ${E.fmtTime(next.start)}`, act: 'class', actId: next.id, label: 'Open' });
  }
  for (const [k, label] of [['sheet', 'Lead sheet'], ['schedule', 'Class schedule']]) {
    const f = E.freshness(state.sources[k], c, t);
    if (f.state === 'failed' || f.state === 'stale') add(`sy:${k}:${E.dayKey(t)}`, { tone: f.state === 'failed' ? 'bad' : 'amb', icon: 'sources', title: `${label}: ${f.state === 'failed' ? 'sync failed' : 'may be outdated'}`, sub: f.label, act: 'tab', actId: 'sources', label: 'Update' });
  }
  const unv = (state.units || []).filter(x => !x.verified && x.weekStart + 7 * 864e5 > t).length;
  if (unv) add(`uv:${unv}:${state.sources.sheet.lastOk || 0}`, { tone: 'amb', icon: 'sources', title: `${unv} sheet week${unv > 1 ? 's' : ''} unverified`, sub: 'Sync the lead sheet to confirm lead/support', act: 'tab', actId: 'sources', label: 'Sync' });
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
const VERSION = '0.3.0';
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
      ${grp('Appearance', [rowBox('Theme', `<div class="seg">${[['system', 'System'], ['light', 'Light'], ['dark', 'Dark'], ['amoled', 'AMOLED']].map(([k, l]) => `<button class="${u.theme === k ? 'on' : ''}" data-a="theme" data-id="${k}">${l}</button>`).join('')}</div>`),
        rowBox('App color', `<div class="swatches">${ACCENTS.map(([n, hx]) => `<button class="sw ${u.accent === hx ? 'on' : ''}" style="--c:${hx || '#5a9e5f'}" data-a="accent" data-id="${hx}" aria-label="${n}"></button>`).join('')}<label class="sw custom ${u.accent && !ACCENTS.some(x => x[1] === u.accent) ? 'on' : ''}" style="--c:${u.accent || '#5a9e5f'}" aria-label="Custom color"><input type="color" data-a="accent-custom" value="${u.accent || '#5a9e5f'}"></label></div>`)])}
      ${grp('Home screen', [rowLink('Cards on Home', `${HOME_CARDS.length - Object.values(u.home.hidden).filter(Boolean).length} shown · reorder or hide`, 'panel', 'home')])}
      ${grp('Preferences', [rowToggle('Hide scores on Home', 'Shows •••• instead of your evaluation score', 'ui.hideScores', u.hideScores), rowToggle('24-hour time', '13:00 instead of 1:00 PM', 'ui.clock24', u.clock24)])}
      ${grp('Teaching', [rowLink('Teaching rules', `Cutoffs ${E.fmtTime(E.atTime(Date.now(), c.cutoffTime))} · lead PPT ${c.leadPptDaysBefore} days ahead · buffers`, 'panel', 'rules'), rowLink('Data sources', 'Lead sheet, hub schedule, evaluations', 'go-sources')])}
      ${grp('Security', [rowToggle('App lock', L?.hash ? 'PIN required when opening Ace' : 'Protect your evaluations with a PIN', 'lock', !!L?.hash),
        ...(L?.hash ? [rowLink('Change PIN', '', 'pin-change'), `<label class="srow"><div class="grow"><div class="s-l">Face ID unlock</div><div class="s-s">${faceOk ? 'Unlock with your face' : 'Not available on this device or browser'}</div></div><input type="checkbox" class="switch" data-a="faceid" ${L.cred ? 'checked' : ''} ${faceOk ? '' : 'disabled'}></label>`] : [])])}
      ${grp('Notifications', [rowLink('Reminders', perm === 'granted' ? 'On for this device' : perm === 'denied' ? 'Blocked — allow in iPhone Settings → Ace' : 'Tap to allow (open Ace from the Home Screen first)', 'notif'),
        rowToggle('Leave-by / log-in time', '15 minutes before', 'ui.notif.leave', u.notif.leave), rowToggle('Deadlines', 'Handouts, exams, lead duties — 3 hours before', 'ui.notif.deadlines', u.notif.deadlines),
        rowToggle('Lead PowerPoint', 'The day before it’s due', 'ui.notif.leadppt', u.notif.leadppt), rowToggle('Schedule & role changes', 'After a sync finds changes', 'ui.notif.changes', u.notif.changes),
        rowToggle('Morning plan', 'Your most important task and today’s priorities', 'ui.notif.morning', u.notif.morning), ...(u.notif.morning ? [rowBox('Morning plan time', `<input type="time" data-f="ui.notif.morningTime" value="${esc(u.notif.morningTime)}">`)] : []),
        `<div class="srow col"><div class="s-s">Reminders arrive while Ace is open or recently opened. Background push needs the server phase.</div></div>`])}
      ${grp('Calendar', [rowLink('Add classes & deadlines to your calendar', 'Download an .ics file for Google or Apple Calendar', 'ics'), `<div class="srow col"><div class="s-s">Google Calendar: Settings → Import & export → Import the file. Re-import after schedule changes (events update, not duplicate). A live Google Calendar sync needs Google sign-in and isn’t set up yet.</div></div>`])}
      ${grp('Imports', [rowLink('Import data file (merge)', 'Adds new records only · never duplicates or overwrites', 'merge'), ...Object.entries(state.imports || {}).map(([k, v]) => `<div class="srow col"><div class="s-l">${esc(v.label || k)}</div><div class="s-s">${esc(importSummary(v.report))} · ${E.fmtAgo(v.at, Date.now())}</div></div>`)])}
      ${grp('Backup & data', [rowLink('Export backup', 'Save a copy of everything (not your API key or PIN)', 'export'), rowLink('Restore backup (replace all)', 'From an Ace JSON backup', 'import'), `<button class="srow danger" data-a="reset"><div class="grow"><div class="s-l">Erase all data on this device</div></div></button>`])}
      ${grp('Help', [rowLink('How to use Ace', 'Sources, readiness, handouts, growth', 'panel', 'help')])}
      ${grp('About', [`<div class="srow col about"><div class="row"><img src="icon-192.png" width="44" height="44" style="border-radius:11px" alt=""><div><div class="s-l">Ace</div><div class="s-s">Your instructor excellence companion. Version ${VERSION}</div></div></div></div>`, rowLink('What’s new', '', 'panel', 'whatsnew'), rowLink('Check for updates', '', 'update')])}
      <input type="file" id="bk" accept=".json,application/json" hidden><input type="file" id="mg" accept=".json,application/json" hidden>
      <div class="empty small" id="noresult" hidden>No settings match “<span></span>”</div>`];
  },
  home() {
    const u = ui();
    return ['Home screen', `<div class="muted small" style="margin:0 4px 10px">Choose which cards appear on Today and in what order.</div><div class="glist">${u.home.order.map((k, i) => `<div class="srow"><div class="grow"><div class="s-l">${esc(HOME_CARDS.find(x => x[0] === k)[1])}</div></div>
      <button class="circle sm" data-a="hmove" data-id="${k}" data-d="-1" ${i ? '' : 'disabled'} aria-label="Move up">${ico('up', 16)}</button><button class="circle sm" data-a="hmove" data-id="${k}" data-d="1" ${i < u.home.order.length - 1 ? '' : 'disabled'} aria-label="Move down">${ico('down', 16)}</button>
      <input type="checkbox" class="switch" data-a="hshow" data-id="${k}" ${u.home.hidden[k] ? '' : 'checked'}></div>`).join('')}</div>`];
  },
  rules() { return ['Teaching rules', rulesHTML()]; },
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
    return ['What’s new', v('0.3', 'Nov 6, 2026', ['Settings with search, like Power', 'Alerts bell: changes, deadlines, sync problems', 'App lock with PIN and Face ID', 'Themes: System, Light, Dark, AMOLED · app colors', 'Reorder or hide Home cards · hide scores · 24-hour time', 'Choose which reminders you get, plus a morning plan'])
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
const TABS = [['home', 'Today'], ['week', 'Week'], ['work', 'Work'], ['growth', 'Growth'], ['sources', 'Sources']];
const scrollMem = {};
/** Tab bar is built once; switching only moves the lens and recolours labels (no rebuild, no flicker). */
function renderTabs() {
  const el = $('#tabs');
  if (!el.dataset.ready) {
    el.innerHTML = '<span class="tab-lens" aria-hidden="true"></span>' + TABS.map(([k, l]) => `<button data-a="tab" data-id="${k}" aria-label="${l}">${ico(k, 22)}<span>${l}</span></button>`).join('');
    el.dataset.ready = '1';
  }
  el.style.setProperty('--i', TABS.findIndex(x => x[0] === tab));
  el.querySelectorAll('button').forEach(b => { const on = b.dataset.id === tab; b.classList.toggle('on', on); on ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'); });
}
/** Switch tab like Power: slide the new screen in from the side you tapped, keep each tab's scroll position. */
function go(next) {
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
  const screens = { home, week, work, growth, sources };
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
  save(); closeSheet(); go('week');
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
    case 'task': markTask(id, true); if (!id.endsWith(':submit')) toast('Done ✓'); break;
    case 'untask': markTask(id, false); break;
    case 'snooze': state.snooze[id] = t + 3 * 36e5; save(); render(); break;
    case 'class': classSheet(id); break;
    case 'rd': { const it = el.dataset.item, s = E.teachingItems(state).find(x => x.id === id); const k = s ? E.readinessKey(s, it) : id; (state.readiness[k] ||= {}); state.readiness[k][it] ? delete state.readiness[k][it] : state.readiness[k][it] = t; save(); render(); classSheet(id); break; }
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
    case 'paste-sched': { const wk = E.dayKey(E.mondayOf(t)); sheet(`<h2>Paste hub schedule</h2><label>Week (Monday) — from the page’s ?week=</label><input type="date" name="week" value="${wk}"><label>Page text</label><textarea name="txt" rows="8" placeholder="On the hub schedule page: Select All → Copy, then paste here. Only your ${esc(cfg().initials)} classes are kept."></textarea><button class="btn" style="margin-top:12px" data-a="parse-sched">Read classes</button>`); break; }
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
      save(); closeSheet(); go('growth'); break; }
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
      if (a.review) sheet(`<h2>Needs review</h2><div style="font-weight:700;margin-top:6px">${esc(a.review.title)}</div><div class="muted small" style="margin-top:6px">${esc(a.review.detail || '')}</div>${a.review.source ? `<div class="pill amb" style="margin-top:10px">Source: ${esc(a.review.source)}</div>` : ''}<div class="row" style="margin-top:16px"><button class="btn ghost" data-a="close">Later</button><button class="btn" data-a="review-ok" data-id="${esc(a.review.id)}">Mark reviewed</button></div>`);
      else if (a.act === 'tab') go(a.actId); else if (a.act === 'class') classSheet(a.actId); break; }
    case 'alert-x': dismissAlert(id); render(); alertsSheet(); break;
    case 'review-ok': { const r = (state.review || []).find(x => x.id === id); if (r) r.resolvedAt = t; save(); closeSheet(); render(); toast('Marked reviewed'); break; }
    case 'settings': setQ = ''; panels.length = 0; openPanel('settings'); break;
    case 'panel': openPanel(id); break;
    case 'pback': backPanel(); break;
    case 'go-sources': closePanel(); go('sources'); break;
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
window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if (h && h !== tab && TABS.some(x => x[0] === h)) go(h); });

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
