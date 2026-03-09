/* eslint-disable no-console */
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');

function isImageFile(p) {
  const ext = path.extname(p).toLowerCase();
  return (
    ext === '.png' ||
    ext === '.jpg' ||
    ext === '.jpeg' ||
    ext === '.webp' ||
    ext === '.gif' ||
    ext === '.svg' ||
    ext === '.avif' ||
    ext === '.heic'
  );
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.avif') return 'image/avif';
  if (ext === '.heic') return 'image/heic';
  return undefined;
}

function toPosix(p) {
  return p.split(path.sep).join('/');
}

async function walk(dirAbs) {
  const out = [];
  const entries = await fsp.readdir(dirAbs, { withFileTypes: true });
  for (const e of entries) {
    const abs = path.join(dirAbs, e.name);
    if (e.isDirectory()) out.push(...(await walk(abs)));
    else if (e.isFile()) out.push(abs);
  }
  return out;
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

async function main() {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has('--dry-run');

  // back/migrate-site-media.cjs -> repoRoot
  const repoRoot = path.resolve(__dirname, '..');
  const clientPublic = path.join(repoRoot, 'client', 'public');

  const bucket = env('S3_BUCKET', 'orchestra-media');
  const endpoint = env('S3_ENDPOINT', 'http://127.0.0.1:9000');
  const region = env('S3_REGION', 'us-east-1');
  const accessKeyId = env('S3_ACCESS_KEY', 'orchestra');
  const secretAccessKey = env('S3_SECRET_KEY', 'orchestra_secret');
  const prefix = (process.env.SITE_MEDIA_PREFIX || 'site')
    .replace(/^\/+|\/+$/g, '')
    .trim();

  const publicBaseUrl = computePublicBaseUrl(endpoint);
  const suggestedEnvValue = publicBaseUrl
    ? `${publicBaseUrl}/${bucket}/${prefix}`
    : null;

  console.log('[migrate-site-media] client/public =', clientPublic);
  console.log('[migrate-site-media] bucket =', bucket);
  console.log('[migrate-site-media] endpoint =', endpoint);
  console.log('[migrate-site-media] prefix =', prefix);
  if (suggestedEnvValue) {
    console.log(
      '[migrate-site-media] suggested REACT_APP_SITE_ASSETS_BASE_URL =',
      suggestedEnvValue,
    );
  }
  if (dryRun) console.log('[migrate-site-media] DRY RUN (no uploads)');

  const all = await walk(clientPublic);
  const files = all.filter(isImageFile);
  if (files.length === 0) {
    console.log('[migrate-site-media] no image files found');
    return;
  }

  const s3 = new S3Client({
    endpoint,
    region,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });

  for (const absPath of files) {
    const rel = path.relative(clientPublic, absPath);
    const relPosix = toPosix(rel);
    const key = `${prefix}/${relPosix}`;
    const fromSite = `/${relPosix}`;
    const toUrl = publicBaseUrl ? `${publicBaseUrl}/${bucket}/${key}` : key;

    if (dryRun) {
      console.log('[dry]', fromSite, '->', toUrl);
      continue;
    }

    const ct = contentTypeFor(absPath);
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: fs.createReadStream(absPath),
        ContentType: ct,
      }),
    );
    console.log('[ok]', fromSite, '->', toUrl);
  }

  console.log('[migrate-site-media] done:', files.length, 'files');
}

main().catch((err) => {
  console.error('[migrate-site-media] failed:', err);
  process.exitCode = 1;
});

