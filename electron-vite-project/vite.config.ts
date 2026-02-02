import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import electron from "vite-plugin-electron";
import tsconfigPaths from "vite-tsconfig-paths";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tsconfigPaths(),
    electron([
      {
        entry: "electron/main.ts",
        vite: {
          build: {
            rollupOptions: {
              external: ["obj2gltf", "fbx2gltf"],
            },
          },
        },
      },
      {
        entry: "electron/preload.mjs",
        vite: {
          build: {
            rollupOptions: {
              output: {
                format: 'esm'
              }
            }
          }
        },
        onstart(options) {
          // Notify the Renderer-Process to reload the page when the Preload-Scripts build is complete,
          // instead of restarting the entire Electron App.
          options.reload();
        },
      },
    ]),
  ],
});
