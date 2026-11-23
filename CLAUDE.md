# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
packages/game-sdk/  (planned) shared runtime: load deck theme, start play session, submit score
web/                (planned) dashboard + player site (nickname → games → play → leaderboard)
server/             (planned) Node + Express + MySQL API, runs as a cPanel Node.js app
```

Planned data model: `games` (slug, name, max_score), `decks` (name, share code, enabled, optional end date), `deck_games`, `plays` (deck, game, nickname, score, time; one row per server-issued play session). Score sanity: the server issues a one-time session per play, accepts one score per session, and rejects scores above the game's `max_score`.

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
- `npm run lint`: works only in `lane-dash` and `slice-frenzy` (the only ones with `eslint.config.js`).
- No test suites. Verify by building and driving the game in a browser. `lane-dash` has Playwright installed (`scripts/shot.mjs`, `_*.mjs`; check each script's hardcoded port), and other games can borrow it by requiring `games/lane-dash/node_modules/playwright` with `channel: 'chrome'`. `strike-alley` documents headless Chrome + CDP in `.claude/skills/verify/SKILL.md`. While `DEV_MODE` is false, append `?token=dev` to get past the token gate locally.

### Legacy hub binding (to be replaced by `game-sdk`)
Every game still carries the old hub contract (now the only remaining tie to the HSBC event): `src/data/appConfig.js` (`DEV_MODE`, `GAME_SR_NO`, royalbankingquest.com URLs), `src/utils/token.js` (`?token=`), `src/utils/submitScore.js` (multipart POST to `gamescore.php`), a `BlockedScreen` token gate, and a results screen that submits once (guarded by `useRef` against StrictMode double effects) and then redirects to the hub. (The original spec, `HUB_INTEGRATION_TEMPLATE.md`, was deleted during clean-up; it lives in the old repo history.) Keep the *pattern* (gate, submit-once, retry on error, dev mode) when migrating, but point it at GameDeck. Submit call sites:
`picture-perfect/src/components/Summary.jsx`, `strike-alley/src/components/GameOverScreen.jsx`, `lane-dash/src/games/templeRun/TempleRun.jsx`, `slice-frenzy/src/components/GameOverOverlay.jsx`, `zip-to-victory/src/components/ResultScreen.jsx`.

HSBC/CIB branding, the "Royal" names and title art, the event copy and the event-only docs have all been removed. Any new game should follow the brand system above from the start.

### Engine ↔ React boundaries
- **lane-dash:** Phaser lives only under `src/games/templeRun/game/` and talks to React only through the singleton `EventBus.js` (Phaser→React: `ready`, `score-update`, `coins-update`, `game-over`; React→Phaser: `pause`, `resume`, `restart`). `TempleRun.jsx` owns the phase machine (loading → ready → countdown → tutorial → running ⇄ paused → over). Score = distance + coins × `POINTS_PER_COIN`, taken from the `game-over` payload, not the HUD. Tunables are in `game/constants.js`. `docs/CLAUDE.md` and the GameFlow spec describe the original v1. Their React↔Phaser/perf rules still apply, but the "out of scope" list is outdated.
- **slice-frenzy:** `game/PhaserGame.jsx` boots Phaser and hands the instance up. React subscribes to **that instance's** `game.events`, deliberately not a global bus, so StrictMode double-mount can't leave ghost listeners. Gameplay is in `game/scenes/GameScene.js`.
- **strike-alley:** `game/game.js` is a plain `Game` class (phases INTRO→AIMING→POWER→ROLLING→RESULT→RETURNING→GAMEOVER, `scoreGame`, max 3000) created by `GameCanvas.jsx`. It pushes state to React via `onUiState`, and React calls methods on `gameRef.current`. Rendering is hand-written in `render.js`. Never use `ctx.shadowBlur` (perf). The pin sprite is baked once, so lighting changes need a full reload.
- **zip-to-victory / picture-perfect:** pure React state machines (`App.jsx` / `Quiz.jsx`). Zip's puzzle generation is in `game/generator.js` and scoring in `game/score.js`.

## Local environment
- Windows 11, Node 24, npm 11.
- **MySQL 8.0** runs locally as the `MySQL80` service (Workbench installed). Use it for local dev so the schema matches cPanel's MySQL/MariaDB.
- cPanel Node apps run under Passenger: the app must listen on `process.env.PORT` and is started from a configured startup file. Check ESM support for the chosen Node version on the server before relying on `"type": "module"` in the startup file.
