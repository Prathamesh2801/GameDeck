export const QUIZ_CONFIG = {
  QUESTIONS_PER_QUIZ: 10,
  POINTS_PER_QUESTION: 100,
  // Each question gets a fixed window to answer. Tune this single value —
  // the progress bar and the on-screen countdown both derive from it.
  PER_QUESTION_TIME: 12000,
  // Minimum time the loading screen stays visible even if images preload
  // instantly, so it doesn't just flash on fast devices/connections.
  MIN_LOADING_TIME: 3000,
};
