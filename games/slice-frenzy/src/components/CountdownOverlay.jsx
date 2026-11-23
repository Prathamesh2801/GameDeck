import { motion } from "framer-motion";

// Shows 3 · 2 · 1 · Go! at the start of each run. Driven by the scene so it
// stays in lock-step with when spawning actually begins.
export default function CountdownOverlay({ value }) {
  const go = value === "go";
  return (
    <motion.div
      initial={{ scale: 0.35, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 1.7, opacity: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center"
    >
      {go ? (
        <span className="rounded-full bg-primary px-10 py-4 font-display text-4xl font-bold tracking-[0.15em] text-on-primary shadow-2xl ring-2 ring-accent/50">
          Go!
        </span>
      ) : (
        <span className="grid h-32 w-32 place-items-center rounded-full bg-surface-translucent font-display text-7xl font-bold text-primary shadow-2xl ring-2 ring-primary/30 backdrop-blur-sm">
          {value}
        </span>
      )}
    </motion.div>
  );
}
