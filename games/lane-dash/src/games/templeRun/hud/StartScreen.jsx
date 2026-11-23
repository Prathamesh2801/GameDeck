import { motion } from "framer-motion";

// BASE_URL is '/' in dev and the configured `base` (e.g. '/games/lane-dash/') in a
// build, so these resolve when the site is served from a subpath.
const ASSET_BASE = `${import.meta.env.BASE_URL}assets/templeRun`;
import LOGO from '@brand/zeal-logo.png';

// The three obstacles the player must dodge — shown circled on the how-to-play
// card so the obstacle is recognisable before the run begins.
// (Kept while the "Avoid These" section below is temporarily commented out.)
// eslint-disable-next-line no-unused-vars
const OBSTACLES = [
  { src: `${ASSET_BASE}/obstacle_1.png`, label: "Broken Pillar" },
  { src: `${ASSET_BASE}/obstacle_2.png`, label: "Mossy Log" },
  { src: `${ASSET_BASE}/obstacle_3.png`, label: "Rock Pile" },
];

// The game's actual rules, one ledger row each (numbered 01…). Keep this list
// to REAL mechanics only — the row count is derived from it, so adding or
// removing a rule here is the whole change.
const RULES = [
  "Duration of the game: 120 seconds.",
  "Swipe left or right to switch lanes.",
  "Swipe up to jump over obstacles.",
  "You have 3 lives. Each collision with an obstacle costs 1 life. The game ends when all 3 lives are lost or the timer expires.",
  "Collect coins to earn points. Each coin is worth 10 points.",
  "Avoid Broken Pillars, Mossy Logs, and Rock Piles.",
  "The farther you run, the higher your score.",
  "Reach the top of the leaderboard to become the champion.",
];

/**
 * Intro / how-to-play overlay shown in the `ready` phase. On Start → run begins.
 * Controls are touch-only (this ships on mobile), so no keyboard hints here.
 */
export function StartScreen({ onStart }) {
  return (
    <motion.div
      className="absolute inset-0 grid place-items-center bg-heading/40 p-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="glass-card rounded-card max-h-[92vh] w-full max-w-sm overflow-y-auto px-6 py-7 text-center"
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ ease: [0.2, 0.8, 0.2, 1], duration: 0.4 }}
      >
        {/* ── Branding ────────────── */}
        <img
          src={LOGO}
          alt="Zeal Interactive"
          className="mx-auto h-16 w-16 object-contain"
          draggable={false}
        />
        <h1 className="font-display mt-3 text-3xl font-bold text-heading">Lane Dash</h1>
        <Rule />
        <p className="text-muted mx-auto mt-3 max-w-[18rem] text-sm leading-relaxed">
          Run. Dodge. Collect. Conquer.
        </p>

        {/* ── How to play — numbered ledger (rows come from RULES) ─ */}
        <SectionLabel className="text-left">How to Play</SectionLabel>
        <ol className="divide-border/80 border-border/80 divide-y border-y text-left">
          {RULES.map((rule, i) => (
            <li key={rule} className="flex items-baseline gap-4 py-3">
              <span className="font-display text-primary shrink-0 text-lg font-semibold tabular-nums">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="text-text text-sm leading-relaxed">{rule}</span>
            </li>
          ))}
        </ol>

        {/* ── Obstacles to avoid (temporarily hidden) ─────────── */}
        {/*
        <SectionLabel>Avoid These</SectionLabel>
        <div className="grid grid-cols-3 gap-3">
          {OBSTACLES.map((o) => (
            <div key={o.label} className="flex flex-col items-center gap-2">
              <div className="ring-primary/55 bg-surface-muted shadow-card grid h-20 w-20 place-items-center overflow-hidden rounded-full ring-2">
                <img
                  src={o.src}
                  alt={o.label}
                  className="h-14 w-14 object-contain drop-shadow"
                  draggable={false}
                />
              </div>
              <span className="text-heading text-[11px] font-semibold leading-tight">
                {o.label}
              </span>
            </div>
          ))}
        </div>
        */}

        {/* ── Start ────────────────────────────────────────────── */}
        <button
          type="button"
          onClick={onStart}
          className="text-hud bg-primary text-on-primary shadow-glow ease-snap hover:bg-primary-hover rounded-pill mt-7 w-full px-8 py-3.5 text-lg font-bold tracking-wide transition-all duration-150 hover:scale-[1.03] active:scale-95"
        >
          Start Run
        </button>
      </motion.div>
    </motion.div>
  );
}

/* A small amber ornamental divider. */
function Rule() {
  return (
    <div
      className="mt-3 flex items-center justify-center gap-2"
      aria-hidden="true"
    >
      <span className="via-accent/60 h-px w-10 bg-linear-to-r from-transparent to-transparent" />
      <span className="bg-accent/70 h-1.5 w-1.5 rotate-45" />
      <span className="via-accent/60 h-px w-10 bg-linear-to-r from-transparent to-transparent" />
    </div>
  );
}

function SectionLabel({ children, className = "" }) {
  return (
    <p
      className={`text-accent mt-6 mb-3 text-[11px] font-bold tracking-[0.22em] uppercase ${className}`}
    >
      {children}
    </p>
  );
}
