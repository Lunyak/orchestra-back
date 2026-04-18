import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";
import { defineConfig, loadEnv } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const apiTarget =
    process.env.DEV_PROXY_API ||
    (env.VITE_API_BASE_URL?.startsWith("http://") ||
    env.VITE_API_BASE_URL?.startsWith("https://")
      ? env.VITE_API_BASE_URL
      : "http://localhost:3000");
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
