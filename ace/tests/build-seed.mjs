// Builds the screenshot imports shipped with Ace (screenshots are the official source for lead/support weeks).
// seed/gertc-2026-11-06.json  — first import (Nov 6)
// seed/gertc-2026-11-06b.json — update: weeks confirmed by the user; no official hub schedule from Nov 9 yet
// seed/gertc-2026-11-06c.json — update: Week 4 topics from the user's hub “My Schedule” screenshot
// Only the user's own (GDL) records; co-instructor initials are left for the live sheet sync to fill in.
// Run: node tests/build-seed.mjs
import fs from 'fs';
import * as E from '../js/engine.js';
import * as S from '../js/sources.js';
import { grid } from './fixtures/lead-sheet.mjs';
import { hubWeek4 } from './fixtures/hub-week.mjs';
const AT = E.mk(2026, 11, 6, 16); // when the screenshots were shared
const units = S.parseTopicGrid(grid, { initials: 'GDL', now: AT }).units.map(u => ({
  ...u, instructors: ['GDL'], coInstructors: [], verified: true, reasons: [],
  source: { id: 'sheet', name: 'Lead sheet · screenshot Nov 6', method: 'screenshot' },
}));
const sessions = S.parseScheduleGrid(hubWeek4, { initials: 'GDL', weekStart: E.mk(2026, 11, 2) }).sessions
  .map(s => ({ ...s, source: { id: 'hub', name: 'Hub schedule · screenshot Nov 6', method: 'screenshot' } }));
const review = [
  { id: 'wk4-no-topic', title: 'Week 4 classes have no topic', source: 'Hub schedule + lead sheet screenshots',
    detail: 'The hub lists your Review Week 4 classes (Mon Nov 2 ONLINE “GDL - A”; Tue Nov 3 X3 AM/PM and Thu Nov 5 L2 AM/PM “GDL - B”), but the lead sheet’s Week 4 column names no instructors. They are imported as “Review Week 4 · Group A/B” without a lead/support role.' },
  { id: 'wk4-online-role', title: 'Were you lead for Mon Nov 2 (ONLINE)?', source: 'Hub schedule screenshot',
    detail: 'Online classes are taught by the lead instructor, and you taught the ONLINE class on Mon Nov 2 (Group A). The sheet doesn’t confirm a Week 4 lead, so Ace did not mark you as lead.' },
  { id: 'group-letters', title: 'Meaning of hub groups A–E', source: 'Hub schedule screenshot',
    detail: 'Hub cells read “GDL - A” / “GDL - B”. Their link to sheet rows isn’t confirmed, so Ace links your classes to the week’s sheet topic (you appear in only one sheet cell per week) and keeps the letter as “Group”.' },
];
const out = { v: 1, kind: 'ace-import', identity: { name: 'Given Dave Layos' }, label: 'Screenshots · Nov 6, 2026 (schedule & lead sheet)', createdAt: AT, sessions, units, review };
// update for devices that already imported the first version: weeks confirmed, no hub schedule from Nov 9 yet
const upd = { v: 1, kind: 'ace-import', label: 'Update · Nov 6, 2026 (weeks confirmed, Nov 9+ schedule not released)', createdAt: AT + 60e3, units, unitsComplete: true, resolve: ['missing-nov9'] };
fs.writeFileSync(new URL('../seed/gertc-2026-11-06b.json', import.meta.url), JSON.stringify(upd, null, 1));
fs.writeFileSync(new URL('../seed/gertc-2026-11-06.json', import.meta.url), JSON.stringify(out, null, 1));
console.log(`seed: ${sessions.length} classes, ${units.length} teaching weeks, ${review.length} review items`);

// Week 4 topics, from the hub "My Schedule" page screenshot (Nov 6): Mon Online "Soil Properties a…", Tue/Thu "Buoyancy and S…".
// Completed from the lead sheet's Week 4 column (same week, same truncated titles).
const W4 = { A: 'Soil Properties and Soil Compaction', B: 'Buoyancy and Stability' };
const wk4 = sessions.map(s => ({ ...s, subject: W4[s.group] || s.subject, autoTopic: false, topicSource: 'hub My Schedule screenshot (Nov 6)' }));
const updC = { v: 1, kind: 'ace-import', label: 'Update · Nov 6, 2026 (Week 4 topics from your My Schedule screenshot)', createdAt: AT + 120e3, sessions: wk4,
  resolve: ['wk4-no-topic'],
  review: [{ id: 'wk4-section-name', title: 'Section name: X3 or EX?', source: 'Hub weekly grid vs My Schedule screenshots',
    detail: 'The weekly grid lists your Tue Nov 3 classes under “X3 AM / X3 PM”, but your My Schedule page shows “EX AM / EX PM”. Ace keeps “X3” until you confirm which is right.' }] };
fs.writeFileSync(new URL('../seed/gertc-2026-11-06c.json', import.meta.url), JSON.stringify(updC, null, 1));
console.log('update c: Week 4 topics for', wk4.length, 'classes');

// Update d — lead-sheet screenshot of Nov 6 (later): adds Week 11 (Dec 21). Weeks 5–10 unchanged; no GDL cell in
// the visible rows of Week 11 (rows 4–5 are cut off in that screenshot).
const updD = { v: 1, kind: 'ace-import', label: 'Lead sheet screenshot · Nov 6 (Week 11 added, your weeks unchanged)', createdAt: AT + 180e3, units,
  review: [{ id: 'wk11-rows', title: 'Week 11 (Dec 21): rows 4–5 not visible', source: 'Lead sheet screenshot (Nov 6)',
    detail: 'You have no assignment in rows 1–3 of Week 11. Rows 4–5 were cut off in the screenshot — send them if you might be in them.' }] };
fs.writeFileSync(new URL('../seed/gertc-2026-11-06d.json', import.meta.url), JSON.stringify(updD, null, 1));
console.log('update d: Week 11 note');
