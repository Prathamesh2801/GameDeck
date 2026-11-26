import { FaLock } from 'react-icons/fa6'

/*
  Shown in production when the game is opened without a play token — no
  untracked, unscored sessions. Mirrors the StartScreen's full-screen modal look
  (brand backdrop behind a single floating surface card).
*/
export default function BlockedScreen() {
  return (
    <div className="relative flex w-full flex-1 flex-col overflow-hidden">
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(120% 80% at 50% 0%, var(--brand-700), var(--ink-900))' }}
        aria-hidden="true"
      />

      <div className="relative flex flex-1 overflow-y-auto px-5 py-8">
        <div className="animate-rise m-auto w-full max-w-sm overflow-hidden rounded-card bg-surface p-8 text-center shadow-card">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary-soft text-3xl text-primary shadow-card">
            <FaLock />
          </div>
          <h2 className="text-hud mt-6 text-2xl font-bold text-heading">Access Blocked</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Open this game from your GameDeck link to play and save your score.
          </p>
        </div>
      </div>
    </div>
  )
}
