import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/games/picture-perfect/",
  resolve: {
    alias: { "@brand": fileURLToPath(new URL("../../packages/brand", import.meta.url)) },
  },
  // Shared brand assets live outside this app's root.
  server: { fs: { allow: ["../.."] } },
});
