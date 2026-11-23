import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MdQuiz } from "react-icons/md";

import ALL_QUESTIONS from "../data/questions.js";
import { QUIZ_CONFIG } from "../data/quizConfig.js";
import { APP_CONFIG } from "../data/appConfig.js";
import { getToken } from "../utils/token.js";
import Question from "./Question.jsx";
import Summary from "./Summary.jsx";
import StartModal from "./StartModal.jsx";
import LoadingScreen from "./LoadingScreen.jsx";
import BlockedScreen from "./BlockedScreen.jsx";

function getRandomQuestions(allQuestions, count) {
  const shuffled = [...allQuestions].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export default function Quiz() {
  const [quizStarted, setQuizStarted] = useState(false);
  const [userAnswers, setUserAnswers] = useState([]);
  const [imagesReady, setImagesReady] = useState(false);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const [loadedCount, setLoadedCount] = useState(0);
  const selectedQuestions = useRef(
    getRandomQuestions(ALL_QUESTIONS, QUIZ_CONFIG.QUESTIONS_PER_QUIZ),
  );

  // Preload every selected question's image once the quiz starts, so no
  // question ever renders with a half-loaded image.
  useEffect(() => {
    if (!quizStarted) return;

    const sources = selectedQuestions.current
      .map((question) => question.image)
      .filter(Boolean);

    if (sources.length === 0) {
      setImagesReady(true);
      return;
    }

    let cancelled = false;
    let loaded = 0;

    const markLoaded = () => {
      if (cancelled) return;
      loaded += 1;
      setLoadedCount(loaded);
      if (loaded === sources.length) setImagesReady(true);
    };

    sources.forEach((src) => {
      const img = new Image();
      img.onload = markLoaded;
      img.onerror = markLoaded; // a broken image shouldn't stall the quiz
      img.src = src;
    });

    return () => {
      cancelled = true;
    };
  }, [quizStarted]);

  // Keep the loading screen up for a minimum time so it reads as a real load
  // step instead of flashing by on fast devices.
  useEffect(() => {
    if (!quizStarted) return;
    const timer = setTimeout(
      () => setMinTimeElapsed(true),
      QUIZ_CONFIG.MIN_LOADING_TIME,
    );
    return () => clearTimeout(timer);
  }, [quizStarted]);

  const activeQuestionIndex = userAnswers.length;
  const quizIsComplete =
    quizStarted && activeQuestionIndex === selectedQuestions.current.length;

  const handleSelectAnswer = useCallback(function handleSelectAnswer(
    selectedAnswer,
  ) {
    setUserAnswers((prevUserAnswers) => {
      return [...prevUserAnswers, selectedAnswer];
    });
  }, []);

  const handleSkipAnswer = useCallback(
    () => handleSelectAnswer(null),
    [handleSelectAnswer],
  );

  // DEV_MODE only: fully reset to a fresh playthrough (new random questions).
  const resetQuiz = useCallback(() => {
    selectedQuestions.current = getRandomQuestions(
      ALL_QUESTIONS,
      QUIZ_CONFIG.QUESTIONS_PER_QUIZ,
    );
    setUserAnswers([]);
    setImagesReady(false);
    setMinTimeElapsed(false);
    setLoadedCount(0);
    setQuizStarted(false);
  }, []);

  // Production: the game must be launched from the hub with a token. Without one
  // there's nothing to score against, so block play entirely.
  if (!APP_CONFIG.DEV_MODE && !getToken()) {
    return <BlockedScreen />;
  }

  if (!quizStarted) {
    return <StartModal onStart={() => setQuizStarted(true)} />;
  }

  if (!imagesReady || !minTimeElapsed) {
    return (
      <LoadingScreen
        loaded={loadedCount}
        total={selectedQuestions.current.length}
        minLoadingTime={QUIZ_CONFIG.MIN_LOADING_TIME}
      />
    );
  }

  if (quizIsComplete) {
    return (
      <Summary
        userAnswers={userAnswers}
        questions={selectedQuestions.current}
        onPlayAgain={resetQuiz}
      />
    );
  }

  return (
    <motion.div
      className="quiz-card-bg w-full max-w-3xl mx-auto p-3 sm:p-6 md:p-8 rounded-2xl shadow-[0_10px_30px_-8px_rgba(21,68,33,0.25)] text-center"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex items-center justify-center mb-4">
        <div className="flex items-center gap-1.5 text-brand-text-dim">
          <MdQuiz className="text-brand-indigo text-lg" />
          <span className="font-display text-xs sm:text-sm uppercase tracking-wide">
            Question {activeQuestionIndex + 1} /{" "}
            {selectedQuestions.current.length}
          </span>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeQuestionIndex}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.3 }}
        >
          <Question
            question={selectedQuestions.current[activeQuestionIndex]}
            onSelectAnswer={handleSelectAnswer}
            onSkipAnswer={handleSkipAnswer}
          />
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
