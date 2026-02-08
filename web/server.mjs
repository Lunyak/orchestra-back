/**
 * Minimal production server: static files + /api proxy.
 * Replaces nginx to avoid pulling nginx image (Docker Hub rate limit).
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, 'dist');
const BACK_URL = process.env.BACK_URL || 'http://back:3000';
const PORT = Number(process.env.PORT) || 80;

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function send(res, statusCode, body, contentType) {
  res.writeHead(statusCode, { 'Content-Type': contentType || 'text/plain' });
  res.end(body);
}

function serveFile(res, filePath) {
  const ext = path.extname(filePath);
  const contentType = MIME[ext] || 'application/octet-stream';
  const stream = fs.createReadStream(filePath);
  stream.on('error', () => send(res, 404, 'Not Found', 'text/plain'));
  res.writeHead(200, { 'Content-Type': contentType });
  stream.pipe(res);
}

async function proxy(req, res, pathname) {
  const url = new URL(pathname + (req.url.slice(req.url.indexOf('?')) || ''), BACK_URL);
  const headers = { ...req.headers, host: new URL(BACK_URL).host };
  const opt = { method: req.method, headers };
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    opt.body = Buffer.concat(chunks);
  }
  const backend = await fetch(url.toString(), opt);
  res.writeHead(backend.status, Object.fromEntries(backend.headers.entries()));
  res.end(Buffer.from(await backend.arrayBuffer()));
}

const server = http.createServer(async (req, res) => {
  const url = req.url?.split('?')[0] || '/';
  if (url.startsWith('/api/')) {
    const pathname = url.replace(/^\/api/, '') || '/';
    return proxy(req, res, pathname);
  }
  let filePath = path.join(ROOT, url === '/' ? 'index.html' : url);
  if (!filePath.startsWith(ROOT)) {
    return send(res, 403, 'Forbidden', 'text/plain');
  }
  try {
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }
    if (!fs.existsSync(filePath)) {
      filePath = path.join(ROOT, 'index.html');
    }
    if (url === '/' || url.endsWith('/')) {
      res.setHeader('Cache-Control', 'no-cache');
    } else if (url.startsWith('/assets/')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
    serveFile(res, filePath);
  } catch {
    const fallback = path.join(ROOT, 'index.html');
    if (fs.existsSync(fallback)) {
      res.setHeader('Cache-Control', 'no-cache');
      serveFile(res, fallback);
    } else {
      send(res, 404, 'Not Found', 'text/plain');
    }
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Web server listening on port ${PORT}, back=${BACK_URL}`);
});
