import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MdTimer } from 'react-icons/md';

// Colour for the fill while the clock is still running: green with plenty of
// time, easing through amber, to red as it runs out. Driven by how much of the
// window is left (1 = full, 0 = empty).
function getTimingColor(ratio) {
  const clamped = Math.max(0, Math.min(1, ratio));
  // Hue 140 (green) -> 0 (red), passing ~60 (yellow) on the way down.
  const hue = clamped * 140;
  return `hsl(${hue}, 68%, 45%)`;
}

// Colour for the fill once the question has resolved.
const REVEAL_COLORS = {
  answered: '#b97a14', // amber — selection registered, awaiting reveal
  correct: '#2f8a4a',
  wrong: '#c4453b',
  skipped: '#8a958d', // muted tan — timed out, no answer
};

export default function QuestionTimer({ timeout, onTimeout, mode, showTime }) {
  const [remainingTime, setRemainingTime] = useState(timeout);

  useEffect(() => {
    if (!onTimeout) return;
    const timer = setTimeout(onTimeout, timeout);
    return () => clearTimeout(timer);
  }, [timeout, onTimeout]);

  useEffect(() => {
    const interval = setInterval(() => {
      setRemainingTime((prevRemainingTime) => Math.max(prevRemainingTime - 100, 0));
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // Both the numeric badge and the bar read from the same state, so they stay
  // perfectly in sync with the allotted time for the question.
  const ratio = remainingTime / timeout;
  const seconds = Math.ceil(remainingTime / 1000);
  const isLowTime = remainingTime <= 5000;

  // While answering, colour by time left; after resolving, colour by outcome.
  const barColor = showTime ? getTimingColor(ratio) : REVEAL_COLORS[mode] || '#1c552a';

  return (
    <div className="flex flex-col items-center gap-2">
      {showTime && (
        <motion.div
          className={`flex items-center gap-1.5 font-display font-bold px-3 py-1 rounded-full ${
            isLowTime
              ? 'bg-brand-red/20 text-brand-red'
              : 'bg-brand-purple/20 text-brand-pink'
          }`}
          animate={isLowTime ? { scale: [1, 1.08, 1] } : {}}
          transition={isLowTime ? { duration: 1, repeat: Infinity } : {}}
        >
          <MdTimer className="text-lg" />
          <span className="text-lg sm:text-xl">{seconds}s</span>
        </motion.div>
      )}
      <progress
        className={`progress-bar w-full sm:w-3/4 md:w-1/2 ${mode || ''}`}
        style={{ '--bar-color': barColor }}
        max={timeout}
        value={remainingTime}
      />
    </div>
  );
}
