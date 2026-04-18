#!/usr/bin/env bash
# Зеркалирование бакета S3/MinIO с VPS в локальный MinIO (объекты не входят в pg_dump).
#
# Нужен доступ к API MinIO на сервере (порт 9000 снаружи, как на VPS в docker-compose).
# Переменные (опционально):
#   ORCHESTRA_MINIO_REMOTE, ORCHESTRA_MINIO_REMOTE_USER, ORCHESTRA_MINIO_REMOTE_PASSWORD
#   S3_BUCKET
#   ORCHESTRA_MINIO_LOCAL — с установленным mc по умолчанию http://127.0.0.1:9000;
#     в docker-режиме: http://host.docker.internal:9000
#
# Если порт 9000 на сервере закрыт: в другом терминале
#   ssh -N -L 19000:127.0.0.1:9000 root@ВАШ_ХОСТ
# затем: ORCHESTRA_MINIO_REMOTE=http://127.0.0.1:19000 ./scripts/pull-minio-from-server.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

REMOTE_URL="${ORCHESTRA_MINIO_REMOTE:-http://213.226.126.196:9000}"
REMOTE_USER="${ORCHESTRA_MINIO_REMOTE_USER:-${MINIO_ROOT_USER:-orchestra}}"
REMOTE_PASS="${ORCHESTRA_MINIO_REMOTE_PASSWORD:-${MINIO_ROOT_PASSWORD:-orchestra_secret}}"
BUCKET="${S3_BUCKET:-orchestra-media}"

LOCAL_USER="${ORCHESTRA_MINIO_LOCAL_USER:-orchestra}"
LOCAL_PASS="${ORCHESTRA_MINIO_LOCAL_PASSWORD:-orchestra_secret}"

echo ">>> Бакет: $BUCKET"
echo ">>> Источник (VPS): $REMOTE_URL"
echo ">>> Локальный MinIO должен быть запущен: docker compose up -d minio"

if command -v mc >/dev/null 2>&1; then
  LOCAL_URL="${ORCHESTRA_MINIO_LOCAL:-http://127.0.0.1:9000}"
  echo ">>> Назначение (mc на хосте): $LOCAL_URL"
  mc alias set rem "$REMOTE_URL" "$REMOTE_USER" "$REMOTE_PASS"
  mc alias set loc "$LOCAL_URL" "$LOCAL_USER" "$LOCAL_PASS"
  mc mb -p "loc/$BUCKET" || true
  mc mirror --overwrite "rem/$BUCKET" "loc/$BUCKET"
  mc anonymous set download "loc/$BUCKET" || true
else
  LOCAL_URL="${ORCHESTRA_MINIO_LOCAL:-http://host.docker.internal:9000}"
  echo ">>> Назначение (docker + minio/mc): $LOCAL_URL"
  # У образа minio/mc ENTRYPOINT = mc → без --entrypoint аргумент sh уходит в mc как «команда».
  docker run --rm \
    --add-host=host.docker.internal:host-gateway \
    --entrypoint /bin/sh \
    -e "REMOTE_URL=$REMOTE_URL" \
    -e "REMOTE_USER=$REMOTE_USER" \
    -e "REMOTE_PASS=$REMOTE_PASS" \
    -e "LOCAL_URL=$LOCAL_URL" \
    -e "LOCAL_USER=$LOCAL_USER" \
    -e "LOCAL_PASS=$LOCAL_PASS" \
    -e "BUCKET=$BUCKET" \
    minio/mc:latest \
    -c '
      set -e
      mc alias set rem "$REMOTE_URL" "$REMOTE_USER" "$REMOTE_PASS"
      mc alias set loc "$LOCAL_URL" "$LOCAL_USER" "$LOCAL_PASS"
      mc mb -p "loc/$BUCKET" || true
      mc mirror --overwrite "rem/$BUCKET" "loc/$BUCKET"
      mc anonymous set download "loc/$BUCKET" || true
    '
fi

echo ">>> Готово."
