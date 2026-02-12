#!/bin/bash

# Скрипт для остановки всех контейнеров

echo "🛑 Останавливаем все контейнеры..."

# Останавливаем production
docker compose down 2>/dev/null || true

# Останавливаем dev
docker compose -f docker-compose.yml -f docker-compose.dev.yml down 2>/dev/null || true

echo "✅ Все контейнеры остановлены"
