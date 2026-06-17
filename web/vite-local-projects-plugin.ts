import fs from "node:fs";
import fsPromises from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Plugin } from "vite";

const MEDIA_FOLDERS = new Set(["videos", "images", "playlist", "sounds", "sounds/icons"]);

const VIDEO_EXT = new Set([".mp4", ".webm", ".mov", ".mkv"]);
const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);
const AUDIO_EXT = new Set([".mp3", ".wav", ".ogg", ".m4a", ".flac"]);

function safeSegment(value: string): string {
  return path.basename(String(value || "").replace(/[/\\]/g, "_"));
}

function resolveProjectsRoots(webDir: string): string[] {
  const explicit = String(process.env.ORCHESTRA_PROJECTS_ROOT ?? "").trim();
  const roots = [
    explicit,
    path.join(os.homedir(), "Library", "Application Support", "orchestra-services", "projects"),
    path.join(webDir, "src", "data", "projects"),
  ].filter(Boolean);
  return [...new Set(roots)];
}

/** Плоская папка с медиа (например ~/Desktop/xxx). ORCHESTRA_MEDIA_ROOT или Desktop/xxx. */
function resolveMediaRoot(): string | null {
  const explicit = String(process.env.ORCHESTRA_MEDIA_ROOT ?? "").trim();
  if (explicit && fs.existsSync(explicit)) return path.resolve(explicit);
  const desktopXxx = path.join(os.homedir(), "Desktop", "xxx");
  if (fs.existsSync(desktopXxx)) return desktopXxx;
  return null;
}

function resolveProjectFile(roots: string[], projectSlug: string, parts: string[]): string | null {
  const safeProject = safeSegment(projectSlug);
  if (!safeProject) return null;
  for (const root of roots) {
    const base = path.resolve(root, safeProject);
    const target = path.resolve(base, ...parts.map(safeSegment));
    if (!target.startsWith(base)) continue;
    if (fs.existsSync(target) && fs.statSync(target).isFile()) return target;
  }
  return null;
}

function resolveFlatMediaFile(
  mediaRoot: string,
  fileName: string,
  titleHint?: string,
): string | null {
  const base = path.resolve(mediaRoot);
  const safeName = path.basename(decodeURIComponent(fileName));
  if (!safeName && !String(titleHint ?? "").trim()) return null;

  const tryPath = (name: string): string | null => {
    const target = path.resolve(base, name);
    if (!target.startsWith(base)) return null;
    if (fs.existsSync(target) && fs.statSync(target).isFile()) return target;
    return null;
  };

  if (safeName && safeName !== "_") {
    const direct = tryPath(safeName);
    if (direct) return direct;

    try {
      for (const entry of fs.readdirSync(base)) {
        if (entry.startsWith(".")) continue;
        if (entry.toLowerCase() === safeName.toLowerCase()) {
          const matched = tryPath(entry);
          if (matched) return matched;
        }
      }
    } catch {
      /* unreadable */
    }
  }

  const title = String(titleHint ?? "").trim();
  if (title) {
    const norm = title.toLowerCase();
    try {
      for (const entry of fs.readdirSync(base)) {
        if (entry.startsWith(".")) continue;
        const stem = entry.replace(/\.[^.]+$/, "").toLowerCase();
        if (stem === norm) {
          const matched = tryPath(entry);
          if (matched) return matched;
        }
      }
    } catch {
      /* unreadable */
    }
  }

  return null;
}

function resolveMediaFile(
  roots: string[],
  projectSlug: string,
  parts: string[],
  mediaRoot: string | null,
  titleHint?: string,
  projectMediaRoots?: Map<string, string>,
): string | null {
  const fromProject = resolveProjectFile(roots, projectSlug, parts);
  if (fromProject) return fromProject;
  const flatRoot =
    projectMediaRoots?.get(projectSlug) ??
    projectMediaRoots?.get(decodeURIComponent(projectSlug)) ??
    mediaRoot;
  if (!flatRoot) return null;
  const fileName = parts[parts.length - 1] ?? "";
  const folder = parts[0] ?? "";
  if (!["videos", "images", "playlist", "sounds"].includes(folder)) return null;
  return resolveFlatMediaFile(flatRoot, fileName, titleHint);
}

function scanMediaFolder(mediaRoot: string) {
  const videos: Array<{ id: number; title: string; file: string; filePath: string }> = [];
  const holdImages: Array<{ id: number; title: string; file: string; filePath: string }> = [];
  const sounds: Array<{ id: number; title: string; file: string; filePath: string }> = [];

  let videoId = 1;
  let holdId = 1;
  let soundId = 1;

  const base = path.resolve(mediaRoot);
  const entries = fs.readdirSync(base, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || entry.name.startsWith(".")) continue;
    const ext = path.extname(entry.name).toLowerCase();
    const title = entry.name.replace(/\.[^.]+$/, "") || entry.name;
    const filePath = path.join(base, entry.name);
    if (VIDEO_EXT.has(ext)) {
      videos.push({ id: videoId++, title, file: entry.name, filePath });
    } else if (IMAGE_EXT.has(ext)) {
      holdImages.push({ id: holdId++, title, file: entry.name, filePath });
    } else if (AUDIO_EXT.has(ext)) {
      sounds.push({ id: soundId++, title, file: entry.name, filePath });
    }
  }

  videos.sort((a, b) => a.title.localeCompare(b.title, "ru"));
  holdImages.sort((a, b) => a.title.localeCompare(b.title, "ru"));

  return { mediaRoot, videos, holdImages, sounds };
}

const MIME: Record<string, string> = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".mkv": "video/x-matroska",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
  ".json": "application/json",
};

/** Dev-only: script.json, notes-run и медиа с диска + плоская папка Desktop/xxx. */
export function viteLocalProjectsPlugin(webDir: string): Plugin {
  const roots = resolveProjectsRoots(webDir);
  const mediaRoot = resolveMediaRoot();
  const projectMediaRoots = new Map<string, string>();

  return {
    name: "vite-local-projects",
    configureServer(server) {
      if (mediaRoot) {
        console.log(`[local-projects] default media folder: ${mediaRoot}`);
      }
      server.middlewares.use(async (req, res, next) => {
        const rawUrl = req.url ?? "";
        const url = rawUrl.split("?")[0] ?? "";
        try {
          if (url === "/local-project-dev/set-project-media-root" && req.method === "POST") {
            const chunks: Buffer[] = [];
            for await (const chunk of req) {
              chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            }
            const body = JSON.parse(Buffer.concat(chunks).toString("utf-8")) as {
              project?: string;
              root?: string;
            };
            const project = safeSegment(String(body.project ?? ""));
            const root = String(body.root ?? "").trim();
            if (project && root && fs.existsSync(root)) {
              projectMediaRoots.set(project, path.resolve(root));
              console.log(`[local-projects] ${project} → ${root}`);
            }
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: true }));
            return;
          }

          if (url === "/local-project-dev/projects") {
            const names = new Set<string>();
            for (const root of roots) {
              try {
                for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
                  if (entry.isDirectory()) names.add(entry.name);
                }
              } catch {
                /* missing root */
              }
            }
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: true, projects: [...names].sort() }));
            return;
          }

          if (url === "/local-project-dev/ping") {
            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({ ok: true, roots, mediaRoot: mediaRoot ?? null }),
            );
            return;
          }

          if (url === "/local-project-dev/scan-media") {
            const rootParam = new URL(rawUrl, "http://local").searchParams.get("root");
            const scanRoot =
              rootParam && fs.existsSync(rootParam)
                ? path.resolve(rootParam)
                : mediaRoot;
            if (!scanRoot) {
              res.statusCode = 404;
              res.end(JSON.stringify({ ok: false, error: "Media folder not found" }));
              return;
            }
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: true, ...scanMediaFolder(scanRoot) }));
            return;
          }

          const sceneMatch = /^\/local-project-scenes\/([^/]+)\/(script|notes-run)\.json$/.exec(
            url,
          );
          if (sceneMatch) {
            const [, projectSlug, kind] = sceneMatch;
            const rel =
              kind === "notes-run" ? ["notes-run.json"] : ["scenes", "script.json"];
            const filePath = resolveProjectFile(roots, decodeURIComponent(projectSlug), rel);
            if (!filePath) {
              res.statusCode = 404;
              res.end("Not found");
              return;
            }
            const body = await fsPromises.readFile(filePath, "utf-8");
            res.setHeader("Content-Type", "application/json");
            res.end(body);
            return;
          }

          const mediaMatch = /^\/local-project-media\/([^/]+)\/(.+)\/([^/]+)$/.exec(url);
          if (mediaMatch) {
            const [, projectSlug, folderPath, fileName] = mediaMatch;
            const queryTitle = new URL(req.url ?? "", "http://local").searchParams.get("title");
            const safeFolder = decodeURIComponent(folderPath);
            const topFolder = safeFolder.split("/")[0];
            if (!MEDIA_FOLDERS.has(safeFolder) && !MEDIA_FOLDERS.has(topFolder)) {
              res.statusCode = 404;
              res.end("Invalid folder");
              return;
            }
            const parts = safeFolder.split("/");
            parts.push(decodeURIComponent(fileName));
            const filePath = resolveMediaFile(
              roots,
              decodeURIComponent(projectSlug),
              parts,
              mediaRoot,
              queryTitle ?? undefined,
              projectMediaRoots,
            );
            if (!filePath) {
              res.statusCode = 404;
              res.end("Not found");
              return;
            }
            const ext = path.extname(filePath).toLowerCase();
            res.setHeader("Content-Type", MIME[ext] ?? "application/octet-stream");
            res.setHeader("Cache-Control", "no-cache");
            fs.createReadStream(filePath).pipe(res);
            return;
          }
        } catch (err) {
          res.statusCode = 500;
          res.end(String((err as Error).message ?? err));
          return;
        }
        next();
      });
    },
  };
}
