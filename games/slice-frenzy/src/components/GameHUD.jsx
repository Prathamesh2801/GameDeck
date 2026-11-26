import { AnimatePresence, motion } from "framer-motion";
import { FaPause } from "react-icons/fa";
import { RULES } from "../game/constants";
import { isDevPlay } from "@sdk";

// Pure overlay — sits above the canvas, ignores pointer events except the
// control buttons so slashes pass straight through to Phaser.
export default function GameHUD({ score, timeLeft, combo, onPause, feastActive }) {
  const secs = Math.max(0, timeLeft ?? 0);
  const clock = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
  const low = secs <= RULES.LOW_TIME_S;

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <div className="flex items-start justify-between">
        {/* Score */}
        <div className="rounded-2xl border border-border/70 bg-surface-translucent px-4 py-2 backdrop-blur-sm">
          <p className="font-display text-[10px] font-bold uppercase tracking-[0.2em] text-muted">
            Score
          </p>
          <p className="font-display text-2xl font-bold leading-none text-heading">
            {score}
          </p>
        </div>

        {/* Timer + pause */}
        <div className="flex items-center gap-2">
          <motion.div
            animate={low ? { scale: [1, 1.08, 1] } : { scale: 1 }}
            transition={low ? { duration: 1, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }}
            className="rounded-2xl border border-border/70 bg-surface-translucent px-4 py-2 text-right backdrop-blur-sm"
          >
            <p className="font-display text-[10px] font-bold uppercase tracking-[0.2em] text-muted">
              Time
            </p>
            <p
              className={`font-display text-2xl font-bold leading-none tabular-nums ${
                low ? "text-error" : "text-heading"
              }`}
            >
              {clock}
            </p>
          </motion.div>
          {/* Pause is dev-only: in production the game is played once, so
              pause → Restart / Main Menu would be a way to cheat a fresh run. */}
          {isDevPlay && !feastActive && (
            <button
              onClick={onPause}
              className="pointer-events-auto grid h-11 w-11 place-items-center rounded-2xl border border-border/70 bg-surface-translucent text-base text-muted backdrop-blur-sm transition-colors hover:text-primary"
              aria-label="Pause game"
            >
              <FaPause />
            </button>
          )}
        </div>
      </div>

      {/* Combo flourish — grows and glows harder the longer the streak */}
      <div className="mt-10 flex justify-center">
        <AnimatePresence mode="wait">
          {combo && (
            <motion.div
              key={combo.id}
              initial={{ opacity: 0, scale: 0.4, y: 14, rotate: -6 }}
              animate={{ opacity: 1, scale: comboScale(combo.count), y: 0, rotate: 0 }}
              exit={{ opacity: 0, scale: comboScale(combo.count) * 1.35, y: -12 }}
              transition={{ type: "spring", stiffness: 320, damping: 13 }}
              className="relative"
            >
              {/* pulsing glow halo behind the badge */}
              <motion.div
                className="absolute inset-0 rounded-full bg-accent/50 blur-md"
                animate={{ scale: [1, 1.35, 1], opacity: [0.6, 0, 0.6] }}
                transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
              />
              <div className="relative flex items-center gap-1.5 rounded-full bg-linear-to-r from-primary via-accent to-primary px-4 py-1 shadow-lg ring-1 ring-accent/60">
                <span className="font-display text-sm font-bold leading-none text-on-primary drop-shadow">
                  Combo ×{combo.count}
                </span>
                <span className="font-display text-xs font-extrabold leading-none text-on-primary/95">
                  +{combo.bonus}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// The badge swells slightly with the streak, capped so it stays subtle.
function comboScale(count) {
  return Math.min(1 + (count - 2) * 0.04, 1.2);
}
