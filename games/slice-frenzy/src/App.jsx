import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import DeviceFrame from "./components/DeviceFrame.jsx";
import BlockedScreen from "./components/BlockedScreen.jsx";
import StartScreen from "./screens/StartScreen.jsx";
import GameScreen from "./screens/GameScreen.jsx";
import { APP_CONFIG } from "./data/appConfig.js";
import { getToken } from "./utils/token.js";

export default function App() {
  // screen state machine: start ↔ game
  const [screen, setScreen] = useState("start");

  // Production: require a signed hub token — no untracked, unscored sessions.
  if (!APP_CONFIG.DEV_MODE && !getToken()) {
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
