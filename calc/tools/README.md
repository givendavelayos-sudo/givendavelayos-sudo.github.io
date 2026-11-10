# Tools for matching the Canon F-789SGA emulator

Not part of the app (the service worker never caches this folder). Windows only.

| File | What it does |
|---|---|
| `emu.ps1` | Drives the "Canon F-789SGA Emulator" window: `press <keys>` clicks keys by name, `lcd <out.png>` copies the LCD (Ctrl+C in the emulator, 213×80 px), `shot <out.png>` screenshots the window. Key names: `shift alpha mode on apps conv up down left right calc inv integ eng frac sqrt pow sq log ln neg dms hyp sin cos tan rcl abs lp rp sd mplus 0-9 del ac mul div add sub dot exp ans eq` (same names as SciCalc's key ids). |
| `run.ps1` | `run.ps1 "name=keys; name=keys"`: presses each step and saves the LCD to `emu\<name>.png`. |
| `sheet.ps1` | Puts several captures side by side in one PNG for viewing. |
| `lt.py` | Reads a capture as a 105×32 dot grid (dot (i, j) = pixel (1+2i, 14+2j)) plus the 1-px icon strip. |
| `build.py` | Builds `../lcddata.js` (fonts, menu screens, icons, C-VALUE/CONVT pages) from the captures in `emu\`. The capture names it expects are listed in the script. |
| `tests.json` | Key sequences of the reference screens (start from a reset calculator). |
| `harness.js`, `smoke.js` | Browser checks. Put `emu.json` (`{tests, emu, icons}`, made from the captures with `lt.py`) in this folder, open `/calc/`, then in the console: `H = await import('./tools/harness.js'); H.summary()` (dot-for-dot diff of every screen), `H.diff('t06')`, `H.icons()`; `M = await import('./tools/smoke.js'); M.run(); M.sheet()`. |

The emulator captures themselves are not kept in the repo; re-run `run.ps1` with the sequences in `tests.json` to make them again. Needs Python with Pillow (`pip install --target <dir> pillow`).
