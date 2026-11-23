// Mini rack rows, back row first, using pin indices (0 = head pin).
const RACK_ROWS = [
  [6, 7, 8, 9],
  [3, 4, 5],
  [1, 2],
  [0],
]

const HINTS = {
  AIMING: 'Aim • Tap • Bowl',
  POWER: 'Tap to lock power!',
  ROLLING: '',
  RESULT: '',
}

export default function HUD({ ui }) {
  const { phase, score, frame, totalFrames, ballNumber, standingMask, banner } =
    ui

  // every frame is up to 2 balls — a strike ends it early, no fill balls
  const ballSlots = [1, 2]

  return (
    <div className="hud">
      {/* hidden through the opening (loading + reveal), slides down at AIMING */}
      <div className={'hud-top' + (phase === 'INTRO' ? ' hidden' : '')}>
        <div className="hud-score">
          <span className="label">SCORE</span>
          <span className="value">{score}</span>
        </div>

        <div className="hud-frame">
          <span className="label">FRAME</span>
          <span className="value">
            {frame}/{totalFrames}
          </span>
        </div>

        <div className="pin-rack">
          {RACK_ROWS.map((row) => (
            <div className="row" key={row[0]}>
              {row.map((i) => (
                <span
                  key={i}
                  className={
                    'pin-dot' + ((standingMask >> i) & 1 ? '' : ' down')
                  }
                />
              ))}
            </div>
          ))}
        </div>

        <div className="hud-balls">
          <span className="label">BALL</span>
          <div className="dots">
            {ballSlots.map((n) => (
              <span
                key={n}
                className={
                  'ball-dot' +
                  (n === ballNumber ? ' active' : n < ballNumber ? ' used' : '')
                }
              />
            ))}
          </div>
        </div>
      </div>

      {banner && (
        <div
          key={banner.id}
          className={'banner' + (banner.kind ? ' ' + banner.kind : '')}
        >
          {banner.text}
        </div>
      )}

      {HINTS[phase] && <div className="hud-hint">{HINTS[phase]}</div>}
    </div>
  )
}
