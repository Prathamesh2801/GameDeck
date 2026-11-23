import { useEffect, useRef, useState } from 'react'

export const GAME_SECONDS = 60

/*
  Countdown driven by requestAnimationFrame against real elapsed time
  (no setInterval drift). Stops updating when `active` goes false, so the
  last rendered value is the frozen time remaining.
*/
export function useTimer(durationSeconds, active, onExpire) {
  const [remaining, setRemaining] = useState(durationSeconds)
  const remainingRef = useRef(durationSeconds)
  const onExpireRef = useRef(onExpire)
  onExpireRef.current = onExpire

  useEffect(() => {
    if (!active) return
    const startedAt = performance.now()
    const budget = remainingRef.current
    let raf

    const tick = (now) => {
      const left = Math.max(0, budget - (now - startedAt) / 1000)
      remainingRef.current = left
      setRemaining(left)
      if (left <= 0) {
        onExpireRef.current?.()
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [active])

  return remaining
}

export function formatTime(seconds) {
  const s = Math.ceil(seconds)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
