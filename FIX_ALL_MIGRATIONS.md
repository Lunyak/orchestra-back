# 🔧 Полное исправление миграций на Production

## Проблема

Несколько миграций упали на production:

- `20260213091146_add_user_profile_fields` - добавление полей в UserProfile
- `20260213_create_missing_tables` - создание таблиц (уже удалена)
- `20260213_add_bot_fields` - поля для бота (уже удалена)

## 🚀 БЫСТРОЕ РЕШЕНИЕ (копируйте команды)

### На production сервере:

```bash
# Шаг 1: Подключитесь
ssh root@spb-3-vm-2g6f
cd /opt/orchestra-back

# Шаг 2: Удалите ВСЕ failed миграции из БД
docker exec -it orkestr-postgres psql -U postgres -d dophamin_orkestr << 'EOF'
DELETE FROM _prisma_migrations WHERE finished_at IS NULL;
EOF

# Шаг 3: Проверьте, какие таблицы существуют
docker exec -it orkestr-postgres psql -U postgres -d dophamin_orkestr -c "\dt" | grep -E "UserProfile|Rehearsal|BotSettings"

# Шаг 4: Если таблиц НЕТ - создайте их вручную
docker exec -it orkestr-postgres psql -U postgres -d dophamin_orkestr << 'EOSQL'
-- Создаем UserProfile если не существует
CREATE TABLE IF NOT EXISTS "UserProfile" (
  "email" TEXT NOT NULL,
  "displayName" TEXT,
  "firstName" TEXT,
  "lastName" TEXT,
  "telegramUsername" TEXT,
  "telegramId" TEXT UNIQUE,
  "avatarUrl" TEXT,
  "availabilityCalendar" JSONB,
  "sex" TEXT,
  "role" TEXT,
  "characters" JSONB,
  "phone" TEXT,
  "birthday" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("email")
);

-- Создаем enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RehearsalParticipantStatus') THEN
    CREATE TYPE "RehearsalParticipantStatus" AS ENUM ('unknown', 'present', 'absent', 'late');
  END IF;
END $$;

-- Создаем Rehearsal если не существует
CREATE TABLE IF NOT EXISTS "Rehearsal" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "durationMin" INTEGER,
  "notes" TEXT,
  "place" TEXT,
  "telegramChatId" TEXT,
  "telegramMessageId" TEXT,
  "telegramThreadId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy" TEXT,
  "createdVia" TEXT,
  CONSTRAINT "Rehearsal_pkey" PRIMARY KEY ("id")
);

-- Добавляем FK если ещё нет
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Rehearsal_projectId_fkey'
  ) THEN
    ALTER TABLE "Rehearsal" ADD CONSTRAINT "Rehearsal_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- Создаем RehearsalParticipant если не существует
CREATE TABLE IF NOT EXISTS "RehearsalParticipant" (
  "id" TEXT NOT NULL,
  "rehearsalId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "telegramId" TEXT,
  "userName" TEXT,
  "status" "RehearsalParticipantStatus" NOT NULL DEFAULT 'unknown',
  "roles" JSONB,
  "lateTime" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RehearsalParticipant_pkey" PRIMARY KEY ("id")
);

-- Добавляем FK если ещё нет
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RehearsalParticipant_rehearsalId_fkey'
  ) THEN
    ALTER TABLE "RehearsalParticipant" ADD CONSTRAINT "RehearsalParticipant_rehearsalId_fkey"
      FOREIGN KEY ("rehearsalId") REFERENCES "Rehearsal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Создаем индексы
CREATE INDEX IF NOT EXISTS "Rehearsal_projectId_startsAt_idx" ON "Rehearsal"("projectId", "startsAt");
CREATE INDEX IF NOT EXISTS "RehearsalParticipant_email_idx" ON "RehearsalParticipant"("email");
CREATE INDEX IF NOT EXISTS "RehearsalParticipant_telegramId_idx" ON "RehearsalParticipant"("telegramId");

-- Создаем BotSettings
CREATE TABLE IF NOT EXISTS "BotSettings" (
  "id" TEXT NOT NULL DEFAULT 'singleton',
  "groupChatId" TEXT,
  "attendanceThreadId" TEXT,
  "announcementsThreadId" TEXT,
  "projectSlug" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BotSettings_pkey" PRIMARY KEY ("id")
);

-- Вставляем запись по умолчанию
INSERT INTO "BotSettings" ("id", "updatedAt")
VALUES ('singleton', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
EOSQL

# Шаг 5: Перезапустите контейнер
docker-compose restart back

# Шаг 6: Проверьте логи (должен запуститься!)
docker logs orkestr-back --tail=100 -f
```

## ✅ Что должно произойти:

После выполнения команд вы должны увидеть в логах:

```
✅ Telegram бот запущен
✅ Application successfully started
```

## 🔍 Проверка состояния

```bash
# Проверьте таблицы
docker exec -it orkestr-postgres psql -U postgres -d dophamin_orkestr -c "\dt"

# Проверьте миграции
docker exec -it orkestr-postgres psql -U postgres -d dophamin_orkestr -c \
  "SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY started_at DESC LIMIT 10;"
```

## ⚠️ Если всё ещё не работает

### Вариант A: Полный сброс миграций (радикальный)

```bash
# ⚠️ ОСТОРОЖНО: Удалит все таблицы!
docker exec -it orkestr-postgres psql -U postgres -d dophamin_orkestr << 'EOF'
-- Удалить схему
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
EOF

# Применить миграции заново
docker exec -it orkestr-back npx prisma migrate deploy

# Перезапустить
docker-compose restart back
```

### Вариант B: Пометить миграции как выполненные

Если таблицы уже созданы правильно, просто пометьте миграции как выполненные:

```bash
docker exec -it orkestr-postgres psql -U postgres -d dophamin_orkestr << 'EOF'
-- Удалите все failed
DELETE FROM _prisma_migrations WHERE finished_at IS NULL;

-- Добавьте записи о выполненных миграциях
INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
VALUES
  (gen_random_uuid()::text, '', NOW(), '20260211120000_user_profile', '', NULL, NOW(), 1),
  (gen_random_uuid()::text, '', NOW(), '20260211123000_rehearsals', '', NULL, NOW(), 1),
  (gen_random_uuid()::text, '', NOW(), '20260212120000_profile_availability_calendar', '', NULL, NOW(), 1),
  (gen_random_uuid()::text, '', NOW(), '20260213091146_add_user_profile_fields', '', NULL, NOW(), 1)
ON CONFLICT DO NOTHING;
EOF

docker-compose restart back
```

## 📞 После исправления

1. ✅ Приложение должно запуститься
2. ✅ Настройте BOT_TOKEN в .env
3. ✅ Настройте projectSlug в BotSettings
4. ✅ Добавьте бота в группу Telegram
5. ✅ Настройте группу через /setgroup

---

**Создано:** 13 февраля 2026  
**Статус:** Экстренное исправление миграций
