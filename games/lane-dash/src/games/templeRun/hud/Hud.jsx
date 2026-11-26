import { useEffect, useRef } from 'react';
import { EventBus } from '../game/EventBus';

const COIN_SPRITE = `${import.meta.env.BASE_URL}assets/templeRun/coin-score.png`;

/** ms → "M:SS" (e.g. 120000 → "2:00", 9000 → "0:09"). */
function formatTime(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Top HUD overlay — one row of compact stat tiles: Score + Coins (left), the
 * countdown Timer (center) and Lives/hearts (right, where the removed pause
 * button used to sit). Coins are a bonus on top of the score (final score =
 * score + coins × POINTS_PER_COIN); the run ends when the timer hits 0 or all
 * lives are lost.
 *
 * Fully pointer-events-none so every tap/swipe reaches the canvas (there are no
 * interactive controls up here anymore). The row honours the iOS safe-area
 * insets (notch / status bar) so it never renders under the notch in a
 * standalone PWA — needs `viewport-fit=cover` (set in index.html). Tiles are
 * sized to fit side-by-side down to ~320px-wide devices.
 */
export function Hud({ score, coins, timeLeft, lives, maxLives }) {
  const urgent = timeLeft <= 10000; // last 10s → accent the clock
  // Report the coin tile's live center to the scene (mount + resize) so
  // collected coins can fly to the real counter (RunScene.flyCoinToHud). The
  // canvas fills the same full-screen container, so viewport px == game px.
  const coinsRef = useRef(null);
  useEffect(() => {
    const report = () => {
      const el = coinsRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      EventBus.emit('hud-coins-pos', { x: r.left + r.width / 2, y: r.top + r.height / 2 });
    };
    report();
    window.addEventListener('resize', report);
    return () => window.removeEventListener('resize', report);
  }, []);

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2"
      style={{
        // Push the stats clear of the notch / status bar on every device.
        paddingTop: 'max(0.6rem, env(safe-area-inset-top, 0px))',
        paddingLeft: 'max(0.6rem, env(safe-area-inset-left, 0px))',
        paddingRight: 'max(0.6rem, env(safe-area-inset-right, 0px))',
      }}
    >
      {/* Left: Score + Coins */}
      <div className="flex gap-2">
        <StatTile label="Score">{score}</StatTile>
        <div ref={coinsRef}>
          <StatTile label="Coins" tone="accent">
            <CoinIcon />
            {coins}
          </StatTile>
        </div>
      </div>

      {/* Center: countdown clock */}
      <StatTile label="Time" tone={urgent ? 'primary' : undefined}>
        {formatTime(timeLeft)}
      </StatTile>

      {/* Right: lives (replaces the old pause button) */}
      <StatTile label="Lives" aria-label={`${lives} of ${maxLives} lives remaining`}>
        <span className="flex items-center gap-1">
          {Array.from({ length: maxLives }, (_, i) => (
            <HeartIcon key={i} filled={i < lives} />
          ))}
        </span>
      </StatTile>
    </div>
  );
}

/**
 * One glass stat tile: a small uppercase label over a bold value. `tone`
 * colours the value (accent = coins gold, primary = urgent/brand). Kept compact
 * (small padding + text) so four tiles fit across a narrow phone.
 */
function StatTile({ label, tone, children, ...rest }) {
  const toneClass =
    tone === 'accent' ? 'text-accent' : tone === 'primary' ? 'text-primary' : 'text-heading';
  return (
    <div className="glass-card rounded-2xl px-3 py-1.5 text-center" {...rest}>
      <div className="text-hud text-[9px] font-semibold uppercase leading-none tracking-[0.14em] text-muted">
        {label}
      </div>
      <div
        className={`text-hud mt-1 flex items-center justify-center gap-1 text-lg font-bold leading-none tabular-nums ${toneClass}`}
      >
        {children}
      </div>
    </div>
  );
}

function CoinIcon() {
  return (
    <img
      src={COIN_SPRITE}
      alt=""
      className="h-4 w-4 shrink-0"
      style={{ objectFit: 'cover', objectPosition: '0 0' }}
      draggable={false}
    />
  );
}

function HeartIcon({ filled }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      className={filled ? 'text-primary' : 'text-muted/40'}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 21s-7.5-4.9-10-9.3C.6 9 1.5 5.6 4.6 4.7 6.7 4.1 9 5 12 8c3-3 5.3-3.9 7.4-3.3 3.1.9 4 4.3 2.6 7-2.5 4.4-10 9.3-10 9.3z" />
    </svg>
  );
}
