import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Dev ports of the game apps (each game's vite.config.js pins the same port).
// In production the server serves every game's build under /games/<slug>/.
const GAME_PORTS = {
  "slice-frenzy": 5301,
  "picture-perfect": 5302,
  "lane-dash": 5303,
  "zip-to-victory": 5304,
  "strike-alley": 5305,
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@brand": fileURLToPath(new URL("../packages/brand", import.meta.url)) },
  },
  server: {
    port: 5173,
    host:true,
    // Shared brand assets live outside this app's root.
    fs: { allow: [".."] },
    // In production the API and games share this origin; in dev, proxy them
    // so the player site, games and API all live on localhost:5173.
    proxy: {
      "/api": "http://localhost:4000",
      ...Object.fromEntries(
        Object.entries(GAME_PORTS).map(([slug, port]) => [
          `/games/${slug}`,
          { target: `http://localhost:${port}`, ws: true }, // ws: game HMR
        ]),
      ),
    },
  },
});
