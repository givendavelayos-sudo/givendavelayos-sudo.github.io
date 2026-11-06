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

## Open questions for the user
1. Wednesday handout **cutoff time**? Handouts for **support** weeks too, or lead only?
2. Do the 5 sheet rows (tracks) map to specific batches/sections or class days?
3. Are classes in person, online, or mixed? (Sets the readiness template.)
4. Can the hub provide an **.ics feed / export / API** for schedules and evaluations?
5. Any lead duties beyond the PowerPoint (e.g. handout review, exam set)?

## Next (Phase 2)
1. Supabase project `ace` (separate from Power): tables per data model, RLS by user, Auth (magic link).
2. Edge Function `sync-sheet` (service account, cron), `sync_runs` table, diffs → notifications.
3. Web Push (VAPID) + daily 06:30 plan digest + deadline reminders; notification settings per type.
4. Hub integration per the hub owner's answer (ics → API → bookmarklet).
5. Deploy: Vercel project with root `ace/`, Cloudflare DNS. Optional SwiftUI shell + widgets.
