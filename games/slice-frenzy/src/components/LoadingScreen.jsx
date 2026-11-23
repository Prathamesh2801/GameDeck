import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { GiThreeLeaves } from "react-icons/gi";
import logo from "@brand/zeal-logo.png";

// Themed boot screen shown while Phaser streams in the fruit / sweet / bomb
// sprites and sound effects. `progress` is the real asset-load fraction (0→1)
// coming off the scene; once it fills we hold a short beat, then `onDone`
// dismisses us and the countdown begins.
export default function LoadingScreen({ progress = 0, onDone }) {
  const pct = Math.round(Math.min(1, progress) * 100);
  const firedRef = useRef(false);

  useEffect(() => {
    if (progress < 1 || firedRef.current) return;
    firedRef.current = true;
    const t = setTimeout(() => onDone?.(), 450); // let the full bar register
    return () => clearTimeout(t);
  }, [progress, onDone]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: "easeInOut" }}
      className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-6 bg-surface px-8 text-center"
    >
      {/* Emblem with a soft breathing glow */}
      <div className="relative">
        <motion.div
          className="absolute inset-0 rounded-3xl bg-primary/30 blur-xl"
          animate={{ scale: [1, 1.15, 1], opacity: [0.35, 0.6, 0.35] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.img
          src={logo}
          alt="Zeal Interactive"
          className="relative h-20 w-20 object-contain"
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <div>
        <h1 className="font-display text-3xl font-bold tracking-[0.12em] text-heading">
          SLICE FRENZY
        </h1>
        <div className="mt-2 flex items-center justify-center gap-2.5 text-accent/70">
          <span className="h-px w-10 bg-gradient-to-r from-transparent to-border-strong" />
          <GiThreeLeaves className="text-base" />
          <span className="h-px w-10 bg-gradient-to-l from-transparent to-border-strong" />
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-[220px]">
        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted ring-1 ring-border-strong/40">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
            initial={{ width: "0%" }}
            animate={{ width: `${pct}%` }}
            transition={{ ease: "easeOut", duration: 0.3 }}
          />
        </div>
        <div className="mt-3 flex items-center justify-between font-display text-[11px] font-bold uppercase tracking-[0.22em] text-muted">
          <span>Sharpening the blade</span>
          <span className="tabular-nums text-primary">{pct}%</span>
        </div>
      </div>
    </motion.div>
  );
}
