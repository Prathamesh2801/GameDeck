import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { FaRegClock } from "react-icons/fa";
import { isDevPlay, leaderboardUrl, REDIRECT_DELAY, submitScore } from "@sdk";

export default function GameOverOverlay({ result, onReplay, onExit }) {
  const submittedRef = useRef(false);
  const [submitState, setSubmitState] = useState("submitting"); // submitting | success | error
  const [submitError, setSubmitError] = useState(null);

  const runSubmit = useCallback(async () => {
    setSubmitState("submitting");
    setSubmitError(null);
    try {
      await submitScore({ score: result.score });
      setSubmitState("success");
    } catch (err) {
      setSubmitState("error");
      setSubmitError(err?.message || "Couldn't save your score. Please retry.");
    }
  }, [result.score]);

  // Submit exactly once on mount (StrictMode-safe).
  useEffect(() => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    runSubmit();
  }, [runSubmit]);

  // Production: go to the leaderboard after a successful submit.
  useEffect(() => {
    if (isDevPlay || submitState !== "success") return;
    const t = setTimeout(() => {
      window.location.href = leaderboardUrl;
    }, REDIRECT_DELAY);
    return () => clearTimeout(t);
  }, [submitState]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-30 flex items-center justify-center bg-heading/35 p-6 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 220, damping: 20 }}
        className="w-full max-w-xs rounded-3xl border border-border-strong/70 bg-surface px-6 py-7 text-center shadow-2xl"
      >
        <p className="font-display text-xs font-bold uppercase tracking-[0.25em] text-muted">
          The round has ended
        </p>
        <h2 className="mt-2 font-display text-3xl font-bold text-heading">
          Time&rsquo;s Up!
        </h2>
        <p className="mt-2 flex items-center justify-center gap-2 text-sm text-muted">
          <FaRegClock className="text-primary" /> Your round is complete.
        </p>

        <div className="mt-5 rounded-2xl bg-surface-muted py-4">
          <p className="font-display text-[11px] uppercase tracking-widest text-muted">
            Final Score
          </p>
          <p className="font-display text-4xl font-bold text-primary">
            {result.score}
          </p>
        </div>

        {/* Footer — driven by practice play / submit state */}
        {isDevPlay ? (
          <>
            <button
              onClick={onReplay}
              className="mt-5 w-full rounded-full bg-primary py-3 font-display text-sm font-bold uppercase tracking-widest text-on-primary transition-colors hover:bg-primary-hover"
            >
              Play Again
            </button>
            <button
              onClick={onExit}
              className="mt-2 w-full rounded-full border border-border-strong py-2.5 font-display text-sm font-semibold text-primary transition-colors hover:bg-primary-soft"
            >
              Main Menu
            </button>
          </>
        ) : submitState === "submitting" ? (
          <p className="mt-5 font-display text-sm font-semibold text-muted">
            Saving your score&hellip;
          </p>
        ) : submitState === "success" ? (
          <div className="mt-5">
            <p className="font-display text-sm font-semibold text-primary">
              Opening the leaderboard&hellip;
            </p>
            <a
              href={leaderboardUrl}
              className="mt-3 inline-block font-display text-xs font-semibold uppercase tracking-widest text-muted underline transition-colors hover:text-primary"
            >
              See the leaderboard now
            </a>
          </div>
        ) : (
          <div className="mt-5">
            <p className="text-sm text-primary">{submitError}</p>
            <button
              onClick={runSubmit}
              className="mt-3 w-full rounded-full bg-primary py-3 font-display text-sm font-bold uppercase tracking-widest text-on-primary transition-colors hover:bg-primary-hover"
            >
              Retry
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
