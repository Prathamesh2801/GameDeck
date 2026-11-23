import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import logoImg from "@brand/zeal-logo.png";

// Shown while the selected round's images are preloaded, so a question never
// appears with a half-rendered image. Mirrors the quiz card's look & feel.
//
// The bar tracks BOTH readiness signals and fills only as fast as the slower
// one, so it reaches 100% exactly when the screen is about to dismiss —
// instead of snapping to full and then sitting there through the min-time.
export default function LoadingScreen({ loaded, total, minLoadingTime = 0 }) {
  const [timeFrac, setTimeFrac] = useState(minLoadingTime ? 0 : 1);

  useEffect(() => {
    if (!minLoadingTime) {
      setTimeFrac(1);
      return;
    }
    const start = performance.now();
    let raf;
    const tick = (now) => {
      const frac = Math.min((now - start) / minLoadingTime, 1);
      setTimeFrac(frac);
      if (frac < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [minLoadingTime]);

  const imageFrac = total ? loaded / total : 1;
  // The screen dismisses only when both images AND the min-time are done, so
  // the bar's progress is the slower (minimum) of the two.
  const pct = Math.round(Math.min(imageFrac, timeFrac) * 100);

  return (
    <motion.div
      className="quiz-card-bg w-full max-w-3xl mx-auto p-6 sm:p-8 md:p-10 rounded-2xl shadow-[0_10px_30px_-8px_rgba(21,68,33,0.25)] text-center"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
    >
      <motion.div
        className="inline-flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 bg-brand-card-deep mb-4 shadow-[0_6px_16px_-6px_rgba(21,68,33,0.35)]"
        animate={{ scale: [1, 1.06, 1], rotate: [0, 6, -6, 0] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
      >
        <img
          src={logoImg}
          alt="Zeal Interactive"
          className="w-full h-full object-contain drop-shadow-sm"
        />
      </motion.div>

      <h2 className="font-display font-bold text-2xl sm:text-3xl uppercase tracking-wider gradient-text m-0 mb-1">
        Preparing Your Quiz
      </h2>
      <p className="font-display text-xs sm:text-sm text-brand-text-dim uppercase tracking-widest m-0 mb-5">
        Loading images {loaded} / {total}
      </p>

      <div className="w-full sm:w-3/4 md:w-1/2 mx-auto h-2.5 rounded-full bg-brand-card-deep overflow-hidden">
        <div
          className="h-full rounded-full transition-[width] duration-150 ease-out"
          style={{
            width: `${pct}%`,
            background: "linear-gradient(90deg, #1c552a 0%, #2f8a4a 100%)",
          }}
        />
      </div>
    </motion.div>
  );
}
