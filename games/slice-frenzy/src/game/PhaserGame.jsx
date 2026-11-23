import { useEffect, useRef } from "react";
import Phaser from "phaser";
import GameScene from "./scenes/GameScene";
import { STAGE, PHYSICS } from "./constants";

// Boots a Phaser game into a div and hands the instance back via onReady.
// Control + HUD events go through THIS game's own emitter (game.events),
// never a global singleton — so StrictMode's transient double-mount can't
// leave a ghost instance intercepting events.
export default function PhaserGame({ className, onReady }) {
  const parentRef = useRef(null);
  const readyRef = useRef(onReady);
  readyRef.current = onReady;

  useEffect(() => {
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: parentRef.current,
      transparent: true, // let the device-frame gradient show through
      width: STAGE.WIDTH,
      height: STAGE.HEIGHT,
      // Cap the device pixel ratio: on hi-DPI phones an uncapped ratio makes
      // the WebGL backing store enormous and starves the fill rate — a common
      // source of slice stutter. 2× stays crisp without the cost.
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      render: {
        antialias: true,
        roundPixels: true, // avoids sub-pixel sprite jitter/reblending
        powerPreference: "high-performance",
      },
      fps: { target: 60, min: 30 },
      physics: {
        default: "arcade",
        arcade: { gravity: { y: PHYSICS.GRAVITY } },
      },
      scene: [GameScene],
    });

    readyRef.current?.(game);

    return () => {
      readyRef.current?.(null);
      game.destroy(true);
    };
  }, []);

  return <div ref={parentRef} className={className} />;
}
