import { useRef } from 'react';
import { motion } from 'framer-motion';

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25 } },
};

export default function Answers({
  answers,
  correctAnswer,
  selectedAnswer,
  answerState,
  onSelect,
}) {
  const shuffledAnswers = useRef();

  if (!shuffledAnswers.current) {
    shuffledAnswers.current = [...answers];
    shuffledAnswers.current.sort(() => Math.random() - 0.5);
  }

  return (
    <motion.ul
      className="list-none m-0 p-0 flex flex-col items-center gap-2 sm:gap-3"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {shuffledAnswers.current.map((answer) => {
        const isSelected = selectedAnswer === answer;
        const isCorrectAnswer = correctAnswer === answer;
        // The result has been revealed once the answer is marked correct/wrong,
        // or when the question was skipped (timed out with no selection).
        const isRevealed =
          answerState === 'correct' ||
          answerState === 'wrong' ||
          answerState === 'skipped';
        let btnClass =
          'w-full font-display font-medium text-sm sm:text-base py-3 sm:py-4 px-4 sm:px-6 rounded-3xl cursor-pointer transition-all duration-200 ease-in-out border';

        if (isRevealed && isCorrectAnswer) {
          // Always show the correct answer in green once revealed, and blink it
          // — even when the user picked a different (wrong) option.
          btnClass += ' bg-brand-green text-brand-on-primary border-brand-green scale-105 answer-blink-green';
        } else if (answerState === 'wrong' && isSelected) {
          btnClass += ' bg-brand-red text-brand-on-primary border-brand-red scale-105 answer-blink-red';
        } else if (answerState === 'answered' && isSelected) {
          btnClass += ' bg-brand-orange text-brand-on-primary border-brand-orange';
        } else if (answerState !== '') {
          btnClass += ' bg-brand-blue text-brand-text border-brand-border opacity-50';
        } else {
          btnClass += ' bg-brand-blue text-brand-text border-brand-border-strong answer-option-idle';
        }

        if (answerState !== '') {
          btnClass += ' cursor-default pointer-events-none';
        }

        return (
          <motion.li
            key={answer}
            className="w-[95%] sm:w-[90%]"
            variants={itemVariants}
          >
            <motion.button
              onClick={() => onSelect(answer)}
              className={btnClass}
              disabled={answerState !== ''}
              whileTap={answerState === '' ? { scale: 0.97 } : {}}
            >
              {answer}
            </motion.button>
          </motion.li>
        );
      })}
    </motion.ul>
  );
}
