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
  assert.deepEqual(ff1.coInstructors, ['CGD']);
  assert.equal(ff1.week, 'Week 6'); assert.equal(ff1.track, '1'); assert.equal(ff1.cell, 'I3');
  assert.ok(units.every(u => u.verified), units.map(u => u.reasons).join(';'));
  assert.equal(S.colorClass({ r: 0, g: 0, b: 1 }), 'other');
  assert.equal(S.colorClass({ r: 0, g: 1, b: 1 }), 'neon_blue');
  // someone else's initials
  assert.deepEqual(S.parseTopicGrid(grid, { initials: 'FOJ', now }).units.map(u => u.topic), ['Calculator Fundamentals', 'Analysis of Composite Bodies, Compound Beams, Frames, Three-Hinged Arch, Pulleys', 'Stresses in Beams', 'Friction']);
  assert.ok(S.parseTopicGrid(grid, { initials: 'FOJ', now }).units[0].reasons.some(r => /inferred/.test(r)), 'Week 0 date is inferred → unverified');
  // year rollover: dates in Jan near a December "now" belong to next year
  assert.equal(P(S.parseTopicGrid({ rowData: [{ values: [{ formattedValue: 'Dec 28' }, { formattedValue: 'Jan 4' }] }, { values: [{ formattedValue: 'A\nX & GDL' }, { formattedValue: 'B\nGDL & Y' }] }] }, { initials: 'GDL', now: mk(2026, 12, 20) }).units[1].weekStart).y, 2027);
});

test('splitCell handles the sheet\'s instructor notations', () => {
  assert.deepEqual(S.splitCell('Orifice and Weirs\nby CGD & FCL'), { topic: 'Orifice and Weirs', initials: ['CGD', 'FCL'], detail: '' });
  assert.deepEqual(S.splitCell('Friction by FOJ & JFC').topic, 'Friction');
  assert.deepEqual(S.splitCell('Statistics and Probability 1 FCL and KJC').initials, ['FCL', 'KJC']);
  assert.deepEqual(S.splitCell('Algebra\nFundamentals\nJSA'), { topic: 'Algebra Fundamentals', initials: ['JSA'], detail: '' });
  assert.equal(S.splitCell('Calculus 2\nIAD & GVB\nTime Rates').detail, 'Time Rates');
  assert.deepEqual(S.splitCell('CE Fundamentals\nRRT').topic, 'CE Fundamentals');
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
  assert.equal(E.leadPptDue(ff1.unit, cfg), mk(2026, 11, 9, 8)); // one week before Nov 16
  const p = E.plan(state, now);
  const t = p.open.find(t => t.id === `rd:${ff1.id}:slides_final`);
  assert.equal(t.official, mk(2026, 11, 9, 8));
  const draft = p.open.find(t => t.id === `rd:${ff1.id}:slides_draft`);
  assert.equal(draft.target, mk(2026, 11, 7, 8));
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
  assert.equal(items[0].role, 'lead'); assert.equal(items[0].template, 'lead'); assert.ok(!items[0].approx);
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
  const ex = E.leadExams(state);
  assert.deepEqual(ex.map(e => [e.subject, E.dayKey(e.due), E.fmtTime(e.due)]), [['Fluid Flow 1', '2026-11-18', '8:00 PM'], ['Kinetics 1', '2026-12-09', '8:00 PM']]);
  const p = E.plan(state, now);
  assert.ok(p.open.some(t => t.id === `as:${ex[0].id}:questions`));
  assert.ok(E.deadlines(state, now, 10).some(d => d.kind === 'exam' && d.title === 'Exam: Fluid Flow 1'));
  const lead = E.unitItems(state).find(u => u.subject === 'Fluid Flow 1');
  assert.equal(lead.format, 'online');
  assert.ok(E.readiness(lead, state).rows.some(r => r.id === 'tech'));
  assert.equal(E.unitItems(state).find(u => u.subject === 'Fluid Flow 2').format, 'in_person');
  assert.equal(lead.section, 'Slot 1');
  // exam progress persists by id
  state.exams = { [ex[0].id]: { stages: { plan: now, questions: now } } };
  assert.ok(E.plan(state, now).tasks.find(t => t.id === `as:${ex[0].id}:questions`).done);
});
