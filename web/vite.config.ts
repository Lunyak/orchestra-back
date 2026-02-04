import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

// Чистая веб-конфигурация Vite без Electron
export default defineConfig({
  plugins: [react(), tsconfigPaths()],
});
