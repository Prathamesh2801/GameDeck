import { useRef } from 'react'
import { rowOf, colOf } from '../game/generator'

const CELL = 100 // SVG units per cell

/*
  Stacked layers inside one square: the cell grid (fills + hairlines), an SVG
  overlay drawing the path as a fat rounded stroke, then numbers and walls on
  top. Pointer input is handled on the container so one drag sweeps across
  cells; fast swipes are interpolated one orthogonal step at a time so no
  cell is skipped. attemptCell mutates game state synchronously and returns
  whether the move was legal, so we track the working head in a ref.
*/
export default function Board({ puzzle, path, attemptCell, hintCells, nextNumber, won, disabled }) {
  const boardRef = useRef(null)
  const dragging = useRef(false)
  const workHead = useRef(null)

  const { size } = puzzle
  const visited = new Set(path)
  const head = path[path.length - 1]

  const cellFromEvent = (e) => {
    const rect = boardRef.current.getBoundingClientRect()
    const c = Math.floor(((e.clientX - rect.left) / rect.width) * size)
    const r = Math.floor(((e.clientY - rect.top) / rect.height) * size)
    if (r < 0 || r >= size || c < 0 || c >= size) return null
    return r * size + c
  }

  const tryCell = (idx) => {
    if (attemptCell(idx)) {
      workHead.current = idx
      return true
    }
    return false
  }

  /* Walk from the working head toward the hovered cell one orthogonal step
     at a time (longer axis first), applying each legal move along the way. */
  const moveToward = (target) => {
    for (let guard = 0; guard < size * size; guard++) {
      const cur = workHead.current
      if (cur === target) return
      const rd = rowOf(target, size) - rowOf(cur, size)
      const cd = colOf(target, size) - colOf(cur, size)
      const rowStep = rd !== 0 ? cur + Math.sign(rd) * size : null
      const colStep = cd !== 0 ? cur + Math.sign(cd) : null
      const tries = Math.abs(rd) >= Math.abs(cd) ? [rowStep, colStep] : [colStep, rowStep]
      if (!tries.some((t) => t != null && tryCell(t))) return
    }
  }

  const handlePointerDown = (e) => {
    if (disabled) return
    dragging.current = true
    workHead.current = head
    boardRef.current.setPointerCapture?.(e.pointerId)
    const cell = cellFromEvent(e)
    if (cell != null) tryCell(cell)
  }

  const handlePointerMove = (e) => {
    if (!dragging.current || disabled) return
    const cell = cellFromEvent(e)
    if (cell == null || cell === workHead.current) return
    if (!tryCell(cell)) moveToward(cell)
  }

  const endDrag = () => {
    dragging.current = false
  }

  /* SVG path points at cell centers */
  const points = path
    .map((idx) => `${(colOf(idx, size) + 0.5) * CELL},${(rowOf(idx, size) + 0.5) * CELL}`)
    .join(' ')
  const headX = (colOf(head, size) + 0.5) * CELL
  const headY = (rowOf(head, size) + 0.5) * CELL

  /* Wall segments (slightly overhanging the shared edge, LinkedIn style) */
  const pct = (v) => `${(v / size) * 100}%`
  const wallBars = [...puzzle.walls].map((key) => {
    const [a, b] = key.split('-').map(Number)
    const r = rowOf(a, size)
    const c = colOf(a, size)
    return b === a + 1
      ? {
          key,
          style: {
            left: pct(c + 1),
            top: `calc(${pct(r)} - 3px)`,
            height: `calc(${pct(1)} + 6px)`,
            width: '7px',
            transform: 'translateX(-50%)',
          },
        }
      : {
          key,
          style: {
            top: pct(r + 1),
            left: `calc(${pct(c)} - 3px)`,
            width: `calc(${pct(1)} + 6px)`,
            height: '7px',
            transform: 'translateY(-50%)',
          },
        }
  })

  const hintSet = new Set(hintCells)

  return (
    <div
      ref={boardRef}
      className={`relative aspect-square w-full select-none overflow-hidden rounded-card border-2 border-border-strong bg-surface shadow-card ${won ? 'animate-win' : ''}`}
      style={{ touchAction: 'none', WebkitTouchCallout: 'none' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {/* cell grid */}
      <div
        className="absolute inset-0 grid"
        style={{
          gridTemplateColumns: `repeat(${size}, 1fr)`,
          gridTemplateRows: `repeat(${size}, 1fr)`,
        }}
      >
        {Array.from({ length: size * size }, (_, idx) => (
          <div
            key={idx}
            className={`border-[0.5px] border-border transition-colors duration-150 ${
              hintSet.has(idx) ? 'animate-hint' : visited.has(idx) ? 'bg-primary-soft' : 'bg-surface'
            }`}
          />
        ))}
      </div>

      {/* path */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox={`0 0 ${size * CELL} ${size * CELL}`}
      >
        {path.length > 1 && (
          <polyline
            points={points}
            fill="none"
            stroke="var(--color-primary)"
            strokeOpacity="0.9"
            strokeWidth={CELL * 0.55}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        <circle cx={headX} cy={headY} r={CELL * 0.3} fill="var(--color-primary)" fillOpacity="0.95" />
      </svg>

      {/* numbered waypoints */}
      {puzzle.numberCells.map((idx, i) => {
        const n = i + 1
        const isCollected = visited.has(idx)
        const isNext = n === nextNumber
        return (
          <div
            key={idx}
            className="pointer-events-none absolute"
            style={{
              left: `${((colOf(idx, size) + 0.5) / size) * 100}%`,
              top: `${((rowOf(idx, size) + 0.5) / size) * 100}%`,
              width: `${58 / size}%`,
              aspectRatio: '1',
              transform: 'translate(-50%, -50%)',
            }}
          >
            <div
              className={`flex h-full w-full items-center justify-center rounded-full bg-heading font-bold text-on-primary ${isCollected ? 'animate-pop' : ''}`}
              style={{
                fontSize: 'clamp(0.85rem, 4vw, 1.15rem)',
                boxShadow: isNext
                  ? '0 0 0 3px var(--color-surface), 0 0 0 6px var(--color-primary)'
                  : '0 1px 4px rgba(70,30,15,0.35)',
              }}
            >
              {n}
            </div>
          </div>
        )
      })}

      {/* walls */}
      {wallBars.map(({ key, style }) => (
        <div key={key} className="pointer-events-none absolute rounded-full bg-heading" style={style} />
      ))}
    </div>
  )
}
