import { FaPlay } from 'react-icons/fa6'
import HowToPlay from './HowToPlay'
import Scoring from './Scoring'
import zealLogo from '@brand/zeal-logo.png'

/*
  Full-screen modal presentation: a deep brand-green backdrop behind a single
  floating card (brand mark, title, rules, Start button). The card is the
  whole screen, not a page with a separate button below it.
*/
export default function StartScreen({ onPlay }) {
  return (
    <div className="relative flex w-full flex-1 flex-col overflow-hidden">
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(120% 80% at 50% 0%, var(--brand-700), var(--ink-900))' }}
        aria-hidden="true"
      />

      <div className="relative flex flex-1 overflow-y-auto px-5 py-8">
        <div className="animate-rise m-auto w-full max-w-sm overflow-hidden rounded-card bg-surface shadow-card">
          <div className="flex flex-col items-center px-6 pt-7 pb-2 text-center">
            <img src={zealLogo} alt="Zeal Interactive" width={56} height={56} className="h-14 w-14" />
            <h1 className="mt-4 font-display text-3xl font-bold text-heading">Zip to Victory</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Connect the numbers. Fill every square. Race the clock.
            </p>
          </div>

          <div className="border-t border-border px-6 py-5">
            <HowToPlay />
          </div>

          <div className="border-t border-border px-6 py-5">
            <Scoring />
          </div>

          <div className="px-6 pb-6">
            <button
              type="button"
              onClick={onPlay}
              className="flex w-full items-center justify-center gap-3 rounded-pill bg-primary py-4 text-lg font-semibold tracking-wide text-on-primary shadow-glow transition-colors duration-200 hover:bg-primary-hover active:scale-95"
            >
              <FaPlay className="text-sm" />
              Start Game
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
