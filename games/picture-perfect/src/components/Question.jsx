import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MdTimerOff } from 'react-icons/md';

import QuestionTimer from './QuestionTimer.jsx';
import Answers from './Answers.jsx';
import { QUIZ_CONFIG } from '../data/quizConfig.js';
import correctAnswerSound from '../assets/sounds/Correct_Answer.wav';
import wrongAnswerSound from '../assets/sounds/Wrong_Answer.wav';

function playSound(src) {
  new Audio(src).play().catch(() => {});
}

export default function Question({ question, onSelectAnswer, onSkipAnswer }) {
  const [answer, setAnswer] = useState({
    selectedAnswer: '',
    isCorrect: null,
    skipped: false,
  });

  function handleSelectAnswer(selectedAnswer) {
    setAnswer({ selectedAnswer, isCorrect: null, skipped: false });

    setTimeout(() => {
      const isCorrect = question.answers[0] === selectedAnswer;
      setAnswer({
        selectedAnswer,
        isCorrect,
        skipped: false,
      });
      playSound(isCorrect ? correctAnswerSound : wrongAnswerSound);

      setTimeout(() => {
        onSelectAnswer(selectedAnswer);
      }, 2000);
    }, 1000);
  }

  function handleTimeout() {
    // Time ran out with no answer picked. Reveal the correct answer and lock
    // the options (handled via the 'skipped' answerState) for a beat, then
    // advance and record this question as skipped.
    setAnswer({ selectedAnswer: '', isCorrect: null, skipped: true });
    playSound(wrongAnswerSound);

    setTimeout(() => {
      onSkipAnswer();
    }, 2000);
  }

  let answerState = '';

  if (answer.skipped) {
    answerState = 'skipped';
  } else if (answer.selectedAnswer && answer.isCorrect !== null) {
    answerState = answer.isCorrect ? 'correct' : 'wrong';
  } else if (answer.selectedAnswer) {
    answerState = 'answered';
  }

  // Drive the timer window from the current phase: the full question window
  // while answering, a short beat while showing the selection/reveal.
  let timer = QUIZ_CONFIG.PER_QUESTION_TIME;

  if (answerState === 'answered') {
    timer = 1000;
  } else if (answerState !== '') {
    timer = 2000;
  }

  return (
    <div>
      <QuestionTimer
        key={timer}
        timeout={timer}
        onTimeout={answerState === '' ? handleTimeout : null}
        mode={answerState}
        showTime={answerState === ''}
      />
      <AnimatePresence>
        {answerState === 'skipped' && (
          <motion.div
            key="skipped-note"
            className="flex items-center justify-center gap-1.5 mt-2 font-display text-xs sm:text-sm font-bold uppercase tracking-wide text-brand-text-dim"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <MdTimerOff className="text-brand-red text-base" />
            <span>Time&apos;s up — correct answer shown</span>
          </motion.div>
        )}
      </AnimatePresence>
      <h2 className="font-body text-base sm:text-lg md:text-xl font-normal mt-2 mb-4 text-brand-text-muted px-2">
        {question.text}
      </h2>
      {question.image && (
        <div className="flex justify-center mb-6 md:mb-8">
          <img
            src={question.image}
            alt={question.text}
            className="max-h-48 sm:max-h-60 md:max-h-72 w-auto rounded-xl object-contain border border-brand-border ring-1 ring-brand-border-strong/40 shadow-[0_8px_20px_-6px_rgba(21,68,33,0.3)]"
          />
        </div>
      )}
      <Answers
        answers={question.answers}
        correctAnswer={question.answers[0]}
        selectedAnswer={answer.selectedAnswer}
        answerState={answerState}
        onSelect={handleSelectAnswer}
      />
    </div>
  );
}
