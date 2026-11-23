import { motion } from "framer-motion";
import { FaPlay, FaRotateRight, FaHouse } from "react-icons/fa6";

export default function PauseOverlay({ onResume, onRestart, onExit }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-30 flex items-center justify-center bg-heading/35 p-6 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 220, damping: 20 }}
        className="w-full max-w-xs rounded-3xl border border-border-strong/70 bg-surface px-6 py-7 text-center shadow-2xl"
      >
        <p className="font-display text-xs font-bold uppercase tracking-[0.25em] text-muted">
          Intermission
        </p>
        <h2 className="mt-2 font-display text-3xl font-bold text-heading">
          Paused
        </h2>

        <button
          onClick={onResume}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 font-display text-sm font-bold uppercase tracking-widest text-on-primary transition-colors hover:bg-primary-hover"
        >
          <FaPlay className="text-xs" /> Resume
        </button>
        <button
          onClick={onRestart}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-full border border-border-strong py-2.5 font-display text-sm font-semibold text-primary transition-colors hover:bg-primary-soft"
        >
          <FaRotateRight className="text-xs" /> Restart
        </button>
        <button
          onClick={onExit}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-full py-2.5 font-display text-sm font-semibold text-muted transition-colors hover:text-primary"
        >
          <FaHouse className="text-xs" /> Main Menu
        </button>
      </motion.div>
    </motion.div>
  );
}
