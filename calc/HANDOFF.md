# Handoff: SciCalc 789 (F-789SGA-style calculator web app)

Paste this file (or point the new session at it) to continue the work.

## Goal
A phone web app (installable to the Home Screen) that looks, feels and works as close as possible
to the user's **Canon F-789SGA** scientific calculator. The reference is the **official Canon
F-789SGA Emulator** on the user's Windows laptop (Desktop shortcut "Canon F-789SGA Emulator";
folder `Desktop\GERTC\Canon-Emulator-Recovery\clean-recovery-test\Canon_F-789SGA\`, which also
holds the official calculator manual PDF, `Calculator_Manual\F-789SGA Calculator manual.pdf`).

## Where things are
- Repo: `givendavelayos-sudo/givendavelayos-sudo.github.io` (GitHub Pages), branch
  `claude/epic-darwin-o06w5b`. **Not merged yet**; goes live at `/calc/` after merging.
- The rest of the repo is the user's separate budget app **"Power"** (built output only). Don't
  touch its files except root `sw.js` (patched with `denylist:[/^\/calc\//]`; Power's next build
  overwrites it; permanent fix: `workbox: { navigateFallbackDenylist: [/^\/calc\//] }` in Power's source).

## Files (all in `calc/`, plain HTML/CSS/JS, no build step)
| File | What it does |
|---|---|
| `index.html`, `style.css` | Silver body, keypad, `<canvas id="lcd">` |
| `lcd.js` | Dot-matrix LCD: 105×32 dot buffer, 4 fonts, textbook-math layout boxes (fraction, roots, powers, Σ/∏, ∫, d/dx, log_a b, Abs, growing brackets, cursor), CONVT/C-VALUE picker drawing, canvas painter with indicator icons |
| `lcddata.js` | **Generated** by `tools/build.py` from emulator captures: big 5×9 font, small 5×6 font, number font, menu screens (exact bitmaps), icons, constant/unit pages |
| `engine.js` | Math engine: tokens, parser, evaluator, formatting, stats, solver, matrices, vectors, 79 constants (Canon order, CODATA 2010), CONVT (8 categories, 36 units, all 172 pairs, Canon's measured factors) |
| `app.js` | Screens (stack), editor, key layout, modes, menus, grids; `window.__sc` test hook (`reset()`, `keys('1 div 3 eq')`, `dump()`) |
| `sw.js` | Offline cache, scope `/calc/`. **Bump `VERSION` and the `?v=` numbers when files change** (now v3) |
| `tools/` | Emulator automation + data builder + browser test harness (see `tools/README.md`) |

## How it matches the real calculator
- LCD geometry, fonts and layout rules were measured on the emulator (its Ctrl+C copies the LCD
  as a 213×80 bitmap; dots are 2×2 px). Text uses 6-dot cells from column 6; input at the top,
  result right-aligned with its bottom at row 29.
- Menus are the emulator's own screens. Apps per mode: COMP `∏ Σ Max Min Q…r Mod LCM GCD`;
  CPLX `▶r∠θ ▶a+bi Arg Conjg Real Imag`; BASE (2 pages) logic + d/h/b/o; MATX (2 pages);
  VCTR; STAT `Type Data Edit S-SUM S-VAR S-PTS Distr (Reg)` with sub-menus.
- hyp opens a menu; SET-UP has 2 pages (Fix/Sci/Norm prompts, Complex Result?, Frequency?,
  Decimal Point?, CONTRAST); Shift+9 = Clear? Setup/Memory/All → confirm → "Complete!".
- The fraction key takes the number just typed as its numerator; in CMPLX, ENG types i and
  Shift+(−) types ∠; ▶r∠θ converts the whole expression; Line mode shows decimals unless the
  input had a fraction; EQN has 2/3/4 unknowns + quadratic/cubic/quartic.
- Also added: blinking cursor, 7-minute auto power-off, contrast, optional key click (the small
  dot next to the model name).

## Verified
Browser harness replays 81 emulator key sequences and compares dots: **80/81 identical** (the one
left is `Rand`, which is random). Status icons match. 48 extra feature sequences (∫, d/dx, Σ, ∏,
SOLVE, CALC, STO/RCL, M+, matrices, vectors, STAT, EQN, TABLE, BASE-N, CMPLX, CONVT, C-VALUE,
setup changes, OFF/ON, scrolling, history) run without errors with correct results.

## Known gaps
- STAT `Distr` menu (P( Q( R( ▶t) and the 1-variable extras med/mode/Q1/Q3/R are shown but not
  calculated; BASE-N d/h/b/o prefixes do nothing; multi-statements (`:`) are not executed.
- Glyphs never seen on the emulator (some lowercase letters in the big font, bold hex A/B/D/E/F)
  are drawn by hand in the same style; ∫ alone, nth roots, log_a b were matched by rule, not
  against a capture of every case.
- Indicator icon set shown while typing in grid editors follows the emulator only roughly.

## Next steps
1. Merge the branch, open `/calc/` on the phone, "Add to Home screen".
2. Fill the gaps above (capture each case in the emulator first with `tools/run.ps1`).
3. After changes: bump `calc/sw.js` VERSION and the `?v=` numbers, re-run `tools/harness.js`.
