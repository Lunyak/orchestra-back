#!/bin/bash

# Скрипт для ручного деплоя на production сервер
# Альтернатива автоматическому деплою через GitLab CI/CD

set -e

SERVER_HOST="${DEPLOY_HOST:-213.226.126.196}"
SERVER_USER="${DEPLOY_USER:-root}"
SERVER_PATH="${DEPLOY_PATH:-/opt/orchestra-back}"

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
ssh "$SERVER_USER@$SERVER_HOST" << 'ENDSSH'
    set -e
    cd /opt/orchestra-back || exit 1
    
    echo "📥 Получение обновлений из Git..."
    git pull
    
    echo "🔨 Сборка и перезапуск контейнеров..."
    docker compose up -d --build
    
    echo "🔍 Проверка статуса контейнеров..."
    docker compose ps
    
    echo "✅ Деплой завершён успешно!"
ENDSSH

echo ""
echo "🎉 Деплой завершён!"
echo "🌐 Проверьте: http://$SERVER_HOST"
