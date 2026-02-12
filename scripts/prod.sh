#!/bin/bash

# Скрипт для запуска production-окружения

set -e

echo "🚀 Запуск production окружения..."

# Проверяем, есть ли .env файл
if [ ! -f .env ]; then
    echo "❌ Ошибка: файл .env не найден!"
    echo "Создайте .env файл с настройками для production"
    exit 1
fi

# Останавливаем dev-контейнеры, если запущены
echo "📦 Останавливаем development контейнеры..."
docker compose -f docker-compose.yml -f docker-compose.dev.yml down 2>/dev/null || true

# Запускаем production
echo "🔧 Запуск production контейнеров..."
docker compose up -d --build

echo "✅ Production окружение запущено!"
echo "🌐 Web: http://localhost"
echo "📝 API: http://localhost:3000"
echo "⚙️  Admin: http://localhost:8081"
echo "📊 MinIO: http://localhost:9001"
echo "📋 Logs: http://localhost:9999"
echo ""
echo "💡 Для просмотра логов: docker compose logs -f"
