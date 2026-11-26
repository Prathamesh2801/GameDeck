import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import DeviceFrame from "./components/DeviceFrame.jsx";
import BlockedScreen from "./components/BlockedScreen.jsx";
import StartScreen from "./screens/StartScreen.jsx";
import GameScreen from "./screens/GameScreen.jsx";
import { canPlay } from "@sdk";

export default function App() {
  // screen state machine: start ↔ game
  const [screen, setScreen] = useState("start");

  // Production: require a play token — no untracked, unscored sessions.
  if (!canPlay) {
    return <BlockedScreen />;
  }

  return (
    <DeviceFrame>
      <AnimatePresence mode="wait">
        {screen === "start" && (
          <motion.div
            key="start"
            className="flex min-h-0 flex-1 flex-col"
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.3 }}
          >
            <StartScreen onStart={() => setScreen("game")} />
          </motion.div>
        )}

        {screen === "game" && (
          <motion.div key="game" className="flex min-h-0 flex-1 flex-col">
            <GameScreen onExit={() => setScreen("start")} />
          </motion.div>
        )}
      </AnimatePresence>
    </DeviceFrame>
  );
}
