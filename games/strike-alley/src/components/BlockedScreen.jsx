import logoUrl from '@brand/zeal-logo.png'

// Production gate: shown when the game is opened without a play token, so there
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
          Open Strike Alley from your GameDeck link to play and save your score.
        </p>
      </div>
    </div>
  )
}
