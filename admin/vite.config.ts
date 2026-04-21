import { existsSync } from "node:fs";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";
import { defineConfig, loadEnv } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolveApiProxyTarget(raw: string | undefined): string {
  const explicit = String(process.env.DEV_PROXY_API ?? "").trim();
  if (explicit) return explicit;
  if (existsSync("/.dockerenv")) return "http://back:3000";
  if (raw?.startsWith("http://") || raw?.startsWith("https://")) return String(raw);
  return "http://localhost:3000";
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const apiTarget = resolveApiProxyTarget(env.VITE_API_BASE_URL);
  const minioTarget =
    env.VITE_MINIO_PROXY_TARGET?.startsWith("http://") ||
    env.VITE_MINIO_PROXY_TARGET?.startsWith("https://")
      ? env.VITE_MINIO_PROXY_TARGET
      : "http://localhost:9000";

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@shared": path.resolve(__dirname, "../app/src/shared"),
        "@app": path.resolve(__dirname, "../app/src"),
      },
    },
    server: {
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
        // Same behavior as Caddy: /minio/<bucket>/<key> -> MinIO S3 API
        "/minio": {
          target: minioTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/minio/, ""),
        },
      },
    },
  };
});
