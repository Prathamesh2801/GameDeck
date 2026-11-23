import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import PhaserGame from "../game/PhaserGame";
import GameHUD from "../components/GameHUD";
import GameOverOverlay from "../components/GameOverOverlay";
import PauseOverlay from "../components/PauseOverlay";
import FeastBanner from "../components/FeastBanner";
import CountdownOverlay from "../components/CountdownOverlay";
import LoadingScreen from "../components/LoadingScreen";
import { RULES } from "../game/constants";

const FULL_TIME = Math.round(RULES.DURATION_MS / 1000);

export default function GameScreen({ onExit }) {
  const [game, setGame] = useState(null); // the live Phaser instance
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(FULL_TIME); // seconds remaining
  const [combo, setCombo] = useState(null);
  const [over, setOver] = useState(null); // { score, reason } | null
  const [paused, setPaused] = useState(false);
  const [feast, setFeast] = useState(null); // { duration } | null
  const [countdown, setCountdown] = useState(null); // 3|2|1|"go"|null
  const [booting, setBooting] = useState(true); // loading screen up?
  const [loadProgress, setLoadProgress] = useState(0); // asset load 0→1

  // Subscribe to THIS game's emitter — never a global bus.
  useEffect(() => {
    if (!game) return;

    // The "Begin" click gave the page sticky activation, so we can unlock
    // Phaser's (suspended) audio context now — lets the very first countdown
    // sound play instead of waiting for the first slice gesture.
    game.sound?.unlock?.();
    const ctx = game.sound?.context;
    if (ctx && ctx.state === "suspended") ctx.resume();

    // Seed from the registry in case the first progress ticks fired before we
    // subscribed (Phaser's boot can beat this effect on a warm cache).
    const seeded = game.registry?.get("rn:loadprogress");
    if (typeof seeded === "number") setLoadProgress(seeded);

    const ev = game.events;
    const onScore = (v) => setScore(v);
    const onTime = (v) => setTimeLeft(v);
    const onCombo = (v) => setCombo({ ...v, id: Date.now() });
    const onGameOver = (v) => setOver(v);
    const onFeastStart = (v) => setFeast(v);
    const onFeastEnd = () => setFeast(null);
    const onCountdown = (n) => setCountdown(n > 0 ? n : "go");
    const onLoadProgress = (v) => setLoadProgress(v);

    ev.on("rn:score", onScore);
    ev.on("rn:time", onTime);
    ev.on("rn:combo", onCombo);
    ev.on("rn:gameover", onGameOver);
    ev.on("rn:feast-start", onFeastStart);
    ev.on("rn:feast-end", onFeastEnd);
    ev.on("rn:countdown", onCountdown);
    ev.on("rn:loadprogress", onLoadProgress);
    return () => {
      ev.off("rn:score", onScore);
      ev.off("rn:time", onTime);
      ev.off("rn:combo", onCombo);
      ev.off("rn:gameover", onGameOver);
      ev.off("rn:feast-start", onFeastStart);
      ev.off("rn:feast-end", onFeastEnd);
      ev.off("rn:countdown", onCountdown);
      ev.off("rn:loadprogress", onLoadProgress);
    };
  }, [game]);

  // Clear the "Go!" flash once it has shown.
  useEffect(() => {
    if (countdown !== "go") return;
    const t = setTimeout(() => setCountdown(null), 600);
    return () => clearTimeout(t);
  }, [countdown]);

  // Auto-dismiss the combo flourish.
  useEffect(() => {
    if (!combo) return;
    const t = setTimeout(() => setCombo(null), 1100);
    return () => clearTimeout(t);
  }, [combo]);

  const emit = (event) => game?.events.emit(event);

  // Loading screen finished → drop it and let the scene run its countdown.
  const handleBootDone = () => {
    setBooting(false);
    emit("rn:begin");
  };

  const handleReplay = () => {
    setScore(0);
    setTimeLeft(FULL_TIME);
    setCombo(null);
    setOver(null);
    setPaused(false);
    setFeast(null);
    setCountdown(null);
    emit("rn:restart");
  };

  const handlePause = () => {
    setPaused(true);
    emit("rn:pause");
  };

  const handleResume = () => {
    setPaused(false);
    emit("rn:resume");
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="relative flex min-h-0 flex-1 touch-none select-none flex-col"
    >
      <PhaserGame className="absolute inset-0" onReady={setGame} />
      <GameHUD
        score={score}
        timeLeft={timeLeft}
        combo={combo}
        onPause={handlePause}
        feastActive={!!feast || countdown != null}
      />
      <AnimatePresence mode="wait">
        {countdown != null && (
          <CountdownOverlay key={countdown} value={countdown} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {booting && (
          <LoadingScreen
            key="loading"
            progress={loadProgress}
            onDone={handleBootDone}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {feast && (
          <FeastBanner
            key="feast"
            duration={feast.duration}
            perSlash={feast.perSlash}
            bonusEvery={feast.bonusEvery}
            bonus={feast.bonus}
          />
        )}
        {paused && !over && (
          <PauseOverlay
            key="pause"
            onResume={handleResume}
            onRestart={handleReplay}
            onExit={onExit}
          />
        )}
        {over && (
          <GameOverOverlay
            key="over"
            result={over}
            onReplay={handleReplay}
            onExit={onExit}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
