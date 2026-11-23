import { useEffect, useRef } from 'react'

// Self-animating overlay: reads the oscillating power straight off the Game
// instance with its own rAF loop so React never re-renders at 60fps.
export default function PowerMeter({ gameRef, visible }) {
  const fillRef = useRef(null)

  useEffect(() => {
    if (!visible) return
    let raf
    const tick = () => {
      const game = gameRef.current
      if (game && fillRef.current) {
        fillRef.current.style.height = `${(game.getPower() * 100).toFixed(1)}%`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [visible, gameRef])

  if (!visible) return null

  return (
    <div className="power-meter">
      <div className="fill" ref={fillRef} />
      <div className="ticks" />
    </div>
  )
}
