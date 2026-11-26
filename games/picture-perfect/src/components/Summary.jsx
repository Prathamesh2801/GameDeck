import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MdExpandMore,
  MdCheckCircle,
  MdCancel,
  MdRemoveCircle,
  MdReplay,
} from "react-icons/md";
import { FaTrophy } from "react-icons/fa";

import { QUIZ_CONFIG } from "../data/quizConfig.js";
import { isDevPlay, leaderboardUrl, REDIRECT_DELAY, submitScore } from "@sdk";

const statVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.15, duration: 0.4 },
  }),
};

const listItemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: (i) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.08, duration: 0.3 },
  }),
};

export default function Summary({ userAnswers, questions, onPlayAgain }) {
  const [showDetails, setShowDetails] = useState(false);

  const allAnswers = [...userAnswers];
  while (allAnswers.length < questions.length) {
    allAnswers.push(null);
  }

  const correctAnswers = allAnswers.filter(
    (answer, index) => answer === questions[index].answers[0],
  );
  const wrongAnswers = allAnswers.filter(
    (answer, index) =>
      answer !== null && answer !== questions[index].answers[0],
  );
  const skippedAnswers = allAnswers.filter((answer) => answer === null);

  const earnedPoints = correctAnswers.length * QUIZ_CONFIG.POINTS_PER_QUESTION;
  const maxPoints = questions.length * QUIZ_CONFIG.POINTS_PER_QUESTION;

  // Submit the score exactly once when this screen mounts. The ref guard is
  // essential: React StrictMode double-invokes effects in dev, and we must not
  // POST twice.
  const submittedRef = useRef(false);
  const [submitState, setSubmitState] = useState("submitting"); // submitting | success | error
  const [submitError, setSubmitError] = useState(null);

  const runSubmit = useCallback(async () => {
    setSubmitState("submitting");
    setSubmitError(null);
    try {
      await submitScore({ score: earnedPoints });
      setSubmitState("success");
    } catch (err) {
      setSubmitState("error");
      setSubmitError(err?.message || "Couldn't save your score. Please retry.");
    }
  }, [earnedPoints]);

  useEffect(() => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    runSubmit();
  }, [runSubmit]);

  // Production: once the score is saved, go to the leaderboard after a beat.
  useEffect(() => {
    if (isDevPlay || submitState !== "success") return;
    const timer = setTimeout(() => {
      window.location.href = leaderboardUrl;
    }, REDIRECT_DELAY);
    return () => clearTimeout(timer);
  }, [submitState]);

  const stats = [
    {
      icon: <FaTrophy className="text-brand-yellow" />,
      value: `${earnedPoints}/${maxPoints}`,
      label: "Score",
    },
    {
      icon: <MdCheckCircle className="text-brand-green" />,
      value: correctAnswers.length,
      label: "Correct",
    },
    {
      icon: <MdCancel className="text-brand-red" />,
      value: wrongAnswers.length,
      label: "Wrong",
    },
    {
      icon: <MdRemoveCircle className="text-brand-text-dim" />,
      value: skippedAnswers.length,
      label: "Skipped",
    },
  ];

  return (
    <motion.div
      className="summary-bg w-full max-w-3xl mx-auto mt-6 p-4 sm:p-6 md:p-8 text-brand-text rounded-2xl shadow-[0_10px_30px_-8px_rgba(21,68,33,0.25)]"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      <motion.div
        aria-hidden
        className="flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 rounded-full mx-auto mb-3 bg-[#fbefd6] text-[#b97a14] text-4xl sm:text-5xl drop-shadow-lg"
        initial={{ scale: 0 }}
        animate={{ scale: 1, rotate: [0, -10, 10, 0] }}
        transition={{ duration: 0.6, type: "spring", stiffness: 200 }}
      >
        <FaTrophy />
      </motion.div>

      <h2 className="font-display font-bold text-2xl sm:text-3xl md:text-4xl text-center m-0 uppercase tracking-wider text-brand-summary-dark">
        Quiz Completed!
      </h2>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 w-full sm:w-[90%] mx-auto my-5 sm:my-6 pb-5 sm:pb-6 border-b border-brand-border-strong">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            className="flex flex-col items-center"
            custom={i}
            variants={statVariants}
            initial="hidden"
            animate="visible"
          >
            <span className="text-xl mb-1">{stat.icon}</span>
            <span className="font-display text-2xl sm:text-3xl md:text-4xl text-brand-purple-dark">
              {stat.value}
            </span>
            <span className="font-display uppercase text-[0.65rem] sm:text-xs text-brand-summary-text tracking-wider -mt-1">
              {stat.label}
            </span>
          </motion.div>
        ))}
      </div>

      <div className="flex flex-col items-center gap-3 mt-1">
        {isDevPlay ? (
          <motion.button
            onClick={onPlayAgain}
            className="toggle-btn-bg flex items-center justify-center gap-2 px-6 py-2.5 font-display text-sm sm:text-base font-bold uppercase tracking-wide text-brand-purple-dark border border-brand-border-strong rounded-full cursor-pointer transition-all duration-200 hover:shadow-[0_0_12px_3px_rgba(28,85,42,0.2)]"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            <MdReplay className="text-lg" />
            <span>Play Again</span>
          </motion.button>
        ) : submitState === "submitting" ? (
          <p className="font-display text-sm uppercase tracking-wide text-brand-text-dim m-0">
            Saving your score…
          </p>
        ) : submitState === "success" ? (
          <>
            <p className="font-display text-sm uppercase tracking-wide text-brand-text-dim m-0">
              Opening the leaderboard…
            </p>
            <a
              href={leaderboardUrl}
              className="font-display text-sm font-bold uppercase tracking-wide text-brand-purple-dark underline"
            >
              See the leaderboard now
            </a>
          </>
        ) : (
          <>
            <p className="font-display text-sm text-brand-red text-center px-4 m-0">
              {submitError}
            </p>
            <motion.button
              onClick={runSubmit}
              className="toggle-btn-bg flex items-center justify-center gap-2 px-6 py-2.5 font-display text-sm sm:text-base font-bold uppercase tracking-wide text-brand-purple-dark border border-brand-border-strong rounded-full cursor-pointer transition-all duration-200 hover:shadow-[0_0_12px_3px_rgba(28,85,42,0.2)]"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              <MdReplay className="text-lg" />
              <span>Retry</span>
            </motion.button>
          </>
        )}
      </div>

      {/* <motion.button
        onClick={() => setShowDetails((prev) => !prev)}
        className="toggle-btn-bg flex items-center justify-center gap-2 mx-auto mt-4 mb-2 px-5 py-2.5 font-display text-sm sm:text-base font-bold uppercase tracking-wide text-brand-purple-dark border border-brand-border-strong rounded-full cursor-pointer transition-all duration-200 hover:shadow-[0_0_12px_3px_rgba(28,85,42,0.2)]"
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
      >
        <span>View Answers</span>
        <motion.span
          className="inline-flex items-center text-xl"
          animate={{ rotate: showDetails ? 180 : 0 }}
          transition={{ duration: 0.3 }}
        >
          <MdExpandMore />
        </motion.span>
      </motion.button> */}

      {/* <AnimatePresence>
        {showDetails && (
          <motion.ol
            className="list-none m-0 mx-auto mt-4 p-0 text-center"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            {allAnswers.map((answer, index) => {
              let statusIcon;
              let answerClass = "font-display font-bold";

              if (answer === null) {
                statusIcon = (
                  <MdRemoveCircle className="text-brand-text-dim text-lg" />
                );
                answerClass += " text-brand-text-dim font-normal";
              } else if (answer === questions[index].answers[0]) {
                statusIcon = (
                  <MdCheckCircle className="text-brand-green text-lg" />
                );
                answerClass += " text-brand-green";
              } else {
                statusIcon = <MdCancel className="text-brand-red text-lg" />;
                answerClass += " text-brand-red";
              }

              return (
                <motion.li
                  key={index}
                  className="my-4 sm:my-5"
                  custom={index}
                  variants={listItemVariants}
                  initial="hidden"
                  animate="visible"
                >
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <span className="font-display text-sm flex items-center justify-center bg-brand-purple text-brand-on-primary w-7 h-7 rounded-full">
                      {index + 1}
                    </span>
                    {statusIcon}
                  </div>
                  <p className="m-0 text-sm sm:text-base text-brand-summary-text px-2">
                    {questions[index].text}
                  </p>
                  <p className={`m-0 text-sm sm:text-base ${answerClass}`}>
                    {answer ?? "Skipped"}
                  </p>
                  {answer !== null &&
                    answer !== questions[index].answers[0] && (
                      <p className="m-0 mt-0.5 font-display text-xs sm:text-sm text-brand-green font-bold">
                        Correct: {questions[index].answers[0]}
                      </p>
                    )}
                </motion.li>
              );
            })}
          </motion.ol>
        )}
      </AnimatePresence> */}
    </motion.div>
  );
}
