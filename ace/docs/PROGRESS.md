# Progress & handoff

_Last updated 2026-11-07 · deployed from `givendavelayos-sudo/gdgertc` (main) on Vercel; mirror in the Power repo branch `claude/instructor-performance-app-w9ewgk` under `ace/`_

## Done (v0.1)
- Engine, adapters and UI as described in the README. 25 unit tests (`npm test`), all passing.
- End-to-end browser check (iPhone 13 viewport, dark + light): sheet sync with mocked Google API using a
  fixture of the real sheet (`tests/fixtures/lead-sheet.mjs`), bad-key error path, schedule paste → review →
  merge, handout submission confirmation, evaluation paste → review → save → adopt practice, stale-data
  banner after 30 h, no horizontal overflow.
- Power untouched (no files outside `ace/` changed).

## v0.8.1–0.8.2 (Nov 7) — iPhone alarms
- Lecture sheet → **Alarms** (only for the first class of a day, `firstOfDay`): bath alarm `ui.alarms.bathMin` (90) and
  leave alarm `ui.alarms.leaveMin` (30) before leave-by time. Offered within 24 h of the first alarm (Clock alarms have no date).
- Hand-off: `shortcuts://run-shortcut?name=Ace%20Alarms&input=text&text=<lines>`, one `YYYY-MM-DD HH:MM|label` per line
  (`window.__aceOpen` hook for tests). Settings → iPhone alarms has offsets and a 5-step guide, incl. a description
  to paste when Shortcuts asks to describe the shortcut.

## v0.8 (Nov 7) — less to tick, after-class check
- `cfg.checklist: 'essentials'` (default): ~5 key items per class (`E.ESSENTIALS`); 'full' keeps every item.
  Ace confirms `schedule_ok` (official hub class) and `buffer` (class time known) itself (`row.auto`); room stays manual.
- After-class check: `E.pendingDebrief` (latest class ended < 24 h, not answered/skipped) → three Yes/No questions on Week;
  stored in `state.debriefs[sessionId]` (onTime also logs the arrival); `E.debriefStats` feeds Performance › Habits and the
  matching "What to improve" card; optional nudge 5–60 min after class (`ui.notif.debrief`).

## v0.7.1 (Nov 7) — user's mix
Older colours and system font (v0.6.6 stylesheet as base) with AMOLED and the app-colour picker; v0.7 structure kept
(3 tabs, Week home, Prepare sheet, Week/Month, alerts urgency). Performance: score → **What students praise** (themes,
highest scores, purely positive quotes via `E.praiseQuotes`) → scores → habits → practices → evaluations → **What to improve** (last).
GERTC tokens remain documented in `docs/DESIGN.md` in case the brand look is wanted later.

## v0.7 (Nov 7) — UX, UI and workflow refinement
See `docs/DESIGN.md` (audit, strategy, GERTC tokens verified from gertcrev.com, validation). Baseline tag `v0.6.6-baseline`.

## v0.6 (Nov 6) — weekly rhythm + calendar
Confirmed rules (user): **lead week W** → handout Wed before W (8 PM) · PowerPoint Sat 11:59 PM before W
(`leadPptDaysBefore: 2`, `leadPptTime: '23:59'`, draft Thu) · Sunday before W = mastery (studied, concepts,
questions; `masteryDaysBefore: 1`) — via `LEAD_DAYS` in the engine. **Every teaching week (lead or support)** →
assessment draft sent that week's Wed 8 PM (`leadExams()` now covers `assessRoles`, kind `draft`).
- Schedule: month calendar under the week view — week rows tinted Lead/Support with week number, dots per day
  (deadline / step / done / missed), selected day lists items with checkboxes (same task ids as Tasks), past days too.
  `E.calendarItems(state, from, to, now)`, `E.weekRole(state, monday)`.
- Reminders: 1 day and 3 hours before every deadline; Sunday 8 AM mastery nudge before a lead week.
- Tasks look 8 weeks ahead (Kinetics 1 handout Wed Dec 2 now listed).
- `seed/gertc-2026-11-06d.json`: newer sheet screenshot (Week 11 added, no change to your weeks) + review item.

## v0.5 (Nov 6)
- **Schedule redesigned** after the user's hub "My Schedule" screenshot: next-class card with a Mon–Sun strip
  (hours per day, today outlined), "The week at a glance" time grid (blocks coloured by section, red now-line,
  today highlighted), selected-day panel with Previous/Next week. State: `schedWeek`, `schedDay` in `js/app.js`.
- **Evaluation ships encrypted** (`seed/sealed/evaluation-2026-11-06.json`, AES-256-GCM, PBKDF2-SHA-256 600k):
  `S.seal`/`S.unseal`; unlocked once in Performance with a passcode given to the user in chat (never committed).
  Build with `ACE_PASSCODE=… node tests/build-sealed.mjs plain.json out.json "label"`.
- `seed/gertc-2026-11-06c.json`: Week 4 topics (Mon online: Soil Properties and Soil Compaction; Tue/Thu:
  Buoyancy and Stability); review item for the X3 vs EX section name; `importMerge` now treats subject changes as updates.

## v0.4.1 (Nov 6) — user decisions
- **No Google Sheet sync**: lead/support weeks come only from screenshots the user sends. Each batch is shipped as a
  new file in `seed/` (add it to `SEEDS` in `js/app.js`, build with `tests/build-seed.mjs`). `E.importMerge` updates
  screenshot weeks in place when a newer import arrives (role/topic changes → Alerts), `unitsComplete: true` removes
  weeks no longer on a full-sheet screenshot, `resolve: [...]` clears review items. API-key code removed and any stored key is deleted.
- **No official hub schedule from Nov 9 yet**: those weeks say "Official schedule not released yet"; review item cleared.
- **No Face ID**: removed; the app lock is PIN-only.

## v0.4 (Nov 6) — cleanup & redesign (baseline tag: `v0.3.0-baseline`)
- Navigation: 4 tabs **Today · Schedule · Tasks · Performance**; Sources moved to Settings → Connections;
  old hash links (#week, #work, #growth, #sources) redirect.
- Today: next class (one action), Focus today (without repeating the card's task), Coming up (3 deliverables),
  Performance (only with real evaluation data). Removed: stale banner (bell covers it), assignments card, "—" tiles, quote.
- Tasks: `E.deliverables()` unifies handouts, lead PowerPoints, exams/assessments and lead duties (one row pattern,
  one detail sheet with steps; same task ids as the planner). One "Add a deliverable" form replaces two.
- Schedule: grouped by teaching week with sheet topic + role, past classes greyed, "Paste" where class times are missing,
  topic prep row shared by the week.
- Performance: score summary, top 3 focus areas (2 actions each, quotes collapsed), criteria, strengths, habit stats only
  when data exists, practices, evaluations. Removed: 5.00 hero, 8 "no data yet" bars, ~16-tip wall.
- style.css rewritten as one design system (tokens, card/list-row/tag/button/sheet patterns, empty/feedback states).
- Removed dead code: ring(), srcBadge(), badge(), staleBanner(), arrangeHome(), week/work/growth/sources screens.

## v0.3 (Nov 6)
- Settings (Power pattern): search; Profile; Appearance (System/Light/Dark/AMOLED, app colour); Home screen cards
  (reorder/hide); Preferences (hide scores, 24-hour); Teaching rules; Security (PIN app lock, device-only in `localStorage['ace.lock']`); Notifications per type + morning plan; Calendar (.ics export);
  Imports (merge); Backup & data; Help; About / What's new / Check for updates.
- Bell / Alerts: schedule changes, sheet role changes, deadlines < 48 h, open prep for the next class, leave-by,
  stale/failed syncs, unverified sheet weeks, "Needs review" items. Dismiss / Mark all read.
- Screenshot data shipped as a one-time import: `seed/gertc-2026-11-06.json` (built by `tests/build-seed.mjs`),
  merged on first launch via `E.importMerge` (idempotent, never overwrites edits or live data, conflicts → review).
  Evaluation results are NOT in the public repo: the user imports them with *Import data file (merge)*.
- Home "Improvement focus" card from real evaluation data (`E.focusAreas`).

## Not verified yet (needs the real thing)
- (Sheet API sync removed in v0.4.1 — screenshots only.) Expected results for GDL as of Nov 6:
  Relative Equilibrium (Nov 9, support), **Fluid Flow 1 (Nov 16, lead)**, Fluid Flow 2 (Nov 23, support),
  **Kinetics 1 (Dec 7, lead)**, Kinetics 2 (Dec 14, support).
- Hub schedule/evaluation page formats: parsers are tolerant but untested on real pasted text.
  **Next step:** paste one real week and one evaluation page (in a test, with student info removed) and add them as fixtures.

## Answered (Nov 6)
Cutoffs 8 PM · handouts lead-only · rows = partner slots · lead weeks online, support in person ·
lead exam due Wednesday of the teaching week. All encoded as defaults in `DEFAULT_CFG` and tested.

## Review items shipped with the screenshot import
Week 4 classes have no sheet topic · whether GDL was lead for the Mon Nov 2 ONLINE class · meaning of hub groups A–E ·
hub schedule from Nov 9 not yet provided.

## Open questions for the user
1. Is the **handout** cutoff also 8 PM? (Assumed yes, from “Wednesday deadline … is 8 pm”.)
2. Can the hub provide an **.ics feed / export / API** for schedules and evaluations?
3. Does the lead's exam need a separate answer-key or review step by co-instructors?

## Next (Phase 2)
1. Supabase project `ace` (separate from Power): tables per data model, RLS by user, Auth (magic link).
2. Edge Function `sync-sheet` (service account, cron), `sync_runs` table, diffs → notifications.
3. Web Push (VAPID) + daily 06:30 plan digest + deadline reminders; notification settings per type.
4. Hub integration per the hub owner's answer (ics → API → bookmarklet).
5. Deploy: Vercel project with root `ace/`, Cloudflare DNS. Optional SwiftUI shell + widgets.
