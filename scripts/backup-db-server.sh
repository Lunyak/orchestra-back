#!/usr/bin/env bash
# Ежедневный бэкап PostgreSQL на production-сервере.
# Cron (root): 0 3 * * * /opt/orchestra-back/scripts/backup-db-server.sh >> /var/log/orchestra-backup.log 2>&1

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

BACKUP_DIR="$ROOT_DIR/backups"
mkdir -p "$BACKUP_DIR"

TS="$(date +%Y%m%d_%H%M%S)"
REMOTE_PATH="/tmp/orchestra_${TS}.dump"
LOCAL_PATH="$BACKUP_DIR/orchestra_${TS}.dump"

docker compose exec -T postgres pg_dump -U orkestr -d dophamin_orkestr -Fc -f "$REMOTE_PATH"
docker cp orkestr-postgres:"$REMOTE_PATH" "$LOCAL_PATH"
docker compose exec -T postgres rm -f "$REMOTE_PATH"

# Храним последние 14 дампов
ls -1t "$BACKUP_DIR"/orchestra_*.dump 2>/dev/null | tail -n +15 | xargs -r rm -f

echo "[$(date -Is)] backup ok: $LOCAL_PATH ($(du -h "$LOCAL_PATH" | awk '{print $1}'))"
