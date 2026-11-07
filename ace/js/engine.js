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
let clock24 = false;
export const setClock24 = v => { clock24 = !!v; };
export const fmtTime = ms => { const p = P(ms); return clock24 ? `${pad(p.h)}:${pad(p.mi)}` : `${(p.h % 12) || 12}:${pad(p.mi)} ${p.h < 12 ? 'AM' : 'PM'}`; };
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
  // Confirmed (Nov 6): every week you teach (lead or support) → assessment draft sent that week's Wednesday, 8 PM.
  examDow: 3, examTime: '20:00', examEffortH: 5, assessRoles: ['lead', 'support'],
  // Which classes a Wednesday covers: the Mon–Sun week that starts N days after that Wednesday.
  handoutWeekStartOffset: 5,
  cutoffOverrides: {},            // { 'YYYY-MM-DD' (the normal Wednesday): 'skip' | 'YYYY-MM-DDTHH:MM' }
  holidays: [],                   // ['YYYY-MM-DD'] — flagged, never silently moved
  milestoneHour: 20, draftDaysBefore: 2, finishDaysBefore: 1, // suggested internal targets
  arriveEarlyMin: 30, onlineSetupMin: 30, travelMin: 20, minGapMin: 30,
  dailyMinutes: 150, horizonDays: 5, staleHours: 24,
  // Lead sheet (colour-coded grid). Your rule: lead = neon-blue cell → PowerPoint ready 1 week before the week starts.
  initials: '',
  // Confirmed (Nov 6): lead PowerPoint due Saturday midnight before the week (days before its Monday), so Sunday is for mastery.
  leadPptDaysBefore: 2, leadPptTime: '23:59', leadDraftDaysBefore: 4, masteryDaysBefore: 1, masteryTime: '23:59', leadFormat: 'online', supportFormat: 'in_person', unitHorizonDays: 21, unitTemplates: {},
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
// Lead weeks: items pinned to a day before the week's Monday — [days-before key, time key].
const LEAD_DAYS = { slides_draft: ['leadDraftDaysBefore', 'leadPptTime'], slides_final: ['leadPptDaysBefore', 'leadPptTime'],
  studied: ['masteryDaysBefore', 'masteryTime'], concepts: ['masteryDaysBefore', 'masteryTime'], questions: ['masteryDaysBefore', 'masteryTime'] };
export const DEFAULT_TEMPLATES = {
  in_person: { label: 'In-person class', items: [...CORE, 'venue'] },
  online: { label: 'Online class', items: [...CORE, 'platform', 'tech'] },
  lead: { label: 'Lead instructor week (online)', items: [...CORE, 'platform', 'tech'], official: ['slides_final'], leadDays: LEAD_DAYS },
  lead_in_person: { label: 'Lead instructor · in-person class', items: [...CORE, 'venue'], official: ['slides_final'], leadDays: LEAD_DAYS },
  consult: { label: 'Consultation', items: ['questions', 'schedule_ok', 'buffer'] },
  support: { label: 'Support instructor week (in person)', items: ['slides_received', 'solutions', 'formulas', 'studied', 'concepts', 'questions', 'activities', 'rehearsed', 'timing', 'schedule_ok', 'buffer', 'venue'] },
  review: { label: 'Review / problem session', items: ['solutions', 'formulas', 'studied', 'questions', 'timing', 'schedule_ok', 'buffer'] },
};
export const unitsForWeek = (state, ms) => (state.units || []).filter(u => dayKey(u.weekStart) === dayKey(mondayOf(ms)));
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
  const byMonday = new Map(); for (const u of units) { const k = dayKey(u.start); byMonday.set(k, [...(byMonday.get(k) || []), u]); }
  const pick = (s, u) => s.template || (u.role === 'lead' ? (s.format === 'online' ? 'lead' : 'lead_in_person') : 'support');
  // A hub class in a sheet week inherits that week's topic and your role. Grid cells only say "GDL - B", so when
  // you appear in exactly one sheet cell that week, every class of yours that week is that topic.
  const ss = activeSessions(state).map(s => {
    let u = byWk.get(wk(s));
    if (!u && s.autoTopic) { const c = byMonday.get(dayKey(mondayOf(s.start))) || []; if (c.length === 1) u = c[0]; }
    return u ? { ...s, subject: u.subject, role: u.role, unit: u.unit, template: pick(s, u), linked: s.subject !== u.subject } : s;
  });
  const have = new Set(ss.map(wk));
  return [...ss, ...units.filter(u => !have.has(wk(u)))].sort((a, b) => a.start - b.start);
}
/** Lead deadline for a unit: PowerPoint finalized N days before the week starts. */
export function leadPptDue(u, cfg) { return atTime(addDays(u.weekStart, -cfg.leadPptDaysBefore), cfg.leadPptTime); }
export function itemLead(id, tpl, start, cfg) {
  const k = tpl.leadDays?.[id];
  if (k) return (start - atTime(addDays(mondayOf(start), -cfg[k[0]]), cfg[k[1]])) / H;
  return READINESS_ITEMS[id].lead;
}

// Logistics are per class session; everything else (slides, solutions, studying…) is shared by all
// sessions of the same topic-week, so you prepare it once.
export const SESSION_ITEMS = new Set(['schedule_ok', 'venue', 'platform', 'tech', 'buffer']);
export const readinessKey = (s, id) => s.unit && !SESSION_ITEMS.has(id) ? `u:${s.unit.key}` : s.id;

/** Transparent readiness: share of the template's items you have confirmed done. Unconfirmed ≠ done. */
export function readiness(session, state, cfg = cfgOf(state), at = Infinity) {
  const tpl = templateFor(session, cfg);
  const items = tpl.items.filter(id => READINESS_ITEMS[id]);
  const done = id => state.readiness?.[readinessKey(session, id)]?.[id];
  const rows = items.map(id => ({ id, ...READINESS_ITEMS[id], key: readinessKey(session, id), lead: itemLead(id, tpl, session.start, cfg), official: (tpl.official || []).includes(id), doneAt: done(id) && done(id) <= at ? done(id) : null }));
  const nDone = rows.filter(r => r.doneAt).length;
  const byCat = {};
  for (const r of rows) { (byCat[r.cat] ||= { done: 0, total: 0 }).total++; if (r.doneAt) byCat[r.cat].done++; }
  const doneSet = new Set(rows.filter(r => r.doneAt).map(r => r.id));
  const open = rows.filter(r => !r.doneAt).map(r => ({ ...r, blocked: (r.deps || []).some(d => items.includes(d) && !doneSet.has(d)) }));
  const next = open.filter(r => !r.blocked).sort((a, b) => b.lead - a.lead)[0] || null;
  return { rows, done: nDone, total: rows.length, pct: rows.length ? nDone / rows.length : 0, byCat, next, unconfirmed: rows.length - nDone };
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
  let finish = addDays(startOfDay(a.due), -1) + cfg.milestoneHour * H; // keep a buffer day
  let start = addDays(startOfDay(finish), -days) + 8 * H;
  if (a.notBefore) { start = Math.max(start, a.notBefore + 8 * H); if (finish <= start) finish = Math.max(start + 2 * H, a.due - 2 * H); } // e.g. a draft is worked on in its teaching week
  let cum = 0;
  const stages = ASSESS_STAGES.map(st => {
    cum += st.w;
    const target = st.id === 'submit' ? a.due : Math.min(start + (finish - start) * cum / (1 - .02), finish);
    return { ...st, min: Math.round(total * st.w), target, doneAt: a.stages?.[st.id] || null };
  });
  if (a.revision && !a.revision.doneAt) stages.push({ id: 'revision', label: `Requested revision${a.revision.note ? ': ' + a.revision.note : ''}`, min: 45, target: a.revision.due || a.due, doneAt: null, w: 0 });
  return { start, finish, days, total, stages };
}

/** Every teaching week (lead or support) carries an assessment draft due that week's Wednesday, 8 PM. Progress in state.exams[id]. */
export function leadExams(state) {
  const cfg = cfgOf(state);
  return unitItems(state).filter(u => cfg.assessRoles.includes(u.role)).map(u => {
    const id = `lx|${u.unit.key}`, rec = state.exams?.[id] || {};
    return { id, auto: true, role: u.role, title: `Assessment draft: ${u.subject}`, kind: 'Assessment draft', subject: u.subject, due: atTime(addDays(u.start, (cfg.examDow + 6) % 7), cfg.examTime),
      dueVerified: true, notBefore: u.start, effortH: rec.effortH || cfg.examEffortH, stages: rec.stages || {}, revision: rec.revision || null, unit: u.unit };
  });
}
/** Deliverables you marked "not assigned to me" (e.g. the lead instructor already did it). id = deliverable id. */
export const isExcluded = (state, id) => !!state.excluded?.[id];
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
  const seen = new Set();
  for (const s of teachingItems(state)) {
    if (s.start <= now || s.start > now + (s.approx ? cfg.unitHorizonDays : cfg.horizonDays) * DAY) continue;
    const r = readiness(s, state, cfg);
    const soon = s.start - now < 24 * H;
    const pptOff = s.unit && isExcluded(state, `lp:u:${s.unit.key}`);
    const when = s.approx ? `week of ${fmtDay(s.start)}` : `${fmtDayRel(s.start, now)} ${fmtTime(s.start)}`;
    for (const row of r.rows) {
      if (pptOff && (row.id === 'slides_draft' || row.id === 'slides_final')) continue;
      const id = `rd:${row.key}:${row.id}`;
      if (seen.has(id)) continue; // shared topic prep already listed for an earlier session of this week
      seen.add(id);
      const deps = (row.deps || []).filter(d => r.rows.some(x => x.id === d)).map(d => `rd:${readinessKey(s, d)}:${d}`);
      const target = s.start - row.lead * H;
      const title = row.official && s.role === 'lead' ? `PowerPoint finalized — lead, due ${fmtDay(target)}` : row.label;
      tasks.push({ id, kind: 'readiness', ref: s.id, item: row.id, title, sub: `${s.subject}${s.role ? ' · ' + (s.role === 'lead' ? 'Lead' : 'Support') : ''} · ${when}`,
        min: row.min, target: Math.max(target, now - 14 * DAY), official: row.official ? target : null, classSoon: soon, done: !!row.doneAt, deps });
    }
  }
  // Wednesday handouts
  for (const h of handoutCycles(state, now)) {
    if (isExcluded(state, h.id)) continue;
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
    if (isExcluded(state, `as:${a.id}`)) continue;
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
  for (const h of handoutCycles(state, now)) if (!h.submittedAt && !isExcluded(state, h.id)) out.push({ kind: 'handout', title: `${h.subject} handout`, at: h.cutoff, verified: h.cutoffVerified, holiday: h.holiday, status: handoutStatus(h), ref: h.id });
  for (const a of allAssessments(state)) if (!a.stages?.submit && a.due > now - 7 * DAY && !isExcluded(state, `as:${a.id}`)) out.push({ kind: a.auto ? 'exam' : a.kind || 'assessment', title: a.title, at: a.due, verified: !!a.dueVerified, ref: a.id });
  const cfg = cfgOf(state);
  for (const u of unitItems(state)) if (u.role === 'lead' && !state.readiness?.[u.id]?.slides_final && !isExcluded(state, `lp:${u.id}`)) {
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
  pacing: { label: 'Pacing & time management', words: ['fast', 'slow', 'rush', 'pace', 'pacing', 'hurr', 'overtime', 'extend', 'well-timed', 'time', 'bilis', 'nagmadali', 'magmadali', 'madali', 'bagal', 'nabagalan', 'naghapit', 'oras', 'ubos', 'tagal'],
    tips: ['Budget the period on your slide notes: hook 5 min · core concepts · hardest topic before the midpoint · problems · 10 min buffer.', 'Start the first concept within 5 minutes of the start time; keep jokes and stories inside the budget.', 'Mark 2–3 “skip if short” slides so the end is never rushed and the class never runs over.', 'On the last problems, pause about 60 seconds per step so students can write and use their calculators.'] },
  punctuality: { label: 'Punctuality & schedule', words: ['late', 'tardy', 'start on time', 'starts', 'on time', 'punctual', 'break time', 'delayed', 'minutes late', 'extending the class'],
    tips: ['Be logged in and live at the published start time; use the setup buffer for OBS, mic and slides.', 'Follow the published break time exactly; set a silent timer for it.', 'End on time; if something is left, move it to the posted handout instead of extending.'] },
  materials: { label: 'Slides & handouts availability', words: ['upload', 'handout', 'ppt', 'powerpoint', 'practice problem', 'post', 'slides', 'presentation', 'materials'],
    tips: ['Post the PPT and handouts right after class (same day), with the practice problems.', 'Tell students at the end of class exactly where and when materials will be posted.', 'Keep your “concepts after the problem” slide style — students say it helps them review.'] },
  coverage: { label: 'Depth on difficult topics', words: ['harder', 'hard topic', 'complicated', 'difficult', 'not discussed', 'na discuss', 'discussed properly', 'napagtuunan', 'sample problem', 'projectile', 'stability', 'focused more'],
    tips: ['Identify the hardest sub-topic before class and schedule it in the first half.', 'Give the complicated case (e.g. projectile motion) a full worked example plus a student try.', 'Spend less time on the easiest case; one example is enough before moving on.'] },
  engagement: { label: 'Energy & engagement', words: ['boring', 'engag', 'interactive', 'interaction', 'participat', 'sleepy', 'antok', 'naantok', 'energy', 'monoton', 'attention', 'gising', 'loud', 'voice', 'boses', 'sigaw', 'louden', 'mic', 'jokes'],
    tips: ['Open with a hook problem in the first 2 minutes to win attention, then teach.', 'Keep the mic at one steady level; create energy with questions and pace changes, not sudden volume.', 'Ask a question every 5–7 minutes and wait 5 seconds before answering it yourself.', 'Keep interactions tied to the learning goal — every activity should end with the concept.'] },
  clarity: { label: 'Clarity of explanation', words: ['unclear', 'confus', 'hard to understand', 'clear', 'explain', 'understand', 'intindi', 'understandable', 'approach', 'formula'],
    tips: ['State the learning goal in one sentence at the start of class.', 'Use one fully worked example before each practice problem.', 'Add a 1-minute understanding check after every concept.', 'End each section with a 2-line recap slide.'] },
  mastery: { label: 'Subject mastery', words: ['knowledge', 'knowledgeable', 'master', 'expert', 'unsure', 'magaling', 'galing'],
    tips: ['List the 5 hardest questions students might ask and answer them in your notes.', 'Re-derive key formulas from first principles once.', 'Prepare a second explanation for the most difficult concept.'] },
  rapport: { label: 'Motivation & rapport', words: ['motivat', 'inspir', 'encourag', 'words of', 'advice', 'approach', 'kind', 'patient', 'appreciate', 'effort', 'thank', 'salamat'],
    tips: ['Keep the short motivational message — students value it; time-box it to 2 minutes.', 'Invite questions explicitly at three planned points in class.'] },
  preparation: { label: 'Preparation', words: ['prepared', 'unprepared', 'mistake', 'error', 'wrong answer', 'organized', 'disorgan'],
    tips: ['Finish slides 48 hours ahead so there is time to study them.', 'Independently re-solve every example before class.'] },
};
// Clause-level sentiment so “explains well, but rushes at the end” counts as a strength AND a concern.
const NEG = ['not ', 'no ', 'too ', 'hindi', ' di ', 'medyo', 'sana', 'pwede', 'suggest', 'recommend', 'should', 'would be better', 'would be nice', 'it would', 'wish', 'late', 'rush', 'nagmadali', 'magmadali', 'bilisan', 'bilis', 'bagal', 'naantok', 'sleepy', 'boring', 'extend', 'still no', 'wasted', 'prioritized', 'hurts', 'redundant', 'mahina', 'confus', 'unclear', 'lost', 'mistake', 'wrong', 'monoton', 'couldn', 'nagtagal', 'naghapit', 'request', 'please', 'more ', 'paki', 'pa-upload', 'need', 'kulang', 'unta', 'ask lang'];
const POS = ['good', 'great', 'love', 'like', 'clear', 'appreciate', 'thank', 'salamat', 'magaling', 'inspir', 'galing', 'ganda', 'understandable', 'improve', 'motivat', 'well', 'excellent', 'thorough', 'knowledgeable', 'helps', '👍', '🥰', 'engaging'];
const clauses = c => String(c).toLowerCase().split(/[.!?;\n]+|\s(?:but|pero|however|kaso|although)\s/).map(x => ` ${x.trim()} `).filter(x => x.trim().length > 2);
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
  // interpretation (keyword-based, clause level) — never mixed with the confirmed scores above
  const themes = {};
  for (const e of list) for (const c of e.comments || []) {
    const seen = new Set();
    for (const cl of clauses(c)) {
      const neg = NEG.some(w => cl.includes(w)), pos = !neg && POS.some(w => cl.includes(w));
      for (const [k, th] of Object.entries(THEMES)) if (th.words.some(w => cl.includes(w))) {
        const x = (themes[k] ||= { key: k, label: th.label, neg: 0, pos: 0, quotes: [], praise: [] });
        if (seen.has(k + (neg ? '-' : '+'))) continue; seen.add(k + (neg ? '-' : '+'));
        if (neg) { x.neg++; if (x.quotes.length < 3) x.quotes.push(c); } else if (pos) { x.pos++; if (x.praise.length < 2) x.praise.push(c); }
      }
    }
  }
  const latest = overall[overall.length - 1] || null, prev = overall.length > 1 ? overall[overall.length - 2] : null;
  return { count: list.length, latest, prev, overall, criteria, themes: Object.values(themes).filter(t => t.neg || t.pos).sort((a, b) => b.neg - a.neg || b.pos - a.pos), strengths: criteria.filter(c => c.latest >= 4.8).map(c => c.name), weakest: criteria.filter(c => c.latest < 4.8).slice(0, 3) };
}
export function themeForCriterion(name) {
  const n = name.toLowerCase();
  const map = [['slide', 'materials'], ['material', 'materials'], ['particip', 'engagement'], ['engag', 'engagement'], ['interact', 'engagement'], ['motiv', 'engagement'], ['knows', 'mastery'], ['knowledge', 'mastery'], ['master', 'mastery'], ['subject', 'mastery'], ['time', 'pacing'], ['pac', 'pacing'], ['organ', 'pacing'], ['clar', 'clarity'], ['speaks', 'clarity'], ['explain', 'clarity'], ['punctual', 'punctuality'], ['attend', 'punctuality'], ['prepar', 'preparation'], ['question', 'rapport'], ['approach', 'rapport'], ['respect', 'rapport'], ['respons', 'rapport']];
  return (map.find(([w]) => n.includes(w)) || [])[1] || null;
}

/* ------------------------------------------------- excellence journey */
/** Leading indicators from your own logged activity. Nothing is assumed: no data → null. */
export function journey(state, now, days = 30) {
  const cfg = cfgOf(state), from = now - days * DAY;
  const items = teachingItems(state).filter(s => s.kind !== 'consultation');
  const past = items.filter(s => !s.approx && s.start < now && s.start >= from);
  const pastUnits = items.filter(s => s.approx && s.start < now && s.start >= from);
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
  for (const s of teachingItems(state)) if (!s.approx && s.end < now) (byDay.get(dayKey(s.start)) || byDay.set(dayKey(s.start), []).get(dayKey(s.start))).push(s);
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

/** Where to focus first: criterion gap to 5.0 (confirmed) combined with how often comments raise it (interpretation). */
export function focusAreas(ev) {
  if (!ev) return [];
  const m = {};
  for (const c of ev.criteria) { const k = themeForCriterion(c.name); if (k) (m[k] ||= { key: k, gap: 0, concerns: 0, criteria: [] }), m[k].gap = Math.max(m[k].gap, 5 - c.latest), m[k].criteria.push(c.name); }
  for (const t of ev.themes) if (t.neg) (m[t.key] ||= { key: t.key, gap: 0, concerns: 0, criteria: [] }).concerns = t.neg;
  return Object.values(m).filter(x => x.concerns || x.gap > .3).map(x => ({ ...x, score: x.gap * 10 + x.concerns })).sort((a, b) => b.score - a.score);
}

/**
 * Merge an import file (e.g. data extracted from your screenshots) into the current data.
 * - never creates duplicates (same class key / sheet week / evaluation id)
 * - never overwrites what you edited or what a live source already confirmed
 * - differing values from another source become review items, not silent changes
 * Returns { state, report } — the input state is not mutated.
 */
export function importMerge(state, data, { now }) {
  const st = JSON.parse(JSON.stringify(state));
  st.sessions ||= []; st.units ||= []; st.evals ||= []; st.review ||= []; st.unitHistory ||= [];
  const rep = { sessions: { added: 0, updated: 0, unchanged: 0, conflicts: 0 }, units: { added: 0, updated: 0, removed: 0, unchanged: 0, skipped: 0 }, evals: { added: 0, unchanged: 0 }, review: 0 };
  const byKey = new Map(st.sessions.map(s => [sessionKey(s), s]));
  for (const raw of data.sessions || []) {
    const inc = { section: '', location: '', platform: '', format: 'in_person', status: 'scheduled', ...raw };
    const k = sessionKey(inc), ex = byKey.get(k);
    if (!ex) { const s = { ...inc, id: inc.id || `s_${hash(k)}`, source: { ...inc.source, at: now } }; st.sessions.push(s); byKey.set(k, s); rep.sessions.added++; continue; }
    const diff = ['start', 'end', 'section', 'format', 'subject', 'location'].filter(f => (ex[f] ?? '') !== (inc[f] ?? ''));
    if (!diff.length) { rep.sessions.unchanged++; continue; }
    if (ex.source?.id === inc.source?.id && ex.source?.method === inc.source?.method && !ex.edited) { Object.assign(ex, inc, { id: ex.id, source: { ...inc.source, at: now } }); rep.sessions.updated++; continue; }
    rep.sessions.conflicts++;
    st.review.push({ id: `cf:${k}`, at: now, kind: 'conflict', title: `Different details for ${ex.subject} on ${fmtDay(ex.start)}`, detail: `Kept: ${fmtTime(ex.start)}–${fmtTime(ex.end)} (${ex.source?.name || ex.source?.id || 'existing'}). Import says ${fmtTime(inc.start)}–${fmtTime(inc.end)} (${inc.source?.name || 'import'}).` });
  }
  const liveSheet = st.sources?.sheet?.lastOk && !String(st.sources.sheet.method || '').includes('screenshot');
  if (data.units?.length) {
    if (liveSheet) rep.units.skipped += data.units.length; // the live sheet wins over screenshot evidence
    else {
      // Screenshots are the official source: a newer screenshot import updates weeks in place.
      const have = new Map(st.units.map(u => [u.key, u])), first = !st.units.length, ver = data.createdAt || now;
      for (const u of data.units) {
        const ex = have.get(u.key);
        if (!ex) {
          st.units.push({ ...u, source: { ...u.source, at: now }, since: now, importedFrom: ver }); rep.units.added++;
          st.unitHistory.push({ type: first ? 'imported' : 'added', key: u.key, topic: u.topic, role: u.role, weekStart: u.weekStart, at: now });
          continue;
        }
        if (ver <= (ex.importedFrom || 0)) { rep.units.unchanged++; continue; } // (live-sheet weeks never reach here: see liveSheet above)
        const f = ['topic', 'role'].filter(k => ex[k] !== u[k]);
        Object.assign(ex, u, { source: { ...u.source, at: now }, since: ex.since, importedFrom: ver });
        if (f.length) st.unitHistory.push({ type: 'changed', key: u.key, topic: u.topic, fields: f, to: Object.fromEntries(f.map(k => [k, u[k]])), weekStart: u.weekStart, at: now });
        rep.units[f.length ? 'updated' : 'unchanged']++;
      }
      if (data.unitsComplete) { // a full-sheet screenshot: weeks no longer on it (from its first week on) are removed
        const keys = new Set(data.units.map(u => u.key)), from = Math.min(...data.units.map(u => u.weekStart));
        st.units = st.units.filter(u => { const gone = u.source?.method === 'screenshot' && u.weekStart >= from && !keys.has(u.key); if (gone) { rep.units.removed++; st.unitHistory.push({ type: 'removed', key: u.key, topic: u.topic, role: u.role, weekStart: u.weekStart, at: now }); } return !gone; });
      }
      st.units.sort((a, b) => a.weekStart - b.weekStart);
    }
  }
  if (data.identity?.name && !st.identity?.name) st.identity = { ...(st.identity || {}), name: data.identity.name };
  for (const e of data.evals || []) { if (st.evals.some(x => x.id === e.id)) rep.evals.unchanged++; else { st.evals.push({ ...e, importedAt: now }); rep.evals.added++; } }
  for (const r of data.review || []) if (!st.review.some(x => x.id === r.id)) { st.review.push({ ...r, at: now }); rep.review++; }
  for (const [id, reason] of Object.entries(data.exclude || {})) if (!st.excluded?.[id]) (st.excluded ||= {})[id] = { at: now, reason, source: data.label || 'import' };
  // corrections: undo an exclusion made by an earlier import (never one you made yourself)
  for (const [id, fromLabel] of Object.entries(data.unexclude || {})) if (st.excluded?.[id] && st.excluded[id].source === fromLabel) delete st.excluded[id];
  // rule corrections confirmed by you (only these keys)
  for (const [k, v] of Object.entries(data.cfg || {})) if (['handoutRoles', 'handoutRolesVerified'].includes(k)) (st.cfg ||= {})[k] = v;
  for (const id of data.resolve || []) { const r = st.review.find(x => x.id === id); if (r && !r.resolvedAt) r.resolvedAt = now; }
  rep.review += rep.sessions.conflicts;
  return { state: st, report: rep };
}

/** Calendar export (.ics) of your classes and official deadlines — import into Google/Apple Calendar. */
export function toICS(state, now) {
  const z = ms => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const escI = x => String(x || '').replace(/[\\,;]/g, m => '\\' + m).replace(/\n/g, '\\n');
  const ev = [];
  for (const s of teachingItems(state)) if (!s.approx && s.end > now - 30 * DAY)
    ev.push(['ace-' + hash(s.id) + '@ace', s.start, s.end, `${s.subject}${s.role ? (s.role === 'lead' ? ' (Lead)' : ' (Support)') : ''}`, s.section || s.location || s.platform || '', s.format === 'online' ? 'Online class' : '']);
  for (const d of deadlines(state, now, 50)) ev.push(['ace-dl-' + hash(d.kind + d.ref + d.at) + '@ace', d.at - 30 * MIN, d.at, `Due: ${d.title}`, '', 'Official deadline (Ace)']);
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Ace//Instructor Excellence//EN', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Ace · Teaching', 'X-WR-TIMEZONE:Asia/Manila',
    ...ev.flatMap(([uid, a, b, sum, loc, desc]) => ['BEGIN:VEVENT', `UID:${uid}`, `DTSTAMP:${z(now)}`, `DTSTART:${z(a)}`, `DTEND:${z(b)}`, `SUMMARY:${escI(sum)}`, ...(loc ? [`LOCATION:${escI(loc)}`] : []), ...(desc ? [`DESCRIPTION:${escI(desc)}`] : []), 'END:VEVENT']),
    'END:VCALENDAR'].join('\r\n');
}

/**
 * Every deliverable in one list: Wednesday handouts, lead PowerPoints, exams/assessments and lead duties.
 * Each has an official due date, ordered steps (suggested targets + the official submit step) and a status.
 * Step `task` ids are the same ids the planner uses, so ticking a step anywhere updates everywhere.
 */
export function deliverables(state, now) {
  const cfg = cfgOf(state), out = [];
  for (const h of handoutCycles(state, now, { back: 2, ahead: 8 })) {
    if (isExcluded(state, h.id)) continue;
    out.push({ id: h.id, kind: 'handout', title: `${h.subject} handout`, subject: h.subject, due: h.cutoff, verified: h.cutoffVerified,
      note: `For classes in the week of ${fmtDay(h.weekStart)}`, flags: h.holiday ? ['Holiday — confirm the cutoff'] : [],
      steps: HANDOUT_STAGES.map(st => ({ id: st.id, label: st.id === 'submit' ? 'Submitted' : st.label, task: `${h.id}:${st.id}`, target: handoutTarget(h, st, cfg), doneAt: (st.id === 'submit' ? h.submittedAt : h.stages[st.id]) || null, official: st.id === 'submit' })),
      done: !!h.submittedAt });
  }
  for (const u of unitItems(state)) {
    if (u.role !== 'lead' || u.start + 7 * DAY <= now || isExcluded(state, `lp:${u.id}`)) continue;
    const due = leadPptDue(u.unit, cfg), r = state.readiness?.[u.id] || {};
    out.push({ id: `lp:${u.id}`, kind: 'leadppt', title: `${u.subject} PowerPoint`, subject: u.subject, due, verified: !!u.unit.verified, unitId: u.id,
      note: `Lead · teaching week of ${fmtDay(u.start)}`, flags: [],
      steps: [['slides_draft', 'Slides drafted', atTime(addDays(u.start, -cfg.leadDraftDaysBefore), cfg.leadPptTime), false], ['slides_final', 'PowerPoint finalized', due, true]]
        .map(([id, label, target, official]) => ({ id, label, task: `rd:${u.id}:${id}`, target, doneAt: r[id] || null, official })),
      done: !!r.slides_final });
  }
  for (const a of allAssessments(state)) {
    if (a.due < now - 14 * DAY || isExcluded(state, `as:${a.id}`)) continue;
    const p = assessmentPlan(a, cfg), open = a.revision && !a.revision.doneAt;
    out.push({ id: `as:${a.id}`, kind: a.auto ? 'draft' : /exam/i.test(a.kind || '') ? 'exam' : 'assessment', title: a.title, subject: a.subject, due: a.due, verified: !!a.dueVerified, ref: a.id, auto: !!a.auto,
      note: a.auto ? `${a.role === 'lead' ? 'Lead' : 'Support'} · send the draft by this teaching week’s Wednesday` : (a.kind || 'Assessment'), flags: [], start: p.start,
      steps: p.stages.map(st => ({ id: st.id, label: st.id === 'submit' ? (a.auto ? 'Draft sent' : 'Submitted') : st.label, task: `as:${a.id}:${st.id}`, target: st.target, doneAt: st.doneAt, official: st.id === 'submit' })),
      done: !!a.stages?.submit && !open });
  }
  for (const d of state.duties || []) out.push({ id: `du:${d.id}`, kind: 'duty', title: d.title, subject: d.subject, due: d.due || null, verified: !!d.verified, ref: d.id, note: 'Lead responsibility', flags: [],
    steps: [{ id: 'done', label: 'Done', task: `du:${d.id}`, target: d.due || now, doneAt: d.doneAt || null, official: true }], done: !!d.doneAt });
  for (const x of out) {
    const open = x.steps.filter(s => !s.doneAt);
    x.next = open[0] || null; x.doneCount = x.steps.length - open.length;
    x.status = x.done ? 'done' : x.due && x.due < now ? 'overdue' : x.next && x.next.target < now ? 'behind' : x.due && x.due - now < 3 * DAY ? 'soon' : 'ok';
  }
  return out.sort((a, b) => (a.due ?? Infinity) - (b.due ?? Infinity));
}

/**
 * Calendar: what is due or planned on each day — deliverable steps (official deadlines + suggested targets)
 * and the topic prep of each teaching week (e.g. Sunday mastery before a lead week). Same task ids as everywhere.
 */
export function calendarItems(state, from, to, now) {
  const cfg = cfgOf(state), out = [];
  for (const d of deliverables(state, now)) for (const st of d.steps) if (st.target >= from && st.target < to)
    out.push({ at: st.target, title: st.official ? `${st.label} · ${d.title}` : st.label, ctx: d.title, task: st.task, doneAt: st.doneAt, official: st.official, kind: d.kind, deliv: d.id });
  for (const u of unitItems(state)) {
    const r = readiness(u, state, cfg);
    for (const row of r.rows) {
      if (SESSION_ITEMS.has(row.id) || (u.role === 'lead' && (row.id === 'slides_draft' || row.id === 'slides_final'))) continue; // (PowerPoint steps come from its deliverable)
      const at = u.start - row.lead * H;
      if (at >= from && at < to) out.push({ at, title: row.label, ctx: `${u.subject} · ${u.role === 'lead' ? 'Lead' : 'Support'} prep`, task: `rd:${row.key}:${row.id}`, doneAt: row.doneAt, official: false, kind: 'prep', unit: u.id });
    }
  }
  return out.sort((a, b) => a.at - b.at || (b.official - a.official));
}
/** Your role for the week starting on `monday` (from the sheet screenshots), or null. */
export const weekRole = (state, monday) => (state.units || []).find(u => dayKey(u.weekStart) === dayKey(monday)) || null;
