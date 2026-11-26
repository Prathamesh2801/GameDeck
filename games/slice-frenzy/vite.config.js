import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "/games/slice-frenzy/",
  resolve: {
    alias: {
      "@brand": fileURLToPath(new URL("../../packages/brand", import.meta.url)),
      "@sdk": fileURLToPath(new URL("../../packages/game-sdk/index.js", import.meta.url)),
    },
  },
  // Shared brand assets live outside this app's root.
  server: { port: 5301, strictPort: true, fs: { allow: ["../.."] } },
});
