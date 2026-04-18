#!/usr/bin/env bash
# Снимок БД с VPS в ./backups/ (нужен ssh-доступ). Переменные можно переопределить:
#   ORCHESTRA_SSH=root@host ORCHESTRA_REMOTE_DIR=/opt/orchestra-back ./scripts/pull-db-from-server.sh

set -euo pipefail

REMOTE="${ORCHESTRA_SSH:-root@213.226.126.196}"
REMOTE_DIR="${ORCHESTRA_REMOTE_DIR:-/opt/orchestra-back}"
DUMP_NAME="dophamin_orkestr_$(date +%Y%m%d_%H%M%S).dump"

mkdir -p backups

echo ">>> Дамп в контейнере postgres на сервере ($REMOTE_DIR)..."
ssh "$REMOTE" "cd \"$REMOTE_DIR\" && docker compose exec -T postgres pg_dump -U orkestr -d dophamin_orkestr --no-owner --no-acl -Fc -f /tmp/$DUMP_NAME"

echo ">>> Выгрузка файла из контейнера на диск VPS (/tmp)..."
ssh "$REMOTE" "cd \"$REMOTE_DIR\" && docker compose cp postgres:/tmp/$DUMP_NAME /tmp/$DUMP_NAME"

echo ">>> Копирование ./backups/$DUMP_NAME ..."
scp "$REMOTE:/tmp/$DUMP_NAME" "./backups/$DUMP_NAME"

echo ">>> Удаление дампов на сервере..."
ssh "$REMOTE" "rm -f /tmp/$DUMP_NAME; cd \"$REMOTE_DIR\" && docker compose exec -T postgres rm -f /tmp/$DUMP_NAME"

echo "Готово: ./backups/$DUMP_NAME"
echo "Восстановление: ./scripts/restore-local-db.sh ./backups/$DUMP_NAME"
