#!/usr/bin/env bash
# Восстановление custom-format pg_dump в локальный postgres из docker-compose.yml.
# Запустите стек с БД заранее: make dev (или docker compose up -d postgres).

set -euo pipefail

DUMP="${1:?Укажите путь к файлу дампа (.dump), например: ./backups/dophamin_orkestr_....dump}"

test -f "$DUMP"

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

COMPOSE=(docker compose -f docker-compose.yml)

echo ">>> Копирование дампа в контейнер postgres..."
"${COMPOSE[@]}" cp "$DUMP" postgres:/tmp/orchestra_restore.dump

echo ">>> pg_restore (ожидайте, возможны предупреждения)..."
"${COMPOSE[@]}" exec -T postgres pg_restore -U orkestr -d dophamin_orkestr --no-owner --no-acl --clean --if-exists -v /tmp/orchestra_restore.dump

"${COMPOSE[@]}" exec -T postgres rm -f /tmp/orchestra_restore.dump

echo "Готово. DBeaver: localhost:5432, БД dophamin_orkestr, пользователь orkestr (см. docker-compose.yml)."
