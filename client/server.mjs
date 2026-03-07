/**
 * Minimal production server for CRA build (static + SPA fallback).
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "build");
const PORT = Number(process.env.PORT) || 80;

const MIME = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function send(res, statusCode, body, contentType) {
  res.writeHead(statusCode, { "Content-Type": contentType || "text/plain" });
  res.end(body);
}

function serveFile(reqUrl, res, filePath) {
  const ext = path.extname(filePath);
  const contentType = MIME[ext] || "application/octet-stream";

  if (reqUrl.startsWith("/static/")) {
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  } else if (reqUrl === "/" || reqUrl.endsWith("/")) {
    res.setHeader("Cache-Control", "no-cache");
  }

  const stream = fs.createReadStream(filePath);
  stream.on("error", () => send(res, 404, "Not Found", "text/plain"));
  res.writeHead(200, { "Content-Type": contentType });
  stream.pipe(res);
}

const server = http.createServer((req, res) => {
  const urlPath = (req.url?.split("?")[0] || "/").trim() || "/";

  let filePath = path.join(ROOT, urlPath === "/" ? "index.html" : urlPath);
  if (!filePath.startsWith(ROOT)) return send(res, 403, "Forbidden", "text/plain");

  try {
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) filePath = path.join(filePath, "index.html");
    if (!fs.existsSync(filePath)) filePath = path.join(ROOT, "index.html");
    serveFile(urlPath, res, filePath);
  } catch {
    const fallback = path.join(ROOT, "index.html");
    if (fs.existsSync(fallback)) {
      res.setHeader("Cache-Control", "no-cache");
      serveFile("/", res, fallback);
    } else {
      send(res, 404, "Not Found", "text/plain");
    }
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Site server listening on port ${PORT}`);
});

