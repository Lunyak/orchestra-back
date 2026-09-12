#!/usr/bin/env bash
# Mirror web/public/theater → MinIO {bucket}/theater/
# Prefer docker compose (prod VPS). Fallback: node script if back/node_modules exists.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
THEATER="$ROOT/web/public/theater"

if [[ ! -d "$THEATER" ]]; then
  echo "[push-theater-assets] missing $THEATER" >&2
  exit 1
fi

glb_count="$(find "$THEATER" -type f -name '*.glb' | wc -l | tr -d ' ')"
if [[ "$glb_count" == "0" ]]; then
  echo "[push-theater-assets] no .glb in web/public/theater" >&2
  echo "They are gitignored. Copy from the machine where models exist:" >&2
  echo "  scp -r web/public/theater root@HOST:/opt/orchestra-back/web/public/theater" >&2
  echo "Then rerun: make push-theater-assets" >&2
  exit 1
fi

cd "$ROOT"

if docker compose ps --status running minio >/dev/null 2>&1; then
  echo "[push-theater-assets] $glb_count glb → MinIO via docker"
  docker compose run --rm --no-deps \
    -v "$THEATER:/theater:ro" \
    --entrypoint /bin/sh \
    minio-init \
    -c 'set -e
      mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"
      mc mb -p "local/${S3_BUCKET}" || true
      mc anonymous set download "local/${S3_BUCKET}" || true
      mc mirror --overwrite /theater "local/${S3_BUCKET}/theater"
      echo "[push-theater-assets] done: local/${S3_BUCKET}/theater"
    '
  exit 0
fi

if [[ -d "$ROOT/back/node_modules/@aws-sdk/client-s3" ]]; then
  exec node "$ROOT/scripts/push-theater-assets-to-minio.cjs" "$@"
fi

echo "[push-theater-assets] start MinIO (docker compose up -d minio) or npm ci in back/" >&2
exit 1
