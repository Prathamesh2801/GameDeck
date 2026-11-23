import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "/games/lane-dash/",
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@brand": fileURLToPath(new URL("../../packages/brand", import.meta.url)),
    },
  },
  // Shared brand assets live outside this app's root.
  server: { fs: { allow: ["../.."] } },
});
