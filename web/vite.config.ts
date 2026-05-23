import { existsSync } from "node:fs";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";
import { defineConfig, loadEnv } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Vite dev server (proxy) runs in Node; inside Docker it must reach API by compose service name, not LAN IP. */
function resolveApiProxyTarget(rawBase: string): string {
  const explicit = String(process.env.DEV_PROXY_API ?? "").trim();
  if (explicit) return explicit;

  const inDocker = existsSync("/.dockerenv");
  if (inDocker) return "http://back:3000";

  if (rawBase.startsWith("http://") || rawBase.startsWith("https://")) return rawBase;
  return "http://localhost:3000";
}

// Чистая веб-конфигурация Vite без Electron
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const rawBase = String(env.VITE_API_BASE_URL || "http://localhost:3000");
  const basePath = String(env.VITE_BASE_PATH || "/");
  // DEV_PROXY_API — явный URL для прокси (compose: http://back:3000). Иначе в Docker — back:3000, на хосте — rawBase или localhost.
  const proxyTarget = resolveApiProxyTarget(rawBase);
  const isMobileBuild = mode === "mobile" || env.VITE_CAPACITOR === "1";
  const capacitorStub = path.resolve(
    __dirname,
    "../app/src/shared/platform/capacitor-web-stub.ts",
  );
  return {
    base: basePath,
    optimizeDeps: {
      include: [
        "@codemirror/state",
        "@codemirror/view",
        "@codemirror/commands",
        "@codemirror/language",
        "@codemirror/lang-markdown",
      ],
    },
    resolve: {
      alias: {
        ...(isMobileBuild
          ? {}
          : {
              "@capacitor/core": capacitorStub,
              "@capacitor/network": capacitorStub,
              "@capacitor/filesystem": capacitorStub,
            }),
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
          target: proxyTarget,
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api/, ""),
        },
        // Realtime (socket.io)
        "/socket.io": {
          target: proxyTarget,
          ws: true,
          changeOrigin: true,
        },
      },
    },
    plugins: [react(), tsconfigPaths()],
  };
});
