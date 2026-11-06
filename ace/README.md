# Ace — Instructor Excellence

A personal, iPhone-first assistant that answers one question every morning:
**“What is the most important thing I should work on next to be fully prepared and professionally reliable?”**

Ace is a separate product from **Power** (the budget app in this repository's root). It borrows Power's design
language (deep-green palette, elevated cards, gradient hero card, glass tab bar, bottom sheets) and shares
**no code, data, storage or deployment** with it.

## What it does today (v0.1, MVP)

| Area | Status |
|---|---|
| **Lead-instructor sheet sync** (Google Sheets API v4, read-only, reads cell colours) | ✅ Neon-blue cell with your initials → **Lead**; any other colour → **Support**. History of changes (e.g. support → lead). |
| **Lead PowerPoint deadline** | ✅ Finalized 7 days before the teaching week (your stated rule, configurable), draft target 9 days before. |
| **Wednesday handouts** | ✅ Lead weeks only (confirmed). Due the Wednesday *before* the teaching week at 8 PM (confirmed); 7 tracked stages; Mon/Tue *suggested* milestones; **ready ≠ submitted**; submission only on your confirmation (with time + optional evidence); holiday flags; moved/skipped cutoffs. |
| **Class schedule (hub)** | ✅ Paste your hub “My Schedule” week (or import CSV/.ics) → review → merge with change detection: added / moved / cancelled / *missing (unconfirmed)*; no duplicates; Asia/Manila. |
| **Lecture readiness** | ✅ 5 dimensions (materials, accuracy, mastery, delivery, logistics), templates for in-person / online (OBS, mic, platform) / review / lead week / support week. Score = confirmed items ÷ template items. Unconfirmed is shown as unconfirmed, never as done. |
| **Planner** | ✅ One ranked list across readiness, handouts, lead PowerPoints, assessments and your confirmed lead duties: official deadlines, suggested targets, effort, dependencies, daily capacity. |
| **Assessments & exams** | ✅ **Lead weeks automatically get an exam due that week's Wednesday, 8 PM** (confirmed). Plus manual ones: 7-stage workflow, backward-planned “start by” date from effort + capacity, revision requests, verified/unverified due dates. |
| **Punctuality** | ✅ Leave-by / be-online-by times, “I'm here” arrival logging (early / on time / late), conflict & tight-transition warnings. |
| **Evaluations** | ✅ Paste from the hub (or enter manually) → review → save. Criterion trends, weakest areas, **confirmed scores separated from keyword “interpretation”**, development plan you can adopt and track. Emails/ID numbers masked. |
| **Excellence Journey** | ✅ 8 dimensions; **leading** indicators from your own logs vs **outcome** evaluation scores; “no data yet” instead of assumptions. |
| **Settings** | ✅ Power-style settings with search: appearance & colours, Home cards, privacy, teaching rules, app lock (PIN + Face ID), reminders per type, calendar export, merge import, backup. |
| **Alerts (bell)** | ✅ Changes, deadlines due soon, open prep, sync problems and items that need your review. |
| **Reminders** | ⚠️ While the app is open/recently opened. Reliable background push = Phase 2 (server). |
| **Freshness** | ✅ Every synced source shows *Verified x ago*, *Cached — may be outdated* (> 24 h), or *Last sync failed*. |

## Run, test, deploy

```bash
cd ace
npm test                 # 31 unit tests; runs with TZ=America/New_York to prove Manila handling
npm run serve            # http://localhost:5180
```

No build step and no dependencies. **Deploy `ace/` as its own site**, *not* from this repository's GitHub Pages
root: that root is Power, and Power's service worker controls every path on its domain.

**Vercel:** New Project → import this repo → *Root Directory* = `ace` → Framework “Other” → no build command.
Add a custom domain via Cloudflare DNS (e.g. `ace.<your-domain>`). Then on iPhone: Safari → Share → *Add to Home Screen*.

## First-time setup (on your phone)

1. **Sources → You:** name; initials `GDL` (already set).
2. **Sources → Lead instructor sheet:** link is pre-filled. Create a Google API key:
   Google Cloud Console → *APIs & Services* → enable **Google Sheets API** → *Credentials* → *Create API key* →
   restrict to **Sheets API** and to your Ace domain (HTTP referrer). Paste it in Ace; it is stored only on the device.
   The sheet must be shared as **Anyone with the link → Viewer**. Tap **Sync now**.
3. **Sources → Class schedule:** tap *This week*, sign in to the hub, select all, copy, back in Ace tap **Paste schedule**.
4. **Sources → Rules:** check buffers and travel time (cutoffs, handout and exam rules are already set from your answers).
5. **Growth:** paste your evaluation results.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for decisions and [`docs/PROGRESS.md`](docs/PROGRESS.md) for handoff notes.
