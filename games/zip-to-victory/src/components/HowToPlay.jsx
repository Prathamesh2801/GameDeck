import { FaAngleRight } from 'react-icons/fa6'

/*
  The 1 → 2 → … → 8 order, rendered with an SVG chevron icon instead of the
  Unicode arrow "→", which falls back to an inconsistent glyph on many Android
  fonts. react-icons renders the same on every platform.
*/
function OrderSequence() {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 align-middle font-semibold text-heading">
      {Array.from({ length: 8 }, (_, i) => i + 1).map((n, i) => (
        <span key={n} className="inline-flex items-center gap-1.5">
          {i > 0 && <FaAngleRight className="text-[0.7em] text-accent" aria-hidden="true" />}
          {n}
        </span>
      ))}
    </span>
  )
}

const RULES = [
  <>
    Start at 1 and connect the numbers in order (<OrderSequence />).
  </>,
  'Draw one continuous path — no lifting or breaking the line.',
  'Fill every square on the board with your path.',
  'Move only up, down, left or right — no diagonal moves.',
  'Do not cross or overlap your own path.',
  'Black walls block your way — go around them.',
  'Drag backwards along your path (or tap Undo) to fix a move.',
  'Finish before the 60-second timer runs out!',
]

export default function HowToPlay() {
  return (
    <section className="w-full">
      <p className="text-center text-xs font-semibold tracking-[0.3em] text-accent uppercase">
        How to Play
      </p>

      <ol className="mt-3">
        {RULES.map((rule, i) => (
          <li
            key={i}
            className="flex gap-4 border-t border-border py-3 text-sm leading-relaxed first:border-t-0"
          >
            <span className="font-display font-semibold text-primary">
              {String(i + 1).padStart(2, '0')}
            </span>
            <span>{rule}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}
