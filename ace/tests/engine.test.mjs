// Run: cd ace && npm test   (uses TZ=America/New_York to prove Manila math ignores device zone)
import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../js/engine.js';
import * as S from '../js/sources.js';

const { mk, P } = E;
const H = 36e5;
const sess = (id, subject, start, hrs = 1.5, extra = {}) => ({ id, subject, section: 'A', start, end: start + hrs * H, format: 'in_person', location: 'R1', status: 'scheduled', source: { id: 'site' }, ...extra });

test('Manila wall clock is independent of device time zone', () => {
  const t = mk(2026, 11, 11, 17, 0);
  assert.equal(new Date(t).toISOString(), '2026-11-11T09:00:00.000Z');
  assert.deepEqual(P(t), { y: 2026, m: 11, d: 11, h: 17, mi: 0, dow: 3 });
  assert.equal(E.fmtTime(t), '5:00 PM');
  assert.equal(E.dayKey(mk(2026, 11, 11, 23, 59)), '2026-11-11');
  assert.equal(E.dayKey(mk(2026, 11, 12, 0, 0)), '2026-11-12');
  assert.equal(E.parseLocal('2026-11-11T17:00'), t);
  assert.equal(P(E.mondayOf(t)).d, 9);
});

test('Wednesday handout cycle covers the following Mon–Sun week', () => {
  const now = mk(2026, 11, 6, 9, 0); // Friday
  const state = { cfg: { cutoffTime: '17:00' }, sessions: [
    sess('a', 'Calculus 1', mk(2026, 11, 16, 8)),   // Mon after Wed 11
    sess('b', 'Calculus 1', mk(2026, 11, 18, 8)),
    sess('c', 'Physics', mk(2026, 11, 22, 13)),     // Sun, still that week
    sess('d', 'Statics', mk(2026, 11, 23, 8)),      // next cycle (Wed 18)
    sess('e', 'Physics', mk(2026, 11, 10, 8)),      // this week → covered by Wed 4 (past, unsubmitted)
  ] };
  const cyc = E.handoutCycles(state, now);
  const w11 = cyc.filter(h => h.cutoffKey === '2026-11-11');
  assert.deepEqual(w11.map(h => h.subject).sort(), ['Calculus 1', 'Physics']);
  assert.equal(w11.find(h => h.subject === 'Calculus 1').sessions.length, 2);
  assert.equal(w11[0].cutoff, mk(2026, 11, 11, 17, 0));
  assert.equal(w11[0].cutoffVerified, true, 'confirmed 8 PM rule; this test overrides the time to 17:00');
  assert.ok(cyc.some(h => h.cutoffKey === '2026-11-18' && h.subject === 'Statics'));
  // past cutoff still shown while unsubmitted, hidden once submitted
  assert.ok(cyc.some(h => h.cutoffKey === '2026-11-04'));
  state.handouts = { 'ho:2026-11-04:physics': { submittedAt: mk(2026, 11, 4, 16) } };
  assert.ok(!E.handoutCycles(state, now).some(h => h.cutoffKey === '2026-11-04'));
});

test('handout milestones are suggestions before the official cutoff; ready ≠ submitted', () => {
  const now = mk(2026, 11, 6, 9);
  const state = { sessions: [sess('a', 'Calc', mk(2026, 11, 16, 8))], handouts: { 'ho:2026-11-11:calc': { stages: { draft: 1, problems: 1, verify: 1, format: 1, check: 1, ready: 1 } } } };
  const h = E.handoutCycles(state, now).find(h => h.cutoffKey === '2026-11-11');
  const cfg = E.cfgOf(state);
  assert.equal(E.handoutTarget(h, E.HANDOUT_STAGES[0], cfg), mk(2026, 11, 9, 20)); // Monday
  assert.equal(E.handoutTarget(h, E.HANDOUT_STAGES[2], cfg), mk(2026, 11, 10, 20)); // Tuesday
  assert.equal(E.handoutStatus(h), 'ready');
  const p = E.plan(state, now);
  const submit = p.open.find(t => t.id === 'ho:2026-11-11:calc:submit');
  assert.ok(submit && !submit.done, 'submit stays open until confirmed');
});

test('cutoff overrides and holidays', () => {
  const now = mk(2026, 11, 6, 9);
  const base = { sessions: [sess('a', 'Calc', mk(2026, 11, 16, 8)), sess('b', 'Calc', mk(2026, 11, 23, 8))] };
  let st = { ...base, cfg: { cutoffOverrides: { '2026-11-11': 'skip' } } };
  assert.ok(!E.handoutCycles(st, now).some(h => h.cutoffKey === '2026-11-11'));
  st = { ...base, cfg: { cutoffOverrides: { '2026-11-11': '2026-11-10T12:00' } } };
  const h = E.handoutCycles(st, now).find(h => h.cutoffKey === '2026-11-11');
  assert.equal(h.cutoff, mk(2026, 11, 10, 12)); assert.equal(h.overridden, true);
  st = { ...base, cfg: { holidays: ['2026-11-18'] } };
  assert.equal(E.handoutCycles(st, now).find(h => h.cutoffKey === '2026-11-18').holiday, true);
});

test('schedule merge: add, move, explicit cancel, missing ≠ cancelled, dedupe, other sources untouched', () => {
  const now = mk(2026, 11, 6, 9), src = { id: 'site', name: 'Schedule site' };
  const existing = [
    sess('s1', 'Calc', mk(2026, 11, 9, 8)),
    sess('s2', 'Physics', mk(2026, 11, 9, 13)),
    sess('s3', 'Statics', mk(2026, 11, 10, 8)),
    { ...sess('u1', 'Consultation', mk(2026, 11, 9, 15)), source: { id: 'user' } },
  ];
  const incoming = [
    { subject: 'Calc', section: 'A', start: mk(2026, 11, 9, 10), end: mk(2026, 11, 9, 11, 30), format: 'in_person', location: 'R1' }, // moved
    { subject: 'Physics', section: 'A', start: mk(2026, 11, 9, 13), end: mk(2026, 11, 9, 14, 30), format: 'in_person', location: 'R1', status: 'cancelled' },
    { subject: 'Algebra', section: 'B', start: mk(2026, 11, 11, 8), end: mk(2026, 11, 11, 9), format: 'online', location: '' },
    { subject: 'Algebra', section: 'B', start: mk(2026, 11, 11, 8), end: mk(2026, 11, 11, 9), format: 'online', location: '' }, // dup
  ];
  const r = E.mergeSchedule(existing, incoming, { source: src, now });
  const by = t => r.changes.filter(c => c.type === t);
  assert.equal(by('changed').length, 1); assert.ok(by('changed')[0].fields.includes('start'));
  assert.equal(r.sessions.find(s => s.id === 's1').start, mk(2026, 11, 9, 10), 'id preserved on move');
  assert.equal(by('cancelled').length, 1);
  assert.equal(by('added').length, 1, 'duplicate rows collapsed');
  assert.equal(by('missing').length, 1);
  assert.equal(r.sessions.find(s => s.id === 's3').status, 'missing');
  assert.ok(r.sessions.find(s => s.id === 'u1'), 'user session kept');
  // re-running the same pull is idempotent
  const again = E.mergeSchedule(r.sessions, incoming, { source: src, now });
  assert.equal(again.changes.filter(c => c.type !== 'missing').length, 0);
  assert.equal(again.sessions.length, r.sessions.length);
});

test('readiness counts only confirmed items; dependencies gate the next step', () => {
  const s = sess('a', 'Calc', mk(2026, 11, 9, 8));
  const state = { sessions: [s], readiness: { a: { slides_draft: mk(2026, 11, 5, 10) } } };
  const r = E.readiness(s, state);
  assert.equal(r.done, 1); assert.equal(r.total, 15); assert.equal(r.unconfirmed, 14);
  assert.ok(r.rows.find(x => x.id === 'studied') && !r.rows.find(x => x.id === 'studied').doneAt);
  assert.equal(r.next.id, 'slides_final');
  const online = E.readiness({ ...s, format: 'online' }, state);
  assert.ok(online.rows.some(x => x.id === 'tech') && !online.rows.some(x => x.id === 'venue'));
  // as-of time: before it was done → 0
  assert.equal(E.readiness(s, state, undefined, mk(2026, 11, 4)).done, 0);
});

test('planner ranks overdue official deadlines and class-soon prep, respects deps and capacity', () => {
  const now = mk(2026, 11, 11, 15); // Wed 3 PM, cutoff 5 PM today
  const state = { sessions: [sess('n', 'Calc', mk(2026, 11, 16, 8)), sess('t', 'Physics', mk(2026, 11, 12, 8))],
    handouts: { 'ho:2026-11-11:calc': { stages: { draft: 1, problems: 1, verify: 1, format: 1, check: 1, ready: 1 } } } };
  const p = E.plan(state, now);
  assert.ok(p.next);
  assert.ok(['ho:2026-11-11:calc:submit'].includes(p.next.id) || p.next.kind === 'readiness', `got ${p.next.id}`);
  assert.ok(p.today.some(t => t.id === 'ho:2026-11-11:calc:submit'));
  assert.ok(!p.today.some(t => t.blocked));
  assert.ok(p.open.find(t => t.id === 'rd:t:studied').blocked, 'studied blocked until slides finalized');
});

test('assessment backward planning starts early enough and keeps a buffer day', () => {
  const cfg = E.cfgOf({});
  const a = { id: 'x', title: 'Midterm', due: mk(2026, 11, 20, 17), effortH: 9, stages: {} };
  const p = E.assessmentPlan(a, cfg);
  assert.ok(p.finish <= mk(2026, 11, 19, 20));
  assert.equal(p.days, Math.ceil(540 / 90));
  assert.ok(p.start < mk(2026, 11, 14));
  assert.equal(p.stages.at(-1).target, a.due);
  for (let i = 1; i < p.stages.length; i++) assert.ok(p.stages[i].target >= p.stages[i - 1].target);
});

test('arrival status and conflicts', () => {
  const cfg = E.cfgOf({});
  const s = sess('a', 'Calc', mk(2026, 11, 9, 8));
  assert.equal(E.arrivalStatus(mk(2026, 11, 9, 7, 25), s, cfg), 'early');
  assert.equal(E.arrivalStatus(mk(2026, 11, 9, 7, 50), s, cfg), 'on_time');
  assert.equal(E.arrivalStatus(mk(2026, 11, 9, 8, 1), s, cfg), 'late');
  assert.equal(E.leaveBy(s, cfg), mk(2026, 11, 9, 7, 10));
  const c = E.conflicts({ sessions: [s, sess('b', 'Phys', mk(2026, 11, 9, 9)), sess('c', 'Stat', mk(2026, 11, 9, 10, 40), 1, { location: 'R9' })] });
  assert.deepEqual(c.map(x => x.kind), ['overlap', 'tight']);
});

test('CSV + schedule rows: quotes, ranges, meridiem inference, identity filter, skipped rows reported', () => {
  const csv = 'Subject,Section,Date,Time,Room,Instructor,Remarks\n"Calculus 1, Lec",A,11/16/2026,8:00-9:30 AM,R101,Juan Dela Cruz,\nPhysics,B,2026-11-17,11:00-1:00 PM,Zoom,"Dela Cruz, Juan",\nStatics,C,Nov 18 2026,1:00 PM - 2:30 PM,R2,Maria Santos,\nBad,D,someday,8-9,R1,Juan Dela Cruz,\nChem,E,2026-11-19,8:00-9:00,R3,Juan Dela Cruz,No class';
  const r = S.rowsToSessions(S.parseCSV(csv), { identity: { name: 'Juan Dela Cruz' } });
  assert.equal(r.sessions.length, 3);
  const [calc, phys, chem] = r.sessions;
  assert.equal(calc.subject, 'Calculus 1, Lec');
  assert.equal(calc.start, mk(2026, 11, 16, 8)); assert.equal(calc.end, mk(2026, 11, 16, 9, 30));
  assert.equal(phys.start, mk(2026, 11, 17, 11)); assert.equal(phys.end, mk(2026, 11, 17, 13));
  assert.equal(phys.format, 'online');
  assert.equal(chem.status, 'cancelled');
  assert.equal(r.skipped.length, 1); assert.match(r.skipped[0].reason, /date/);
});

test('ICS: UTC and Asia/Manila accepted, other zones refused rather than guessed', () => {
  const ics = 'BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:1\nSUMMARY:Calc\nDTSTART:20261116T000000Z\nDTEND:20261116T013000Z\nLOCATION:R101\nEND:VEVENT\nBEGIN:VEVENT\nUID:2\nSUMMARY:Phys\nDTSTART;TZID=Asia/Manila:20261117T130000\nDTEND;TZID=Asia/Manila:20261117T143000\nLOCATION:https://zoom.us/j/1\nSTATUS:CANCELLED\nEND:VEVENT\nBEGIN:VEVENT\nUID:3\nSUMMARY:X\nDTSTART;TZID=America/New_York:20261117T130000\nEND:VEVENT\nEND:VCALENDAR';
  const ev = S.parseICS(ics);
  assert.equal(ev.length, 2);
  assert.equal(ev[0].start, mk(2026, 11, 16, 8));
  assert.equal(ev[1].start, mk(2026, 11, 17, 13)); assert.equal(ev[1].format, 'online'); assert.equal(ev[1].status, 'cancelled');
});

test('lead sheet: exact match verified, partial name unverified, non-lead rows excluded, no-role sheet flagged', () => {
  const me = { name: 'Juan Dela Cruz', email: 'juan@school.edu' };
  const rows = S.parseCSV('Instructor,Subject,Role,Term\njuan@school.edu,Calculus 1,Lead,1st Sem\nJ. Dela Cruz,Physics,Lead,1st Sem\nJuan Dela Cruz,Statics,Member,1st Sem\nMaria Santos,Chem,Lead,1st Sem');
  const r = S.rowsToAssignments(rows, me, { leadValues: E.DEFAULT_CFG.leadRoleValues });
  assert.deepEqual(r.assignments.map(a => [a.subject, a.verified]), [['Calculus 1', true], ['Physics', false]]);
  const noRole = S.rowsToAssignments(S.parseCSV('Name,Subject\nJuan Dela Cruz,Calc'), me, {});
  assert.equal(noRole.assignments[0].verified, false);
  assert.ok(noRole.warnings.some(w => /role/.test(w)));
});

test('assignment merge keeps history of changes', () => {
  const src = { id: 'sheet' }, now = 1;
  const a = E.mergeAssignments([], [{ subject: 'Calc', term: 'S1', verified: true, role: 'Lead' }], { source: src, now });
  assert.equal(a.history[0].type, 'assigned');
  const b = E.mergeAssignments(a.assignments, [], { source: src, now: 2 });
  assert.equal(b.history[0].type, 'removed'); assert.equal(b.assignments.length, 0);
});

test('google sheet links become CSV export URLs', () => {
  assert.equal(S.sheetCsvUrl('https://docs.google.com/spreadsheets/d/AbC-1_x/edit#gid=42'), 'https://docs.google.com/spreadsheets/d/AbC-1_x/gviz/tq?tqx=out:csv&gid=42');
  const pub = 'https://docs.google.com/spreadsheets/d/e/2PACX/pub?output=csv';
  assert.equal(S.sheetCsvUrl(pub), pub);
});

test('evaluation analysis separates confirmed scores from keyword interpretation', () => {
  const a = E.analyzeEvals([
    { date: '2026-05-30', overall: 4.5, criteria: { 'Clarity of explanation': 4.3, 'Punctuality': 4.9 }, comments: ['Sometimes too fast and confusing'] },
    { date: '2026-10-30', overall: 4.7, criteria: { 'Clarity of explanation': 4.6, 'Punctuality': 5 }, comments: ['Very knowledgeable', 'Boring at times'] },
  ]);
  assert.equal(a.latest.v, 4.7); assert.equal(a.prev.v, 4.5);
  assert.equal(a.weakest[0].name, 'Clarity of explanation');
  assert.ok(Math.abs(a.weakest[0].delta - 0.3) < 1e-9);
  assert.deepEqual(a.strengths, ['Punctuality']);
  assert.ok(a.themes.find(t => t.key === 'clarity').neg >= 1);
  assert.equal(E.analyzeEvals([]), null);
});

test('journey reports null (no data) instead of assuming performance', () => {
  const j = E.journey({ sessions: [] }, mk(2026, 11, 6));
  assert.equal(j.lead.punctual, null); assert.equal(j.lead.readyAtStart, null); assert.equal(j.outcome, null);
});

test('freshness labels stale and failed syncs', () => {
  const cfg = E.cfgOf({}), now = mk(2026, 11, 6, 12);
  assert.equal(E.freshness({ lastOk: now - H }, cfg, now).state, 'live');
  assert.equal(E.freshness({ lastOk: now - 30 * H }, cfg, now).state, 'stale');
  assert.equal(E.freshness({ lastOk: now - H, lastTry: now, error: 'x' }, cfg, now).state, 'failed');
  assert.equal(E.freshness(null, cfg, now).state, 'never');
});

import { grid } from './fixtures/lead-sheet.mjs';
test('lead sheet grid: GDL cells found, neon blue = lead, other colours = support, royal blue ≠ neon blue', () => {
  const now = mk(2026, 11, 6, 9);
  const { units, warnings } = S.parseTopicGrid(grid, { initials: 'GDL', now });
  assert.deepEqual(warnings, []);
  assert.deepEqual(units.map(u => [E.dayKey(u.weekStart), u.topic, u.role]), [
    ['2026-11-09', 'Relative Equilibrium of Fluids in Moving Vessels', 'support'],
    ['2026-11-16', 'Fluid Flow 1', 'lead'],
    ['2026-11-23', 'Fluid Flow 2', 'support'],
    ['2026-12-07', 'Kinetics 1', 'lead'],
    ['2026-12-14', 'Kinetics 2', 'support'],
  ]);
  const ff1 = units[1];
  assert.deepEqual(ff1.coInstructors, ['ZAA']);
  assert.equal(ff1.week, 'Week 6'); assert.equal(ff1.track, '1'); assert.equal(ff1.cell, 'I3');
  assert.ok(units.every(u => u.verified), units.map(u => u.reasons).join(';'));
  assert.equal(S.colorClass({ r: 0, g: 0, b: 1 }), 'other');
  assert.equal(S.colorClass({ r: 0, g: 1, b: 1 }), 'neon_blue');
  // someone else's initials
  assert.deepEqual(S.parseTopicGrid(grid, { initials: 'ZGG', now }).units.map(u => u.topic), ['Calculator Fundamentals', 'Analysis of Composite Bodies, Compound Beams, Frames, Three-Hinged Arch, Pulleys', 'Stresses in Beams', 'Friction']);
  assert.ok(S.parseTopicGrid(grid, { initials: 'ZGG', now }).units[0].reasons.some(r => /inferred/.test(r)), 'Week 0 date is inferred → unverified');
  // year rollover: dates in Jan near a December "now" belong to next year
  assert.equal(P(S.parseTopicGrid({ rowData: [{ values: [{ formattedValue: 'Dec 28' }, { formattedValue: 'Jan 4' }] }, { values: [{ formattedValue: 'A\nX & GDL' }, { formattedValue: 'B\nGDL & Y' }] }] }, { initials: 'GDL', now: mk(2026, 12, 20) }).units[1].weekStart).y, 2027);
});

test('splitCell handles the sheet\'s instructor notations', () => {
  assert.deepEqual(S.splitCell('Orifice and Weirs\nby ZAA & ZBB'), { topic: 'Orifice and Weirs', initials: ['ZAA', 'ZBB'], detail: '' });
  assert.deepEqual(S.splitCell('Friction by ZGG & ZFF').topic, 'Friction');
  assert.deepEqual(S.splitCell('Statistics and Probability 1 ZBB and ZCC').initials, ['ZBB', 'ZCC']);
  assert.deepEqual(S.splitCell('Algebra\nFundamentals\nZEE'), { topic: 'Algebra Fundamentals', initials: ['ZEE'], detail: '' });
  assert.equal(S.splitCell('Calculus 2\nZKK & ZJJ\nTime Rates').detail, 'Time Rates');
  assert.deepEqual(S.splitCell('CE Fundamentals\nZMM').topic, 'CE Fundamentals');
});

test('evaluation paste: criteria, overall, comments, PII masked', () => {
  const r = S.parseEvalPaste(`Instructor Evaluation\n32 responses\nKnowledge of the subject matter\t4.85\nClarity of explanation: 4.40 / 5\nPunctuality 4.9\nOverall Rating 4.71\nComments\nVery knowledgeable and approachable\nSometimes too fast, email me at a.b@x.com\n-\n`);
  assert.equal(r.overall, 4.71); assert.equal(r.overallComputed, false);
  assert.deepEqual(r.criteria, { 'Knowledge of the subject matter': 4.85, 'Clarity of explanation': 4.4, 'Punctuality': 4.9 });
  assert.equal(r.responses, 32);
  assert.equal(r.comments.length, 2); assert.match(r.comments[1], /\[email\]/);
  const c = S.parseEvalPaste('Engagement 4\nClarity 5');
  assert.equal(c.overall, 4.5); assert.equal(c.overallComputed, true);
});

test('sheet units feed lead PowerPoint deadlines, handouts and readiness', () => {
  const now = mk(2026, 11, 6, 9);
  const { units } = S.parseTopicGrid(grid, { initials: 'GDL', now });
  const state = { units: units.map(u => ({ ...u, source: { id: 'sheet' } })) };
  const cfg = E.cfgOf(state);
  const ff1 = E.unitItems(state).find(u => u.subject === 'Fluid Flow 1');
  assert.equal(ff1.template, 'lead');
  assert.equal(E.leadPptDue(ff1.unit, cfg), mk(2026, 11, 14, 23, 59)); // Saturday midnight before Nov 16
  const p = E.plan(state, now);
  const t = p.open.find(t => t.id === `rd:${ff1.id}:slides_final`);
  assert.equal(t.official, mk(2026, 11, 14, 23, 59));
  const draft = p.open.find(t => t.id === `rd:${ff1.id}:slides_draft`);
  assert.equal(draft.target, mk(2026, 11, 12, 23, 59)); // Thursday before
  assert.equal(p.open.find(t => t.id === `rd:${ff1.id}:studied`).target, mk(2026, 11, 15, 23, 59), 'Sunday = mastery');
  // support week has no slide-making duty
  const sup = E.unitItems(state).find(u => u.subject === 'Fluid Flow 2');
  assert.ok(!E.readiness(sup, state).rows.some(r => r.id === 'slides_final'));
  assert.ok(E.readiness(sup, state).rows.some(r => r.id === 'slides_received'));
  // Wed Nov 11 handout covers week of Nov 16 → Fluid Flow 1
  assert.deepEqual(E.handoutCycles(state, now).filter(h => h.cutoffKey === '2026-11-11').map(h => h.subject), ['Fluid Flow 1']);
  assert.ok(E.deadlines(state, now).some(d => d.kind === 'lead' && d.title.includes('Fluid Flow 1')));
});

test('weekly schedule paste: day headers, ranges, subject on same/next line, online detection', () => {
  const ws = mk(2026, 11, 2);
  const r = S.parseSchedulePaste(`My Schedule\nMonday\n8:00 AM - 10:00 AM | Fluid Flow 1 | Room 301\nTuesday, Nov 3 2026\n1:00-3:00 PM\nHydraulics Review\nOnline · Zoom\nWed\n6:00 PM - 8:00 PM Statics Online (Zoom)\n`, ws);
  assert.equal(r.sessions.length, 3);
  const [a, b, c] = r.sessions;
  assert.equal(a.start, mk(2026, 11, 2, 8)); assert.equal(a.subject, 'Fluid Flow 1'); assert.equal(a.location, 'Room 301');
  assert.equal(b.start, mk(2026, 11, 3, 13)); assert.equal(b.end, mk(2026, 11, 3, 15)); assert.equal(b.subject, 'Hydraulics Review'); assert.equal(b.format, 'online'); assert.equal(b.platform, 'Online · Zoom');
  assert.equal(c.start, mk(2026, 11, 4, 18)); assert.equal(c.format, 'online');
  assert.equal(S.weekFromUrl('https://hub.gertcrev.com/admin/group-chat/my-schedule?week=2026-11-02'), '2026-11-02');
});

test('unit merge records role changes support → lead', () => {
  const now = mk(2026, 11, 6);
  const base = S.parseTopicGrid(grid, { initials: 'GDL', now }).units;
  const a = E.mergeUnits([], base, { source: { id: 'sheet' }, now });
  assert.equal(a.history.length, 5);
  const changed = base.map(u => u.topic === 'Fluid Flow 2' ? { ...u, role: 'lead' } : u).filter(u => u.topic !== 'Kinetics 2');
  const b = E.mergeUnits(a.units, changed, { source: { id: 'sheet' }, now: now + 1 });
  assert.deepEqual(b.history.map(h => [h.type, h.topic]), [['changed', 'Fluid Flow 2'], ['removed', 'Kinetics 2']]);
  assert.deepEqual(b.history[0].to, { role: 'lead' });
});

test('real class in a sheet week inherits role and template', () => {
  const now = mk(2026, 11, 6, 9);
  const { units } = S.parseTopicGrid(grid, { initials: 'GDL', now });
  const state = { units, sessions: [sess('r', 'Fluid Flow 1', mk(2026, 11, 16, 8))] };
  const items = E.teachingItems(state).filter(i => E.dayKey(E.mondayOf(i.start)) === '2026-11-16');
  assert.equal(items.length, 1, 'no duplicate of the sheet week');
  assert.equal(items[0].role, 'lead'); assert.equal(items[0].template, 'lead_in_person', 'in-person class in a lead week'); assert.ok(!items[0].approx);
});

test('readiness logged on a sheet week carries over to the imported class', () => {
  const now = mk(2026, 11, 6, 9);
  const { units } = S.parseTopicGrid(grid, { initials: 'GDL', now });
  const ff1 = units.find(u => u.topic === 'Fluid Flow 1');
  const state = { units, readiness: { [`u:${ff1.key}`]: { slides_draft: now } }, sessions: [sess('r', 'Fluid Flow 1', mk(2026, 11, 16, 8))] };
  const item = E.teachingItems(state).find(i => i.id === 'r');
  assert.equal(E.readiness(item, state).done, 1);
});

test('confirmed rules: 8 PM cutoffs, handouts only for lead weeks, lead exam on teaching-week Wednesday, lead weeks online', () => {
  const now = mk(2026, 11, 6, 9);
  const { units } = S.parseTopicGrid(grid, { initials: 'GDL', now });
  const state = { units, sessions: [sess('r', 'Fluid Flow 2', mk(2026, 11, 23, 8))] }; // real class in a SUPPORT week
  const cyc = E.handoutCycles(state, now, { ahead: 6 });
  assert.deepEqual([...new Set(cyc.map(h => h.subject))].sort(), ['Fluid Flow 1', 'Kinetics 1']);
  const ff1 = cyc.find(h => h.subject === 'Fluid Flow 1');
  assert.equal(ff1.cutoff, mk(2026, 11, 11, 20)); // Wednesday before the teaching week, 8 PM
  const ex = E.leadExams(state).filter(e => e.role === 'lead');
  assert.deepEqual(ex.map(e => [e.subject, E.dayKey(e.due), E.fmtTime(e.due)]), [['Fluid Flow 1', '2026-11-18', '8:00 PM'], ['Kinetics 1', '2026-12-09', '8:00 PM']]);
  assert.deepEqual(E.leadExams(state).map(e => E.dayKey(e.due)), ['2026-11-11', '2026-11-18', '2026-11-25', '2026-12-09', '2026-12-16'], 'assessment draft every teaching week (lead and support)');
  const p = E.plan(state, now);
  assert.ok(p.open.some(t => t.id === `as:${ex[0].id}:questions`));
  assert.ok(E.deadlines(state, now, 10).some(d => d.title === 'Assessment draft: Fluid Flow 1'));
  const lead = E.unitItems(state).find(u => u.subject === 'Fluid Flow 1');
  assert.equal(lead.format, 'online');
  assert.ok(E.readiness(lead, state).rows.some(r => r.id === 'tech'));
  assert.equal(E.unitItems(state).find(u => u.subject === 'Fluid Flow 2').format, 'in_person');
  assert.equal(lead.section, 'Slot 1');
  // exam progress persists by id
  state.exams = { [ex[0].id]: { stages: { plan: now, questions: now } } };
  assert.ok(E.plan(state, now).tasks.find(t => t.id === `as:${ex[0].id}:questions`).done);
});

import { hubWeek4 } from './fixtures/hub-week.mjs';
test('hub grid: only GDL cells, NN = noon, sections, online row, consultations, others ignored', () => {
  assert.deepEqual(S.parseTime('12:00 NN'), { h: 12, mi: 0, ap: 'p' });
  const r = S.parseScheduleGrid(hubWeek4, { initials: 'GDL', weekStart: mk(2026, 11, 2) });
  assert.equal(r.title, 'Review Week 4');
  assert.deepEqual(r.sessions.map(s => [E.dayKey(s.start), E.fmtTime(s.start), E.fmtTime(s.end), s.section, s.group, s.format]), [
    ['2026-11-02', '8:00 AM', '12:00 PM', 'ONLINE', 'A', 'online'],
    ['2026-11-05', '7:30 AM', '11:30 AM', 'L2 AM', 'B', 'in_person'],
    ['2026-11-03', '7:30 AM', '11:30 AM', 'X3 AM', 'B', 'in_person'],
    ['2026-11-05', '12:30 PM', '4:30 PM', 'L2 PM', 'B', 'in_person'],
    ['2026-11-03', '12:30 PM', '4:30 PM', 'X3 PM', 'B', 'in_person'],
  ]);
  assert.ok(!JSON.stringify(r).includes('ZAA'), 'no other instructor data kept');
  // another instructor sees theirs, incl. consultation rows (initials only)
  const jam = S.parseScheduleGrid(hubWeek4, { initials: 'ZLL', weekStart: mk(2026, 11, 2) }).sessions;
  assert.deepEqual(jam.map(s => [s.section, E.dayKey(s.start), s.kind]), [['MNL AM', '2026-11-03', 'class'], ['PM Live Consultation', '2026-11-05', 'consultation'], ['EV Live Consultation', '2026-11-02', 'consultation']]);
  assert.equal(jam[2].end, mk(2026, 11, 2, 21));
  // not a grid → null (falls back to line parser)
  assert.equal(S.parseScheduleGrid('Monday\n8:00-9:00 Calc', { initials: 'GDL', weekStart: mk(2026, 11, 2) }), null);
  // re-import of the same week is idempotent
  const src = { id: 'hub' };
  const a = E.mergeSchedule([], r.sessions, { source: src, now: 1, windowStart: mk(2026, 11, 2), windowEnd: mk(2026, 11, 9) });
  const b = E.mergeSchedule(a.sessions, S.parseScheduleGrid(hubWeek4, { initials: 'GDL', weekStart: mk(2026, 11, 2) }).sessions, { source: src, now: 2, windowStart: mk(2026, 11, 2), windowEnd: mk(2026, 11, 9) });
  assert.equal(b.changes.length, 0); assert.equal(b.sessions.length, 5);
});

test('grid classes link to the week\'s sheet topic, share topic prep, keep logistics per session', () => {
  const now = mk(2026, 11, 6, 15);
  const { units } = S.parseTopicGrid(grid, { initials: 'GDL', now });
  // next week (Week 5, Nov 9): same layout, GDL support on Relative Equilibrium
  const wk5 = hubWeek4.replace('Review Week 4', 'Review Week 5').replace(/\(Nov (\d)\)/g, (m, d) => `(Nov ${+d + 7})`);
  const ss = S.parseScheduleGrid(wk5, { initials: 'GDL', weekStart: mk(2026, 11, 9) }).sessions.map((s, i) => ({ ...s, id: 's' + i, source: { id: 'hub' } }));
  const state = { units, sessions: ss };
  const items = E.teachingItems(state).filter(i => E.dayKey(E.mondayOf(i.start)) === '2026-11-09');
  assert.equal(items.length, 5, 'sheet week replaced by the 5 real classes');
  assert.ok(items.every(i => i.subject === 'Relative Equilibrium of Fluids in Moving Vessels' && i.role === 'support' && i.template === 'support'));
  // studying once covers all five classes; venue is per class
  const first = items[0];
  state.readiness = { [E.readinessKey(first, 'studied')]: { studied: now }, [E.readinessKey(first, 'venue')]: { venue: now } };
  assert.ok(items.every(i => E.readiness(i, state).rows.find(r => r.id === 'studied').doneAt));
  assert.equal(items.filter(i => E.readiness(i, state).rows.find(r => r.id === 'venue').doneAt).length, 1);
  // planner lists shared prep once, logistics per class
  const p = E.plan(state, now);
  assert.equal(p.tasks.filter(t => t.item === 'concepts' && t.id.includes('2026-11-09')).length, 1);
  assert.equal(p.tasks.filter(t => t.item === 'venue' && ss.some(x => t.ref === x.id)).length, ss.filter(x => x.start < now + 5 * 864e5).length, 'logistics per class inside the 5-day horizon');
  // support week → no handout
  assert.ok(!E.handoutCycles(state, now).some(h => h.subject.startsWith('Relative')));
});

import { hubEval } from './fixtures/hub-eval.mjs';
test('hub evaluation page: label/score on separate lines, overall + count, numbered multi-line comments, Taglish themes', () => {
  const r = S.parseEvalPaste(hubEval);
  assert.equal(r.overall, 4.4); assert.equal(r.overallComputed, false); assert.equal(r.responses, 40);
  assert.equal(Object.keys(r.criteria).length, 6);
  assert.equal(r.criteria['Keeps me engaged (energy, eye contact, delivery)'], 4.2);
  assert.equal(r.comments.length, 5);
  assert.match(r.comments[2], /upload the ppt[\s\S]*practice problems/);
  assert.ok(!r.criteria.Sample && !r.unparsed.includes('4.50'));
  const a = E.analyzeEvals([{ date: '2026-11-06', overall: r.overall, criteria: r.criteria, comments: r.comments }]);
  const t = Object.fromEntries(a.themes.map(x => [x.key, x]));
  assert.ok(t.pacing.neg >= 1, 'nagmadali / naubos ang oras → pacing concern');
  assert.ok(t.punctuality.neg >= 1);
  assert.ok(t.materials.neg >= 1, 'upload request');
  assert.ok(t.engagement.neg >= 1, 'naantok');
  assert.ok(t.clarity.pos >= 1, 'very clear — praise kept separately from the pacing concern');
  assert.equal(E.themeForCriterion('Lessons are organized, on topic and well-timed'), 'pacing');
  assert.equal(E.themeForCriterion('Slides and materials are clear and useful'), 'materials');
  assert.equal(E.themeForCriterion('Keeps me engaged (energy, eye contact, delivery)'), 'engagement');
  assert.equal(a.weakest[0].name, 'Keeps me engaged (energy, eye contact, delivery)');
});

test('import merge: idempotent, keeps edits, flags conflicts, live sheet wins over screenshot', () => {
  const now = mk(2026, 11, 6, 16);
  const units = S.parseTopicGrid(grid, { initials: 'GDL', now }).units.map(u => ({ ...u, verified: false, source: { id: 'sheet', method: 'screenshot' } }));
  const sessions = S.parseScheduleGrid(hubWeek4, { initials: 'GDL', weekStart: mk(2026, 11, 2) }).sessions.map(s => ({ ...s, source: { id: 'hub', method: 'screenshot' } }));
  const data = { sessions, units, evals: [{ id: 'e1', date: '2026-11-06', overall: 4.5, criteria: {}, comments: [] }], review: [{ id: 'r1', title: 'Check week 4' }] };
  const a = E.importMerge({ sources: { sheet: {} } }, data, { now });
  assert.deepEqual(a.report.sessions, { added: 5, updated: 0, unchanged: 0, conflicts: 0 });
  assert.equal(a.report.units.added, 5); assert.equal(a.report.evals.added, 1); assert.equal(a.report.review, 1);
  // run again → nothing duplicated
  const b = E.importMerge(a.state, data, { now: now + 1 });
  assert.equal(b.state.sessions.length, 5); assert.equal(b.state.units.length, 5); assert.equal(b.state.evals.length, 1); assert.equal(b.state.review.length, 1);
  assert.equal(b.report.sessions.unchanged, 5);
  // a manually edited class from another source is kept; difference becomes a review item
  const edited = JSON.parse(JSON.stringify(a.state));
  Object.assign(edited.sessions[0], { start: edited.sessions[0].start + 36e5, source: { id: 'user' }, edited: true });
  const c = E.importMerge(edited, data, { now });
  assert.equal(c.report.sessions.conflicts, 1);
  assert.equal(c.state.sessions[0].start, edited.sessions[0].start, 'user edit kept');
  assert.ok(c.state.review.some(r => r.kind === 'conflict'));
  // after a live sheet sync, screenshot units are not imported over it
  const d = E.importMerge({ sources: { sheet: { lastOk: now, method: 'api' } }, units: [] }, data, { now });
  assert.equal(d.report.units.skipped, 5); assert.equal(d.state.units.length, 0);
  // input not mutated
  assert.equal(edited.review.length, 1, 'input state not mutated by the merge');
});

test('calendar export: classes and deadlines as valid ICS with stable UIDs', () => {
  const now = mk(2026, 11, 6, 9);
  const { units } = S.parseTopicGrid(grid, { initials: 'GDL', now });
  const state = { units, sessions: [sess('a', 'Fluid Flow 1', mk(2026, 11, 16, 8))] };
  const ics = E.toICS(state, now);
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/); assert.match(ics, /END:VCALENDAR$/);
  assert.match(ics, /SUMMARY:Fluid Flow 1 \(Lead\)/);
  assert.match(ics, /DTSTART:20261116T000000Z/);
  assert.match(ics, /SUMMARY:Due: Assessment draft: Fluid Flow 1/);
  assert.equal(ics, E.toICS(state, now), 'deterministic');
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, (ics.match(/END:VEVENT/g) || []).length);
});

test('deliverables: one list of handouts, lead PowerPoints and exams with steps and status', () => {
  const now = mk(2026, 11, 6, 16);
  const { units } = S.parseTopicGrid(grid, { initials: 'GDL', now });
  const state = { units, duties: [{ id: 'd1', title: 'Review co-instructor slides', due: mk(2026, 11, 12, 17) }] };
  const d = E.deliverables(state, now);
  const titles = d.map(x => `${x.kind}:${x.title}:${E.dayKey(x.due)}`);
  assert.deepEqual(titles.slice(0, 5), ['handout:Fluid Flow 1 handout:2026-11-11', 'draft:Assessment draft: Relative Equilibrium of Fluids in Moving Vessels:2026-11-11', 'duty:Review co-instructor slides:2026-11-12', 'leadppt:Fluid Flow 1 PowerPoint:2026-11-14', 'draft:Assessment draft: Fluid Flow 1:2026-11-18']);
  assert.ok(titles.includes('handout:Kinetics 1 handout:2026-12-02') && titles.includes('leadppt:Kinetics 1 PowerPoint:2026-12-05'));
  const ppt = d.find(x => x.kind === 'leadppt');
  assert.equal(ppt.steps.length, 2); assert.equal(ppt.next.id, 'slides_draft'); assert.equal(ppt.status, 'ok');
  // ticking the planner task updates the deliverable (same ids)
  state.readiness = { [ppt.unitId]: { slides_draft: now, slides_final: now } };
  assert.equal(E.deliverables(state, now).find(x => x.kind === 'leadppt').status, 'done');
  // a past-due unsubmitted handout is overdue; submission is never assumed
  const late = E.deliverables(state, mk(2026, 11, 12, 9)).find(x => x.kind === 'handout');
  assert.equal(late.status, 'overdue'); assert.equal(late.done, false);
  assert.ok(E.deliverables(state, now).every(x => x.steps.every(s => s.task)));
});

test('screenshot updates: newer import changes weeks in place, records role changes, removes dropped weeks, resolves review items', () => {
  const now = mk(2026, 11, 6, 16), src = { id: 'sheet', method: 'screenshot' };
  const base = S.parseTopicGrid(grid, { initials: 'GDL', now }).units.map(u => ({ ...u, source: src }));
  const a = E.importMerge({ sources: { sheet: {} } }, { createdAt: 1, units: base, review: [{ id: 'missing-nov9', title: 'x' }] }, { now });
  assert.equal(a.state.units.length, 5);
  assert.ok(a.state.unitHistory.every(h => h.type === 'imported'), 'first import is not reported as changes');
  // later screenshot: Fluid Flow 2 becomes lead, Kinetics 2 gone (full sheet), a new week added
  const later = base.filter(u => u.topic !== 'Kinetics 2').map(u => u.topic === 'Fluid Flow 2' ? { ...u, role: 'lead', verified: true } : u)
    .concat([{ ...base[0], key: '2026-12-21|1', topic: 'Hydraulic Machines', role: 'lead', weekStart: mk(2026, 12, 21) }]);
  const b = E.importMerge(a.state, { createdAt: 2, units: later, unitsComplete: true, resolve: ['missing-nov9'] }, { now: now + 1 });
  assert.equal(b.report.units.updated, 1); assert.equal(b.report.units.removed, 1); assert.equal(b.report.units.added, 1);
  assert.equal(b.state.units.find(u => u.topic === 'Fluid Flow 2').role, 'lead');
  assert.deepEqual(b.state.unitHistory.filter(h => h.type !== 'imported').map(h => `${h.type}:${h.topic}`).sort(), ['added:Hydraulic Machines', 'changed:Fluid Flow 2', 'removed:Kinetics 2']);
  assert.ok(b.state.review.find(r => r.id === 'missing-nov9').resolvedAt);
  // re-running the same import changes nothing
  const c = E.importMerge(b.state, { createdAt: 2, units: later, unitsComplete: true }, { now: now + 2 });
  assert.equal(c.report.units.updated + c.report.units.added + c.report.units.removed, 0);
});

test('sealed imports: round-trip with the passcode, refuse a wrong one, no plaintext in the file', async () => {
  const data = { kind: 'ace-import', evals: [{ id: 'e1', overall: 4.55, comments: ['Very clear but rushed at the end'] }] };
  const sealed = await S.seal(data, 'kp7m-x4qh-9tvc-2wrn', { label: 'Evaluation', iterations: 1000 });
  const raw = JSON.stringify(sealed);
  assert.ok(!raw.includes('rushed') && !raw.includes('4.55'), 'nothing readable in the sealed file');
  assert.deepEqual(await S.unseal(sealed, 'kp7m-x4qh-9tvc-2wrn'), data);
  assert.deepEqual(await S.unseal(sealed, '  kp7m-x4qh-9tvc-2wrn '), data, 'surrounding spaces ignored');
  await assert.rejects(S.unseal(sealed, 'kp7m-x4qh-9tvc-2wrm'), /wrong passcode/);
  await assert.rejects(S.unseal({ ...sealed, ct: sealed.ct.slice(0, -4) + 'AAAA' }, 'kp7m-x4qh-9tvc-2wrn'), /wrong passcode/, 'tampering detected');
});

test('calendar items: lead-week rhythm (handout Wed before, PPT Sat, mastery Sun, draft Wed) and support weeks', () => {
  const now = mk(2026, 11, 6, 16);
  const { units } = S.parseTopicGrid(grid, { initials: 'GDL', now });
  const state = { units };
  const items = E.calendarItems(state, mk(2026, 11, 9), mk(2026, 11, 23), now);
  const on = k => items.filter(i => E.dayKey(i.at) === k).map(i => i.title);
  assert.ok(on('2026-11-11').includes('Submitted · Fluid Flow 1 handout'), 'Wed before lead week: handout');
  assert.ok(on('2026-11-11').includes('Draft sent · Assessment draft: Relative Equilibrium of Fluids in Moving Vessels'), 'support week: draft Wed');
  assert.ok(on('2026-11-14').includes('PowerPoint finalized · Fluid Flow 1 PowerPoint'), 'Saturday: PowerPoint');
  assert.deepEqual(on('2026-11-15').filter(x => /studied|concepts|questions/i.test(x)).length, 3, 'Sunday: mastery');
  assert.ok(on('2026-11-18').includes('Draft sent · Assessment draft: Fluid Flow 1'), 'lead week: draft Wed');
  assert.equal(E.weekRole(state, mk(2026, 11, 16)).role, 'lead'); assert.equal(E.weekRole(state, mk(2026, 11, 30)), null);
  // ticking in the calendar is the same task as everywhere else
  const t = items.find(i => /PowerPoint finalized/.test(i.title));
  assert.match(t.task, /^rd:u:2026-11-16\|1:slides_final$/);
});

test('support-week draft work starts in its teaching week; “not assigned to me” removes a deliverable everywhere', () => {
  const now = mk(2026, 11, 6, 16); // Friday before Week 5
  const { units } = S.parseTopicGrid(grid, { initials: 'GDL', now });
  const state = { units };
  const re = E.deliverables(state, now).find(d => d.title.startsWith('Assessment draft: Relative'));
  assert.equal(E.dayKey(re.due), '2026-11-11');
  assert.ok(re.steps.every(s => s.target >= mk(2026, 11, 9, 8)), 'no draft step before Mon Nov 9');
  assert.ok(!E.plan(state, now).today.some(t => /^as:lx\|2026-11-09/.test(t.id)), 'nothing from it in Today on Fri Nov 6');
  // the lead instructor already submitted the Fluid Flow 1 handout → not yours
  const hid = 'ho:2026-11-11:fluid flow 1';
  assert.ok(E.deliverables(state, now).some(d => d.id === hid));
  const m = E.importMerge({ ...state, sources: { sheet: {} } }, { exclude: { [hid]: 'The lead instructor submitted it' } }, { now });
  const s2 = m.state;
  assert.ok(!E.deliverables(s2, now).some(d => d.id === hid), 'gone from Tasks');
  assert.ok(!E.plan(s2, now).open.some(t => t.id.startsWith(hid)), 'gone from the planner');
  assert.ok(!E.deadlines(s2, now, 20).some(d => d.ref === hid), 'no reminders for it');
  assert.ok(!E.calendarItems(s2, mk(2026, 11, 9), mk(2026, 11, 16), now).some(i => i.deliv === hid), 'gone from the calendar');
  assert.ok(E.deliverables(s2, now).some(d => d.kind === 'handout' && d.subject === 'Kinetics 1'), 'other lead-week handouts stay');
  assert.equal(s2.excluded[hid].reason, 'The lead instructor submitted it');
});

test('correction import restores a deliverable excluded by an earlier import, but not one you excluded yourself', () => {
  const now = mk(2026, 11, 6, 16), hid = 'ho:2026-11-11:fluid flow 1';
  const { units } = S.parseTopicGrid(grid, { initials: 'GDL', now });
  let st = E.importMerge({ units, sources: { sheet: {} } }, { label: 'E', exclude: { [hid]: 'x' } }, { now }).state;
  st = E.importMerge(st, { label: 'F', unexclude: { [hid]: 'E' }, cfg: { handoutRoles: ['lead'], dailyMinutes: 1 } }, { now }).state;
  assert.ok(E.deliverables(st, now).some(d => d.id === hid), 'Fluid Flow 1 handout back');
  assert.deepEqual(st.cfg, { handoutRoles: ['lead'] }, 'only whitelisted rule keys applied');
  const mine = { ...st, excluded: { [hid]: { source: 'you' } } };
  assert.ok(E.importMerge(mine, { unexclude: { [hid]: 'E' } }, { now }).state.excluded[hid], 'your own choice is kept');
  // support-week handouts never appear
  assert.ok(!E.deliverables(st, mk(2026, 11, 2, 9)).some(d => d.kind === 'handout' && /Relative/.test(d.title)));
});
