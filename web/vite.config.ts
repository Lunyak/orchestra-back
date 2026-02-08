import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Чистая веб-конфигурация Vite без Electron
export default defineConfig({
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "../app/src/shared"),
      "@app": path.resolve(__dirname, "../app/src"),
    },
  },
  plugins: [react(), tsconfigPaths()],
});
