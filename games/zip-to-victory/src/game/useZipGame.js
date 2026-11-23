import { useCallback, useEffect, useRef, useState } from "react";
import { areAdjacent, wallKey } from "./generator";
import correctSfx from "../assets/sounds/correct_answer.wav";

/*
  Game state for one puzzle. The path always starts locked on the cell of
  number 1. attemptCell() is safe to call repeatedly in one pointer event
  (state lives in a ref, mirrored to React state for rendering).
*/
export function useZipGame(puzzle) {
  const startCell = puzzle.numberCells[0];
  const totalCells = puzzle.size * puzzle.size;

  const pathRef = useRef([startCell]);
  const [path, setPath] = useState(pathRef.current);
  const [hintCells, setHintCells] = useState([]);
  const hintTimer = useRef(null);
  const sfxRef = useRef(null);
  if (!sfxRef.current) {
    sfxRef.current = new Audio(correctSfx);
    sfxRef.current.volume = 0.7;
  }

  useEffect(() => () => clearTimeout(hintTimer.current), []);

  const playCorrect = () => {
    const audio = sfxRef.current;
    audio.currentTime = 0;
    audio.play().catch(() => {});
  };

  // dev-only hook so automated tests can read the solution
  useEffect(() => {
    if (import.meta.env.DEV) window.__zipPuzzle = puzzle;
  }, [puzzle]);

  const commit = () => setPath([...pathRef.current]);

  const countNumbers = (p) =>
    p.reduce((n, idx) => n + (puzzle.numbers[idx] ? 1 : 0), 0);

  const numbersCollected = countNumbers(path);
  const nextNumber = numbersCollected + 1;
  const won =
    path.length === totalCells &&
    numbersCollected === puzzle.numberCells.length;

  /* Extend to an adjacent legal cell, or truncate back to a visited cell. */
  const attemptCell = useCallback(
    (idx) => {
      const p = pathRef.current;
      const pos = p.indexOf(idx);

      if (pos !== -1) {
        if (pos === p.length - 1) return false;
        p.length = pos + 1; // backtrack
        commit();
        return true;
      }

      const head = p[p.length - 1];
      if (!areAdjacent(head, idx, puzzle.size)) return false;
      if (puzzle.walls.has(wallKey(head, idx))) return false;

      const num = puzzle.numbers[idx];
      if (num && num !== countNumbers(p) + 1) return false;

      p.push(idx);
      if (num) playCorrect();
      commit();
      return true;
    },
    [puzzle],
  );

  /* Step back to the previous numbered checkpoint (fine control = drag back). */
  const undo = useCallback(() => {
    const p = pathRef.current;
    if (p.length <= 1) return;
    let cut = p.length - 1;
    while (cut > 0 && !puzzle.numbers[p[cut - 1]]) cut--;
    p.length = Math.max(1, cut);
    commit();
  }, [puzzle]);

  /*
    Hint: trim the path back to where it still matches the generator's
    solution, then pulse the next three solution cells.
  */
  const hint = useCallback(() => {
    const p = pathRef.current;
    const sol = puzzle.solution;
    let match = 0;
    while (match < p.length && p[match] === sol[match]) match++;
    if (match < p.length) {
      p.length = Math.max(1, match);
      commit();
    }
    setHintCells(sol.slice(p.length, p.length + 1));
    clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setHintCells([]), 2600);
  }, [puzzle]);

  return {
    path,
    attemptCell,
    undo,
    hint,
    hintCells,
    nextNumber,
    numbersCollected,
    won,
  };
}
