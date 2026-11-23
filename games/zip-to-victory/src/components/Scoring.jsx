import { FaHashtag, FaTableCells, FaTrophy, FaBolt } from 'react-icons/fa6'
import { SCORING } from '../game/score'

/*
  Scoring explainer for the start screen. Values are pulled straight from the
  SCORING constants so the instructions can never drift from what the game
  actually awards.
*/
const ITEMS = [
  {
    icon: FaHashtag,
    label: 'Each number you link',
    value: `+${SCORING.perNumber}`,
  },
  {
    icon: FaTableCells,
    label: 'Each square you fill',
    value: `+${SCORING.perCell}`,
  },
  {
    icon: FaTrophy,
    label: 'Complete the whole board',
    value: `+${SCORING.completionBonus.toLocaleString()}`,
  },
  {
    icon: FaBolt,
    label: 'Every second left on the clock',
    value: `+${SCORING.perSecondLeft}`,
  },
]

export default function Scoring() {
  return (
    <section className="w-full">
      <p className="text-center text-xs font-semibold tracking-[0.3em] text-accent uppercase">
        Scoring
      </p>
      <p className="mt-2 text-center text-xs leading-relaxed text-muted">
        Every number counts — and the faster you finish, the bigger your score.
      </p>

      <ul className="mt-3 space-y-2">
        {ITEMS.map(({ icon: Icon, label, value }) => (
          <li
            key={label}
            className="flex items-center gap-3 rounded-2xl bg-surface-muted px-4 py-2.5"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
              <Icon className="text-sm" />
            </span>
            <span className="flex-1 text-sm text-text">{label}</span>
            <span className="font-display text-sm font-bold tabular-nums text-accent-strong">
              {value}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
