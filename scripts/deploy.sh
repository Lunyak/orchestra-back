#!/bin/bash

# Скрипт для ручного деплоя на production сервер
# Альтернатива автоматическому деплою через GitLab CI/CD

set -euo pipefail

SERVER_HOST="${DEPLOY_HOST:-213.226.126.196}"
SERVER_USER="${DEPLOY_USER:-root}"
SERVER_PATH="${DEPLOY_PATH:-/opt/orchestra-back}"
# DEPLOY_HTTPS:
# - auto (default): если на сервере есть docker-compose.https.yml — используем его
# - 1/true: всегда использовать HTTPS compose
# - 0/false: никогда не использовать HTTPS compose
DEPLOY_HTTPS="${DEPLOY_HTTPS:-auto}"

echo "🚀 Деплой на production сервер..."
echo "📍 Сервер: $SERVER_USER@$SERVER_HOST"
echo "📂 Путь: $SERVER_PATH"
echo ""

# Проверка SSH-доступа
if ! ssh -o ConnectTimeout=5 "$SERVER_USER@$SERVER_HOST" "echo '✓ SSH подключение успешно'" 2>/dev/null; then
    echo "❌ Ошибка: не удалось подключиться к серверу"
    echo "Проверьте SSH-доступ: ssh $SERVER_USER@$SERVER_HOST"
    exit 1
fi

# Деплой
echo "📦 Выполнение деплоя..."
ssh "$SERVER_USER@$SERVER_HOST" "DEPLOY_PATH='$SERVER_PATH' DEPLOY_HTTPS='$DEPLOY_HTTPS' bash -lc 'set -euo pipefail
cd \"\$DEPLOY_PATH\"

echo \"📥 Получение обновлений из Git...\"
git pull

compose_files=(-f docker-compose.yml)
if [[ \"\$DEPLOY_HTTPS\" == \"1\" || \"\$DEPLOY_HTTPS\" == \"true\" ]]; then
  if [[ ! -f docker-compose.https.yml ]]; then
    echo \"❌ DEPLOY_HTTPS=\$DEPLOY_HTTPS, но docker-compose.https.yml не найден\"
    exit 1
  fi
  compose_files+=(-f docker-compose.https.yml)
elif [[ \"\$DEPLOY_HTTPS\" == \"0\" || \"\$DEPLOY_HTTPS\" == \"false\" ]]; then
  : # только базовый compose
else
  # auto
  if [[ -f docker-compose.https.yml ]]; then
    compose_files+=(-f docker-compose.https.yml)
  fi
fi

echo \"🔨 Сборка и перезапуск контейнеров...\"
docker compose \"\${compose_files[@]}\" up -d --build

echo \"🔍 Проверка статуса контейнеров...\"
docker compose \"\${compose_files[@]}\" ps

echo \"✅ Деплой завершён успешно!\"'"

echo ""
echo "🎉 Деплой завершён!"
echo "🌐 Проверьте: http://$SERVER_HOST (или ваш https-домен, если включён HTTPS)"
