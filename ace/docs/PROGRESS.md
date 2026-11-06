# Progress & handoff

_Last updated 2026-11-06 · deployed from `givendavelayos-sudo/gdgertc` (main) on Vercel; mirror in the Power repo branch `claude/instructor-performance-app-w9ewgk` under `ace/`_

## Done (v0.1)
- Engine, adapters and UI as described in the README. 25 unit tests (`npm test`), all passing.
- End-to-end browser check (iPhone 13 viewport, dark + light): sheet sync with mocked Google API using a
  fixture of the real sheet (`tests/fixtures/lead-sheet.mjs`), bad-key error path, schedule paste → review →
  merge, handout submission confirmation, evaluation paste → review → save → adopt practice, stale-data
  banner after 30 h, no horizontal overflow.
- Power untouched (no files outside `ace/` changed).

## v0.3 (Nov 6)
- Settings (Power pattern): search; Profile; Appearance (System/Light/Dark/AMOLED, app colour); Home screen cards
  (reorder/hide); Preferences (hide scores, 24-hour); Teaching rules; Security (PIN app lock + Face ID via WebAuthn,
  device-only in `localStorage['ace.lock']`); Notifications per type + morning plan; Calendar (.ics export);
  Imports (merge); Backup & data; Help; About / What's new / Check for updates.
- Bell / Alerts: schedule changes, sheet role changes, deadlines < 48 h, open prep for the next class, leave-by,
  stale/failed syncs, unverified sheet weeks, "Needs review" items. Dismiss / Mark all read.
- Screenshot data shipped as a one-time import: `seed/gertc-2026-11-06.json` (built by `tests/build-seed.mjs`),
  merged on first launch via `E.importMerge` (idempotent, never overwrites edits or live data, conflicts → review).
  Evaluation results are NOT in the public repo: the user imports them with *Import data file (merge)*.
- Home "Improvement focus" card from real evaluation data (`E.focusAreas`).

## Not verified yet (needs the real thing)
- Live call to the real sheet: needs your API key; the build container can reach `sheets.googleapis.com` but
  can't receive a Google key through its credential form. Expected results for GDL as of Nov 6:
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
