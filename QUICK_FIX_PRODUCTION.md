# ⚡ Быстрое исправление на Production

## Что случилось?

Две ручные миграции (`20260213_add_bot_fields` и `20260213_create_missing_tables`) были созданы неправильно и упали на production сервере.

## ✅ Что уже сделано локально:

- ❌ Удалены проблемные миграции из `prisma/migrations/`

## 🔧 Исправление на Production (выполните эти команды):

### Шаг 1: Подключитесь к серверу

```bash
ssh root@spb-3-vm-2g6f
cd /opt/orchestra-back
```

### Шаг 2: Очистите failed миграции в БД

```bash
docker exec -it orkestr-postgres psql -U postgres -d dophamin_orkestr -c \
  "DELETE FROM _prisma_migrations WHERE migration_name LIKE '20260213%' AND finished_at IS NULL;"
```

### Шаг 3: Подтяните изменения и пересоберите

```bash
git pull
docker-compose down
docker-compose up -d --build
```

### Шаг 4: Проверьте логи

```bash
docker logs orkestr-back --tail=50 -f
```

Должны увидеть:
```
✅ Telegram бот запущен
✅ Application successfully started
```

## 📝 Альтернативный вариант (если таблицы уже существуют):

Если таблицы `UserProfile`, `Rehearsal`, `BotSettings` уже созданы на production:

```bash
# Просто удалите все записи о failed миграциях
docker exec -it orkestr-postgres psql -U postgres -d dophamin_orkestr << 'EOF'
DELETE FROM _prisma_migrations WHERE migration_name LIKE '20260213%';
EOF

# Перезапустите контейнер
docker-compose restart back
```

## 🔍 Проверка состояния

```bash
# Проверьте, какие таблицы существуют
docker exec -it orkestr-postgres psql -U postgres -d dophamin_orkestr -c "\dt"

# Проверьте миграции
docker exec -it orkestr-postgres psql -U postgres -d dophamin_orkestr -c \
  "SELECT migration_name, finished_at, logs FROM _prisma_migrations ORDER BY started_at DESC LIMIT 10;"
```

## ⚠️ Если таблиц нет (нужно создать):

Если таблицы `UserProfile`, `Rehearsal`, `BotSettings` НЕ существуют на production:

```bash
# Создайте таблицы вручную
docker exec -i orkestr-postgres psql -U postgres -d dophamin_orkestr < back/prisma/migrations/20260213_create_missing_tables/migration.sql

# Зарегистрируйте миграцию
docker exec -it orkestr-postgres psql -U postgres -d dophamin_orkestr << 'EOF'
INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
VALUES (
  gen_random_uuid()::text,
  '',
  NOW(),
  '20260213_bot_tables_manual',
  '',
  NULL,
  NOW(),
  1
);
EOF

# Перезапустите
docker-compose restart back
```

## 🎯 После исправления:

1. ✅ Бэк должен запуститься без ошибок
2. ✅ Настройте BOT_TOKEN в `.env` на сервере
3. ✅ Бот автоматически запустится

---

**Создано:** 13 февраля 2026
**Проблема:** Failed migrations P3009
**Решение:** Удалить проблемные миграции из БД и репозитория
