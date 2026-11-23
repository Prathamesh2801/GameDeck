import { useEffect, useState } from 'react'
import StartScreen from './components/StartScreen'
import GameScreen from './components/GameScreen'
import ResultScreen from './components/ResultScreen'
import BlockedScreen from './components/BlockedScreen'
import { generatePuzzle } from './game/generator'
import { APP_CONFIG } from './data/appConfig'
import { getToken } from './utils/token'

export default function App() {
  const [screen, setScreen] = useState('start') // start | playing | result
  const [puzzle, setPuzzle] = useState(null)
  const [result, setResult] = useState(null)

  const startGame = () => {
    setPuzzle(generatePuzzle())
    setResult(null)
    setScreen('playing')
  }

  // Production requires a signed hub token — no untracked, unscored sessions.
  // DEV_MODE bypasses this so the game can be replayed freely while developing.
  const blocked = !APP_CONFIG.DEV_MODE && !getToken()

  // Each screen owns its own scroll (e.g. the start modal's rule list); a
  // leftover scroll position from the previous screen must not carry over.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [screen])

  return (
    <div
      className="h-dvh overflow-hidden bg-background text-text"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
      <main className="mx-auto flex h-full w-full max-w-md flex-col">
        {blocked && <BlockedScreen />}
        {!blocked && screen === 'start' && <StartScreen onPlay={startGame} />}
        {!blocked && screen === 'playing' && (
          <GameScreen
            key={puzzle.id}
            puzzle={puzzle}
            onEnd={(r) => {
              setResult(r)
              setScreen('result')
            }}
          />
        )}
        {!blocked && screen === 'result' && (
          <ResultScreen result={result} onPlayAgain={startGame} />
        )}
      </main>
    </div>
  )
}
