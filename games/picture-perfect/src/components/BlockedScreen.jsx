import { motion } from "framer-motion";
import { MdLock } from "react-icons/md";

// Shown in production when the game is opened without a valid ?token=... — i.e.
// not launched from a GameDeck link. Blocks play entirely so no untracked,
// unscored session can happen.
export default function BlockedScreen() {
  return (
    <motion.div
      className="quiz-card-bg w-full max-w-md mx-auto p-6 sm:p-8 rounded-2xl shadow-[0_10px_30px_-8px_rgba(21,68,33,0.25)] text-center"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex items-center justify-center mb-4">
        <span className="flex items-center justify-center w-16 h-16 rounded-full bg-brand-card border-2 border-brand-border-strong">
          <MdLock className="text-brand-red text-3xl" />
        </span>
      </div>

      <h2 className="font-display font-bold text-2xl sm:text-3xl uppercase tracking-[0.15em] gradient-text m-0 mb-3">
        Access Blocked
      </h2>
      <p className="font-body text-sm sm:text-base text-brand-text-muted leading-relaxed m-0">
        Open Picture Perfect from your GameDeck link to play and save your score.
      </p>
    </motion.div>
  );
}
