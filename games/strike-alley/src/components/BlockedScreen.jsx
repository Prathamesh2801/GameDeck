import logoUrl from '@brand/zeal-logo.png'

// Production gate: shown when the game is opened without a hub token, so there
// are no untracked, unscored sessions. Styled to match the intro / game-over
// parchment cards.
export default function BlockedScreen() {
  return (
    <div className="blocked">
      <div className="blocked-card">
        <img className="blocked-logo" src={logoUrl} alt="" aria-hidden="true" />
        <h2 className="blocked-title">ACCESS BLOCKED</h2>

        <div className="blocked-divider" aria-hidden="true">
          <span />
          <i />
          <span />
        </div>

        <p className="blocked-text">
          Strike Alley can only be opened from the app. Please head back to your
          games list and tap it there to play.
        </p>
      </div>
    </div>
  )
}
