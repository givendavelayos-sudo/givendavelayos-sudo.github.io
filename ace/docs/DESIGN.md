# Ace v0.7 — UX audit, strategy and GERTC design tokens

## Phase 1 · Audit (v0.6.6, real data, iPhone 13, measured in the rendered app)
| Area | Evidence | Problem |
|---|---|---|
| Schedule | 1,835 px tall, 64 visible buttons | Week grid, day panel, month calendar and toolbar stacked; two views of the same week compete |
| Today | 2 cards; next-class card duplicates Schedule's | A whole tab with nothing of its own since reminders were removed |
| Alerts | badge "4" — all 4 are data questions | Badge signals urgency that doesn't exist; real urgency gets lost |
| Class sheet | 1,140 px, 12 flat checklist items | No link to that week's handout / PowerPoint / draft; long undifferentiated list |
| Visual | Power's green gradients, free accent picker, AMOLED | Not GERTC; several competing accents |
| Settings | "Home screen" card reorder for 4 cards | Customisation of a layout that should simply be right |

Must stay unchanged: all data and imports (screenshots, sealed evaluation), deadline rules (lead: handout Wed before ·
PowerPoint Sat 11:59 PM · Sunday mastery; every teaching week: draft Wed 8 PM), "not assigned to me", PIN lock,
reminders, calendar ticking, backups, migrations.

## Phase 2 · Strategy
- **Navigation: 3 tabs** — **Week** (home: next class · most pressing deadline · week/month) · **Tasks** · **Performance**;
  Settings (gear) and Alerts (bell) in the header. Old links (#home, #today, #schedule, …) still work.
- **Week (home)** answers: *What am I teaching next?* (next-class card: topic, time, section, room, Prepare) ·
  *What must I do soon?* (one row, only if due within 3 days) · *Am I prepared?* (prep status on the card when enabled;
  the Prepare sheet always shows it). Week ⇄ Month toggle instead of stacking both.
- **Lecture sheet** (Prepare / tap a class): class facts → *This week's work* (handout, PowerPoint, draft for that
  topic-week, with status, tap through) → prep checklist grouped and collapsible → arrival → notes.
- **Alerts**: badge counts only *urgent* items (overdue, due < 24 h, leave-by, failed sync). Data questions live in
  "For your review" without a badge.
- **Removed/consolidated**: Today tab (merged into Week), Home-card reordering, accent picker and AMOLED theme
  (brand consistency; saved choices map to System/Dark), stacked calendar+grid, gradients.

## GERTC design tokens (verified from https://www.gertcrev.com/ CSS, Nov 7, 2026)
Values from the site's final `:root` cascade and `theme-color`:

| Token | Value | GERTC usage → Ace usage |
|---|---|---|
| `--gertc-navy` | `#0d1a38` | headings, primary buttons, dark sections → primary, next-class card |
| `--gertc-deep` | `#0a1428` | `theme-color`, darkest surface → dark-mode background |
| `--gertc-navy-2` | `#16294f` | navy hover → pressed states, class blocks |
| `--gertc-deep-2` | `#13234a` / `#1b2f5c` | raised dark surfaces → dark-mode cards |
| `--gertc-yellow` | `#ffc400` | the single accent (highlights, yellow buttons, focus) → teaching days, lead, focus ring, dark-mode primary |
| `--gertc-yellow-2` | `#ffd84d` | yellow hover |
| `--gertc-gold-text` | `#8a6200` | yellow text on white (contrast) → "Lead" text, eyebrow on light |
| `--gertc-ink` | `#1b2437` | body text |
| `--gertc-muted` | `#4b5568` | secondary text |
| `--gertc-paper` | `#f4f6fa` | page background |
| `--gertc-line` | `#dde3ee` | borders |
| logo blue | `#35499f` | sampled from `images/gertc-logo-blue.png` (not used as UI colour) |
| Display font | Montserrat 600–800 | headings, numbers, labels |
| Body font | Mulish 400–700 | text |

Status colours (not brand, used only for meaning): success `#1f8a4c` / dark `#4cc38a`, danger `#c0392b` / dark `#ff6b5e`
(GERTC's own error red), warning uses gold text on soft yellow.

Rules: one accent (yellow) · navy for primary actions · no gradients · radius 10 (controls) / 14 (rows) / 18 (cards) ·
spacing 4·8·12·16·20·24 · shadows subtle (`0 1px 2px` + `0 8px 24px -16px`).

## Phase 4 · Validation (v0.7.0, rendered app, iPhone 13, light + dark, Nov 7 2026 with real data)
- 37 unit tests; end-to-end: v0.7 suite 32/32 (navigation, brand tokens computed in the page, Week answers, Prepare
  sheet, Week ⇄ Month, alerts urgency, Tasks dates, sealed evaluation, Settings, dark mode, overflow, v0.6.6 upgrade),
  calendar 15/15, sealed evaluation 8/8, update bar 3/3. No console errors.
- Measured after: Week tab replaces Today + Schedule; bell badge 0 with nothing urgent (was 4); Week and Month no longer
  stacked; class sheet groups 12 items into 5 collapsible groups with that week's deliverables on top.
- Retired suites (covered by the v0.7 suite): Today/Home, accent picker, Home-card order, old Schedule layout.
