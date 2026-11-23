---
name: verify
description: Build, run and drive Strike Alley (Vite + React + Canvas 2D bowling game) to visually verify renderer/gameplay changes with headless Chrome screenshots.
---

# Verifying Strike Alley

## Build / launch

- `npm run build` — catches syntax/import errors fast (Vite, ~3s).
- `npm run dev` (background) — serves on 5173, or **5174+ if the user's own
  dev server already holds 5173** (check the Vite banner for the real port).

## Screenshot (static, aiming view)

```
chrome --headless=new --disable-gpu --window-size=600,960 \
  --virtual-time-budget=6000 --screenshot=out.png http://localhost:<port>/
```

Chrome lives at `C:/Program Files/Google/Chrome/Application/chrome.exe`.
The game boots straight into the AIMING phase — one screenshot needs no input.

## Drive a full throw (CDP)

No Playwright/puppeteer in the repo. Launch Chrome headless with
`--remote-debugging-port=9223 --user-data-dir=<scratch>/profile <url>` in the
background, then run `scratchpad/drive.mjs`-style Node 22 script (global
WebSocket + fetch): find the page target via `http://127.0.0.1:9223/json`,
send `Input.dispatchMouseEvent` clicks and `Page.captureScreenshot`.

Input model (`src/game/game.js`): **tap 1** (pointerdown+up on the canvas,
<~few px movement) AIMING → POWER; **tap 2** launches. Camera dollies 0→920
during the roll (~2s to impact, result banner ~1s later, then RETURNING).
Good capture points: 0ms (aiming), after tap 1 (power), +900ms after tap 2
(mid-roll dolly), +1800ms (impact), +4s (result banner).

Drag-to-aim: pointerdown, several pointermoves with horizontal dx, pointerup.

## Perf check

CDP `Runtime.evaluate` a promise that records 180 RAF deltas and returns
median/p95. Headless `--disable-gpu` is CPU/SwiftShader rendering — expect
~19–22ms median there; real hardware with GPU canvas is far faster. Compare
against a `git stash -u` baseline (Vite HMR reloads automatically), then
`git stash pop`.

## Gotchas

- Renderer is `src/game/render.js`; scene light rig `src/game/lights.js`;
  reusable glow/shadow helpers `src/game/glow.js`. No `ctx.shadowBlur`
  anywhere by design — keep it that way (it was the perf hog).
- The pin sprite (`pinSprite.js`) is baked once per session — lighting
  changes to it need a full page reload, not just HMR of render.js.
