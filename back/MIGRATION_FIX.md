# Исправление проблемы с миграцией

## Проблема

Миграция `20260213_create_missing_tables` упала на production сервере с ошибкой P3009.

Prisma пометил её как failed и блокирует запуск приложения.

## Причина

Миграция была создана вручную через SQL, а не через Prisma CLI, и не была правильно зарегистрирована.

## Решение

### Вариант 1: Удалить failed миграцию и пересоздать (РЕКОМЕНДУЕТСЯ)

На production сервере выполните:

```bash
# 1. Подключитесь к контейнеру postgres
docker exec -it orkestr-postgres psql -U postgres -d dophamin_orkestr

# 2. Пометьте миграцию как rolled back
DELETE FROM "_prisma_migrations" 
WHERE migration_name = '20260213_create_missing_tables';

# 3. Выйдите из psql
\q

# 4. Удалите папку с миграцией локально
rm -rf back/prisma/migrations/20260213_create_missing_tables
rm -rf back/prisma/migrations/20260213_add_bot_fields

# 5. Создайте правильную миграцию через Prisma
cd back
npx prisma migrate dev --name add_bot_support

# 6. Закоммитьте и запушьте новую миграцию
git add prisma/migrations
git commit -m "fix: recreate bot migration properly"
git push

# 7. На сервере пересоберите и перезапустите
cd /opt/orchestra-back
git pull
docker-compose up -d --build
```

### Вариант 2: Resolve failed migration (БЫСТРОЕ ИСПРАВЛЕНИЕ)

Если таблицы уже созданы на production, просто пометьте миграцию как выполненную:

```bash
# На production сервере
docker exec -it orkestr-postgres psql -U postgres -d dophamin_orkestr

# Удалите запись о failed миграции
DELETE FROM "_prisma_migrations" 
WHERE migration_name = '20260213_create_missing_tables';

# Выйдите
\q

# Перезапустите контейнер
docker-compose restart back
```

### Вариант 3: Prisma migrate resolve (ЕСЛИ ДОСТУПЕН PRISMA CLI)

```bash
# На production сервере или локально с доступом к production БД
cd back

# Пометить миграцию как rolled back
npx prisma migrate resolve --rolled-back 20260213_create_missing_tables

# Применить миграции заново
npx prisma migrate deploy
```

## Проверка после исправления

```bash
# Проверьте логи
docker logs orkestr-back --tail=50

# Должны увидеть успешный запуск:
# ✅ Telegram бот запущен
# ✅ Application started successfully
```

## Как избежать в будущем

1. **НЕ создавайте миграции вручную** через psql
2. **Используйте Prisma CLI:**
   ```bash
   npx prisma migrate dev --name migration_name
   ```
3. **На production используйте:**
   ```bash
   npx prisma migrate deploy
   ```

## Если ничего не помогает

Самый радикальный вариант - сбросить миграции:

```bash
# ⚠️ ВНИМАНИЕ: Удалит все данные!
docker exec -it orkestr-postgres psql -U postgres -d dophamin_orkestr -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# Применить все миграции заново
cd back
npx prisma migrate deploy
```
