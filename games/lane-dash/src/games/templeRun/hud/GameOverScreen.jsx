import { motion } from 'framer-motion';

/**
 * Centered overlay used for both the paused state and game-over state
 * (same layout, different copy/actions — spec §4 phase table).
 *
 * Paused: pass `paused`, `onResume`, `onRestart` (Restart renders in practice play
 *   only — production is one play per user, so the pause card is Resume-only).
 * Game over: pass the final `score` plus submit state (`devMode`, `submitState`,
 *   `submitError`, `leaderboardUrl`, `onRetry` for a DEV replay, `onRetrySubmit` to
 *   re-POST after a failure). The footer is driven off the submit state.
 *   `completed` = the run ran out the clock (heading "Time's Up!") vs a crash
 *   (heading "Game Over").
 */
export function GameOverScreen({
  paused,
  score,
  completed,
  onResume,
  onRestart,
  devMode,
  submitState,
  submitError,
  leaderboardUrl,
  onRetry,
  onRetrySubmit,
}) {
  const heading = paused ? 'Paused' : completed ? "Time's Up!" : 'Game Over';
  return (
    <motion.div
      className="absolute inset-0 grid place-items-center bg-heading/40 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.div
        className="glass-card rounded-card mx-6 w-full max-w-sm px-8 py-9 text-center"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ ease: [0.2, 0.8, 0.2, 1], duration: 0.35 }}
      >
        <h2 className="text-hud font-display text-3xl font-bold text-primary">
          {heading}
        </h2>

        <p className="text-hud mt-2 text-xs font-semibold tracking-[0.25em] text-muted uppercase">
          {paused ? 'Score' : 'Final Score'}
        </p>
        <p className="text-hud text-5xl font-extrabold text-heading">{score}</p>

        <div className="mt-8 flex flex-col gap-3">
          {paused ? (
            <>
              <Btn primary onClick={onResume}>
                Resume
              </Btn>
              {/* Replay affordance is DEV-only: production allows one play. */}
              {devMode && <Btn onClick={onRestart}>Restart</Btn>}
            </>
          ) : (
            <GameOverFooter
              devMode={devMode}
              submitState={submitState}
              submitError={submitError}
              leaderboardUrl={leaderboardUrl}
              onRetry={onRetry}
              onRetrySubmit={onRetrySubmit}
            />
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

/**
 * Game-over footer. practice play offers a free replay; production POSTs the score
 * once and reports progress, ending with an go to the leaderboard.
 */
function GameOverFooter({ devMode, submitState, submitError, leaderboardUrl, onRetry, onRetrySubmit }) {
  if (devMode) {
    return (
      <Btn primary onClick={onRetry}>
        Play Again
      </Btn>
    );
  }

  if (submitState === 'error') {
    return (
      <>
        <p className="text-hud text-sm font-medium text-primary">
          {submitError || "Couldn't save your score. Please retry."}
        </p>
        <Btn primary onClick={onRetrySubmit}>
          Retry
        </Btn>
      </>
    );
  }

  if (submitState === 'success') {
    return (
      <>
        <p className="text-hud text-muted text-sm font-medium">Opening the leaderboard…</p>
        <a
          href={leaderboardUrl}
          className="text-hud bg-primary text-on-primary shadow-glow ease-snap hover:bg-primary-hover rounded-pill w-full px-8 py-3 text-center text-lg font-bold transition-all duration-150 hover:scale-[1.03] active:scale-95"
        >
          See the leaderboard now
        </a>
      </>
    );
  }

  // submitting (default)
  return <p className="text-hud text-muted text-sm font-medium">Saving your score…</p>;
}

function Btn({ primary, onClick, children }) {
  const base =
    'text-hud w-full rounded-pill px-8 py-3 text-lg font-bold transition-all duration-150 ease-snap hover:scale-[1.03] active:scale-95';
  const style = primary
    ? 'bg-primary text-on-primary shadow-glow hover:bg-primary-hover'
    : 'glass-card text-heading';
  return (
    <button type="button" onClick={onClick} className={`${base} ${style}`}>
      {children}
    </button>
  );
}
