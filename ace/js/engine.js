// Ace engine — pure functions, no DOM. All calendar math is done in Asia/Manila
// (UTC+8, no daylight saving), regardless of the device's time zone.
export const TZ = 'Asia/Manila';
const OFF = 8 * 36e5, H = 36e5, MIN = 6e4, DAY = 864e5;
export const pad = n => String(n).padStart(2, '0');

/** Manila wall-clock parts of a timestamp. */
export function P(ms) {
  const d = new Date(ms + OFF);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes(), dow: d.getUTCDay() };
}
/** Timestamp for a Manila wall-clock time. */
export const mk = (y, m, d, h = 0, mi = 0) => Date.UTC(y, m - 1, d, h, mi) - OFF;
export const dayKey = ms => { const p = P(ms); return `${p.y}-${pad(p.m)}-${pad(p.d)}`; };
export const startOfDay = ms => { const p = P(ms); return mk(p.y, p.m, p.d); };
export const addDays = (ms, n) => ms + n * DAY;
export const mondayOf = ms => addDays(startOfDay(ms), -((P(ms).dow + 6) % 7));
export const hm = s => { const [h, m] = String(s || '0:0').split(':').map(Number); return { h: h || 0, m: m || 0 }; };
export const atTime = (dayMs, hhmm) => { const p = P(dayMs), t = hm(hhmm); return mk(p.y, p.m, p.d, t.h, t.m); };
/** Parse 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:MM' as Manila time; full ISO with offset is respected. */
export function parseLocal(s) {
  if (!s) return NaN;
  if (/[zZ]|[+-]\d\d:?\d\d$/.test(s)) return Date.parse(s);
  const m = String(s).match(/^(\d{4})-(\d\d)-(\d\d)(?:[T ](\d\d):(\d\d))?/);
  return m ? mk(+m[1], +m[2], +m[3], +(m[4] || 0), +(m[5] || 0)) : NaN;
}
export const toLocalInput = ms => { const p = P(ms); return `${p.y}-${pad(p.m)}-${pad(p.d)}T${pad(p.h)}:${pad(p.mi)}`; };

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const fmtTime = ms => { const p = P(ms); return `${(p.h % 12) || 12}:${pad(p.mi)} ${p.h < 12 ? 'AM' : 'PM'}`; };
export const fmtDay = ms => { const p = P(ms); return `${DOW[p.dow]}, ${MON[p.m - 1]} ${p.d}`; };
export function fmtDayRel(ms, now) {
  const d = Math.round((startOfDay(ms) - startOfDay(now)) / DAY);
  return d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : d === -1 ? 'Yesterday' : fmtDay(ms);
}
export function fmtDur(ms) {
  const m = Math.round(Math.abs(ms) / MIN);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h${m % 60 ? ' ' + (m % 60) + 'm' : ''}`;
  return `${Math.round(h / 24)}d`;
}
export const fmtAgo = (ms, now) => ms ? (now - ms < MIN ? 'just now' : fmtDur(now - ms) + ' ago') : 'never';

/* ------------------------------------------------------------------ config */
export const DEFAULT_CFG = {
  // Wednesday handout rule. The cutoff time is NOT known yet → unverified until you confirm it.
  // Confirmed by you (Nov 6): Wednesday deadlines are 8:00 PM.
  cutoffDow: 3, cutoffTime: '20:00', cutoffVerified: true,
  // Lead only: exam for the teaching week is due that week's Wednesday, 8:00 PM.
  examDow: 3, examTime: '20:00', examEffortH: 5,
  // Which classes a Wednesday covers: the Mon–Sun week that starts N days after that Wednesday.
  handoutWeekStartOffset: 5,
  cutoffOverrides: {},            // { 'YYYY-MM-DD' (the normal Wednesday): 'skip' | 'YYYY-MM-DDTHH:MM' }
  holidays: [],                   // ['YYYY-MM-DD'] — flagged, never silently moved
  milestoneHour: 20, draftDaysBefore: 2, finishDaysBefore: 1, // suggested internal targets
  arriveEarlyMin: 30, onlineSetupMin: 30, travelMin: 20, minGapMin: 30,
  dailyMinutes: 150, horizonDays: 5, staleHours: 24,
  // Lead sheet (colour-coded grid). Your rule: lead = neon-blue cell → PowerPoint ready 1 week before the week starts.
  initials: '', leadPptDaysBefore: 7, leadPptTime: '08:00', leadDraftDaysBefore: 9, leadFormat: 'online', supportFormat: 'in_person', unitHorizonDays: 21, unitTemplates: {},
  handoutRoles: ['lead'], handoutRolesVerified: true, // confirmed: support instructors don't create handouts
  leadRoleValues: ['lead', 'lead instructor', 'li', 'yes', 'y', '✓', 'true'],
  templates: null,                // filled from DEFAULT_TEMPLATES
};

/* ----------------------------------------------------- readiness catalogue */
// lead = hours before class start this should be done; min = estimated effort.
export const READINESS_ITEMS = {
  slides_draft: { cat: 'materials', label: 'Slides drafted', lead: 72, min: 60 },
  slides_final: { cat: 'materials', label: 'Slides finalized', lead: 48, min: 30, deps: ['slides_draft'] },
  examples:     { cat: 'materials', label: 'Teaching examples prepared', lead: 40, min: 30, deps: ['slides_draft'] },
  solutions:    { cat: 'accuracy', label: 'Solutions independently checked', lead: 36, min: 45, deps: ['slides_draft'] },
  formulas:     { cat: 'accuracy', label: 'Formulas & derivations reviewed', lead: 36, min: 30, deps: ['slides_draft'] },
  references:   { cat: 'accuracy', label: 'References / materials verified', lead: 30, min: 15, deps: ['slides_draft'] },
  studied:      { cat: 'mastery', label: 'Slides studied', lead: 24, min: 45, deps: ['slides_final', 'slides_received'] },
  concepts:     { cat: 'mastery', label: 'Difficult concepts understood', lead: 22, min: 30, deps: ['studied'] },
  questions:    { cat: 'mastery', label: 'Likely student questions anticipated', lead: 20, min: 20, deps: ['studied'] },
  activities:   { cat: 'delivery', label: 'Student interaction activities ready', lead: 20, min: 20, deps: ['slides_final'] },
  rehearsed:    { cat: 'delivery', label: 'Explanations rehearsed', lead: 14, min: 40, deps: ['studied'] },
  practiced:    { cat: 'delivery', label: 'Examples practiced', lead: 14, min: 20, deps: ['examples'] },
  timing:       { cat: 'delivery', label: 'Timing reviewed', lead: 12, min: 10, deps: ['rehearsed'] },
  schedule_ok:  { cat: 'logistics', label: 'Schedule confirmed', lead: 12, min: 2 },
  venue:        { cat: 'logistics', label: 'Room / venue ready', lead: 4, min: 5 },
  platform:     { cat: 'logistics', label: 'Online platform link & access ready', lead: 4, min: 5 },
  slides_received: { cat: 'materials', label: 'Lead’s slides received', lead: 72, min: 2 },
  tech:         { cat: 'logistics', label: 'PowerPoint, OBS, mic & websites checked', lead: 1.5, min: 15 },
  buffer:       { cat: 'logistics', label: 'Arrival / setup buffer planned', lead: 12, min: 2 },
};
export const CATS = { materials: 'Teaching materials', accuracy: 'Accuracy', mastery: 'Subject mastery', delivery: 'Delivery', logistics: 'Logistics' };
const CORE = ['slides_draft', 'slides_final', 'examples', 'solutions', 'formulas', 'studied', 'concepts', 'questions', 'activities', 'rehearsed', 'practiced', 'timing', 'schedule_ok', 'buffer'];
export const DEFAULT_TEMPLATES = {
  in_person: { label: 'In-person class', items: [...CORE, 'venue'] },
  online: { label: 'Online class', items: [...CORE, 'platform', 'tech'] },
  lead: { label: 'Lead instructor week (online)', items: [...CORE, 'platform', 'tech'], official: ['slides_final'], leadDays: { slides_draft: 'leadDraftDaysBefore', slides_final: 'leadPptDaysBefore' } },
  support: { label: 'Support instructor week (in person)', items: ['slides_received', 'solutions', 'formulas', 'studied', 'concepts', 'questions', 'activities', 'rehearsed', 'timing', 'schedule_ok', 'buffer', 'venue'] },
  review: { label: 'Review / problem session', items: ['solutions', 'formulas', 'studied', 'questions', 'timing', 'schedule_ok', 'buffer'] },
};
export const cfgOf = state => ({ ...DEFAULT_CFG, ...(state.cfg || {}), templates: { ...DEFAULT_TEMPLATES, ...(state.cfg?.templates || {}) } });
export const templateFor = (s, cfg) => cfg.templates[s.template] || cfg.templates[s.format === 'online' ? 'online' : 'in_person'];

export const activeSessions = state => (state.sessions || []).filter(s => s.status !== 'cancelled' && s.status !== 'missing');
/** Sheet units as schedule-like items. Start = Monday of that week (exact class times come from the schedule source). */
export function unitItems(state) {
  const cfg = cfgOf(state);
  return (state.units || []).map(u => ({ id: `u:${u.key}`, unit: u, subject: u.topic, section: `Slot ${u.track}`, start: u.weekStart, end: u.weekStart + 7 * DAY,
    format: u.role === 'lead' ? cfg.leadFormat : cfg.supportFormat, template: cfg.unitTemplates?.[`u:${u.key}`] || (u.role === 'lead' ? 'lead' : 'support'), approx: true, role: u.role, status: 'scheduled', source: u.source }));
}
/** Everything you teach: real sessions, plus sheet weeks not already covered by a real session of the same topic. */
export function teachingItems(state) {
  const wk = s => dayKey(mondayOf(s.start)) + '|' + norm(s.subject);
  const units = unitItems(state), byWk = new Map(units.map(u => [wk(u), u]));
  // a real class in a sheet week inherits the role (lead/support) and its template, unless you chose one
  const ss = activeSessions(state).map(s => { const u = byWk.get(wk(s)); return u ? { ...s, role: u.role, unit: u.unit, template: s.template || u.template } : s; });
  const have = new Set(ss.map(wk));
  return [...ss, ...units.filter(u => !have.has(wk(u)))].sort((a, b) => a.start - b.start);
}
/** Lead deadline for a unit: PowerPoint finalized N days before the week starts. */
export function leadPptDue(u, cfg) { return atTime(addDays(u.weekStart, -cfg.leadPptDaysBefore), cfg.leadPptTime); }
export function itemLead(id, tpl, start, cfg) {
  const k = tpl.leadDays?.[id];
  if (k) return (start - atTime(addDays(start, -cfg[k]), cfg.leadPptTime)) / H;
  return READINESS_ITEMS[id].lead;
}

/** Transparent readiness: share of the template's items you have confirmed done. Unconfirmed ≠ done. */
export function readiness(session, state, cfg = cfgOf(state), at = Infinity) {
  const tpl = templateFor(session, cfg);
  const items = tpl.items.filter(id => READINESS_ITEMS[id]);
  // progress logged on the sheet week carries over once the exact class is imported
  const log = { ...(session.unit && !session.approx ? state.readiness?.[`u:${session.unit.key}`] : null), ...(state.readiness?.[session.id] || {}) };
  const rows = items.map(id => ({ id, ...READINESS_ITEMS[id], lead: itemLead(id, tpl, session.start, cfg), official: (tpl.official || []).includes(id), doneAt: log[id] && log[id] <= at ? log[id] : null }));
  const done = rows.filter(r => r.doneAt).length;
  const byCat = {};
  for (const r of rows) { (byCat[r.cat] ||= { done: 0, total: 0 }).total++; if (r.doneAt) byCat[r.cat].done++; }
  const doneSet = new Set(rows.filter(r => r.doneAt).map(r => r.id));
  const open = rows.filter(r => !r.doneAt).map(r => ({ ...r, blocked: (r.deps || []).some(d => items.includes(d) && !doneSet.has(d)) }));
  const next = open.filter(r => !r.blocked).sort((a, b) => b.lead - a.lead)[0] || null;
  return { rows, done, total: rows.length, pct: rows.length ? done / rows.length : 0, byCat, next, unconfirmed: rows.length - done };
}

/** When to be in the room / logged in. */
export function arriveBy(s, cfg) { return s.start - (s.format === 'online' ? cfg.onlineSetupMin : cfg.arriveEarlyMin) * MIN; }
export function leaveBy(s, cfg) { return s.format === 'online' ? arriveBy(s, cfg) : arriveBy(s, cfg) - (s.travelMin ?? cfg.travelMin) * MIN; }

/** Overlaps and too-tight transitions between active sessions. */
export function conflicts(state, cfg = cfgOf(state)) {
  const ss = activeSessions(state).slice().sort((a, b) => a.start - b.start), out = [];
  for (let i = 0; i < ss.length; i++) for (let j = i + 1; j < ss.length && ss[j].start < ss[i].end + cfg.minGapMin * MIN; j++) {
    const a = ss[i], b = ss[j];
    if (b.start < a.end) out.push({ kind: 'overlap', a, b });
    else if (a.format !== 'online' && b.format !== 'online' && (a.location || '') !== (b.location || '')) out.push({ kind: 'tight', a, b, gapMin: (b.start - a.end) / MIN });
  }
  return out;
}

/* ------------------------------------------------- Wednesday handout cycles */
export const HANDOUT_STAGES = [
  { id: 'draft', label: 'Initial preparation', min: 90, when: 'early' },
  { id: 'problems', label: 'Problem selection / development', min: 60, when: 'early' },
  { id: 'verify', label: 'Independent solution verification', min: 60, when: 'late' },
  { id: 'format', label: 'Formatting & layout', min: 30, when: 'late' },
  { id: 'check', label: 'Final checking', min: 20, when: 'late' },
  { id: 'ready', label: 'Submission-ready', min: 5, when: 'late' },
  { id: 'submit', label: 'Submitted (confirmed)', min: 5, when: 'cutoff' },
];

/** Official cutoff for the week whose normal cutoff day is `wedMs`. null = skipped. */
export function cutoffFor(wedMs, cfg) {
  const key = dayKey(wedMs), o = cfg.cutoffOverrides?.[key];
  if (o === 'skip') return null;
  const at = o ? parseLocal(o) : atTime(wedMs, cfg.cutoffTime);
  return { at, key, overridden: !!o, holiday: cfg.holidays.includes(dayKey(at)), verified: o ? true : !!cfg.cutoffVerified };
}

/** One handout per subject taught in the covered week, for each upcoming cutoff. */
export function handoutCycles(state, now, { back = 1, ahead = 3 } = {}) {
  const cfg = cfgOf(state), out = [];
  const baseWed = addDays(mondayOf(now), (cfg.cutoffDow + 6) % 7);
  for (let k = -back; k < ahead; k++) {
    const wed = addDays(baseWed, 7 * k), c = cutoffFor(wed, cfg);
    if (!c) continue;
    const wStart = mondayOf(addDays(wed, cfg.handoutWeekStartOffset)), wEnd = addDays(wStart, 7);
    const subjects = new Map();
    // Only roles that create handouts. Classes not found in the sheet count only when no sheet is synced.
    const hasSheet = (state.units || []).length > 0;
    const pool = teachingItems(state).filter(s => s.role ? cfg.handoutRoles.includes(s.role) : !hasSheet);
    for (const s of pool) if (s.start >= wStart && s.start < wEnd) {
      const key = s.subject.trim();
      if (s.approx && [...subjects.keys()].some(k => norm(k) === norm(key))) continue;
      const e = subjects.get(key) || { subject: key, sessions: [] };
      e.sessions.push(s); subjects.set(key, e);
    }
    for (const e of subjects.values()) {
      const id = `ho:${c.key}:${e.subject.toLowerCase()}`;
      const rec = state.handouts?.[id] || {};
      out.push({ id, subject: e.subject, cutoff: c.at, cutoffKey: c.key, cutoffVerified: c.verified, holiday: c.holiday, overridden: c.overridden,
        weekStart: wStart, weekEnd: wEnd, sessions: e.sessions, stages: rec.stages || {}, submittedAt: rec.submittedAt || null, notes: rec.notes || '' });
    }
  }
  // keep past cutoffs only while still unsubmitted
  return out.filter(h => h.cutoff > now || !h.submittedAt).sort((a, b) => a.cutoff - b.cutoff || a.subject.localeCompare(b.subject));
}
export function handoutTarget(h, stage, cfg) {
  if (stage.when === 'cutoff') return h.cutoff;
  const n = stage.when === 'early' ? cfg.draftDaysBefore : cfg.finishDaysBefore;
  return Math.min(addDays(startOfDay(h.cutoff), -n) + cfg.milestoneHour * H, h.cutoff);
}
export function handoutStatus(h) {
  if (h.submittedAt) return 'submitted';
  if (h.stages.ready) return 'ready';
  const n = HANDOUT_STAGES.filter(s => s.id !== 'submit' && h.stages[s.id]).length;
  return n ? 'in_progress' : 'not_started';
}

/* ------------------------------------------------- assessments & exams */
export const ASSESS_STAGES = [
  { id: 'plan', label: 'Scope & blueprint', w: .06 },
  { id: 'questions', label: 'Question development', w: .32 },
  { id: 'key', label: 'Answer key / solutions', w: .2 },
  { id: 'verify', label: 'Independent key verification', w: .15 },
  { id: 'review', label: 'Quality review', w: .1 },
  { id: 'format', label: 'Formatting', w: .08 },
  { id: 'submit', label: 'Submitted (confirmed)', w: .02 },
];
/** Backward-planned stage targets from the due date, effort and daily capacity. */
export function assessmentPlan(a, cfg) {
  const total = Math.max(30, (a.effortH || 6) * 60);
  const perDay = Math.max(30, cfg.dailyMinutes * 0.6);
  const days = Math.ceil(total / perDay);
  const finish = addDays(startOfDay(a.due), -1) + cfg.milestoneHour * H; // keep a buffer day
  const start = addDays(startOfDay(finish), -days) + 8 * H;
  let cum = 0;
  const stages = ASSESS_STAGES.map(st => {
    cum += st.w;
    const target = st.id === 'submit' ? a.due : Math.min(start + (finish - start) * cum / (1 - .02), finish);
    return { ...st, min: Math.round(total * st.w), target, doneAt: a.stages?.[st.id] || null };
  });
  if (a.revision && !a.revision.doneAt) stages.push({ id: 'revision', label: `Requested revision${a.revision.note ? ': ' + a.revision.note : ''}`, min: 45, target: a.revision.due || a.due, doneAt: null, w: 0 });
  return { start, finish, days, total, stages };
}

/** Lead weeks automatically carry an exam due on that week's Wednesday (8 PM). Progress lives in state.exams[id]. */
export function leadExams(state) {
  const cfg = cfgOf(state);
  return unitItems(state).filter(u => u.role === 'lead').map(u => {
    const id = `lx|${u.unit.key}`, rec = state.exams?.[id] || {};
    return { id, auto: true, title: `Exam: ${u.subject}`, kind: 'Exam', subject: u.subject, due: atTime(addDays(u.start, (cfg.examDow + 6) % 7), cfg.examTime),
      dueVerified: true, effortH: rec.effortH || cfg.examEffortH, stages: rec.stages || {}, revision: rec.revision || null, unit: u.unit };
  });
}
export const allAssessments = state => [...(state.assessments || []), ...leadExams(state)];

/* ------------------------------------------------- unified planner */
function score(t, now) {
  const hrs = (t.target - now) / H;
  let s = hrs < 0 ? 120 + Math.min(-hrs, 48) : 100 * Math.exp(-hrs / 24);
  if (t.official) s *= 1.3;
  if (t.classSoon) s *= 1.4;
  return s;
}

export function allTasks(state, now) {
  const cfg = cfgOf(state), tasks = [];
  // lecture readiness for classes inside the horizon
  for (const s of teachingItems(state)) {
    if (s.start <= now || s.start > now + (s.approx ? cfg.unitHorizonDays : cfg.horizonDays) * DAY) continue;
    const r = readiness(s, state, cfg);
    const soon = s.start - now < 24 * H;
    const when = s.approx ? `week of ${fmtDay(s.start)}` : `${fmtDayRel(s.start, now)} ${fmtTime(s.start)}`;
    for (const row of r.rows) {
      const deps = (row.deps || []).filter(d => r.rows.some(x => x.id === d)).map(d => `rd:${s.id}:${d}`);
      const target = s.start - row.lead * H;
      const title = row.official && s.role === 'lead' ? `PowerPoint finalized — lead, due ${fmtDay(target)}` : row.label;
      tasks.push({ id: `rd:${s.id}:${row.id}`, kind: 'readiness', ref: s.id, item: row.id, title, sub: `${s.subject}${s.role ? ' · ' + (s.role === 'lead' ? 'Lead' : 'Support') : ''} · ${when}`,
        min: row.min, target: Math.max(target, now - 14 * DAY), official: row.official ? target : null, classSoon: soon, done: !!row.doneAt, deps });
    }
  }
  // Wednesday handouts
  for (const h of handoutCycles(state, now)) {
    let prev = null;
    for (const st of HANDOUT_STAGES) {
      const id = `${h.id}:${st.id}`;
      tasks.push({ id, kind: 'handout', ref: h.id, item: st.id, title: st.id === 'submit' ? `Submit ${h.subject} handout` : `${st.label}`, sub: `${h.subject} handout · due ${fmtDayRel(h.cutoff, now)} ${fmtTime(h.cutoff)}`,
        min: st.min, target: handoutTarget(h, st, cfg), official: st.id === 'submit' ? h.cutoff : null, done: st.id === 'submit' ? !!h.submittedAt : !!h.stages[st.id], deps: prev ? [prev] : [] });
      prev = id;
    }
  }
  // assessments & exams
  for (const a of allAssessments(state)) {
    if (a.due < now - 14 * DAY && !a.stages?.submit) continue;
    if (a.stages?.submit && !(a.revision && !a.revision.doneAt)) continue;
    const p = assessmentPlan(a, cfg); let prev = null;
    for (const st of p.stages) {
      const id = `as:${a.id}:${st.id}`;
      tasks.push({ id, kind: 'assessment', ref: a.id, item: st.id, title: st.id === 'submit' ? `Submit: ${a.title}` : st.label, sub: `${a.title} · due ${fmtDayRel(a.due, now)} ${fmtTime(a.due)}${a.dueVerified ? '' : ' (unverified date)'}`,
        min: st.min, target: st.target, official: st.id === 'submit' ? a.due : null, done: !!st.doneAt, deps: prev && st.id !== 'revision' ? [prev] : [] });
      prev = id;
    }
  }
  // lead-instructor duties: only ones you defined and confirmed
  for (const d of state.duties || []) {
    if (!d.due || d.doneAt) continue;
    tasks.push({ id: `du:${d.id}`, kind: 'duty', ref: d.id, title: d.title, sub: `Lead instructor · ${d.subject || ''} · due ${fmtDayRel(d.due, now)}`, min: d.min || 30, target: d.due, official: d.due, done: false, deps: [] });
  }
  return tasks;
}

/** "What is the most important thing to work on next?" plus a capacity-limited plan for today. */
export function plan(state, now) {
  const cfg = cfgOf(state), tasks = allTasks(state, now);
  const done = new Set(tasks.filter(t => t.done).map(t => t.id));
  const snooze = state.snooze || {};
  const open = tasks.filter(t => !t.done).map(t => ({ ...t, blocked: t.deps.some(d => !done.has(d)), overdue: t.target < now, score: score(t, now) }));
  const actionable = open.filter(t => !t.blocked && !(snooze[t.id] > now)).sort((a, b) => b.score - a.score);
  const horizon = addDays(startOfDay(now), 2);
  const today = [], later = []; let used = 0;
  for (const t of actionable) {
    if (t.target >= horizon) { later.push(t); continue; }
    const must = t.overdue || (t.official && t.official - now < 24 * H) || t.classSoon;
    if (must || used + t.min <= cfg.dailyMinutes) { today.push(t); used += t.min; } else later.push(t);
  }
  return { next: actionable[0] || null, today, later, minutes: used, capacity: cfg.dailyMinutes, open, tasks };
}

/** Upcoming official deadlines (handouts, assessments, duties). */
export function deadlines(state, now, limit = 6) {
  const out = [];
  for (const h of handoutCycles(state, now)) if (!h.submittedAt) out.push({ kind: 'handout', title: `${h.subject} handout`, at: h.cutoff, verified: h.cutoffVerified, holiday: h.holiday, status: handoutStatus(h), ref: h.id });
  for (const a of allAssessments(state)) if (!a.stages?.submit && a.due > now - 7 * DAY) out.push({ kind: a.auto ? 'exam' : a.kind || 'assessment', title: a.title, at: a.due, verified: !!a.dueVerified, ref: a.id });
  const cfg = cfgOf(state);
  for (const u of unitItems(state)) if (u.role === 'lead' && !state.readiness?.[u.id]?.slides_final) {
    const at = leadPptDue(u.unit, cfg);
    if (at > now - 7 * DAY) out.push({ kind: 'lead', title: `Lead PowerPoint: ${u.subject}`, at, verified: !!u.unit.verified, ref: u.id });
  }
  for (const d of state.duties || []) if (d.due && !d.doneAt) out.push({ kind: 'duty', title: d.title, at: d.due, verified: !!d.verified, ref: d.id });
  return out.sort((a, b) => a.at - b.at).slice(0, limit);
}

/* ------------------------------------------------- schedule sync / diff */
const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
export const sessionKey = s => s.externalId ? `x:${s.externalId}` : `${norm(s.subject)}|${norm(s.section)}|${dayKey(s.start)}`;

/**
 * Merge a fresh pull from one source into the stored sessions.
 * Absence from the source is reported as "missing" (unconfirmed), never as a cancellation.
 * Only sessions inside [windowStart, windowEnd) that came from this same source are compared.
 */
export function mergeSchedule(existing, incoming, { source, now, windowStart = -Infinity, windowEnd = Infinity }) {
  const kept = [], changes = [];
  const inc = new Map();
  for (const raw of incoming) { // normalize + dedupe within the pull
    const s = { section: '', location: '', platform: '', format: 'in_person', instructor: '', ...raw, status: raw.status || 'scheduled' };
    const k = sessionKey(s); if (!inc.has(k)) inc.set(k, s);
  }
  const seen = new Set();
  for (const old of existing) {
    if (old.source?.id !== source.id) { kept.push(old); continue; }
    const k = sessionKey(old), neu = inc.get(k);
    if (!neu) {
      if (old.start >= windowStart && old.start < windowEnd && old.start > now && old.status !== 'missing' && old.status !== 'cancelled') {
        kept.push({ ...old, status: 'missing' }); changes.push({ type: 'missing', key: k, before: old, at: now });
      } else kept.push(old);
      continue;
    }
    seen.add(k);
    const fields = ['start', 'end', 'location', 'platform', 'format', 'status', 'section', 'instructor'].filter(f => (old[f] ?? '') !== (neu[f] ?? ''));
    const merged = { ...old, ...neu, id: old.id, source: { ...source, at: now } };
    if (fields.length) changes.push({ type: neu.status === 'cancelled' ? 'cancelled' : 'changed', key: k, fields, before: old, after: merged, at: now });
    kept.push(merged);
  }
  for (const [k, s] of inc) if (!seen.has(k)) {
    const added = { status: 'scheduled', ...s, id: s.id || `s_${hash(k)}`, source: { ...source, at: now } };
    kept.push(added); changes.push({ type: 'added', key: k, after: added, at: now });
  }
  return { sessions: kept.sort((a, b) => a.start - b.start), changes };
}
export function hash(str) { let h = 2166136261; for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0).toString(36); }

/** Merge lead-instructor assignments, keeping history of every change. */
export function mergeAssignments(existing, incoming, { source, now }) {
  const key = a => `${norm(a.subject)}|${norm(a.term)}`;
  const old = new Map(existing.filter(a => a.source?.id === source.id).map(a => [key(a), a]));
  const others = existing.filter(a => a.source?.id !== source.id);
  const history = [], next = [];
  for (const a of incoming) {
    const k = key(a), prev = old.get(k);
    const rec = { ...a, id: prev?.id || `la_${hash(k)}`, source: { ...source, at: now }, since: prev?.since || now };
    if (!prev) history.push({ type: 'assigned', subject: a.subject, term: a.term, verified: a.verified, at: now });
    else if (prev.verified !== a.verified || prev.role !== a.role) history.push({ type: 'updated', subject: a.subject, term: a.term, verified: a.verified, at: now });
    old.delete(k); next.push(rec);
  }
  for (const a of old.values()) history.push({ type: 'removed', subject: a.subject, term: a.term, at: now });
  return { assignments: [...others, ...next], history };
}

/** Freshness of a synced source. */
export function freshness(src, cfg, now) {
  if (!src || !src.lastOk) return { state: 'never', label: 'Not synced yet' };
  const stale = now - src.lastOk > cfg.staleHours * H;
  const failed = src.lastTry && src.lastTry > src.lastOk && src.error;
  if (failed) return { state: 'failed', label: `Last sync failed · showing data from ${fmtAgo(src.lastOk, now)}` };
  if (stale) return { state: 'stale', label: `Cached · last verified ${fmtAgo(src.lastOk, now)} — may be outdated` };
  return { state: 'live', label: `Verified ${fmtAgo(src.lastOk, now)}` };
}

/* ------------------------------------------------- arrivals */
export function arrivalStatus(arrivedAt, s, cfg) {
  if (arrivedAt <= arriveBy(s, cfg)) return 'early';
  if (arrivedAt <= s.start) return 'on_time';
  return 'late';
}

/* ------------------------------------------------- evaluations */
// Keyword themes are an INTERPRETATION of comments, shown separately from the confirmed scores.
export const THEMES = {
  clarity: { label: 'Clarity of explanation', words: ['unclear', 'confus', 'hard to understand', 'clear', 'explain', 'lost', 'too fast', 'fast'],
    tips: ['State the learning goal in one sentence at the start of class.', 'Use one fully worked example before each practice problem.', 'Add a 1-minute understanding check after every concept (thumbs, mini-poll, one question).', 'End each section with a 2-line recap slide.'] },
  engagement: { label: 'Student engagement', words: ['boring', 'engag', 'interactive', 'participat', 'sleepy', 'monoton', 'fun', 'interest'],
    tips: ['Ask a question every 5–7 minutes and wait 5 seconds before answering it yourself.', 'Insert one 2-minute pair-solve activity per class.', 'Open with a real-world problem the topic solves.', 'Call students by name when acknowledging answers.'] },
  pacing: { label: 'Pacing & time management', words: ['fast', 'slow', 'rush', 'time', 'overtime', 'pace', 'hurr'],
    tips: ['Mark time checkpoints on your slide notes (e.g. 15/30/45 min).', 'Plan for 80% of the period; keep one optional “if time allows” slide.', 'Rehearse the hardest segment with a timer.'] },
  punctuality: { label: 'Punctuality', words: ['late', 'tardy', 'start on time', 'waiting', 'absent', 'punctual'],
    tips: ['Use the leave-by time on the Home card, not the class start.', 'Pack devices and materials the night before.', 'Log in to online classes during the setup buffer, not at start time.'] },
  preparation: { label: 'Preparation', words: ['prepared', 'unprepared', 'mistake', 'error', 'wrong answer', 'slides', 'organized', 'disorgan'],
    tips: ['Finish slides 48 hours ahead so there is time to study them.', 'Independently re-solve every example before class.', 'Study the slides once more the evening before.'] },
  mastery: { label: 'Subject mastery', words: ['knowledge', 'knowledgeable', 'master', 'expert', 'doesn\'t know', 'unsure', 'couldn\'t answer'],
    tips: ['List the 5 hardest questions students might ask and answer them in your notes.', 'Re-derive key formulas from first principles once.', 'Prepare a second explanation for the most difficult concept.'] },
  rapport: { label: 'Approachability & responsiveness', words: ['approach', 'kind', 'rude', 'patient', 'respons', 'reply', 'help', 'consult'],
    tips: ['Invite questions explicitly at three planned points in class.', 'Acknowledge every question positively before answering.', 'State when and how students can reach you outside class.'] },
};
const NEG = ['not', 'no ', 'too', 'un', 'hard', 'confus', 'boring', 'late', 'rush', 'fast', 'slow', 'lost', 'mistake', 'error', 'rude', 'wrong', 'monoton', 'disorgan', 'sleepy', 'couldn'];

export function analyzeEvals(evals) {
  const list = (evals || []).slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  if (!list.length) return null;
  const overall = list.filter(e => e.overall != null).map(e => ({ date: e.date, period: e.period, v: +e.overall }));
  const crit = {};
  list.forEach((e, i) => Object.entries(e.criteria || {}).forEach(([k, v]) => { if (v !== '' && v != null) (crit[k] ||= []).push({ i, v: +v, date: e.date }); }));
  const criteria = Object.entries(crit).map(([name, pts]) => {
    const latest = pts[pts.length - 1].v, prev = pts.length > 1 ? pts[pts.length - 2].v : null;
    return { name, latest, prev, delta: prev == null ? null : latest - prev, avg: pts.reduce((s, p) => s + p.v, 0) / pts.length, n: pts.length };
  }).sort((a, b) => a.latest - b.latest);
  // interpretation
  const themes = {};
  for (const e of list) for (const c of e.comments || []) {
    const t = c.toLowerCase();
    for (const [k, th] of Object.entries(THEMES)) if (th.words.some(w => t.includes(w))) {
      const neg = NEG.some(w => t.includes(w));
      const x = (themes[k] ||= { key: k, label: th.label, neg: 0, pos: 0, quotes: [] });
      neg ? x.neg++ : x.pos++; if (x.quotes.length < 3) x.quotes.push(c);
    }
  }
  const latest = overall[overall.length - 1] || null, prev = overall.length > 1 ? overall[overall.length - 2] : null;
  return { count: list.length, latest, prev, overall, criteria, themes: Object.values(themes).sort((a, b) => b.neg - a.neg), strengths: criteria.filter(c => c.latest >= 4.8).map(c => c.name), weakest: criteria.filter(c => c.latest < 4.8).slice(0, 3) };
}
export function themeForCriterion(name) {
  const n = name.toLowerCase();
  const map = [['clar', 'clarity'], ['explain', 'clarity'], ['engag', 'engagement'], ['interact', 'engagement'], ['motiv', 'engagement'], ['time', 'pacing'], ['pac', 'pacing'], ['punctual', 'punctuality'], ['attend', 'punctuality'], ['prepar', 'preparation'], ['organ', 'preparation'], ['knowledge', 'mastery'], ['master', 'mastery'], ['subject', 'mastery'], ['approach', 'rapport'], ['respect', 'rapport'], ['respons', 'rapport']];
  return (map.find(([w]) => n.includes(w)) || [])[1] || null;
}

/* ------------------------------------------------- excellence journey */
/** Leading indicators from your own logged activity. Nothing is assumed: no data → null. */
export function journey(state, now, days = 30) {
  const cfg = cfgOf(state), from = now - days * DAY;
  const past = activeSessions(state).filter(s => s.start < now && s.start >= from);
  const pastUnits = unitItems(state).filter(u => u.start < now && u.start >= from);
  const arr = past.map(s => state.arrivals?.[s.id]).filter(Boolean);
  const punctual = arr.length ? arr.filter(a => a.status !== 'late').length / arr.length : null;
  const ready = [...past, ...pastUnits].map(s => readiness(s, state, cfg, s.start));
  const readyAtStart = ready.length && ready.some(r => r.done) ? ready.reduce((a, r) => a + r.pct, 0) / ready.length : null;
  const ahead = past.length ? past.filter(s => readiness(s, state, cfg, s.start - 12 * H).pct >= 0.999).length : 0;
  const mastery = ready.length && ready.some(r => r.done) ? avg(ready.map(r => r.byCat.mastery ? r.byCat.mastery.done / r.byCat.mastery.total : null)) : null;
  const delivery = ready.length && ready.some(r => r.done) ? avg(ready.map(r => r.byCat.delivery ? r.byCat.delivery.done / r.byCat.delivery.total : null)) : null;
  const hs = Object.entries(state.handouts || {}).filter(([, h]) => h.submittedAt && h.submittedAt >= from);
  const handoutsOnTime = hs.length ? hs.filter(([, h]) => h.cutoffAt ? h.submittedAt <= h.cutoffAt : true).length / hs.length : null;
  const asub = allAssessments(state).filter(a => a.stages?.submit && a.stages.submit >= from);
  const assessOnTime = asub.length ? asub.filter(a => a.stages.submit <= a.due).length / asub.length : null;
  const responsibility = avg([handoutsOnTime, assessOnTime]);
  const practices = (state.practices || []).filter(p => !p.archived);
  const applied = practices.reduce((n, p) => n + (p.applied || []).filter(t => t >= from).length, 0);
  const ev = analyzeEvals(state.evals);
  const critScore = key => { if (!ev) return null; const c = ev.criteria.filter(c => themeForCriterion(c.name) === key); return c.length ? avg(c.map(c => c.latest)) : null; };
  return {
    days, classes: past.length, logged: arr.length, ahead,
    lead: { punctual, readyAtStart, mastery, delivery, responsibility, handoutsOnTime, assessOnTime, applied, practices: practices.length },
    outcome: ev ? { latest: ev.latest?.v ?? null, prev: ev.prev?.v ?? null, clarity: critScore('clarity'), engagement: critScore('engagement'), count: ev.count } : null,
    dims: [
      { key: 'punctuality', label: 'Punctuality & reliability', lead: punctual, outcome: critScore('punctuality'), note: arr.length ? `${arr.length} arrivals logged` : 'Log arrivals with “I’m here”' },
      { key: 'preparation', label: 'Preparation consistency', lead: readyAtStart, outcome: critScore('preparation'), note: past.length ? `${ahead}/${past.length} classes fully ready 12h ahead` : 'No past classes yet' },
      { key: 'mastery', label: 'Subject mastery', lead: mastery, outcome: critScore('mastery'), note: 'Studied, concepts, questions' },
      { key: 'clarity', label: 'Teaching clarity', lead: delivery, outcome: critScore('clarity'), note: 'Rehearsal & timing habits' },
      { key: 'engagement', label: 'Student engagement', lead: null, outcome: critScore('engagement'), note: 'Track an engagement practice' },
      { key: 'responsibility', label: 'Academic responsibility', lead: responsibility, outcome: null, note: hs.length + asub.length ? `${hs.length} handouts, ${asub.length} assessments submitted` : 'No submissions in range' },
      { key: 'feedback', label: 'Responsiveness to feedback', lead: practices.length && past.length + pastUnits.length ? Math.min(1, applied / (past.length + pastUnits.length)) : null, outcome: null, note: practices.length ? `${applied} practice uses / ${past.length} classes` : 'Adopt a practice from feedback' },
      { key: 'improvement', label: 'Continuous improvement', lead: null, outcome: ev?.latest?.v ?? null, note: ev?.prev ? `${ev.latest.v >= ev.prev.v ? '▲' : '▼'} ${(ev.latest.v - ev.prev.v).toFixed(2)} vs previous` : 'Needs two evaluation periods' },
    ],
  };
}
function avg(xs) { const v = xs.filter(x => x != null && !Number.isNaN(x)); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; }

/** Current consecutive-day streak of classes where you were on time AND ≥ 90% ready at start. */
export function streak(state, now) {
  const cfg = cfgOf(state);
  const byDay = new Map();
  for (const s of activeSessions(state)) if (s.end < now) (byDay.get(dayKey(s.start)) || byDay.set(dayKey(s.start), []).get(dayKey(s.start))).push(s);
  const keys = [...byDay.keys()].sort().reverse();
  let n = 0;
  for (const k of keys) {
    const ok = byDay.get(k).every(s => { const a = state.arrivals?.[s.id]; return a && a.status !== 'late' && readiness(s, state, cfg, s.start).pct >= .9; });
    if (!ok) break; n++;
  }
  return n;
}

/** Merge sheet units (your teaching weeks) and record what changed — e.g. a topic moving from support to lead. */
export function mergeUnits(existing, incoming, { source, now }) {
  const old = new Map((existing || []).map(u => [u.key, u])), out = [], history = [];
  for (const u of incoming) {
    const p = old.get(u.key);
    out.push({ ...u, source: { ...source, at: now }, since: p?.since || now });
    if (!p) history.push({ type: 'added', key: u.key, topic: u.topic, role: u.role, weekStart: u.weekStart, at: now });
    else {
      const f = ['topic', 'role', 'coInstructors'].filter(k => JSON.stringify(p[k]) !== JSON.stringify(u[k]));
      if (f.length) history.push({ type: 'changed', key: u.key, topic: u.topic, fields: f, from: Object.fromEntries(f.map(k => [k, p[k]])), to: Object.fromEntries(f.map(k => [k, u[k]])), weekStart: u.weekStart, at: now });
    }
    old.delete(u.key);
  }
  for (const p of old.values()) history.push({ type: 'removed', key: p.key, topic: p.topic, role: p.role, weekStart: p.weekStart, at: now });
  return { units: out.sort((a, b) => a.weekStart - b.weekStart), history };
}
