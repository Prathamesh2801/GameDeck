/*
  Scoring — rewards both partial progress (so a player who only links a few
  numbers before time runs out still earns something) and fast completion
  (finishing with more seconds left is worth more). All values are pure
  functions of the end-of-game state, so the same numbers drive the live
  result screen and the "How scoring works" instructions.
*/
export const SCORING = {
  perNumber: 100, // each numbered checkpoint you link (beyond the start "1")
  perCell: 10, // each square your path fills (beyond the start cell)
  completionBonus: 200, // filling the whole board and reaching the last number
  perSecondLeft: 10, // speed bonus: every whole second left on the clock (win only)
};

/*
  numbersCollected: how many numbered cells are on the path (1..8; a fresh
    board already sits on "1", so that first one earns nothing).
  cellsFilled: path length in cells (the start cell earns nothing).
  secondsLeft: time remaining when the game ended (only bonuses on a win).
*/
export function computeScore({
  numbersCollected,
  cellsFilled,
  secondsLeft,
  won,
}) {
  const links = Math.max(0, numbersCollected - 1);
  const drawnCells = Math.max(0, cellsFilled - 1);

  const numberPoints = links * SCORING.perNumber;
  const cellPoints = drawnCells * SCORING.perCell;
  let score = numberPoints + cellPoints;

  let timeBonus = 0;
  if (won) {
    timeBonus = Math.max(0, Math.floor(secondsLeft)) * SCORING.perSecondLeft;
    score += SCORING.completionBonus + timeBonus;
  }

  return {
    total: score,
    links,
    drawnCells,
    numberPoints,
    cellPoints,
    completionBonus: won ? SCORING.completionBonus : 0,
    timeBonus,
  };
}
