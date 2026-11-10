# Handoff: SciCalc 789 (F-789SGA-style calculator web app)

Paste this file (or point the new session at it) to continue the work in a desktop session.

## Goal
The user wants a phone web app (installable to the Home Screen) that looks, feels and works
as close as possible to their **Canon F-789SGA** scientific calculator. (They first wrote
"F-789DGA"; that model doesn't exist, it's the F-789SGA.) The user has a **calculator emulator
on their laptop** to use as the reference for exact behaviour and screens. Its name isn't known
yet; ask.

## Where things are
- Repo: `givendavelayos-sudo/givendavelayos-sudo.github.io` (GitHub Pages site)
- Branch: `claude/epic-darwin-o06w5b`. **Not merged yet.** The calculator goes live at
  `https://givendavelayos-sudo.github.io/calc/` only after it's merged to the default branch.
- The rest of the repo is the user's separate budget app **"Power"**: built output only (Vite +
  vite-plugin-pwa); its source code is not in this repo. Don't touch its files except `sw.js` (see below).

## Files (all in `calc/`, plain HTML/CSS/JS, no build step)
| File | What it does |
|---|---|
| `index.html` | Page shell: solar strip, brand row, LCD, keypad container |
| `style.css` | Silver body, LCD, keys, textbook-math rendering (fractions, roots, powers) |
| `engine.js` | Math engine: token model, parser, evaluator, formatting, stats, solver, matrices, vectors, constants (44), conversions (46) |
| `app.js` | UI: screens/menus stack, editor and cursor, key layout and labels, modes, saving to localStorage |
| `sw.js` | Offline cache, scope `/calc/`. **Bump `VERSION` and the `?v=` numbers when files change** |
| `manifest.webmanifest` | Separate installable app (`id`/`scope` `/calc/`) |
| `icon.svg`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` | Icons (PNGs rendered from the SVG with Playwright) |

Root `sw.js` (Power's offline worker) was patched with
`denylist:[/^\/calc\//]` on its NavigationRoute so Power doesn't serve its own page at `/calc/`.
**Power's next build will overwrite this.** The permanent fix is in Power's source:
`workbox: { navigateFallbackDenylist: [/^\/calc\//] }` in its vite-plugin-pwa config.

## How it works (short)
- An expression is an array of tokens. Fractions, roots, powers, ∫, d/dx, Σ, log_a b, Abs and
  mixed fractions are **templates** made of structural tokens (e.g. `F<`, `F|`, `F>`). The same
  tokens draw as textbook (Math mode) or one-line (Line mode). The cursor is a token index.
- `engine.parse()` → AST → `engine.evaluate(ast, ctx)`. Values: number, complex `{re,im}`,
  `{mat}`, `{vec}`. Errors throw `CalcError` ("Math ERROR", "Syntax ERROR", "Dimension ERROR", ...).
- Results in Math mode try exact forms first (fraction, a√b/c, nπ/d); F↔D toggles decimal.
- Display rules: 10 significant digits, Norm 1/2, Fix 0–9, Sci 0–9, ENG/◂ENG, DMS.
- Screens are a stack (`ui.stack`): calc screen at the bottom, with menus, prompts and grid editors on top.
- Modes: COMP, CMPLX, STAT (8 regression types), BASE-N, EQN (2/3 unknowns, quadratic, cubic),
  MATRIX (up to 4×4), TABLE (≤30 rows), VECTOR (2D/3D).
- Key layout matches the user's photo of the real calculator: gold = Shift, blue = Alpha,
  green = BASE-N. Examples: Abs has its own key, PFact = Shift+°′″, CONVT = conversions, C-VALUE
  (Shift+CONVT) = constants, DEC/HEX/BIN/OCT on fraction/√/x^/x², log_a b = Alpha+log, i = Alpha+ENG.
- Branding: "SciCalc" / "SC-789SGA" is used where the Canon logo and model name are. Keep the Canon trademark off.

## Verified so far
Playwright test (Pixel 7 viewport, served with `python3 -m http.server` from the repo root)
covered fractions, trig, roots, powers, ∫, d/dx, Σ, Pol, nCr, errors, STO/RCL, SOLVE, every mode,
the menus and PFact. No page errors.

## Known gaps vs the real calculator
- Canon's manual and site were blocked from the cloud session, so menu wording, some key
  sequences, error texts and display rules are best guesses. Unknown labels on the real keys:
  Alpha `:` on x⁻¹, `L` on ∫, `◂Blk` on ln. These are not implemented.
- 44 of Canon's 79 constants and 46 of its 172 conversions.
- The LCD is drawn with a smooth font, not the real dot-matrix.
- No multi-statement (`:`), no contrast setting, no auto power-off, no key sound.
- Removed when the layout was matched: SHIFT shortcuts for Σ and ≈ (Σ is still in Apps).

## Next steps (agreed with the user)
1. Find out which emulator the user has. Use it as the reference: compare its screens with ours
   (screenshots, or computer use on the laptop if available).
2. Run the side-by-side **test list** below in the emulator and fix every difference
   (wording, layout, rounding, which form the answer shows).
3. **Pixel LCD**: draw the screen as a dot-matrix grid (about 96×31) with a pixel font and
   fixed-position indicator symbols. This is the biggest visual gain left.
4. Feel: key-click sound, vibration (already present, 8 ms), contrast in SET-UP, auto power-off.
5. Get the official manual: E-IE-522, `ij.manual.canon/cal/webmanual/WebPortal/pdf/F-789SGA%20(ASA)_E-IE-522.pdf`.
   Use it to fill in the missing constants and conversions and the exact menu text.
6. After changes: bump `calc/sw.js` VERSION and the `?v=` numbers in `index.html` and `sw.js`, then commit and push to
   the branch. The user merges, then opens `/calc/` on their phone and taps "Add to Home screen".

## Test list (run in the emulator, press AC first, default Setup)
1. `1 ÷ 3 =` then F↔D
2. `0.1234 =`
3. `√8 =`
4. `sin 30 =`
5. `π ÷ 3 =`
6. `2 x^ 100 =`
7. `123456789 × 1000 =`
8. `0.001 =`
9. `1 + =` (error screen)
10. `1 ÷ 0 =`
11. `360 =` then Shift+°′″ (PFact)
12. `1 °′″ 30 °′″ =`
13. `5 Shift× 2 =` (nPr)
14. `Shift+ Pol( 3 , 4 ) =`
15. MODE screen (all pages)
16. Shift+MODE (SET-UP), all pages
17. Apps menu in COMP, all pages
18. CONVT, first page
19. Shift+CONVT (C-VALUE), first page
20. STAT: type list, then the data screen with x = 1, 2, 3
21. EQN: type list
22. EQN quadratic with a=1, b=−3, c=2: the result screens
23. MATRIX: first screen
24. TABLE: the f(X)= screen and the table for X² from 1 to 5
25. BASE-N: `12 =` in DEC, then HEX
26. CMPLX: `2 + 3i =`
27. Shift pressed (the "S" symbol)
28. Shift+9 (CLR)
29. Shift+CA (OFF), then ON
30. A fraction part-way through typing

## Local testing
```
cd <repo> && python3 -m http.server 8765
# open http://localhost:8765/calc/ (use a phone-size window). The laptop keyboard works too:
# digits, + - * / ( ) ^, Enter, Backspace, Esc, arrows
```
