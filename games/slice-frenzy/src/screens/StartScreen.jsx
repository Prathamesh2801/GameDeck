import { motion } from "framer-motion";
import { GiThreeLeaves } from "react-icons/gi";
import logo from "@brand/zeal-logo.png";

/* Staggered entrance for the whole panel */
const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 },
  },
};

const rise = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

// Numbered "how to play" steps, shown as a clean list (no icons).
const STEPS = [
  "Slash the fruits: swipe to slice mango, orange, pomegranate, and watermelon.",
  "Every fruit you slice is worth +5 points.",
  "Slice multiple fruits in a single swipe to earn combo bonuses.",
  "When a Ghewar or Mawa Kachori appears, keep slicing it as it grows bigger to earn a higher bonus.",
  "Collecting the power-up awards +50 points.",
  "Avoid the bomb. Let it fall past safely, because slicing it costs -10 points.",
  "The game lasts 2 minutes — score as many points as you can before time runs out.",
];

export default function StartScreen({ onStart }) {
  return (
    // scroll container — min-h-full + justify-center centres when short,
    // and scrolls when content is taller than the frame
    <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
      <motion.main
        variants={container}
        initial="hidden"
        animate="show"
        className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-6 py-6 text-center"
      >
        {/* Emblem */}
        <motion.div variants={rise} className="flex justify-center">
          <motion.img
            src={logo}
            alt="Zeal Interactive"
            className="h-20 w-20 object-contain sm:h-24 sm:w-24"
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>

        {/* Title */}
        <motion.h1
          variants={rise}
          className="mt-4 font-display text-4xl font-bold tracking-[0.12em] text-heading sm:text-5xl"
        >
          SLICE FRENZY
        </motion.h1>

        <motion.p
          variants={rise}
          className="mx-auto mt-1.5 max-w-sm font-display text-xl italic text-primary sm:text-2xl"
        >
          Slash. Score. Conquer.
        </motion.p>

        {/* slash divider */}
        <motion.div
          variants={rise}
          className="mx-auto mt-4 flex items-center justify-center gap-3 text-accent/70"
        >
          <span className="h-px w-16 bg-gradient-to-r from-transparent to-border-strong" />
          <GiThreeLeaves className="text-lg" />
          <span className="h-px w-16 bg-gradient-to-l from-transparent to-border-strong" />
        </motion.div>

        {/* How to play */}
        <motion.h2
          variants={rise}
          className="mt-5 font-display text-xs font-bold uppercase tracking-[0.25em] text-muted"
        >
          How to play
        </motion.h2>

        <motion.ol
          variants={rise}
          className="mt-3 divide-y divide-border/60 text-left"
        >
          {STEPS.map((step, i) => (
            <li key={i} className="flex items-start gap-4 py-3">
              <span className="font-display text-lg font-bold leading-none tabular-nums text-primary">
                {String(i + 1).padStart(2, "0")}
              </span>
              <p className="text-[13px] leading-snug text-muted">{step}</p>
            </li>
          ))}
        </motion.ol>

        {/* Play */}
        <motion.button
          variants={rise}
          onClick={onStart}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
          className="mt-6 self-center rounded-full bg-primary px-12 py-3.5 font-display text-base font-bold uppercase tracking-[0.15em] text-on-primary shadow-lg shadow-primary/30 transition-colors hover:bg-primary-hover"
        >
          Play Now
        </motion.button>
      </motion.main>
    </div>
  );
}
