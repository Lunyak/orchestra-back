#!/bin/bash

# Скрипт для быстрого исправления проблемы с миграциями

echo "🔧 Исправление проблемы с миграциями..."

# 1. Удаляем ручные миграции локально
echo "1. Удаляем ручные миграции..."
rm -rf prisma/migrations/20260213_add_bot_fields
rm -rf prisma/migrations/20260213_create_missing_tables

# 2. Проверяем, что таблицы уже существуют
echo "2. Проверяем существующие таблицы..."
psql postgresql://postgres:9379@localhost:5432/dophamin_orkestr -c "\dt" | grep -E "UserProfile|Rehearsal|BotSettings"

# 3. Если таблицы существуют, создаем baseline миграцию
echo "3. Создаем baseline миграцию..."
cat > prisma/migrations/20260213_bot_support_baseline/migration.sql << 'EOF'
-- This is a baseline migration
-- Tables UserProfile, Rehearsal, RehearsalParticipant, BotSettings already exist
-- This migration marks the current state

-- Verify tables exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'UserProfile') THEN
    RAISE EXCEPTION 'UserProfile table does not exist. Run manual migration first.';
  END IF;
  
  IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'Rehearsal') THEN
    RAISE EXCEPTION 'Rehearsal table does not exist. Run manual migration first.';
  END IF;
  
  IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'BotSettings') THEN
    RAISE EXCEPTION 'BotSettings table does not exist. Run manual migration first.';
  END IF;
END $$;
EOF

mkdir -p prisma/migrations/20260213_bot_support_baseline

echo "✅ Готово! Теперь:"
echo ""
echo "На production сервере выполните:"
echo ""
echo "  # Удалите failed миграцию"
echo "  docker exec -it orkestr-postgres psql -U postgres -d dophamin_orkestr -c \"DELETE FROM _prisma_migrations WHERE migration_name LIKE '20260213_%';\""
echo ""
echo "  # Пересоберите и перезапустите"
echo "  cd /opt/orchestra-back"
echo "  git pull"
echo "  docker-compose up -d --build"
echo ""
