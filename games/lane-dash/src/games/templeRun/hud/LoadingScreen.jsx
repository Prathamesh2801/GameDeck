import { motion } from 'framer-motion';
import LOGO from '@brand/zeal-logo.png';

/**
 * Loading overlay shown during the `loading` phase. `progress` is 0–1 from the
 * Phaser loader (dominated by the video download); we hold here until BootScene
 * → RunScene reports `ready` (video first frame decoded), so the game never
 * flashes an un-rendered backdrop.
 */
export function LoadingScreen({ progress = 0 }) {
  const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100);
  return (
    <div className="absolute inset-0 grid place-items-center bg-background">
      <div className="w-full max-w-xs px-10 text-center">
        <img
          src={LOGO}
          alt="Zeal Interactive"
          className="mx-auto h-16 w-16 object-contain"
          draggable={false}
        />
        <h1 className="font-display mt-3 text-3xl font-bold text-heading">Lane Dash</h1>

        <div className="bg-surface-muted mt-8 h-2 w-full overflow-hidden rounded-pill">
          <motion.div
            className="bg-primary h-full rounded-pill"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ ease: 'linear', duration: 0.2 }}
          />
        </div>
        <p className="text-hud text-muted mt-3 text-xs font-medium">
          Loading… {pct}%
        </p>
      </div>
    </div>
  );
}
