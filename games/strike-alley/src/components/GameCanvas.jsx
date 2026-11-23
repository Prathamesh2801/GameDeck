import { useEffect, useRef } from 'react'
import { Game } from '../game/game.js'

export default function GameCanvas({ gameRef, onUiState }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const game = new Game(canvasRef.current, onUiState)
    gameRef.current = game
    game.start()
    return () => {
      gameRef.current = null
      game.destroy()
    }
  }, [gameRef, onUiState])

  return <canvas ref={canvasRef} className="game-canvas" />
}
