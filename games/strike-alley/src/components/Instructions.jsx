import { C } from '../game/constants.js'
import logoUrl from '@brand/zeal-logo.png'

// First-time player walkthrough: a short title, a plain-language description,
// and an optional hint for the two skill-timing steps. The frame count comes
// from C so the copy can't drift from the real game.
const STEPS = [
  {
    title: 'Aim Your Shot',
    desc: 'A glowing arrow swings across the lane. Tap the screen to lock in your aim.',
    hint: 'Tap when the arrow is as straight as possible for the best chance of a strike.',
  },
  {
    title: 'Set Your Power',
    desc: 'Once your aim is locked, a power meter starts filling. Tap again to set your power and bowl.',
    hint: 'A full meter throws stronger and faster; tapping earlier throws slower and weaker.',
  },
  {
    title: 'Knock Down the Pins',
    desc: 'Roll the ball and knock down as many pins as you can — clearing all 10 scores the most.',
  },
  {
    title: 'Complete the Game',
    desc: `Each frame gives you up to 2 balls to clear all 10 pins. A game is ${C.TOTAL_FRAMES} frames.`,
  },
]

// Flat scoring model (matches scoreGame). One rule — a pin is worth PIN_POINTS
// — then a round bonus for clearing the rack, so the player can do the maths in
// their head. The notes spell out strike vs spare in plain words for players
// new to bowling: the key idea is *when* you clear all 10, first ball (strike)
// vs both balls (spare). Values come from C so the copy can't drift from the
// real scoring.
const ALL_TEN = 10 * C.PIN_POINTS
const SCORING = [
  {
    label: 'Every pin you knock down',
    note: 'so knocking down 5 pins scores ' + 5 * C.PIN_POINTS,
    pts: `${C.PIN_POINTS}`,
  },
  {
    label: 'Spare',
    note: `all 10 pins down using both balls — ${ALL_TEN}, plus a ${C.SPARE_SCORE - ALL_TEN} bonus`,
    pts: `${C.SPARE_SCORE}`,
  },
  {
    label: 'Strike',
    note: `all 10 pins down with your first ball — ${ALL_TEN}, plus a ${C.STRIKE_SCORE - ALL_TEN} bonus`,
    pts: `${C.STRIKE_SCORE}`,
  },
]

export default function Instructions({ onPlay }) {
  return (
    <div className="intro">
      <div className="intro-card">
        <img className="intro-logo" src={logoUrl} alt="Zeal Interactive" />
        <h1 className="intro-title">STRIKE ALLEY</h1>
        <p className="intro-tagline">Aim. Bowl. Conquer.</p>

        <div className="intro-divider" aria-hidden="true">
          <span />
          <i />
          <span />
        </div>

        <p className="intro-kicker">HOW TO PLAY</p>
        <ol className="intro-steps">
          {STEPS.map((step, i) => (
            <li className="intro-step" key={i}>
              <span className="intro-step-num">{i + 1}</span>
              <div className="intro-step-body">
                <h3 className="intro-step-title">{step.title}</h3>
                <p className="intro-step-desc">{step.desc}</p>
                {step.hint && (
                  <p className="intro-step-hint">
                    <span className="hint-tag">Hint</span>
                    {step.hint}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
        

        <p className="intro-kicker">SCORING</p>
        <ul className="intro-score">
          {SCORING.map((s) => (
            <li className="intro-score-row" key={s.label}>
              <span className="s-label">
                {s.label}
                <em>{s.note}</em>
              </span>
              <span className="s-pts">{s.pts}</span>
            </li>
          ))}
        </ul>
        <p className="intro-perfect">
          Perfect game — {C.TOTAL_FRAMES} strikes —{' '}
          <strong>{C.TOTAL_FRAMES * C.STRIKE_SCORE} points</strong>
        </p>

        <button className="intro-play" onClick={onPlay}>
          PLAY NOW
        </button>
      </div>
    </div>
  )
}
