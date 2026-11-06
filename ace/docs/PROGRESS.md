# Progress & handoff

_Last updated 2026-11-06 · branch `claude/instructor-performance-app-w9ewgk`_

## Done (v0.1)
- Engine, adapters and UI as described in the README. 25 unit tests (`npm test`), all passing.
- End-to-end browser check (iPhone 13 viewport, dark + light): sheet sync with mocked Google API using a
  fixture of the real sheet (`tests/fixtures/lead-sheet.mjs`), bad-key error path, schedule paste → review →
  merge, handout submission confirmation, evaluation paste → review → save → adopt practice, stale-data
  banner after 30 h, no horizontal overflow.
- Power untouched (no files outside `ace/` changed).

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
