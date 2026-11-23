import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { EventBus } from '../game/EventBus';
import { SOUNDS } from '../game/constants';

const SEQUENCE = ['3', '2', '1', 'GO!'];
const STEP_MS = 650; // keep in step with the camera zoom in RunScene.startZoom

/**
 * Full-screen 3·2·1·GO! overlay shown in the `countdown` phase while the Phaser
 * camera zooms in on the idling player. Calls onDone after the last step, which
 * flips the phase to `running` and tells the scene to begin the run.
 *
 * pointer-events-none so swipes/taps still reach the canvas underneath.
 */
export function Countdown({ onDone }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (step >= SEQUENCE.length) {
      onDone();
      return;
    }
    const t = setTimeout(() => setStep((s) => s + 1), STEP_MS);
    return () => clearTimeout(t);
  }, [step, onDone]);

  // A beep per "3, 2, 1" and a distinct sting on "GO!" — Countdown has no
  // scene of its own, so it routes through the generic EventBus 'sfx' bridge
  // RunScene listens for (see RunScene.bindEventBus).
  useEffect(() => {
    if (step >= SEQUENCE.length) return;
    EventBus.emit('sfx', SEQUENCE[step] === 'GO!' ? SOUNDS.COUNTDOWN_GO : SOUNDS.COUNTDOWN_BEEP);
  }, [step]);

  if (step >= SEQUENCE.length) return null;

  const isGo = SEQUENCE[step] === 'GO!';

  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center">
      <AnimatePresence mode="popLayout">
        <motion.span
          key={step}
          initial={{ scale: 0.3, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 1.7, opacity: 0 }}
          transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }}
          className={`text-hud font-display font-bold drop-shadow-[0_6px_22px_rgba(13,22,17,0.45)] ${
            isGo ? 'text-7xl text-accent' : 'text-9xl text-primary'
          }`}
        >
          {SEQUENCE[step]}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}
