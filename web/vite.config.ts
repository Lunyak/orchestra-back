import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";
import { defineConfig, loadEnv } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Чистая веб-конфигурация Vite без Electron
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const rawBase = String(env.VITE_API_BASE_URL || "http://localhost:3000");
  const basePath = String(env.VITE_BASE_PATH || "/");
  const target =
    rawBase.startsWith("http://") || rawBase.startsWith("https://")
      ? rawBase
      : "http://localhost:3000";
  return {
    base: basePath,
    resolve: {
      alias: {
        "@shared": path.resolve(__dirname, "../app/src/shared"),
        "@app": path.resolve(__dirname, "../app/src"),
        react: path.resolve(__dirname, "node_modules/react"),
        "react-dom": path.resolve(__dirname, "node_modules/react-dom"),
        "react/jsx-runtime": path.resolve(
          __dirname,
          "node_modules/react/jsx-runtime.js",
        ),
        "react/jsx-dev-runtime": path.resolve(
          __dirname,
          "node_modules/react/jsx-dev-runtime.js",
        ),
      },
      dedupe: ["react", "react-dom", "react-router", "react-router-dom"],
    },
    server: {
      proxy: {
        // Keep API calls consistent with production (/api -> back:3000)
        "/api": {
          target,
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api/, ""),
        },
        // Realtime (socket.io)
        "/socket.io": {
          target,
          ws: true,
          changeOrigin: true,
        },
      },
    },
    plugins: [react(), tsconfigPaths()],
  };
});
