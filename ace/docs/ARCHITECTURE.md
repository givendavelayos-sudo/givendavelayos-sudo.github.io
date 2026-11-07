# Ace: architecture, integrations and decisions

## 1. Product definition

**Name:** *Ace*. Short, the goal (a 5/5 instructor) and the habit (being on top of your work) in one word.
**Promise:** open the app each morning and immediately know what you teach next, how prepared you are,
what's due, and the single most important next action.
**Principles:** minimal manual entry; nothing invented (unknown stays unknown); every record carries its
source; suggestions are clearly separated from official deadlines; calm, not noisy.

Core loop: **Sources → Planner → Today card → you confirm work → Journey indicators → evaluation outcomes → development plan → back to preparation.**

## 2. Integration feasibility (confirmed vs assumed)

| Source | What we know | Method now | Method later |
|---|---|---|---|
| **Lead sheet** (Google Sheets `13n5Hfh…boQ`) — **since v0.4.1: screenshots only** (user decision; the Sheets API sync, API key and Face ID were removed) | **Confirmed** from your screenshot: row 1 = week-start Monday dates (“Nov 9”), row 2 = “Week N”, col B = track 1–5, cells = “Topic\nAAA & BBB” or “Topic by AAA & BBB”. **Lead = neon-blue (#00FFFF) background**, others = support; royal blue #0000FF is *not* lead. Columns before the first date (Weeks 0–3) are dated by inference and flagged unverified. Year is inferred (nearest to today). | Sheets API v4 `spreadsheets.get?includeGridData` with fields limited to `formattedValue` + `effectiveFormat.backgroundColor`, from the browser with a **user-owned, referrer-restricted API key** stored only on the device. CSV/gviz can't be used: they drop colours. | Supabase Edge Function on a schedule, using a Google **service account** the sheet is shared with (no key on devices), storing snapshots + diffs. |
| **Schedule** (`hub.gertcrev.com/admin/group-chat/my-schedule?week=YYYY-MM-DD`) | Behind your login. Not reachable from the build environment (network policy) and must not be scraped with stored credentials. Page structure **not yet seen**. | **Paste import** from your logged-in browser: tolerant parser (day headers, time ranges, subject on same/next line, room/online), review screen, then merge. Also CSV/.ics. | Ask the hub owner for (in order): an **.ics feed per instructor**, a JSON API/token, or a CSV export. Fallback: a bookmarklet that reads the page *in your own session* and hands the data to Ace. |
| **Evaluations** (`hub.gertcrev.com/admin/evaluations?...`) | Behind login; structure not yet seen. | Paste import → review/edit → save. Emails & long IDs masked; no student names stored. | Same options as schedule. |
| **Messenger group chat** | Out of scope (you monitor it). | — | — |

**Confirmed rules (user, Nov 6):**
- Wednesday deadlines are **8:00 PM**.
- **Only lead instructors create handouts.** The handout is due the **Wednesday before** the teaching week.
- The lead also submits the **exam by the Wednesday of the teaching week**, 8 PM.
- Lead instructors teach **online**; support weeks are mostly **in person**.
- Sheet rows 1–5 are the **partner slots** teaching that week (shown as “Slot n”).
- Lead PowerPoint finalized 7 days before the week (earlier statement).
- Further lead duties are not invented; add confirmed ones in Work.

## 3. Architecture (MVP → target)

**MVP (this code):** static, local-first PWA. No build, no dependencies, no server.
- `js/engine.js`: pure domain logic: Manila calendar math, readiness, handout cycles, assessment planning,
  unified planner, schedule/unit/assignment merges, freshness, evaluation analysis, journey.
- `js/sources.js`: adapters: CSV, ICS, schedule paste, evaluation paste, colour-grid parser (used to build screenshot imports).
- `js/app.js`: UI (5 tabs) + localStorage persistence + in-app reminders.
- `sw.js`: offline app shell; never caches API responses.

Why: it delivers real value today without inventing an unverified backend contract for the hub, and keeps
evaluation data on your device.

**Target (Phase 2):** Supabase (Postgres + Auth + RLS + Edge Functions + cron) ↔ Ace web (Vercel, behind
Cloudflare) ↔ **Web Push** (iOS 16.4+ supports push for Home-Screen PWAs) and later a native SwiftUI shell
(Xcode) if widgets/Live Activities are wanted. Server jobs: sheet sync every 30–60 min, daily plan digest at
06:30 Manila, deadline reminders. The engine is pure JS so it can run in Edge Functions (Deno) unchanged.
A separate Supabase project from Power.

## 4. Data model (local today; maps 1:1 to Postgres tables)

- `identity` (name, initials, email) · `cfg` (rules, buffers, templates)
- `sources{schedule|sheet|evals}`: url, lastOk, lastTry, error, warnings → **sync_runs** table later
- `units[]`: sheet weeks: key `YYYY-MM-DD|track`, weekStart, week, track, topic, detail, instructors, coInstructors, role (lead|support), color, colorClass, verified, reasons, cell, source{id,at}
- `unitHistory[]`: added / changed(fields, from, to) / removed
- `sessions[]`: id, externalId?, subject, section, start, end (epoch ms; Manila semantics), format, location, platform, status (scheduled|cancelled|missing), template?, source{id,name,method,at}
- `changes[]`: schedule diffs (added/changed/cancelled/missing), `seen`
- `readiness{itemId → {readinessItem → confirmedAt}}`: evidence = your confirmation timestamp
- `arrivals{sessionId → {at, status, manual}}`
- `handouts{ho:<wed>:<subject> → {stages{}, submittedAt, cutoffAt, evidence, confirmedBy}}`
- `assessments[]`: title, kind, subject, due, dueVerified, effortH, stages{}, revision{note,due,doneAt}
- `duties[]`: confirmed lead responsibilities
- `evals[]`: period, date, overall, criteria{}, comments[] (masked), source · `practices[]`: adopted strategies + applied timestamps

**Provenance labels in UI:** *Hub · 2h ago* / *Sheet · 2h ago* (verified live), *Cached* (stale > 24 h or failed),
*You entered*, *Unverified* (ambiguous sheet cell, unverified due date or cutoff).

## 5. Readiness & planning rules

- Readiness % = confirmed items ÷ items in the class template. Each item has a lead time (hours before class) and effort.
- Lead week: `slides_draft` due 9 days before the week, `slides_final` **official** 7 days before (cfg).
- Support week: no slide authoring; starts with “Lead's slides received”.
- Real hub classes inherit role/template from the matching sheet week (same week + topic), and progress carries over.
- Planner score: urgency `100·e^(−h/24)` (overdue ⇒ 120+), ×1.3 official deadline, ×1.4 class within 24 h; blocked
  tasks (dependency not done) never surface; today's list is capped by daily prep minutes (overdue/official-in-24h always shown).
