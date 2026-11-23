import { useState, useEffect, useRef, useCallback } from 'react'
import { C } from '../game/constants.js'
import { APP_CONFIG } from '../data/appConfig.js'
import { submitScore } from '../utils/submitScore.js'
import logoUrl from '@brand/zeal-logo.png'

// Perfect game = a strike in every frame.
const MAX_SCORE = C.TOTAL_FRAMES * C.STRIKE_SCORE

// Production has no Retry button (one play, no interaction), so a failed score
// POST is retried silently a few times before we give up — a network blip
// shouldn't lose the score, and the player never gets a way to re-tap.
const SUBMIT_MAX_ATTEMPTS = 4
const SUBMIT_RETRY_MS = 2500

// Score-tier rating — echoes the parchment/regal voice set by the intro card.
function rating(score) {
  const pct = score / MAX_SCORE
  if (score === MAX_SCORE) return 'Perfect Game'
  if (pct >= 0.8) return 'Crowned Champion'
  if (pct >= 0.6) return 'Seasoned Bowler'
  if (pct >= 0.4) return 'Rising Contender'
  if (pct >= 0.2) return 'Apprentice of the Alley'
  return 'Better Luck Next Time'
}

export default function GameOverScreen({ score, onPlayAgain }) {
  const submittedRef = useRef(false)
  const attemptRef = useRef(0)
  const retryTimer = useRef(null)
  const [saveState, setSaveState] = useState('saving') // saving | success | failed

  const runSubmit = useCallback(async () => {
    setSaveState('saving')
    try {
      await submitScore({ score })
      setSaveState('success')
    } catch {
      attemptRef.current += 1
      if (attemptRef.current < SUBMIT_MAX_ATTEMPTS) {
        // silent auto-retry — no button, the player never sees an error to act on
        retryTimer.current = setTimeout(runSubmit, SUBMIT_RETRY_MS)
      } else {
        setSaveState('failed')
      }
    }
  }, [score])

  // Submit exactly once — the ref survives StrictMode's double-invoke so the
  // score is never POSTed twice.
  useEffect(() => {
    if (submittedRef.current) return
    submittedRef.current = true
    runSubmit()
    return () => clearTimeout(retryTimer.current)
  }, [runSubmit])

  // Production: once the score is saved, auto-return to the hub — the only way
  // onward. A hub game is played once; the DEV_MODE branch below is the sole
  // replay path. No Retry / Back buttons in production.
  useEffect(() => {
    if (APP_CONFIG.DEV_MODE || saveState !== 'success') return
    const t = setTimeout(() => {
      window.location.href = APP_CONFIG.HUB_URL
    }, APP_CONFIG.REDIRECT_DELAY)
    return () => clearTimeout(t)
  }, [saveState])

  return (
    <div className="gameover">
      <div className="gameover-card">
        <img className="gameover-logo" src={logoUrl} alt="" aria-hidden="true" />

        <p className="gameover-kicker">FINAL SCORE</p>
        <h1 className="gameover-title">GAME OVER</h1>

        <div className="gameover-divider" aria-hidden="true">
          <span />
          <i />
          <span />
        </div>

        <div className="gameover-score">
          <span className="value">{score}</span>
          <span className="max">/ {MAX_SCORE}</span>
        </div>
        <p className="gameover-rating">{rating(score)}</p>

        <div className="gameover-footer">
          {APP_CONFIG.DEV_MODE ? (
            // DEV only: the single replay path. Production has no buttons at all.
            <button className="play-again" onClick={onPlayAgain}>
              Play Again
            </button>
          ) : saveState === 'success' ? (
            <p className="gameover-status">Returning to games…</p>
          ) : saveState === 'failed' ? (
            <p className="gameover-status error">
              Couldn’t save your score. Please reopen the game from your app.
            </p>
          ) : (
            <p className="gameover-status">Saving your score…</p>
          )}
        </div>
      </div>
    </div>
  )
}
