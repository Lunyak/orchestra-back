#!/bin/bash

# Скрипт для запуска dev-окружения с hot-reload

set -e

echo "🚀 Запуск dev-окружения с hot-reload..."

# Проверяем, есть ли .env файл
if [ ! -f .env ]; then
    echo "⚠️  Файл .env не найден. Создаём из .env.example..."
    cp .env.example .env 2>/dev/null || echo "JWT_SECRET=dev-secret-change-me" > .env
fi

# Останавливаем prod-контейнеры, если запущены
echo "📦 Останавливаем production контейнеры..."
docker compose down 2>/dev/null || true

# Запускаем dev-окружение
echo "🔧 Запуск development контейнеров..."
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build

echo "✅ Dev-окружение запущено!"
echo "📝 Backend API: http://localhost:3000"
echo "🌐 Web Frontend: http://localhost:5173"
echo "⚙️  Admin Panel: http://localhost:5174"
echo "📊 MinIO Console: http://localhost:9001"
echo "📋 Dozzle Logs: http://localhost:9999"
