import { motion } from 'framer-motion';

import LOGO from '@brand/zeal-logo.png';

/**
 * Shown in production when the game is opened without a hub token — there's no
 * user/game to score against, so play is blocked (spec: no untracked sessions).
 * Matches the StartScreen card styling (glass-card + brand logo + amber divider).
 */
export function BlockedScreen() {
  return (
    <motion.div
      className="absolute inset-0 grid place-items-center bg-heading/40 p-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.div
        className="glass-card rounded-card w-full max-w-sm px-8 py-9 text-center"
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ ease: [0.2, 0.8, 0.2, 1], duration: 0.4 }}
      >
        <img
          src={LOGO}
          alt="Zeal Interactive"
          className="mx-auto h-16 w-16 object-contain"
          draggable={false}
        />
        <h1 className="font-display mt-3 text-3xl font-bold text-heading">Lane Dash</h1>

        <div className="mt-4 flex items-center justify-center gap-2" aria-hidden="true">
          <span className="via-accent/60 h-px w-10 bg-linear-to-r from-transparent to-transparent" />
          <span className="bg-accent/70 h-1.5 w-1.5 rotate-45" />
          <span className="via-accent/60 h-px w-10 bg-linear-to-r from-transparent to-transparent" />
        </div>

        <h2 className="text-hud font-display mt-4 text-2xl font-bold text-primary">
          Access Blocked
        </h2>
        <p className="text-muted mx-auto mt-3 max-w-[18rem] text-sm leading-relaxed">
          This game can only be opened from the app. Please head back and tap it
          from your games list.
        </p>
      </motion.div>
    </motion.div>
  );
}
