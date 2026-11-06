// Builds seed/gertc-2026-11-06.json from the screenshots the user provided on Nov 6, 2026.
// Only the user's own (GDL) records; co-instructor initials are left for the live sheet sync to fill in.
// Run: node tests/build-seed.mjs
import fs from 'fs';
import * as E from '../js/engine.js';
import * as S from '../js/sources.js';
import { grid } from './fixtures/lead-sheet.mjs';
import { hubWeek4 } from './fixtures/hub-week.mjs';
const AT = E.mk(2026, 11, 6, 16); // when the screenshots were shared
const units = S.parseTopicGrid(grid, { initials: 'GDL', now: AT }).units.map(u => ({
  ...u, instructors: ['GDL'], coInstructors: [], verified: false,
  reasons: [...u.reasons, 'from a screenshot of the lead sheet (Nov 6) — sync the sheet to verify and fill in co-instructors'],
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
  { id: 'missing-nov9', title: 'Hub schedule from Nov 9 not provided yet', source: 'Missing source',
    detail: 'Only Review Week 4 (Nov 2–7) was in the screenshots. Paste the hub page for the week of Nov 9 (Sources → Paste schedule) to get exact times for Relative Equilibrium (support).' },
];
const out = { v: 1, kind: 'ace-import', identity: { name: 'Given Dave Layos' }, label: 'Screenshots · Nov 6, 2026 (schedule & lead sheet)', createdAt: AT, sessions, units, review };
fs.writeFileSync(new URL('../seed/gertc-2026-11-06.json', import.meta.url), JSON.stringify(out, null, 1));
console.log(`seed: ${sessions.length} classes, ${units.length} teaching weeks, ${review.length} review items`);
