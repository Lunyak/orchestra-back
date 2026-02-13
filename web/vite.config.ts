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
      react: path.resolve(__dirname, "node_modules/react"),
      "react-dom": path.resolve(__dirname, "node_modules/react-dom"),
      "react/jsx-runtime": path.resolve(__dirname, "node_modules/react/jsx-runtime.js"),
      "react/jsx-dev-runtime": path.resolve(
        __dirname,
        "node_modules/react/jsx-dev-runtime.js",
      ),
    },
    dedupe: ["react", "react-dom", "react-router", "react-router-dom"],
  },
  plugins: [react(), tsconfigPaths()],
});
