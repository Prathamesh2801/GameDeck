import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/games/strike-alley/",
  resolve: {
    alias: { "@brand": fileURLToPath(new URL("../../packages/brand", import.meta.url)) },
  },
  // Shared brand assets live outside this app's root.
  server: { port: 5305, strictPort: true, fs: { allow: ["../.."] } },
});
