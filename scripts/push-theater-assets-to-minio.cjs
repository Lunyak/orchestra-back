/* eslint-disable no-console */
/**
 * Зеркало web/public/theater → MinIO: {bucket}/theater/...
 *
 * Запуск из корня репо (нужен npm ci в back/):
 *   node scripts/push-theater-assets-to-minio.cjs
 *   node scripts/push-theater-assets-to-minio.cjs --dry-run
 *
 * Env: S3_ENDPOINT, S3_PUBLIC_URL, S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY, S3_REGION
 * Читает корневой .env и back/.env при наличии.
 */
const path = require('node:path');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const Module = require('node:module');

const repoRoot = path.resolve(__dirname, '..');
const backNodeModules = path.join(repoRoot, 'back', 'node_modules');
module.paths.unshift(backNodeModules);
Module.globalPaths.unshift(backNodeModules);

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

try {
  require('dotenv').config({ path: path.join(repoRoot, '.env') });
  require('dotenv').config({ path: path.join(repoRoot, 'back', '.env') });
} catch {
  // optional
}

const THEATER_PREFIX = 'theater';
const UPLOAD_EXTENSIONS = new Set([
  '.glb',
  '.gltf',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.txt',
]);

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.glb') return 'model/gltf-binary';
  if (ext === '.gltf') return 'model/gltf+json';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.txt') return 'text/plain; charset=utf-8';
  return 'application/octet-stream';
}

function toPosix(p) {
  return p.split(path.sep).join('/');
}

function env(name, fallback) {
  const v = process.env[name];
  if (typeof v === 'string' && v.trim()) return v.trim();
  if (fallback != null) return fallback;
  throw new Error(`Missing env: ${name}`);
}

function computePublicBaseUrl(endpointFallback) {
  const publicUrl =
    (process.env.S3_PUBLIC_URL || process.env.MINIO_PUBLIC_URL || '').trim() ||
    (process.env.S3_ENDPOINT || '').trim() ||
    (endpointFallback || '').trim();
  if (!publicUrl) return null;
  return publicUrl.replace(/\/$/, '');
}

async function walk(dirAbs) {
  const out = [];
  const entries = await fsp.readdir(dirAbs, { withFileTypes: true });
  for (const entry of entries) {
    const abs = path.join(dirAbs, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(abs)));
    else if (entry.isFile()) out.push(abs);
  }
  return out;
}

function shouldUpload(filePath) {
  return UPLOAD_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has('--dry-run');

  const theaterDir = path.join(repoRoot, 'web', 'public', 'theater');
  if (!fs.existsSync(theaterDir)) {
    throw new Error(`Theater assets dir not found: ${theaterDir}`);
  }

  const bucket = env('S3_BUCKET', 'orchestra-media');
  const endpoint = env('S3_ENDPOINT', 'http://127.0.0.1:9000');
  const region = env('S3_REGION', 'us-east-1');
  const accessKeyId = env('S3_ACCESS_KEY', 'orchestra');
  const secretAccessKey = env('S3_SECRET_KEY', 'orchestra_secret');
  const publicBaseUrl = computePublicBaseUrl(endpoint);
  const suggestedViteBase = publicBaseUrl
    ? `${publicBaseUrl}/${bucket}`
    : null;

  console.log('[push-theater-assets] source =', theaterDir);
  console.log('[push-theater-assets] bucket =', bucket);
  console.log('[push-theater-assets] endpoint =', endpoint);
  console.log('[push-theater-assets] prefix =', THEATER_PREFIX);
  if (suggestedViteBase) {
    console.log(
      '[push-theater-assets] suggested VITE_THEATER_ASSETS_BASE_URL =',
      suggestedViteBase,
    );
  }
  if (dryRun) console.log('[push-theater-assets] DRY RUN (no uploads)');

  const files = (await walk(theaterDir)).filter(shouldUpload);
  if (files.length === 0) {
    console.log('[push-theater-assets] no files found');
    return;
  }

  const s3 = new S3Client({
    endpoint,
    region,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });

  for (const absPath of files) {
    const relPosix = toPosix(path.relative(theaterDir, absPath));
    const key = `${THEATER_PREFIX}/${relPosix}`;
    const toUrl = publicBaseUrl ? `${publicBaseUrl}/${bucket}/${key}` : key;

    if (dryRun) {
      console.log('[dry]', key, '->', toUrl);
      continue;
    }

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: fs.createReadStream(absPath),
        ContentType: contentTypeFor(absPath),
      }),
    );
    console.log('[ok]', key, '->', toUrl);
  }

  console.log('[push-theater-assets] done:', files.length, 'files');
}

main().catch((err) => {
  console.error('[push-theater-assets] failed:', err);
  process.exitCode = 1;
});
