import { app, BrowserWindow, dialog, protocol } from "electron";

import fbx2gltf from "fbx2gltf";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import obj2gltf from "obj2gltf";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, "..");

protocol.registerSchemesAsPrivileged([
  {
    scheme: "project-images",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
    },
  },
  {
    scheme: "project-audio",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
    },
  },
  {
    scheme: "project-sounds",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
    },
  },
  {
    scheme: "project-sound-icons",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
    },
  },
  {
    scheme: "project-models",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
    },
  },
]);

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST;

const getProjectsRoot = () =>
  app.isPackaged
    ? path.join(app.getPath("userData"), "projects")
    : path.join(process.env.APP_ROOT || path.resolve("."), "src/data/projects");

const getBundledProjectsRoot = () =>
  path.join(process.resourcesPath, "data", "projects");

let win: BrowserWindow | null;

function registerProjectImagesProtocol() {
  const projectsRoot = getProjectsRoot();
  protocol.registerFileProtocol("project-images", (request, callback) => {
    try {
      const url = new URL(request.url);
      const safeProject = path.basename(url.hostname || "");
      if (!safeProject) {
        callback({ error: -10 }); // FILE_NOT_FOUND
        return;
      }
      const decodedPath = decodeURIComponent(url.pathname).replace(/^\/+/, "");
      const imagesRoot = path.join(projectsRoot, safeProject, "images");
      const resolvedBase = path.resolve(imagesRoot);
      const resolvedPath = path.resolve(imagesRoot, decodedPath);
      if (!resolvedPath.startsWith(resolvedBase)) {
        callback({ error: -10 }); // FILE_NOT_FOUND
        return;
      }
      callback({ path: resolvedPath });
    } catch (err) {
      console.error("project-images protocol error:", err);
      callback({ error: -2 }); // FAILED
    }
  });
}

function registerProjectAudioProtocol() {
  const projectsRoot = getProjectsRoot();
  protocol.registerFileProtocol("project-audio", (request, callback) => {
    try {
      const url = new URL(request.url);
      const safeProject = path.basename(url.hostname || "");
      if (!safeProject) {
        callback({ error: -10 }); // FILE_NOT_FOUND
        return;
      }
      const decodedPath = decodeURIComponent(url.pathname).replace(/^\/+/, "");
      const audioRoot = path.join(projectsRoot, safeProject, "playlist");
      const resolvedBase = path.resolve(audioRoot);
      const resolvedPath = path.resolve(audioRoot, decodedPath);
      if (!resolvedPath.startsWith(resolvedBase)) {
        callback({ error: -10 }); // FILE_NOT_FOUND
        return;
      }
      callback({ path: resolvedPath });
    } catch (err) {
      console.error("project-audio protocol error:", err);
      callback({ error: -2 }); // FAILED
    }
  });
}

function registerProjectSoundsProtocol() {
  const projectsRoot = getProjectsRoot();
  protocol.registerFileProtocol("project-sounds", (request, callback) => {
    try {
      const url = new URL(request.url);
      const safeProject = path.basename(url.hostname || "");
      if (!safeProject) {
        callback({ error: -10 }); // FILE_NOT_FOUND
        return;
      }
      const decodedPath = decodeURIComponent(url.pathname).replace(/^\/+/, "");
      const soundsRoot = path.join(projectsRoot, safeProject, "sounds");
      const resolvedBase = path.resolve(soundsRoot);
      const resolvedPath = path.resolve(soundsRoot, decodedPath);
      if (!resolvedPath.startsWith(resolvedBase)) {
        callback({ error: -10 }); // FILE_NOT_FOUND
        return;
      }
      callback({ path: resolvedPath });
    } catch (err) {
      console.error("project-sounds protocol error:", err);
      callback({ error: -2 }); // FAILED
    }
  });
}

function registerProjectSoundIconsProtocol() {
  const projectsRoot = getProjectsRoot();
  protocol.registerFileProtocol("project-sound-icons", (request, callback) => {
    try {
      const url = new URL(request.url);
      const safeProject = path.basename(url.hostname || "");
      if (!safeProject) {
        callback({ error: -10 }); // FILE_NOT_FOUND
        return;
      }
      const decodedPath = decodeURIComponent(url.pathname).replace(/^\/+/, "");
      const iconsRoot = path.join(projectsRoot, safeProject, "sounds", "icons");
      const resolvedBase = path.resolve(iconsRoot);
      const resolvedPath = path.resolve(iconsRoot, decodedPath);
      if (!resolvedPath.startsWith(resolvedBase)) {
        callback({ error: -10 }); // FILE_NOT_FOUND
        return;
      }
      callback({ path: resolvedPath });
    } catch (err) {
      console.error("project-sound-icons protocol error:", err);
      callback({ error: -2 }); // FAILED
    }
  });
}

function registerProjectModelsProtocol() {
  const projectsRoot = getProjectsRoot();
  protocol.registerFileProtocol("project-models", (request, callback) => {
    try {
      const url = new URL(request.url);
      const safeProject = path.basename(url.hostname || "");
      if (!safeProject) {
        callback({ error: -10 }); // FILE_NOT_FOUND
        return;
      }
      const decodedPath = decodeURIComponent(url.pathname).replace(/^\/+/, "");
      const modelsRoot = path.join(projectsRoot, safeProject, "models");
      const resolvedBase = path.resolve(modelsRoot);
      const resolvedPath = path.resolve(modelsRoot, decodedPath);
      if (!resolvedPath.startsWith(resolvedBase)) {
        callback({ error: -10 }); // FILE_NOT_FOUND
        return;
      }
      callback({ path: resolvedPath });
    } catch (err) {
      console.error("project-models protocol error:", err);
      callback({ error: -2 }); // FAILED
    }
  });
}

function toSafeFilename(originalName: string) {
  const parsed = path.parse(originalName);
  const ext = parsed.ext.toLowerCase() || ".png";
  const base = parsed.name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  const safeBase = base.length > 0 ? base : "image";
  return `${safeBase}-${Date.now()}${ext}`;
}

function toSafeProjectName(name: string) {
  const trimmed = name.trim();
  const base = trimmed
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_ ]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return base || "";
}

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    show: false,

    webPreferences: {
      sandbox: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.mjs"),
      
    },
  });

  if (VITE_DEV_SERVER_URL) {
    win.webContents.openDevTools();
  }

  // Test active push message to Renderer-process.
  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", new Date().toLocaleString());
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }

  // Ensure the window opens maximized (full width of screen)
  win.once("ready-to-show", () => {
    win?.maximize();
    win?.show();
  });
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// В main процессе (твой файл с createWindow)

import { ipcMain } from "electron";
import { promises as fsPromises } from "fs";

// ... остальной код ...

// Обработчики для безопасной работы с файлами
ipcMain.handle("save-scene", async (_event, { name, data }) => {
  try {
    const scenesDir = path.join(
      process.env.APP_ROOT || path.resolve("."),
      "src/data/scenes",
    );
    const fileName = path.basename(name).endsWith(".json")
      ? name
      : `${name}.json`;
    const dest = path.join(scenesDir, fileName);
    // Проверка на path traversal (как у тебя было)
    const resolvedBase = path.resolve(scenesDir);
    const resolvedDest = path.resolve(dest);
    if (!resolvedDest.startsWith(resolvedBase)) throw new Error("Invalid path");

    await fsPromises.mkdir(resolvedBase, { recursive: true });
    await fsPromises.writeFile(
      resolvedDest,
      JSON.stringify(data, null, 2),
      "utf-8",
    );
    return { ok: true, path: resolvedDest };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
});

ipcMain.handle(
  "save-project-scene",
  async (_event, { projectName, sceneName, data }) => {
    try {
      const safeProject = path.basename(projectName);
      const safeName = path.basename(sceneName);
      const scenesDir = path.join(getProjectsRoot(), safeProject, "scenes");
      const fileName = safeName.endsWith(".json")
        ? safeName
        : `${safeName}.json`;
      const dest = path.join(scenesDir, fileName);
      const resolvedBase = path.resolve(scenesDir);
      const resolvedDest = path.resolve(dest);
      if (!resolvedDest.startsWith(resolvedBase)) throw new Error("Invalid path");

      await fsPromises.mkdir(resolvedBase, { recursive: true });
      await fsPromises.writeFile(
        resolvedDest,
        JSON.stringify(data, null, 2),
        "utf-8",
      );
      return { ok: true, path: resolvedDest };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  },
);

ipcMain.handle(
  "pick-project-image",
  async (_event, { projectName }) => {
    try {
      const safeProject = path.basename(projectName);
      const imagesDir = path.join(getProjectsRoot(), safeProject, "images");

      const result = await dialog.showOpenDialog({
        title: "Выберите изображение",
        properties: ["openFile"],
        filters: [
          { name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp", "svg"] },
        ],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { ok: false, canceled: true };
      }

      const srcPath = result.filePaths[0];
      const safeFileName = toSafeFilename(path.basename(srcPath));
      await fsPromises.mkdir(imagesDir, { recursive: true });

      const resolvedBase = path.resolve(imagesDir);
      const destPath = path.join(imagesDir, safeFileName);
      const resolvedDest = path.resolve(destPath);
      if (!resolvedDest.startsWith(resolvedBase)) throw new Error("Invalid path");

      await fsPromises.copyFile(srcPath, destPath);

      const relativeMarkdownPath = `./images/${path.basename(destPath)}`;
      const fileUrl = pathToFileURL(destPath).toString();
      return { ok: true, markdownPath: relativeMarkdownPath, fileUrl };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  },
);

ipcMain.handle(
  "add-project-image",
  async (_event, { projectName, data, mimeType, originalName }) => {
    try {
      const safeProject = path.basename(projectName);
      const imagesDir = path.join(getProjectsRoot(), safeProject, "images");

      if (!data) {
        return { ok: false, error: "No image data provided" };
      }

      const buffer = Buffer.isBuffer(data)
        ? data
        : data instanceof ArrayBuffer
          ? Buffer.from(data)
          : Buffer.from(data.buffer || data);

      const extFromMime =
        typeof mimeType === "string" && mimeType.includes("/")
          ? mimeType.split("/").pop()
          : undefined;
      const fallbackName = `image.${extFromMime || "png"}`;
      const safeFileName = toSafeFilename(originalName || fallbackName);

      await fsPromises.mkdir(imagesDir, { recursive: true });
      const resolvedBase = path.resolve(imagesDir);
      const destPath = path.join(imagesDir, safeFileName);
      const resolvedDest = path.resolve(destPath);
      if (!resolvedDest.startsWith(resolvedBase)) throw new Error("Invalid path");

      await fsPromises.writeFile(destPath, buffer);

      const relativeMarkdownPath = `./images/${path.basename(destPath)}`;
      return { ok: true, markdownPath: relativeMarkdownPath };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  },
);

ipcMain.handle(
  "pick-project-audio",
  async (_event, { projectName }) => {
    try {
      const safeProject = path.basename(projectName);
      const playlistDir = path.join(getProjectsRoot(), safeProject, "playlist");

      const result = await dialog.showOpenDialog({
        title: "Выберите аудио",
        properties: ["openFile", "multiSelections"],
        filters: [
          { name: "Audio", extensions: ["mp3", "wav", "ogg", "m4a", "flac"] },
        ],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { ok: false, canceled: true };
      }

      await fsPromises.mkdir(playlistDir, { recursive: true });
      const resolvedBase = path.resolve(playlistDir);

      const addedTracks = [];
      for (const srcPath of result.filePaths) {
        const originalBase = path.basename(srcPath);
        const safeFileName = toSafeFilename(originalBase);
        const destPath = path.join(playlistDir, safeFileName);
        const resolvedDest = path.resolve(destPath);
        if (!resolvedDest.startsWith(resolvedBase)) {
          throw new Error("Invalid path");
        }

        await fsPromises.copyFile(srcPath, destPath);

        const title = path.parse(originalBase).name;
        addedTracks.push({
          title,
          file: path.basename(destPath),
        });
      }

      return { ok: true, tracks: addedTracks };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  },
);

ipcMain.handle(
  "add-project-audio",
  async (_event, { projectName, filePaths }) => {
    try {
      const safeProject = path.basename(projectName);
      const playlistDir = path.join(getProjectsRoot(), safeProject, "playlist");

      if (!Array.isArray(filePaths) || filePaths.length === 0) {
        return { ok: false, error: "No files provided" };
      }

      await fsPromises.mkdir(playlistDir, { recursive: true });
      const resolvedBase = path.resolve(playlistDir);

      const addedTracks = [];
      for (const srcPath of filePaths) {
        if (typeof srcPath !== "string" || srcPath.length === 0) continue;
        const originalBase = path.basename(srcPath);
        const safeFileName = toSafeFilename(originalBase);
        const destPath = path.join(playlistDir, safeFileName);
        const resolvedDest = path.resolve(destPath);
        if (!resolvedDest.startsWith(resolvedBase)) {
          throw new Error("Invalid path");
        }

        await fsPromises.copyFile(srcPath, destPath);

        const title = path.parse(originalBase).name;
        addedTracks.push({
          title,
          file: path.basename(destPath),
        });
      }

      return { ok: true, tracks: addedTracks };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  },
);

ipcMain.handle(
  "delete-project-audio",
  async (_event, { projectName, file }) => {
    try {
      const safeProject = path.basename(projectName);
      const safeFile = path.basename(file || "");
      const playlistDir = path.join(getProjectsRoot(), safeProject, "playlist");
      const target = path.join(playlistDir, safeFile);
      const resolvedBase = path.resolve(playlistDir);
      const resolvedTarget = path.resolve(target);
      if (!resolvedTarget.startsWith(resolvedBase)) {
        throw new Error("Invalid path");
      }
      await fsPromises.unlink(resolvedTarget);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  },
);

ipcMain.handle(
  "pick-project-sound",
  async (_event, { projectName }) => {
    try {
      const safeProject = path.basename(projectName);
      const soundsDir = path.join(getProjectsRoot(), safeProject, "sounds");

      const result = await dialog.showOpenDialog({
        title: "Выберите аудио",
        properties: ["openFile", "multiSelections"],
        filters: [
          { name: "Audio", extensions: ["mp3", "wav", "ogg", "m4a", "flac"] },
        ],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { ok: false, canceled: true };
      }

      await fsPromises.mkdir(soundsDir, { recursive: true });
      const resolvedBase = path.resolve(soundsDir);

      const addedTracks = [];
      for (const srcPath of result.filePaths) {
        const originalBase = path.basename(srcPath);
        const safeFileName = toSafeFilename(originalBase);
        const destPath = path.join(soundsDir, safeFileName);
        const resolvedDest = path.resolve(destPath);
        if (!resolvedDest.startsWith(resolvedBase)) {
          throw new Error("Invalid path");
        }

        await fsPromises.copyFile(srcPath, destPath);

        const title = path.parse(originalBase).name;
        addedTracks.push({
          title,
          file: path.basename(destPath),
        });
      }

      return { ok: true, tracks: addedTracks };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  },
);

ipcMain.handle(
  "pick-project-model",
  async (_event, { projectName }) => {
    try {
      const safeProject = path.basename(projectName);
      const modelsDir = path.join(getProjectsRoot(), safeProject, "models");

      const result = await dialog.showOpenDialog({
        title: "Выберите 3D модель",
        properties: ["openFile"],
        filters: [{ name: "3D Models", extensions: ["glb", "gltf", "fbx", "obj"] }],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { ok: false, canceled: true };
      }

      await fsPromises.mkdir(modelsDir, { recursive: true });
      const resolvedBase = path.resolve(modelsDir);

      const srcPath = result.filePaths[0];
      const originalBase = path.basename(srcPath);
      const originalExt = path.extname(originalBase).toLowerCase();
      const outputBase = toSafeFilename(`${path.parse(originalBase).name}.glb`);
      const destPath =
        originalExt === ".glb" || originalExt === ".gltf"
          ? path.join(modelsDir, toSafeFilename(originalBase))
          : path.join(modelsDir, outputBase);
      const resolvedDest = path.resolve(destPath);
      if (!resolvedDest.startsWith(resolvedBase)) {
        throw new Error("Invalid path");
      }

      if (originalExt === ".glb" || originalExt === ".gltf") {
        await fsPromises.copyFile(srcPath, destPath);
      } else if (originalExt === ".obj") {
        const glbBuffer = await obj2gltf(srcPath, { binary: true });
        await fsPromises.writeFile(destPath, glbBuffer);
      } else if (originalExt === ".fbx") {
        await fbx2gltf(srcPath, destPath, ["--binary"]);
      } else {
        throw new Error("Unsupported model format");
      }

      return {
        ok: true,
        file: path.basename(destPath),
        name: path.parse(originalBase).name,
      };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  },
);

ipcMain.handle(
  "pick-project-sound-icon",
  async (_event, { projectName }) => {
    try {
      const safeProject = path.basename(projectName);
      const iconsDir = path.join(getProjectsRoot(), safeProject, "sounds", "icons");

      const result = await dialog.showOpenDialog({
        title: "Выберите иконку",
        properties: ["openFile"],
        filters: [
          { name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp", "svg"] },
        ],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { ok: false, canceled: true };
      }

      await fsPromises.mkdir(iconsDir, { recursive: true });
      const resolvedBase = path.resolve(iconsDir);

      const srcPath = result.filePaths[0];
      const originalBase = path.basename(srcPath);
      const safeFileName = toSafeFilename(originalBase);
      const destPath = path.join(iconsDir, safeFileName);
      const resolvedDest = path.resolve(destPath);
      if (!resolvedDest.startsWith(resolvedBase)) {
        throw new Error("Invalid path");
      }

      await fsPromises.copyFile(srcPath, destPath);
      return { ok: true, file: path.basename(destPath) };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  },
);

ipcMain.handle(
  "delete-project-sound",
  async (_event, { projectName, file }) => {
    try {
      const safeProject = path.basename(projectName);
      const safeFile = path.basename(file || "");
      const soundsDir = path.join(getProjectsRoot(), safeProject, "sounds");
      const target = path.join(soundsDir, safeFile);
      const resolvedBase = path.resolve(soundsDir);
      const resolvedTarget = path.resolve(target);
      if (!resolvedTarget.startsWith(resolvedBase)) {
        throw new Error("Invalid path");
      }
      await fsPromises.unlink(resolvedTarget);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  },
);

ipcMain.handle(
  "get-project-images-base",
  async (_event, { projectName }) => {
    try {
      const safeProject = path.basename(projectName);
      const imagesDir = path.join(getProjectsRoot(), safeProject, "images");
      const baseUrl = `project-images://${pathToFileURL(
        `${imagesDir}${path.sep}`,
      ).pathname}`;
      return { ok: true, fileUrl: baseUrl };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  },
);

// Аналогично для saveProjectConfig, readProjectScene
// Пример для чтения:
ipcMain.handle(
  "read-project-scene",
  async (_event, { projectName, sceneName }) => {
    console.log('ipcMain.handle');
    
    try {
      const safeProject = path.basename(projectName);
      const safeName = path.basename(sceneName);
      const scenesDir = path.join(getProjectsRoot(), safeProject, "scenes");
      const fileName = safeName.endsWith(".json")
        ? safeName
        : `${safeName}.json`;
      const p = path.join(scenesDir, fileName);
      const resolvedBase = path.resolve(scenesDir);
      const resolvedP = path.resolve(p);
      if (!resolvedP.startsWith(resolvedBase)) throw new Error("Invalid path");

      const text = await fsPromises.readFile(resolvedP, "utf-8");
      return JSON.parse(text);
    } catch (err) {
      console.error("readProjectScene error:", err);
      throw err;
    }
  },
);

ipcMain.handle("list-projects", async () => {
  try {
    const roots = app.isPackaged
      ? [getProjectsRoot(), getBundledProjectsRoot()]
      : [getProjectsRoot(), path.join(process.cwd(), "src", "data", "projects")];
    const names = new Set<string>();

    for (const root of roots) {
      try {
        console.log("[list-projects] root:", root);
        await fsPromises.mkdir(root, { recursive: true });
        const entries = await fsPromises.readdir(root, { withFileTypes: true });
        console.log(
          "[list-projects] entries:",
          entries.map((entry) => ({ name: entry.name, dir: entry.isDirectory() })),
        );
        entries
          .filter((entry) => entry.isDirectory())
          .map((entry) => entry.name)
          .filter((name) => name && !name.startsWith("."))
          .forEach((name) => names.add(name));
      } catch {
        // ignore per-root errors
      }
    }

    return Array.from(names).sort((a, b) => a.localeCompare(b));
  } catch (err) {
    console.error("list-projects error:", err);
    return [];
  }
});

ipcMain.handle("create-project", async (_event, { name }) => {
  try {
    const safeName = toSafeProjectName(String(name || ""));
    if (!safeName) {
      return { ok: false, error: "Invalid project name" };
    }
    const projectRoot = path.join(getProjectsRoot(), safeName);
    const scenesDir = path.join(projectRoot, "scenes");
    const imagesDir = path.join(projectRoot, "images");
    const playlistDir = path.join(projectRoot, "playlist");
    const soundsDir = path.join(projectRoot, "sounds");
    const iconsDir = path.join(soundsDir, "icons");
    const modelsDir = path.join(projectRoot, "models");

    await fsPromises.mkdir(scenesDir, { recursive: true });
    await fsPromises.mkdir(imagesDir, { recursive: true });
    await fsPromises.mkdir(playlistDir, { recursive: true });
    await fsPromises.mkdir(soundsDir, { recursive: true });
    await fsPromises.mkdir(iconsDir, { recursive: true });
    await fsPromises.mkdir(modelsDir, { recursive: true });

    const scriptPath = path.join(scenesDir, "script.json");
    try {
      await fsPromises.access(scriptPath);
    } catch {
      const payload = {
        name: `Проект ${safeName}`,
        steps: [
          { id: 1, title: "Шаг 1", markdown: "", requisites: [] },
        ],
        playlist: [],
        sounds: [],
        lightChannels: Array.from({ length: 9 }, () => ""),
        theaterLayout: {
          hallWidth: 9,
          hallDepth: 6,
          wallHeight: 6,
          audienceStartZ: 3,
          seatRows: 4,
          seatsPerRow: 7,
          seatSpacing: 1.1,
          rowSpacing: 0.8,
          rowRise: 0.25,
          aisleWidth: 1.2,
          aisleCenterX: 0,
          doorWidth: 1.2,
          doorHeight: 2.2,
          doorZ: -6,
        },
      };
      await fsPromises.writeFile(scriptPath, JSON.stringify(payload, null, 2), "utf-8");
    }

    return { ok: true, name: safeName };
  } catch (err) {
    console.error("create-project error:", err);
    return { ok: false, error: (err as Error).message };
  }
});

ipcMain.handle("delete-project", async (_event, { name }) => {
  try {
    const safeName = toSafeProjectName(String(name || ""));
    if (!safeName) {
      return { ok: false, error: "Invalid project name" };
    }
    const projectRoot = path.join(getProjectsRoot(), safeName);
    const resolvedBase = path.resolve(getProjectsRoot());
    const resolvedTarget = path.resolve(projectRoot);
    if (!resolvedTarget.startsWith(resolvedBase)) {
      return { ok: false, error: "Invalid project path" };
    }
    await fsPromises.rm(resolvedTarget, { recursive: true, force: true });
    return { ok: true };
  } catch (err) {
    console.error("delete-project error:", err);
    return { ok: false, error: (err as Error).message };
  }
});

app.whenReady().then(() => {
  const ensureProjectSeed = async () => {
    if (!app.isPackaged) return;
    const userRoot = getProjectsRoot();
    await fsPromises.mkdir(userRoot, { recursive: true });
    const existing = await fsPromises.readdir(userRoot, { withFileTypes: true });
    const hasProjects = existing.some((entry) => entry.isDirectory());
    if (hasProjects) return;
    const bundledRoot = getBundledProjectsRoot();
    try {
      await fsPromises.access(bundledRoot);
    } catch {
      return;
    }
    await fsPromises.cp(bundledRoot, userRoot, { recursive: true });
  };

  void ensureProjectSeed().finally(() => {
    registerProjectImagesProtocol();
    registerProjectAudioProtocol();
    registerProjectSoundsProtocol();
    registerProjectSoundIconsProtocol();
    registerProjectModelsProtocol();
    createWindow();
  });
});
