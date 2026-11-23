import { motion } from "framer-motion";

// Top banner shown during the Feast bonus round. Pointer-events-none so the
// player's slashes pass straight through to the canvas underneath.
export default function FeastBanner({ duration, perSlash, bonusEvery, bonus }) {
  return (
    <motion.div
      key="feast"
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="pointer-events-none absolute inset-x-0 top-20 z-20 flex flex-col items-center"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 16 }}
        className="rounded-full bg-primary/90 px-6 py-2 shadow-xl ring-1 ring-accent/50"
      >
        <span className="font-display text-lg font-bold tracking-wide text-on-primary">
          ✦ Sweet Feast ✦
        </span>
      </motion.div>

      <p className="mt-1.5 font-display text-[11px] font-bold uppercase tracking-[0.25em] text-heading drop-shadow-sm">
        +{perSlash} each · +{bonus} every {bonusEvery}!
      </p>

      {/* draining timer bar */}
      <div className="mt-2 h-1.5 w-44 overflow-hidden rounded-full bg-surface/60 ring-1 ring-border/60">
        <motion.div
          className="h-full rounded-full bg-accent"
          initial={{ width: "100%" }}
          animate={{ width: "0%" }}
          transition={{ duration: duration / 1000, ease: "linear" }}
        />
      </div>
    </motion.div>
  );
}
