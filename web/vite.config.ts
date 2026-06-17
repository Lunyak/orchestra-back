import { existsSync } from "node:fs";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";
import { defineConfig, loadEnv, type PluginOption } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { viteLocalProjectsPlugin } from "./vite-local-projects-plugin";

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

export default defineConfig(async ({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const rawBase = String(env.VITE_API_BASE_URL || "http://localhost:3000");
  const isDesktopBuild = mode === "desktop";
  const basePath = isDesktopBuild ? "./" : String(env.VITE_BASE_PATH || "/");
  // DEV_PROXY_API — явный URL для прокси (compose: http://back:3000). Иначе в Docker — back:3000, на хосте — rawBase или localhost.
  const proxyTarget = resolveApiProxyTarget(rawBase);
  const isMobileBuild = mode === "mobile" || env.VITE_CAPACITOR === "1";
  const electronEntry = path.resolve(__dirname, "../desktop/electron/main.ts");
  const preloadEntry = path.resolve(__dirname, "../desktop/electron/preload.mjs");
  const electronPlugins: PluginOption[] = isDesktopBuild
    ? [
        (await import("vite-plugin-electron")).default([
          {
            entry: electronEntry,
            vite: {
              build: {
                rollupOptions: {
                  external: ["obj2gltf", "fbx2gltf"],
                },
              },
            },
          },
          {
            entry: preloadEntry,
            onstart(options) {
              options.reload();
            },
            vite: {
              build: {
                rollupOptions: {
                  output: {
                    format: "esm",
                  },
                },
              },
            },
          },
        ]),
      ]
    : [];
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
        "jszip",
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
        jszip: path.resolve(__dirname, "node_modules/jszip"),
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
    plugins: [
      react(),
      tsconfigPaths(),
      ...(command === "serve" ? [viteLocalProjectsPlugin(__dirname)] : []),
      ...electronPlugins,
    ],
  };
});
