/**
 * Minimal production server: static files + /api proxy.
 * Replaces nginx to avoid pulling nginx image (Docker Hub rate limit).
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
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
  const queryIndex = req.url.indexOf('?');
  const query = queryIndex >= 0 ? req.url.slice(queryIndex) : '';
  const target = new URL(pathname + query, BACK_URL);
  const headers = { ...req.headers, host: target.host };
  const proxyReq = http.request(
    {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || (target.protocol === 'https:' ? 443 : 80),
      path: `${target.pathname}${target.search}`,
      method: req.method,
      headers,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );
  proxyReq.on('error', () => {
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
    }
    res.end('Bad Gateway');
  });
  req.pipe(proxyReq);
}

function proxyUpgrade(req, socket, head) {
  try {
    const backend = new URL(BACK_URL);
    const port = Number(backend.port || (backend.protocol === 'https:' ? 443 : 80));
    const host = backend.hostname;

    const backendSocket = net.connect(port, host, () => {
      const headers = { ...req.headers, host: backend.host };
      const headerLines = Object.entries(headers)
        .map(([k, v]) => {
          if (Array.isArray(v)) return v.map((vv) => `${k}: ${vv}`).join('\r\n');
          return `${k}: ${v}`;
        })
        .join('\r\n');

      backendSocket.write(`${req.method} ${req.url} HTTP/1.1\r\n${headerLines}\r\n\r\n`);
      if (head?.length) backendSocket.write(head);
      socket.pipe(backendSocket);
      backendSocket.pipe(socket);
    });

    backendSocket.on('error', () => {
      try {
        socket.end();
      } catch {}
    });
  } catch {
    try {
      socket.end();
    } catch {}
  }
}

const server = http.createServer(async (req, res) => {
  const url = req.url?.split('?')[0] || '/';
  if (url.startsWith('/api/')) {
    const pathname = url.replace(/^\/api/, '') || '/';
    return proxy(req, res, pathname);
  }
  if (url.startsWith('/socket.io/')) {
    return proxy(req, res, url);
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

server.on('upgrade', (req, socket, head) => {
  const url = req.url?.split('?')[0] || '/';
  if (url.startsWith('/socket.io/')) {
    proxyUpgrade(req, socket, head);
    return;
  }
  try {
    socket.destroy();
  } catch {}
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Web server listening on port ${PORT}, back=${BACK_URL}`);
});
