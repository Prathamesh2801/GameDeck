import { useEffect, useRef, useState, useCallback } from 'react';
import Phaser from 'phaser';
import { createGameConfig } from './game/config';
import { EventBus } from './game/EventBus';
import { GAME, SOUNDS } from './game/constants';
import { LoadingScreen } from './hud/LoadingScreen';
import { StartScreen } from './hud/StartScreen';
import { Hud } from './hud/Hud';
import { Countdown } from './hud/Countdown';
import { TutorialHints } from './hud/TutorialHints';
import { GameOverScreen } from './hud/GameOverScreen';
import { BlockedScreen } from './hud/BlockedScreen';
import { canPlay, isDevPlay, leaderboardUrl, REDIRECT_DELAY, submitScore } from '@sdk';

/**
 * Mounts the Phaser game and owns the phase state machine + EventBus wiring
 * (spec §4, §8). React owns all screens/overlays; Phaser owns the canvas.
 *
 * Phases: loading → ready → countdown → tutorial → running ⇄ paused, running → over.
 */
export default function TempleRun({ onComplete }) {
  const containerRef = useRef(null);
  const gameRef = useRef(null);
  // The control tutorial plays once per session (after the first Start), then
  // retries skip straight from the countdown into the run.
  const tutorialShownRef = useRef(false);

  const [phase, setPhase] = useState('loading');
  const [progress, setProgress] = useState(0);
  const [score, setScore] = useState(0); // live distance score (HUD)
  const [coins, setCoins] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME.RUN_DURATION_MS); // ms remaining (HUD clock)
  const [lives, setLives] = useState(GAME.LIVES); // remaining lives (HUD hearts)

  // Production requires a play token (no untracked/unscored sessions). practice play
  // bypasses it so the game can be replayed freely. Stable for the mount (the
  // URL doesn't change), so hooks below still run in a consistent order.
  const blocked = !canPlay;

  // --- Score submission (fires once when the run ends) ------------------
  // Score = distance + coins × GAME.POINTS_PER_COIN.
  const submittedRef = useRef(false);
  const [submitState, setSubmitState] = useState('submitting'); // submitting | success | error
  const [submitError, setSubmitError] = useState(null);
  // Authoritative end-of-run numbers, captured from the game-over event (not
  // the HUD state, which can lag by coins still in flight — see onGameOver).
  const [finalDistance, setFinalDistance] = useState(0);
  const [finalCoins, setFinalCoins] = useState(0);
  const [completed, setCompleted] = useState(false); // true = time's up, false = crashed
  // Final score = distance score + coin bonus.
  const finalScore = finalDistance + finalCoins * GAME.POINTS_PER_COIN;

  // Create the Phaser game once; tear it down fully on unmount. Skipped while
  // blocked so Phaser never mounts on the Access-Blocked screen.
  useEffect(() => {
    if (blocked) return;
    const game = new Phaser.Game(createGameConfig(containerRef.current));
    gameRef.current = game;

    const onReady = () => setPhase('ready');
    const onProgress = (v) => setProgress(v);
    const onScore = (s) => setScore(s);
    const onCoins = (c) => setCoins(c);
    const onTime = (ms) => setTimeLeft(ms);
    const onLives = (n) => setLives(n);
    const onGameOver = (distance, coinCount, didComplete) => {
      EventBus.emit('sfx', SOUNDS.GAME_OVER); // fires here, not GameOverScreen.jsx — that's shared with the (silent) paused state
      setFinalDistance(distance); // game-truth numbers for the final score
      setFinalCoins(coinCount);
      setCompleted(!!didComplete); // time's up vs crash → results heading
      setPhase('over');
      onComplete?.(distance + coinCount * GAME.POINTS_PER_COIN);
    };

    EventBus.on('ready', onReady);
    EventBus.on('load-progress', onProgress);
    EventBus.on('score-update', onScore);
    EventBus.on('coins-update', onCoins);
    EventBus.on('time-update', onTime);
    EventBus.on('lives-update', onLives);
    EventBus.on('game-over', onGameOver);

    return () => {
      EventBus.off('ready', onReady);
      EventBus.off('load-progress', onProgress);
      EventBus.off('score-update', onScore);
      EventBus.off('coins-update', onCoins);
      EventBus.off('time-update', onTime);
      EventBus.off('lives-update', onLives);
      EventBus.off('game-over', onGameOver);
      game.destroy(true);
      gameRef.current = null;
    };
  }, [onComplete, blocked]);

  // ---- score submission ------------------------------------------------------

  // POST the coin-based score. practice play logs instead of hitting the network.
  const runSubmit = useCallback(async () => {
    setSubmitState('submitting');
    setSubmitError(null);
    try {
      await submitScore({ score: finalScore });
      setSubmitState('success');
    } catch (err) {
      setSubmitState('error');
      setSubmitError(err?.message || "Couldn't save your score. Please retry.");
    }
  }, [finalScore]);

  // Submit exactly once when the run ends (guarded ref survives StrictMode's
  // double-invoked effects). The retry paths below re-arm it for DEV replays.
  useEffect(() => {
    if (phase !== 'over' || submittedRef.current) return;
    submittedRef.current = true;
    runSubmit();
  }, [phase, runSubmit]);

  // Production: go to the leaderboard after a successful submit.
  useEffect(() => {
    if (isDevPlay || submitState !== 'success') return;
    const t = setTimeout(() => {
      window.location.href = leaderboardUrl;
    }, REDIRECT_DELAY);
    return () => clearTimeout(t);
  }, [submitState]);

  // ---- phase actions -------------------------------------------------------

  // Start tapped: reset HUD, show the 3·2·1 overlay and tell the scene to zoom
  // in on the idling player. The run itself begins in onCountdownDone.
  const start = useCallback(() => {
    setScore(0);
    setCoins(0);
    setTimeLeft(GAME.RUN_DURATION_MS);
    setLives(GAME.LIVES);
    setPhase('countdown');
    EventBus.emit('sfx', SOUNDS.UI_TAP);
    EventBus.emit('start-run');
  }, []);

  // Countdown finished. First time this session: enter the no-spawn tutorial so
  // the player can learn the controls (skipped if TUTORIAL_MS is 0). Afterwards
  // (retries), go straight into the run.
  const onCountdownDone = useCallback(() => {
    if (!tutorialShownRef.current && GAME.TUTORIAL_MS > 0) {
      tutorialShownRef.current = true;
      setPhase('tutorial');
      EventBus.emit('begin-tutorial');
    } else {
      setPhase('running');
      EventBus.emit('begin-run');
    }
  }, []);

  // Tutorial window elapsed: hide the hints and start the real run (spawns on).
  const onTutorialDone = useCallback(() => {
    setPhase('running');
    EventBus.emit('begin-run');
  }, []);

  // No on-screen pause button (removed by request). Desktop keeps a keyboard
  // pause via the Esc/P handler below; touch/PWA has no pause, which suits the
  // short timed run.
  const resume = useCallback(() => {
    setPhase((p) => {
      if (p !== 'paused') return p;
      EventBus.emit('resume');
      return 'running';
    });
  }, []);

  // Retry: reset the scene to idle, then run the same countdown as a fresh start.
  // (practice play replay path — re-arm the one-shot submit for the next run's end.)
  const retry = useCallback(() => {
    submittedRef.current = false;
    setSubmitState('submitting');
    setSubmitError(null);
    setScore(0);
    setCoins(0);
    setTimeLeft(GAME.RUN_DURATION_MS);
    setLives(GAME.LIVES);
    EventBus.emit('restart');
    setPhase('countdown');
    EventBus.emit('sfx', SOUNDS.UI_TAP);
    EventBus.emit('start-run');
  }, []);

  // practice play-only (production hides the pause Restart — one play per user).
  const restartToStart = useCallback(() => {
    // From pause → back to Start screen (scene reset, idle + animating).
    EventBus.emit('restart');
    setScore(0);
    setCoins(0);
    setTimeLeft(GAME.RUN_DURATION_MS);
    setLives(GAME.LIVES);
    setPhase('ready');
  }, []);

  // Desktop pause keys (Esc / P) — React owns pause UI (spec §5 controls).
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape' && e.key !== 'p' && e.key !== 'P') return;
      setPhase((p) => {
        if (p === 'running') {
          EventBus.emit('pause');
          return 'paused';
        }
        if (p === 'paused') {
          EventBus.emit('resume');
          return 'running';
        }
        return p;
      });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    // Letterbox backdrop: the game lives in a centered, max-width 9:16 column so
    // the portrait (mobile) video is shown in full — never cover-cropped — and
    // desktop plays as a centered phone column with bars on the sides.
    <div className="relative grid h-full w-full place-items-center overflow-hidden bg-black select-none">
      <div
        className="relative overflow-hidden bg-surface"
        style={{
          // Fill the screen height (no letterbox on tall phones) with a width
          // capped at 480px so desktop is a centered phone column. The video
          // cover-fills this box; lanes are pinned to the video (see Lane.js).
          height: '100%',
          width: 'min(100%, 480px)',
        }}
      >
        {/* Production without a token: block play, nothing else mounts. */}
        {blocked && <BlockedScreen />}

        {/* Phaser canvas parent (canvas = this 9:16 column) */}
        {!blocked && <div ref={containerRef} className="absolute inset-0" />}

        {/* Loading */}
        {!blocked && phase === 'loading' && <LoadingScreen progress={progress} />}

        {phase === 'ready' && <StartScreen onStart={start} />}

        {phase === 'countdown' && <Countdown onDone={onCountdownDone} />}

        {phase === 'tutorial' && <TutorialHints onDone={onTutorialDone} />}

        {(phase === 'tutorial' || phase === 'running' || phase === 'paused') && (
          <Hud
            score={score}
            coins={coins}
            timeLeft={timeLeft}
            lives={lives}
            maxLives={GAME.LIVES}
          />
        )}

        {phase === 'paused' && (
          <GameOverScreen
            paused
            score={score + coins * GAME.POINTS_PER_COIN}
            devMode={isDevPlay}
            onResume={resume}
            onRestart={restartToStart}
          />
        )}

        {phase === 'over' && (
          <GameOverScreen
            score={finalScore}
            completed={completed}
            devMode={isDevPlay}
            submitState={submitState}
            submitError={submitError}
            leaderboardUrl={leaderboardUrl}
            onRetry={retry}
            onRetrySubmit={runSubmit}
          />
        )}
      </div>
    </div>
  );
}
