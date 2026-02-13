# Сводка миграции бота из Dophamin в Orchestra

## ✅ Что сделано:

### 1. Обновлена схема базы данных (Prisma)

**Добавлено в `UserProfile`:**
- `telegramId` - уникальный ID пользователя в Telegram
- `characters` - роли/персонажи (JSON массив)

**Добавлено в `Rehearsal`:**
- `place` - место проведения репетиции
- `telegramChatId` - ID группы в Telegram
- `telegramMessageId` - ID сообщения опроса
- `telegramThreadId` - ID топика в группе

**Добавлено в `RehearsalParticipant`:**
- `telegramId` - ID участника в Telegram
- `userName` - имя для отображения
- `lateTime` - время прихода для опаздывающих
- Статус `late` добавлен в enum

**Создана таблица `BotSettings`:**
- `groupChatId` - ID группы для опросов
- `attendanceThreadId` - ID топика для опросов
- `announcementsThreadId` - ID топика для объявлений
- `projectSlug` - slug проекта по умолчанию

### 2. Создан модуль Telegram Bot

**Структура:**
```
back/src/telegram/
├── telegram.module.ts
├── telegram.service.ts
└── services/
    ├── attendance.service.ts
    └── profile.service.ts
```

**Основной функционал:**
- ✅ Регистрация и управление профилями через бота
- ✅ Создание репетиций (команда `/setrehearsal`)
- ✅ Опросы о явке с кнопками "Буду" / "Не буду" / "Буду позже"
- ✅ Просмотр списка участников (`/who`)
- ✅ Настройка группы для опросов (`/setgroup`)
- ✅ Хранение всех данных в PostgreSQL

### 3. Миграции БД

Созданы SQL-скрипты миграции:
- `prisma/migrations/20260213_create_missing_tables/migration.sql` - создание таблиц
- Миграции применены к базе данных

### 4. Обновлены зависимости

Добавлены в `back/package.json`:
- `telegraf` ^4.16.3 - библиотека для Telegram Bot API
- `axios` ^1.6.5 - HTTP клиент
- `moment` ^2.30.1 - работа с датами
- `node-cron` ^3.0.3 - планировщик задач

### 5. Документация

Созданы файлы:
- `back/TELEGRAM_BOT_README.md` - полная документация по боту
- `back/scripts/migrate-from-dophamin.md` - инструкция по миграции данных
- `back/.env.example` - пример конфигурации

## 🔧 Что нужно настроить:

### 1. Переменные окружения

Добавьте в `back/.env`:

```env
BOT_TOKEN=your_bot_token_from_botfather
OWNER_TELEGRAM_ID=your_telegram_user_id
```

**Получение токена:**
1. Напишите @BotFather в Telegram
2. Отправьте `/newbot`
3. Следуйте инструкциям
4. Скопируйте токен

**Получение OWNER_TELEGRAM_ID:**
1. Напишите @userinfobot в Telegram
2. Он вернет ваш ID

### 2. Настройка проекта по умолчанию

```sql
UPDATE "BotSettings"
SET "projectSlug" = 'your-project-slug'
WHERE id = 'singleton';
```

### 3. Обновление Node.js (рекомендуется)

Текущая версия: **v18.16.0**
Требуется для Prisma 7: **>= v20.19**

**Установка через nvm:**
```bash
nvm install 20
nvm use 20
```

### 4. Миграция данных из Dophamin

См. подробную инструкцию в `back/scripts/migrate-from-dophamin.md`

Краткий план:
1. Перенести профили пользователей (SQL)
2. Перенести репетиции (скрипт Node.js)
3. Настроить BotSettings

## 🚀 Запуск

```bash
cd back
npm install
npm run start:dev
```

Бот запустится автоматически при старте приложения.

Проверьте логи:
- `✅ Telegram бот запущен` - бот работает
- `⚠️ BOT_TOKEN not set` - не указан токен

## 📝 Основные команды бота

**Для всех пользователей:**
- `/start` - Начать
- `/register` - Регистрация
- `/profile` - Мой профиль
- `/who` - Кто идет на репетицию
- `/menu` - Показать меню
- `/help` - Справка

**Для организатора (OWNER_TELEGRAM_ID):**
- `/setrehearsal` - Создать репетицию
- `/setgroup` - Настроить группу

## 🔄 Отличия от старого бота

### Что изменилось:

| Было (Dophamin) | Стало (Orchestra) |
|-----------------|-------------------|
| Данные в JSON файлах | Все в PostgreSQL |
| TypeORM (User) | Prisma (UserProfile) |
| Отдельный процесс бота | Интегрирован в NestJS |
| `user.characters` | `userProfile.characters` |
| Модель User | Модель UserProfile (без FK к User) |

### Что убрано:

- ❌ Google Sheets интеграция (guests, addguest)
- ❌ Квизы (leaderboard, addquiz, callquiz)
- ❌ Таблица дней рождения (checkbirthdays)
- ❌ Анонимные вопросы (question)
- ❌ Dump базы данных

Эти функции можно добавить позже при необходимости.

### Что осталось:

- ✅ Профили пользователей
- ✅ Создание репетиций
- ✅ Опросы о явке
- ✅ Список участников
- ✅ Статусы: Буду / Не буду / Буду позже

## ⚠️ Важные замечания:

1. **Версия Node.js**: Для работы Prisma 7 нужен Node.js >= 20. Сейчас используется v18.16.0.

2. **Миграция данных**: Профили пользователей и репетиции нужно перенести вручную из старой БД.

3. **Группа Telegram**: После запуска бота добавьте его в группу и настройте через `/setgroup`.

4. **Проект по умолчанию**: Бот создает репетиции в проекте, указанном в `BotSettings.projectSlug`.

## 📞 Поддержка

При возникновении проблем:
1. Проверьте логи приложения
2. Проверьте `.env` файл
3. Убедитесь, что все миграции применены
4. См. `back/TELEGRAM_BOT_README.md` для troubleshooting

## 🎯 Следующие шаги:

1. [ ] Обновить Node.js до версии 20+
2. [ ] Настроить BOT_TOKEN и OWNER_TELEGRAM_ID
3. [ ] Перенести данные из Dophamin
4. [ ] Запустить бота и протестировать
5. [ ] Добавить бота в группу Telegram
6. [ ] Настроить группу через `/setgroup`
7. [ ] Создать тестовую репетицию
8. [ ] Проверить работу опросов

---

**Дата миграции:** 13 февраля 2026
**Версия:** 1.0.0
