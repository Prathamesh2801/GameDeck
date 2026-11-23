import { useCallback, useEffect, useRef } from 'react'
import { FaRegClock, FaArrowRotateLeft, FaRegLightbulb } from 'react-icons/fa6'
import Board from './Board'
import { useZipGame } from '../game/useZipGame'
import { useTimer, formatTime, GAME_SECONDS } from '../game/useTimer'
import { computeScore } from '../game/score'

export default function GameScreen({ puzzle, onEnd }) {
  const { path, attemptCell, undo, hint, hintCells, nextNumber, numbersCollected, won } =
    useZipGame(puzzle)

  const endedRef = useRef(false)

  // Latest progress mirrored into a ref so the timer/win callbacks read the
  // real end-of-game state, not a stale closure.
  const progressRef = useRef(null)
  progressRef.current = { numbersCollected, cellsFilled: path.length }

  const finish = useCallback(
    (didWin, timeLeft) => {
      if (endedRef.current) return
      endedRef.current = true
      const { numbersCollected, cellsFilled } = progressRef.current
      const score = computeScore({ numbersCollected, cellsFilled, secondsLeft: timeLeft, won: didWin })
      onEnd({
        won: didWin,
        timeLeft,
        score,
        numbersCollected,
        totalNumbers: puzzle.numberCells.length,
      })
    },
    [onEnd, puzzle.numberCells.length],
  )

  const remaining = useTimer(GAME_SECONDS, !won && !endedRef.current, () => finish(false, 0))
  const remainingRef = useRef(remaining)
  remainingRef.current = remaining

  // Win: hold the finished board on screen briefly, then report with the
  // clock frozen at the moment of victory (the timer stopped when `won` flipped).
  useEffect(() => {
    if (won && !endedRef.current) {
      const t = setTimeout(() => finish(true, remainingRef.current), 1400)
      return () => clearTimeout(t)
    }
  }, [won, finish])

  const timerTone =
    remaining <= 10 ? 'text-error' : remaining <= 20 ? 'text-warning' : 'text-heading'

  return (
    <div className="animate-rise flex w-full flex-1 flex-col items-center justify-center gap-5 overflow-y-auto px-4 py-6">
      {/* HUD */}
      <div className="flex w-full items-center justify-between">
        <span className="text-hud text-lg font-bold text-primary">ZIP</span>
        <div className={`glass-card flex items-center gap-2 rounded-pill px-5 py-2 font-display text-xl font-semibold tabular-nums ${timerTone}`}>
          <FaRegClock className="text-base" />
          {formatTime(remaining)}
        </div>
        <span className="text-sm font-semibold text-muted tabular-nums">
          {numbersCollected}/{puzzle.numberCells.length}
        </span>
      </div>

      <Board
        puzzle={puzzle}
        path={path}
        attemptCell={attemptCell}
        hintCells={hintCells}
        nextNumber={nextNumber}
        won={won}
        disabled={won}
      />

      {/* controls */}
      <div className="flex w-full gap-3">
        <button
          type="button"
          onClick={undo}
          disabled={path.length <= 1 || won}
          className="flex flex-1 items-center justify-center gap-2 rounded-pill bg-surface-muted py-3.5 font-semibold text-text transition-colors duration-200 enabled:hover:bg-border disabled:opacity-40"
        >
          <FaArrowRotateLeft />
          Undo
        </button>
        <button
          type="button"
          onClick={hint}
          disabled={won}
          className="flex flex-1 items-center justify-center gap-2 rounded-pill border border-border-strong bg-surface py-3.5 font-semibold text-text transition-colors duration-200 enabled:hover:bg-surface-muted disabled:opacity-40"
        >
          <FaRegLightbulb className="text-accent-strong" />
          Hint
        </button>
      </div>
    </div>
  )
}
