import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@brand": fileURLToPath(new URL("../packages/brand", import.meta.url)) },
  },
  server: {
    port: 5173,
    // Shared brand assets live outside this app's root.
    fs: { allow: [".."] },
    // In production the API is served from the same origin; in dev, proxy it.
    proxy: { "/api": "http://localhost:4000" },
  },
});
