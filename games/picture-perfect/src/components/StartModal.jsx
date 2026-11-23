import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { QUIZ_CONFIG } from "../data/quizConfig.js";
import logoImg from "@brand/zeal-logo.png";

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const modalVariants = {
  hidden: { opacity: 0, scale: 0.9, y: 30 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: "spring", stiffness: 260, damping: 24, delay: 0.1 },
  },
};

const ruleVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.3 + i * 0.08, duration: 0.35 },
  }),
};

export default function StartModal({ onStart }) {
  const perQuestionSeconds = Math.floor(QUIZ_CONFIG.PER_QUESTION_TIME / 1000);
  const totalSeconds = perQuestionSeconds * QUIZ_CONFIG.QUESTIONS_PER_QUIZ;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const totalSecondsRem = totalSeconds % 60;
  const totalTimeText =
    totalMinutes > 0
      ? `${totalMinutes} minute${totalMinutes > 1 ? "s" : ""}${
          totalSecondsRem ? ` ${totalSecondsRem} seconds` : ""
        }`
      : `${totalSeconds} seconds`;

  const rules = [
    `${QUIZ_CONFIG.QUESTIONS_PER_QUIZ} picture rounds — one image appears in each round.`,
    "Observe the image carefully",
    "Choose the correct answer from the 3 options provided",
    `${QUIZ_CONFIG.POINTS_PER_QUESTION} points for every correct answer`,
    `${totalTimeText} total to complete all ${QUIZ_CONFIG.QUESTIONS_PER_QUIZ} rounds`,
    `${perQuestionSeconds} seconds per question — unanswered questions auto-skip`,
    "Correct answer → Green flash & points awarded",
    "Wrong answer → Red flash, and the correct answer is revealed",
    "Skipped questions earn 0 points",
    "Score as many points as possible before time runs out!",
  ];

  return createPortal(
    <motion.div
      className="fixed inset-0 z-50 overflow-y-auto"
      variants={backdropVariants}
      initial="hidden"
      animate="visible"
    >
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" aria-hidden />

      <div className="relative min-h-full flex items-center justify-center p-4 py-8">
        <motion.div
          className="relative w-full max-w-md sm:max-w-lg quiz-card-bg rounded-2xl shadow-2xl shadow-brand-purple/20"
          variants={modalVariants}
          initial="hidden"
          animate="visible"
        >
          <div className="px-6 pt-8 pb-6 sm:px-10 sm:pt-10 text-center border-b border-brand-border">
            <img
              src={logoImg}
              alt="Zeal Interactive"
              className="w-16 h-16 sm:w-20 sm:h-20 object-contain mx-auto mb-4 drop-shadow-sm"
            />

            <h2 className="font-display font-bold text-2xl sm:text-3xl uppercase tracking-[0.15em] gradient-text m-0 mb-2">
              PICTURE PERFECT
            </h2>
            <p className="font-display text-xs sm:text-sm text-brand-text-dim uppercase tracking-[0.25em] m-0">
              READY TO PLAY?
            </p>
          </div>

          <div className="px-6 py-6 sm:px-10 sm:py-7">
            <p className="font-display text-[0.7rem] sm:text-xs uppercase tracking-[0.3em] text-brand-text-dim m-0 mb-4">
              How to Play
            </p>

            <ul className="list-none m-0 p-0 divide-y divide-brand-border">
              {rules.map((rule, i) => (
                <motion.li
                  key={i}
                  className="flex items-baseline gap-4 py-3"
                  custom={i}
                  variants={ruleVariants}
                  initial="hidden"
                  animate="visible"
                >
                  <span
                    className="font-display text-base sm:text-lg font-semibold leading-none shrink-0 tabular-nums"
                    style={{ color: "#1c552a" }}
                  >
                    {(i + 1).toString().padStart(2, "0")}
                  </span>
                  <span className="font-body text-sm sm:text-[0.95rem] text-brand-text-muted leading-relaxed">
                    {rule}
                  </span>
                </motion.li>
              ))}
            </ul>
          </div>

          <div className="px-6 pb-8 pt-2 sm:px-10 sm:pb-10">
            <motion.button
              onClick={onStart}
              className="w-full py-3.5 sm:py-4 rounded-full font-display font-bold text-base sm:text-lg uppercase tracking-[0.2em] border-none cursor-pointer text-white"
              style={{
                background:
                  "linear-gradient(135deg, #24703a 0%, #154421 100%)",
              }}
              whileHover={{
                scale: 1.02,
                boxShadow: "0 0 24px 6px rgba(28, 85, 42, 0.3)",
              }}
              whileTap={{ scale: 0.98 }}
            >
              Start Quiz
            </motion.button>
          </div>
        </motion.div>
      </div>
    </motion.div>,
    document.body
  );
}
