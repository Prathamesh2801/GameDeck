import { useRef, useState, useCallback } from 'react'
import GameCanvas from './components/GameCanvas.jsx'
import HUD from './components/HUD.jsx'
import PowerMeter from './components/PowerMeter.jsx'
import GameOverScreen from './components/GameOverScreen.jsx'
import Instructions from './components/Instructions.jsx'
import BlockedScreen from './components/BlockedScreen.jsx'
import { canPlay } from '@sdk'

// Production gate: this game is only playable when launched from a GameDeck link with a
// signed token, so there are no untracked, unscored sessions. In practice play the
// token isn't required. Kept as a thin wrapper so Game's hooks stay unconditional.
export default function App() {
  if (!canPlay) return <BlockedScreen />
  return <Game />
}

function Game() {
  const gameRef = useRef(null)
  const [showIntro, setShowIntro] = useState(true) // rules screen on first launch
  const [ui, setUi] = useState({
    phase: 'AIMING',
    score: 0,
    frame: 1,
    totalFrames: 5,
    ballNumber: 1,
    standingMask: 0b1111111111,
    banner: null,
  })

  const [muted, setMuted] = useState(false)

  const handleUiState = useCallback((state) => setUi(state), [])
  const handlePlayAgain = useCallback(() => gameRef.current?.restart(), [])
  const handleStartPlay = useCallback(() => {
    gameRef.current?.startPlay() // roll the opening cinematic
    setShowIntro(false)
  }, [])
  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m
      gameRef.current?.setMuted(next)
      return next
    })
  }, [])

  return (
    <div className="app-shell">
      <GameCanvas gameRef={gameRef} onUiState={handleUiState} />
      <HUD ui={ui} />
      <PowerMeter gameRef={gameRef} visible={ui.phase === 'POWER'} />
      <button
        className="mute-btn"
        onClick={toggleMute}
        aria-label={muted ? 'Unmute' : 'Mute'}
      >
        {muted ? '🔇' : '🔊'}
      </button>
      {ui.phase === 'GAMEOVER' && (
        <GameOverScreen score={ui.score} onPlayAgain={handlePlayAgain} />
      )}
      {showIntro && <Instructions onPlay={handleStartPlay} />}
    </div>
  )
}
