# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Start of every session

Open work lives in **`ROADMAP.md`**. At the start of each session, before anything else, briefly remind the owner of the next roadmap items and any decisions still pending, then ask which one to work on. When an item is finished or a new one is agreed, update `ROADMAP.md` in the same change.

## What GameDeck is

A self-hosted platform for sharing a curated **deck** of mobile-first web games with a client through one link. The games were originally built for an HSBC internal event (the "Royal Banking Quest" hub). They have since been renamed and rebranded to Zeal, and GameDeck is turning them into a product that the owner fully controls.

Product decisions so far:
- **Branding:** everything carries the owner's company brand, **Zeal Interactive Services** (https://www.zealinteractive.in, an event-tech and gaming company in Mumbai), so clients know whose games they're playing. Mock and demo content (e.g. quiz questions) is about Zeal. Per-client co-branding on decks is deferred.
- **Deck** = the admin picks games and shares one link (`/d/<code>`) with a client.
- **Players** enter a **nickname only** (no accounts). Replays are allowed, and the leaderboard keeps each nickname's best score.
- **Leaderboard per game**, scoped to the deck so clients never see each other's players.
- **Dashboard** has a single admin (the owner) protected by one password from env. Not multi-tenant.
- **Hosting:** everything (API, dashboard, player site, game builds) runs on one **cPanel account with Node.js app support** (Phusion Passenger) using cPanel MySQL. Same origin, so no CORS.
- **Workflow:** develop and test fully on the local machine first. Production upload comes only after the owner is satisfied.

## Repo layout

One git repo (monorepo). The old per-game repos' `.git` folders are archived outside this repo in `../_old_repos/` and also live on GitHub.

```
games/<slug>/       each game is its own Vite app with its own package.json + node_modules
packages/brand/     Zeal brand: brand.css (palette + font vars), zeal-logo.png, zeal-logo-white.png, favicon.png
packages/game-sdk/  shared plain-JS contract every game imports as `@sdk` (play token, submit score, leaderboard URL)
web/                React + Vite app: admin dashboard at /admin, player site at /d/<code>
server/             Node + Express 5 + MySQL API (CommonJS), runs as a cPanel Node.js app
```

## Server (`server/`)

- `npm run db:init`: creates the DB (if permitted) and applies `schema.sql` (idempotent; seeds/updates the `games` catalogue with `max_score`). `npm run dev` runs with `node --watch` on port 4000. `npm test`: one `node:test` end-to-end flow against the local DB (it creates and deletes its own deck). Run a single test with `node --test --test-name-pattern "<name>"`.
- Config comes from `server/.env` (git-ignored; template `.env.example`) via `process.loadEnvFile`. On cPanel the same keys are set as app env vars, and `server.js` is the startup file (it listens on `process.env.PORT`).
- Kept CommonJS and MariaDB-compatible SQL (e.g. `VALUES()` upserts, not row aliases) because cPanel's Node/DB versions are unknown.
- Tables: `games` (slug, name, `max_score` NULL = uncapped), `decks` (8-char `code` from a no-look-alike alphabet, enabled, `expires_at`), `deck_games` (ordered), `plays` (one row per session; a 32-hex `token` can submit one score within 2h).
- Routes in `app.js`. Public: `GET /api/decks/:code`, `POST /api/decks/:code/plays {game, nickname}` → `{token}`, `POST /api/plays/:token/score {score}`, `GET /api/decks/:code/games/:slug/leaderboard` (best per nickname, top 20). Admin: `POST /api/admin/login {password}` → HMAC-signed bearer token (7 days); everything else under `/api/admin/*` requires it (games, deck CRUD, deck plays, delete play).
- Express 5 forwards thrown errors and rejected promises, so handlers throw `HttpError(status, message)` and the final handler turns that into `{error}` JSON.
- Not yet: score caps for `slice-frenzy`/`lane-dash` (no fixed ceiling, so they need playtest data), rate limiting, and serving the web app or game builds.

## Running everything locally

From the repo root: `npm run setup` once (installs every package), then `npm run dev`, which uses `concurrently` to start the API (4000), web (5173) and all five games (5301–5305). Open **http://localhost:5173**. The web dev server proxies `/api` → 4000 and `/games/<slug>` → that game's port (`GAME_PORTS` in `web/vite.config.js`; each game pins the same port with `strictPort`), so the player site, games and API share one origin, as they will in production.

## Web app (`web/`)

- `npm run build` outputs `web/dist` (the server will serve it in production, same origin).
- React 19, React Router (data router in `src/main.jsx`), Tailwind v4 mapped onto the brand palette in `src/index.css` (`btn` / `input` utilities), react-icons, react-hot-toast. Modals use native `<dialog>`, and deletes use inline confirm (no `window.confirm`).
- `src/api.js`: `api(path, {method, body})` (JSON, throws `Error(serverMessage)`, attaches the admin token from localStorage, and on 401 clears it and goes to `/admin/login`) and `useApi(path)` → `{data, error, loading, reload}`.
- `src/games.js`: per-slug icon and blurb. Names and max scores come from the server.
- Player screens (`src/player/`): `DeckHome` (`/d/:code`: nickname once per deck on this device via `useNickname` in localStorage, then game cards), `Leaderboard` (`/d/:code/leaderboard/:slug`, own row highlighted), `PlayerShell` (brand hero + footer, `DeckUnavailable`).
- **Game launch contract:** Play calls `POST /api/decks/:code/plays` and then navigates to `/games/<slug>/?token=<playToken>&deck=<CODE>`. The game must submit its score once to `POST /api/plays/<token>/score` and send the player back to `/d/<CODE>/leaderboard/<slug>`. (`packages/game-sdk` implements this for every game.)
- Admin screens (`src/admin/`): `Login`, `AdminLayout` (auth guard + header), `Decks` (cards: share link + copy, games, status Live/Paused/Expired, edit/pause/delete), `DeckForm` (name, ordered game picker, optional close time), `DeckScores` (per-game tabs, every play sorted by score, delete).

## Brand system

`packages/brand/brand.css` is the single source of colour and type. It defines raw variables in `:root`: `--brand-50…950` (forest green; the logo colour is `--brand-700` `#1c552a`), `--accent-*` (amber, the complementary accent), `--neutral-*`, `--ink-*` (dark surfaces), `--brand-success|warning|danger`, `--brand-font-display` (Outfit) and `--brand-font-body` (Inter). These names are prefixed so they never collide with the games' own `--color-*`/`--font-*` tokens.

How each game consumes it:
- Its CSS `@import`s `../../../packages/brand/brand.css`. Tailwind v4 games map their semantic `@theme` tokens (`--color-primary`, `--color-surface`, …) onto the brand vars, and components only use those tokens.
- **picture-perfect (Tailwind v3)** is the exception. Opacity modifiers need literal colours, so `tailwind.config.js` and its components mirror brand hex values. Keep them in sync on a rebrand.
- Logos are imported in JS via the `@brand` Vite alias (`import logo from '@brand/zeal-logo.png'`). Every `vite.config.js` defines that alias plus `server.fs.allow: ['../..']` so dev can serve files outside the app root.
- Fonts load via `<link>` tags in each `index.html`, not CSS `@import`, which would stop being first after Tailwind inlines files.
- `favicon.png` is copied into each game's `public/`, because `index.html` links can't reach outside the app root in dev.
- Don't share JSX from `packages/`. There's no root `node_modules`, so React imports there wouldn't resolve. Share only CSS and assets.

Look: neutral light UI (white cards, slightly green-tinted greys), Zeal green for primary actions and headings, amber for scores, rewards and hints, and a deep green radial gradient (`--brand-700` → `--ink-900`) behind full-screen start/blocked cards. Every title screen shows the Zeal logo with the game name in Outfit.

## Games

| Slug | Game | Engine | Notes |
|---|---|---|---|
| `slice-frenzy` | Fruit slicing arcade (was Royal Ninja) | Phaser **4** + React | Tailwind v4 |
| `picture-perfect` | Picture quiz about Zeal's own experiences | React only | Tailwind **v3** + PostCSS; questions in `src/data/questions.js`, photos (from zealinteractive.in) in `public/questions/` |
| `lane-dash` | 2.5D lane runner (was Royal Chase) | Phaser **3** + React | Tailwind v4, `@/` alias → `src/`; Udaipur-palace art and videos kept as game content |
| `zip-to-victory` | Grid path puzzle (1 min) | React only | Tailwind v4 |
| `strike-alley` | Bowling (was Royal Alley) | Canvas 2D + matter-js + React | plain CSS; back-wall sign draws `zeal-logo-white.png` |

All use React 19 + Vite + plain JSX (no TypeScript). Vite and plugin versions differ per game (4 → 8), so don't assume one game's config applies to another. Each game builds under `base: '/games/<slug>/'`, so the dev URL is `http://localhost:<port>/games/<slug>/`.

### Commands (inside `games/<slug>/`)
- `npm run dev`: Vite with `--host` (5173 or the next free port; read the banner).
- `npm run build`: builds `dist/` (the old `bestzip` postbuild step has been removed).
- `npm run lint`: works only in `lane-dash` and `slice-frenzy` (the only ones with `eslint.config.js`). `slice-frenzy` has 3 pre-existing errors (ref write during render in `PhaserGame.jsx`, unused `STAGE`, setState in an effect in `GameScreen.jsx`).
- No test suites. Verify by building and driving the game in a browser. `lane-dash` has Playwright installed (`scripts/shot.mjs`, `_*.mjs`; check each script's hardcoded port), and other games can borrow it by requiring `games/lane-dash/node_modules/playwright` with `channel: 'chrome'`. `strike-alley` documents headless Chrome + CDP in `.claude/skills/verify/SKILL.md`. A game's own dev server (e.g. `localhost:5305/games/strike-alley/`) without a token runs in practice mode. To test real scoring, play from a deck link on `localhost:5173`.

### Game SDK (`packages/game-sdk/index.js`, imported as `@sdk`)
Every game gets its platform wiring from this one file (aliased in each `vite.config.js`):
- `canPlay`: render `BlockedScreen` when false (built game opened without `?token=`).
- `isDevPlay`: true on a game's own dev server with no token. This is free practice: nothing is submitted, and result screens show Play Again (it replaces the old manual `DEV_MODE` flag).
- `submitScore({ score })`: rounds the score and POSTs it once to `/api/plays/<token>/score`. A 409 (already saved) counts as success, and other errors throw so the game shows Retry.
- `leaderboardUrl` and `REDIRECT_DELAY`: after a successful submit, result screens wait, then go to `/d/<deck>/leaderboard/<slug>` (the slug comes from the game's Vite `base`).

Result screens keep the submit-once pattern (`useRef` guard, because StrictMode double-runs effects; states submitting/success/error; Retry on error). Submit call sites: `picture-perfect/src/components/Summary.jsx`, `strike-alley/src/components/GameOverScreen.jsx`, `lane-dash/src/games/templeRun/TempleRun.jsx`, `slice-frenzy/src/components/GameOverOverlay.jsx`, `zip-to-victory/src/components/ResultScreen.jsx`. Lane Dash's coin value is `GAME.POINTS_PER_COIN` in its `constants.js`.

HSBC/CIB branding, the old royalbankingquest.com hub contract, the "Royal" names and title art, the event copy and the event-only docs have all been removed. New games should use the brand system and `@sdk` from the start.

### Adding a new game
1. Create it as its own Vite app in `games/<slug>/` with `base: '/games/<slug>/'`, the `@brand` + `@sdk` aliases, `server.fs.allow: ['../..']`, and a fixed dev `server.port` (next free after 5305, `strictPort`).
2. Theme it from `packages/brand/brand.css` (see Brand system), and copy `favicon.png` into its `public/`.
3. Wire `@sdk`: a `canPlay` gate, `submitScore` once at the end (useRef guard, Retry on error), redirect to `leaderboardUrl`, and Play Again only when `isDevPlay`.
4. Register it in `server/schema.sql` (slug, name, `max_score`) and run `npm run db:init`, then add it to `GAME_META` (`web/src/games.js`), `GAME_PORTS` (`web/vite.config.js`), and the root `package.json` `setup`/`dev` scripts.
5. Give it the standard in-game menu (see `ROADMAP.md` item 1).

### Engine ↔ React boundaries
- **lane-dash:** Phaser lives only under `src/games/templeRun/game/` and talks to React only through the singleton `EventBus.js` (Phaser→React: `ready`, `score-update`, `coins-update`, `game-over`; React→Phaser: `pause`, `resume`, `restart`). `TempleRun.jsx` owns the phase machine (loading → ready → countdown → tutorial → running ⇄ paused → over). Score = distance + coins × `POINTS_PER_COIN`, taken from the `game-over` payload, not the HUD. Tunables are in `game/constants.js`. Rules: never import Phaser outside `game/`; tear down with `game.destroy(true)` and remove EventBus listeners on unmount and scene `shutdown`; never `setState` per frame (only via throttled EventBus events); pool obstacles/coins; use delta-time movement; cap DPR at ~2. `docs/Udaipur_Temple_Run_GameFlow_Spec.md` is the original v1 spec, and its "out of scope" list is outdated.
- **slice-frenzy:** `game/PhaserGame.jsx` boots Phaser and hands the instance up. React subscribes to **that instance's** `game.events`, deliberately not a global bus, so StrictMode double-mount can't leave ghost listeners. Gameplay is in `game/scenes/GameScene.js`.
- **strike-alley:** `game/game.js` is a plain `Game` class (phases INTRO→AIMING→POWER→ROLLING→RESULT→RETURNING→GAMEOVER, `scoreGame`, max 3000) created by `GameCanvas.jsx`. It pushes state to React via `onUiState`, and React calls methods on `gameRef.current`. Rendering is hand-written in `render.js`. Never use `ctx.shadowBlur` (perf). The pin sprite is baked once, so lighting changes need a full reload.
- **zip-to-victory / picture-perfect:** pure React state machines (`App.jsx` / `Quiz.jsx`). Zip's puzzle generation is in `game/generator.js` and scoring in `game/score.js`.

## Local environment
- Windows 11, Node 24, npm 11.
- **MySQL 8.0** runs locally as the `MySQL80` service (Workbench installed). Use it for local dev so the schema matches cPanel's MySQL/MariaDB.
- cPanel Node apps run under Passenger: the app must listen on `process.env.PORT` and is started from a configured startup file. Check ESM support for the chosen Node version on the server before relying on `"type": "module"` in the startup file.
