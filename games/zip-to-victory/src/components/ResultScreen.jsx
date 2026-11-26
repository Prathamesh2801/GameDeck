import { useState, useEffect, useRef, useCallback } from 'react'
import { FaTrophy, FaRegClock, FaArrowRotateRight } from 'react-icons/fa6'
import { formatTime, GAME_SECONDS } from '../game/useTimer'
import { isDevPlay, leaderboardUrl, REDIRECT_DELAY, submitScore } from '@sdk'

function BreakdownRow({ label, value, accent }) {
  return (
    <div className="flex items-center justify-between py-2 text-sm">
      <span className="text-muted">{label}</span>
      <span className={`font-semibold tabular-nums ${accent ? 'text-accent-strong' : 'text-heading'}`}>
        +{value.toLocaleString()}
      </span>
    </div>
  )
}

export default function ResultScreen({ result, onPlayAgain }) {
  const { won, timeLeft, score, numbersCollected, totalNumbers } = result

  const submittedRef = useRef(false)
  const [submitState, setSubmitState] = useState('submitting') // submitting | success | error
  const [submitError, setSubmitError] = useState(null)

  const runSubmit = useCallback(async () => {
    setSubmitState('submitting')
    setSubmitError(null)
    try {
      await submitScore({ score: score.total })
      setSubmitState('success')
    } catch (err) {
      setSubmitState('error')
      setSubmitError(err?.message || "Couldn't save your score. Please retry.")
    }
  }, [score.total])

  // Submit exactly once (StrictMode double-invokes effects in dev).
  useEffect(() => {
    if (submittedRef.current) return
    submittedRef.current = true
    runSubmit()
  }, [runSubmit])

  // Production: go to the leaderboard after a successful submit.
  useEffect(() => {
    if (isDevPlay || submitState !== 'success') return
    const t = setTimeout(() => {
      window.location.href = leaderboardUrl
    }, REDIRECT_DELAY)
    return () => clearTimeout(t)
  }, [submitState])

  return (
    <div className="animate-rise flex w-full flex-1 flex-col items-center justify-center gap-6 overflow-y-auto px-5 py-8 text-center">
      <div
        className={`animate-pop flex h-20 w-20 items-center justify-center rounded-full text-3xl shadow-card ${
          won ? 'bg-accent-soft text-accent-strong' : 'bg-primary-soft text-primary'
        }`}
      >
        {won ? <FaTrophy /> : <FaRegClock />}
      </div>

      <div>
        <h2 className="text-hud text-3xl font-bold text-heading sm:text-4xl">
          {won ? 'VICTORY!' : "TIME'S UP"}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {won
            ? `Solved in ${formatTime(GAME_SECONDS - timeLeft)} — ${formatTime(timeLeft)} to spare.`
            : `You linked ${numbersCollected} of ${totalNumbers} numbers before the clock ran out.`}
        </p>
      </div>

      {/* Score card */}
      <div className="w-full max-w-xs rounded-card border border-border bg-surface p-6 shadow-card">
        <p className="text-xs font-semibold tracking-[0.3em] text-accent uppercase">Your Score</p>
        <p className="text-hud mt-1 font-display text-5xl font-bold text-primary tabular-nums">
          {score.total.toLocaleString()}
        </p>

        <div className="mt-4 divide-y divide-border border-t border-border">
          {score.links > 0 && (
            <BreakdownRow label={`${score.links} numbers linked`} value={score.numberPoints} />
          )}
          {score.drawnCells > 0 && (
            <BreakdownRow label={`${score.drawnCells} squares filled`} value={score.cellPoints} />
          )}
          {won && <BreakdownRow label="Board completed" value={score.completionBonus} accent />}
          {won && (
            <BreakdownRow label={`Speed bonus (${Math.floor(timeLeft)}s left)`} value={score.timeBonus} accent />
          )}
        </div>
      </div>

      {/* Footer — replay in dev, submit/redirect in production. */}
      {isDevPlay ? (
        <button
          type="button"
          onClick={onPlayAgain}
          className="flex items-center gap-3 rounded-pill bg-primary px-9 py-4 text-lg font-semibold text-on-primary shadow-glow transition-colors duration-200 hover:bg-primary-hover active:scale-95"
        >
          <FaArrowRotateRight className="text-base" />
          {won ? 'Play Again' : 'Try Again'}
        </button>
      ) : submitState === 'submitting' ? (
        <p className="text-sm font-semibold text-muted">Saving your score…</p>
      ) : submitState === 'success' ? (
        <div className="flex flex-col items-center gap-2">
          <p className="text-sm font-semibold text-muted">Opening the leaderboard…</p>
          <a
            href={leaderboardUrl}
            className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            See the leaderboard now
          </a>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm font-semibold text-error">{submitError}</p>
          <button
            type="button"
            onClick={runSubmit}
            className="flex items-center gap-3 rounded-pill bg-primary px-9 py-4 text-lg font-semibold text-on-primary shadow-glow transition-colors duration-200 hover:bg-primary-hover active:scale-95"
          >
            <FaArrowRotateRight className="text-base" />
            Retry
          </button>
        </div>
      )}
    </div>
  )
}
