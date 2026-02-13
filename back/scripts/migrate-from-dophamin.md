# Миграция данных из Dophamin в Orchestra

## Что нужно перенести:

### 1. Профили пользователей

**Из:** `Dophamin/server` - таблица `user` (TypeORM)
**В:** `Orchestra/back` - таблица `UserProfile` (Prisma)

**Маппинг полей:**
```
Dophamin User          → Orchestra UserProfile
----------------         ----------------------
email                  → email
name                   → firstName
surname                → lastName
telegram_id            → telegramId
telegram               → telegramUsername
characters (JSON)      → characters (JSON)
birthday               → birthday
phone                  → phone
sex                    → sex
```

**SQL-скрипт для миграции:**

```sql
-- Вставка профилей из старой БД в новую
INSERT INTO "UserProfile" (
  email,
  "firstName",
  "lastName",
  "telegramId",
  "telegramUsername",
  characters,
  birthday,
  phone,
  sex,
  "displayName",
  "createdAt",
  "updatedAt"
)
SELECT
  email,
  name,
  surname,
  CAST(telegram_id AS TEXT),
  telegram,
  characters::jsonb,
  birthday,
  phone,
  sex,
  COALESCE(name || ' ' || surname, name, email),
  created_at,
  updated_at
FROM old_db.user
ON CONFLICT (email) DO UPDATE SET
  "firstName" = EXCLUDED."firstName",
  "lastName" = EXCLUDED."lastName",
  "telegramId" = EXCLUDED."telegramId",
  "telegramUsername" = EXCLUDED."telegramUsername",
  characters = EXCLUDED.characters,
  "updatedAt" = EXCLUDED."updatedAt";
```

### 2. Репетиции

**Из:** `Dophamin/bot/data/rehearsal.json`
**В:** `Orchestra/back` - таблица `Rehearsal`

**Важно:** 
- Сначала нужно создать проект в Orchestra
- Затем использовать его `id` или `slug` для привязки репетиций

**Пример скрипта миграции (Node.js):**

```javascript
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function migrateRehearsals() {
  // Читаем старые данные
  const oldData = JSON.parse(
    fs.readFileSync('../Dophamin/bot/data/rehearsal.json', 'utf8')
  );

  // Находим проект
  const project = await prisma.project.findFirst({
    where: { slug: 'default' }
  });

  if (!project) {
    console.error('Project not found!');
    return;
  }

  // Мигрируем каждую репетицию
  for (const [dateKey, rehearsal] of Object.entries(oldData.rehearsalsByDate || {})) {
    // Парсим дату и время
    const [year, month, day] = dateKey.split('-');
    const [hour, minute] = (rehearsal.time || '18:00').split(':');
    const startsAt = new Date(year, month - 1, day, hour, minute);

    // Создаем репетицию
    const newRehearsal = await prisma.rehearsal.create({
      data: {
        projectId: project.id,
        title: `Репетиция ${rehearsal.dateDisplay}`,
        startsAt,
        place: rehearsal.place || null,
        createdBy: 'bot',
        createdVia: 'migration',
      },
    });

    console.log(`Created rehearsal: ${newRehearsal.id} for ${dateKey}`);

    // Мигрируем участников
    const attendance = oldData.attendance[dateKey] || {};
    for (const [telegramId, data] of Object.entries(attendance)) {
      // Находим профиль по telegramId
      const profile = await prisma.userProfile.findFirst({
        where: { telegramId: String(telegramId) },
      });

      if (!profile) {
        console.warn(`Profile not found for telegramId: ${telegramId}`);
        continue;
      }

      // Маппинг статусов
      const statusMap = {
        coming: 'present',
        not_coming: 'absent',
        late: 'late',
      };

      await prisma.rehearsalParticipant.create({
        data: {
          rehearsalId: newRehearsal.id,
          email: profile.email,
          telegramId: String(telegramId),
          userName: data.userName,
          status: statusMap[data.status] || 'unknown',
          lateTime: data.meta?.lateText || null,
        },
      });
    }
  }

  console.log('Migration completed!');
}

migrateRehearsals()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

### 3. Настройки бота

**Вручную настроить в БД:**

```sql
UPDATE "BotSettings"
SET
  "groupChatId" = 'ВАШ_ID_ГРУППЫ',
  "attendanceThreadId" = 'ВАШ_ID_ТОПИКА',
  "projectSlug" = 'ВАШ_SLUG_ПРОЕКТА'
WHERE id = 'singleton';
```

## Пошаговая инструкция

1. **Сделайте бэкап обеих БД!**

2. **Перенесите профили пользователей:**
   ```bash
   # Подключитесь к обеим БД
   psql -h localhost -U postgres -d orchestra
   # Выполните SQL-скрипт выше
   ```

3. **Перенесите репетиции:**
   ```bash
   cd back/scripts
   node migrate-rehearsals.js
   ```

4. **Настройте бота:**
   - Добавьте `BOT_TOKEN` и `OWNER_TELEGRAM_ID` в `.env`
   - Обновите `BotSettings` в БД

5. **Протестируйте бота:**
   ```bash
   cd back
   npm run start:dev
   ```

6. **Настройте группу:**
   - Добавьте бота в группу Telegram
   - Отправьте `/setgroup` в нужном топике

## Проверка после миграции

- [ ] Все профили перенесены (проверить количество)
- [ ] TelegramId заполнен для всех пользователей
- [ ] Репетиции созданы с правильными датами
- [ ] Участники привязаны к репетициям
- [ ] Бот запускается без ошибок
- [ ] Команда `/profile` работает для пользователей
- [ ] Команда `/who` показывает участников репетиции
- [ ] Создание новой репетиции работает
- [ ] Опросы отправляются в группу
