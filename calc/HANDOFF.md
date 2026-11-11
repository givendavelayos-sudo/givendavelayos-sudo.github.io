# Handoff: SciCalc 789 (F-789SGA-style calculator web app)

Paste this file (or point the new session at it) to continue the work.

## Goal
A phone web app (installable to the Home Screen) that looks, feels and works as close as possible
to the user's **Canon F-789SGA** scientific calculator. The reference is the **official Canon
F-789SGA Emulator** on the user's Windows laptop (Desktop shortcut "Canon F-789SGA Emulator";
folder `Desktop\GERTC\Canon-Emulator-Recovery\clean-recovery-test\Canon_F-789SGA\`, which also
holds the official calculator manual PDF, `Calculator_Manual\F-789SGA Calculator manual.pdf`).

## Where things are
- **Live:
  https://scicalc-789.netlify.app** (Netlify site `scicalc-789`, team "Team GDL", site id
  `d4504a60-0fe8-4920-a443-b883ccab2ba9`; visitor sign-in and the Netlify badge are turned off
  for this site). Deploy: copy the app files (not `tools/`, not this file) into a folder, change the
  manifest `id`/`start_url`/`scope` to `/`, add `netlify.toml` (no-cache headers), then
  `npx netlify-cli deploy --prod --dir <folder> --site d4504a60-0fe8-4920-a443-b883ccab2ba9 --no-build`
  (in PowerShell use `npx.cmd`; this laptop is already signed in to Netlify).
- Source: this folder, kept on branch `claude/epic-darwin-o06w5b` of
  `givendavelayos-sudo/givendavelayos-sudo.github.io`. Don't rely on `main`/`/calc/` there:
  every release of the user's budget app "Power" replaces that repo's files and deletes `calc/`.

## Files (all in `calc/`, plain HTML/CSS/JS, no build step)
| File | What it does |
|---|---|
| `index.html`, `style.css` | Silver body, keypad, `<canvas id="lcd">` |
| `lcd.js` | Dot-matrix LCD: 105×32 dot buffer, 4 fonts, textbook-math layout boxes (fraction, roots, powers, Σ/∏, ∫, d/dx, log_a b, Abs, growing brackets, cursor), CONVT/C-VALUE picker drawing, canvas painter with indicator icons |
| `lcddata.js` | **Generated** by `tools/build.py` from emulator captures: big 5×9 font, small 5×6 font, number font, menu screens (exact bitmaps), icons, constant/unit pages |
| `engine.js` | Math engine: tokens, parser, evaluator, formatting, stats, solver, matrices, vectors, 79 constants (Canon order, CODATA 2010), CONVT (8 categories, 36 units, all 172 pairs, Canon's measured factors) |
| `app.js` | Screens (stack), editor, key layout, modes, menus, grids; `window.__sc` test hook (`reset()`, `keys('1 div 3 eq')`, `dump()`) |
| `sw.js` | Offline cache, scope `/calc/`. **Bump `VERSION` and the `?v=` numbers when files change** (now v17) |
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
- Mixed fractions while typing (1 1/2 + 1/3): the input line is a few columns off the emulator (tests cp_mixed, cp_mixsd).
- x̄ typed into the STAT editor line is drawn a few dots differently (test as6).
- Scrolling a long PFact result with ▶ is not implemented (the ▶ mark is shown).
- Not checked: Stack ERROR, Time Out, auto power-off timing. Alpha+∫ (L) is a label only.
- CMPLX: the ∫ key types ∠ (with or without Shift), confirmed on the emulator.

## Verified (latest)
`tools/harness.js` replays 945 emulator key sequences (all modes, memories, CA, SOLVE/CALC, replay, display
formats, constants, **all 172 CONVT unit pairs**, STAT, EQN, matrices, multi-statements, Insert mode):
942/945 identical dot for dot.
Conversions: each unit has a size in SI (the short constants Canon uses, e.g. acre = 4046.856 m²) and a result is
x·size(from)/size(to); a fraction is shown when it fits in 10 places (improper ones are counted as a mixed number).
Capture hands-off with `tools/emu2.ps1 "name=keys; ..."` (posts clicks to the emulator's key buttons and reads the
LCD with PrintWindow: no mouse, focus or clipboard; window must not be minimized). **Never reuse a capture name**
(file names are case-insensitive; build.py reads n1–n25 etc.).

## Next steps
1. Merge the branch, open `/calc/` on the phone, "Add to Home screen".
2. Fill the gaps above (capture each case in the emulator first with `tools/run.ps1`).
3. After changes: bump `calc/sw.js` VERSION and the `?v=` numbers, re-run `tools/harness.js`.
