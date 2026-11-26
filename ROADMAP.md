# GameDeck roadmap

Open work, in the order we plan to tackle it. Update this file whenever an item is done or a new one is agreed.
_Last updated: 2026-11-26._

## Done so far
- Monorepo `GameDeck` with the 5 games, rebranded from the HSBC event to **Zeal Interactive** (shared `packages/brand`).
- Games renamed: Royal Ninja → **Slice Frenzy**, Royal Chase → **Lane Dash**, Royal Alley → **Strike Alley**.
- **Server** (`server/`): Express 5 + MySQL, decks, one-time play tokens, max-score checks, per-deck leaderboards, admin login. `npm test` passes.
- **Dashboard** (`web/` → `/admin`): login, create/edit/pause/delete decks, copy share link, view and delete scores.
- **Player site** (`/d/<code>`): nickname, game list, leaderboards.
- **Game SDK** (`packages/game-sdk`): all 5 games submit scores to GameDeck and return to the leaderboard. Verified end to end for Picture Perfect and Zip to Victory.
- One command for local dev: `npm run setup` once, then `npm run dev`, then open http://localhost:5173.

## 1. Proper in-game controls for every game (next up)
Each game should have the same independent set of controls, built into the game itself (not the platform):
- **Menu / pause button** always visible during play (top corner), opening a pause menu with:
  - **Resume**
  - **Restart** (start the round again)
  - **Sound on/off** (remembered on the device)
  - **How to play** (the rules, readable mid-game)
  - **Quit** (back to the deck's game list `/d/<code>`)
- Pausing must actually freeze the game (timers, physics, spawns).
- Same look in every game (Zeal brand), same icon and position, so players learn it once.

What exists today (starting point):
| Game | Today |
|---|---|
| Slice Frenzy | Most complete: pause overlay with resume / restart / sound / menu. Use as the reference. |
| Lane Dash | Pause / resume; restart only in practice mode; rules only on the start screen. |
| Strike Alley | Only a mute button; restart only at game over in practice mode. |
| Zip to Victory | Undo only; no pause or restart. |
| Picture Perfect | No in-game controls; rules only on the start screen. |

**Decision needed:** in a real (scored) play, should **Restart** be allowed? One play token gets one score, so restarting just replays before the score is sent, but it does let a player retry until they get a good run. Options: allow it, allow it only before the first point is scored, or hide it in scored plays.

## 2. Owner's review of every game (you)
You'll go through each game personally and change rules, tuning, difficulty, scoring and copy as needed. Afterwards:
- Set realistic **max score caps** for Slice Frenzy and Lane Dash (currently uncapped) and recheck the others: `server/schema.sql`, then `npm run db:init`.
- Update each game's "How to play" and scoring text to match the new rules.
- Optional: re-theme Lane Dash's Udaipur palace art and Slice Frenzy's Rajasthani sweets if they should look less event-specific.
- Picture Perfect: add or replace questions (`src/data/questions.js` + photos in `public/questions/`). The current photos come from zealinteractive.in and some show client brands (Adani, BookMyShow).

## 3. Deploy to cPanel
- Root `npm run build` that builds `web/` and all 5 games.
- Server serves `web/dist` (with SPA fallback for `/admin` and `/d/...`) and each game's `dist` under `/games/<slug>/`, so everything runs on one domain. Remove the temporary "API is running" text at `/`.
- cPanel setup: create the MySQL database + user, create the Node.js app (startup file `server/server.js`), set env vars (`DB_*`, `ADMIN_PASSWORD`, `ADMIN_TOKEN_SECRET`), run `npm install` and `npm run db:init`, point the domain or subdomain, and enable HTTPS.
- Check on the server: Node version (≥ 18), MySQL vs MariaDB, server time zone (deck close times are stored as server-local `DATETIME`).
- Upload approach to decide: git pull on the server vs uploading a built zip.

## 4. Hardening before sharing publicly
- Rate limiting on public routes (start play, submit score) and on admin login.
- Strong admin password, and rotate `ADMIN_TOKEN_SECRET` for production.
- Optional nickname filter (blocked words) and a max plays-per-deck guard.

## Known issues / small things
- Slice Frenzy: 3 lint errors that predate GameDeck (`PhaserGame.jsx` ref write during render, unused `STAGE`, setState in an effect in `GameScreen.jsx`).
- Picture Perfect uses Tailwind v3, so its brand colours are hex copies; keep them in sync with `packages/brand/brand.css`.
- Local DB has a "Demo – Zeal Showcase" deck with sample scores; delete it when no longer needed.

## Later / ideas
- Optional per-client co-branding on a deck ("Zeal × ClientName").
- Deck-wide overall leaderboard (needs score normalisation across games).
- Adding a new game: follow the checklist in `CLAUDE.md`.
