# Orchestra Telegram Bot

Telegram бот для управления репетициями, профилями участников, викторинами и другими функциями театра "Оркестр".

## Особенности

- 🎭 **Управление профилями** - регистрация участников, просмотр и редактирование профилей
- 📅 **Репетиции** - напоминания о репетициях, учет посещаемости
- 🎂 **Дни рождения** - автоматические напоминания о днях рождения участников
- 🎯 **Викторины** - создание и проведение викторин с таблицей лидеров
- 📊 **Google Sheets** - интеграция с Google Sheets для списков гостей
- ❓ **Анонимные вопросы** - возможность задать анонимный вопрос
- 🗄️ **Дампы БД** - автоматическое создание дампов базы данных (только для владельца)

## Требования

- Node.js 18+
- Docker и Docker Compose
- PostgreSQL база данных (через backend)
- Telegram Bot Token (получить у [@BotFather](https://t.me/Botfather))
- Google Sheets API credentials (для функций со списками гостей)

## Установка и настройка

### 1. Переменные окружения

Скопируйте `.env.example` в `.env` и заполните переменные:

```bash
cp .env.example .env
```

Основные переменные:
```bash
# Обязательные
BOT_TOKEN=your_bot_token_from_botfather
OWNER_TELEGRAM_ID=your_telegram_user_id
SERVER_URL=back:3000  # URL backend сервера (в Docker: имя контейнера)

# Группы и чаты
GROUP_CHAT_ID=-1001234567890
ANNOUNCEMENTS_THREAD_ID=14434

# Google Sheets (опционально)
SPREADSHEET_ID=your_spreadsheet_id
```

### 2. Google Sheets API (опционально)

Если нужна интеграция с Google Sheets:

1. Создайте проект в [Google Cloud Console](https://console.cloud.google.com/)
2. Включите Google Sheets API
3. Создайте Service Account и скачайте JSON ключ
4. Поместите ключ в `src/services/googleSheets/configs/google-secret.json`
5. Дайте доступ Service Account к вашей таблице (Email из JSON ключа)

### 3. Запуск через Docker Compose

Из корневой директории проекта:

```bash
docker compose up -d bot
```

Проверить логи:
```bash
docker compose logs -f bot
```

### 4. Локальный запуск (разработка)

```bash
cd bot
npm install
npm run dev  # с автоперезагрузкой через nodemon
# или
npm start    # обычный запуск
```

## Архитектура

### Структура проекта

```
bot/
├── bot.js                  # Главный файл, инициализация бота
├── package.json
├── Dockerfile
├── .env                    # Переменные окружения (не в git)
├── .env.example            # Пример переменных
└── src/
    ├── api/                # API клиенты (userApi.js)
    ├── config/             # Конфигурация команд
    ├── const/              # Константы (роли, сцены, API URL)
    ├── handlers/           # Обработчики команд и callback'ов
    ├── services/           # Сервисы (профили, репетиции, викторины и т.д.)
    ├── shared/             # Общие компоненты (кнопки)
    └── utils/              # Утилиты (форматирование, логирование)
```

### Основные компоненты

- **BotManager** - главный класс, управляет инициализацией и сервисами
- **ProfileService** - управление профилями участников
- **AttendanceService** - учет посещаемости репетиций
- **QuizService** - система викторин
- **BirthdayService** - напоминания о днях рождения
- **GoogleSheetsService** - интеграция с Google Sheets
- **AnonymousQuestionService** - анонимные вопросы
- **DumpService** - создание дампов БД

### Health Check

Бот предоставляет HTTP endpoint для health check на порту 3001:
- `GET /health` - возвращает "ok" если бот работает
- `GET /` - то же самое

Это используется Docker для проверки здоровья контейнера.

## API интеграция

Бот взаимодействует с backend через REST API:

```javascript
// Базовый URL формируется из переменной окружения
const API_BASE_URL = `http://${process.env.SERVER_URL}` // back:3000

// Примеры endpoints:
GET    /users/telegram/:telegramId  - Получить пользователя по Telegram ID
GET    /users                       - Получить всех пользователей
POST   /users                       - Создать пользователя
PATCH  /users/telegram/:telegramId  - Обновить пользователя
```

## Команды бота

### Основные команды

- `/start` - Начало работы с ботом, показать меню
- `/menu` - Показать главное меню (только в личных сообщениях)
- `/help` - Справка по командам

### Профили

- `/profile` или `/me` - Просмотр своего профиля
- `/register` - Регистрация нового участника
- `/userslist` - Список всех пользователей (только владелец)

### Репетиции и посещаемость

- `/setrehearsal` - Установить репетицию (дата, время, сцены)
- `/setgroup` - Настроить группу для напоминаний
- `/who` - Кто придет на репетицию
- `/rehearsable` - Какие сцены можно репетировать
- `/remindattendance` - Отправить напоминание о репетиции (вручную)

### Викторины

- `/leaderboard` - Таблица лидеров викторин
- `/addquiz` - Добавить новую викторину (владелец)
- `/callquiz` - Запустить викторину (владелец)
- `/quizlist` - Список доступных викторин
- `/deletequiz` - Удалить викторину (владелец)

### Другое

- `/checkbirthdays` - Показать ближайшие дни рождения
- `/question` - Задать анонимный вопрос
- `/guests` - Показать гостевой список (Google Sheets)
- `/addguest` - Добавить гостя в список (Google Sheets)
- `/newpage` - Создать новую страницу в таблице (Google Sheets)
- `/dump` - Создать дамп БД (только владелец)

## Меню и подменю

В личных сообщениях доступно интерактивное меню с кнопками:

**Главное меню:**
- Все основные команды
- Кнопка "Викторина" → переход в подменю викторин

**Подменю викторин:**
- Таблица лидеров
- Добавить викторину
- Запустить викторину
- Список викторин
- Удалить викторину
- Назад в меню

## Роли и права доступа

Некоторые команды доступны только:
- **Владельцу** (OWNER_TELEGRAM_ID): userslist, dump, addquiz, callquiz, deletequiz, remindattendance

Проверка прав происходит через метод `_isOwner(ctx)`.

## Graceful shutdown

Бот корректно обрабатывает сигналы завершения:
- `SIGINT` (Ctrl+C)
- `SIGTERM` (docker stop)

При получении сигнала бот останавливается через `bot.stop()`.

## Логирование

См. [docs/LOGS.md](../docs/LOGS.md) для подробной информации о просмотре логов.

**Быстрая проверка:**
```bash
# На сервере
docker compose logs --tail 100 -f bot

# Только ошибки
docker compose logs bot 2>&1 | grep -iE 'error|ошибка'
```

**Dozzle (веб-интерфейс):**
http://213.226.126.196:9999

## Разработка

### Структура кода

Основной паттерн:
1. `bot.js` создает `BotManager`
2. `BotManager` инициализирует сервисы
3. Каждый сервис регистрирует свои команды и обработчики
4. Сервисы взаимодействуют с API через `src/api/`

### Добавление новой команды

1. Добавить конфигурацию в `src/config/commandsConfig.js`:
```javascript
{
  command: 'mycommand',
  shortDescription: '📝 Моя команда',
  description: 'Полное описание',
  adminOnly: false,  // или true для команд владельца
  isQuiz: false      // true для команд викторины
}
```

2. Добавить обработчик в `BotManager._setupCommands()`:
```javascript
this.bot.command('mycommand', (ctx) => {
  // Ваша логика
});
```

3. Добавить в меню в `BotManager._runCommand()`:
```javascript
mycommand: () => this.myService.handleMyCommand(ctx),
```

### Создание нового сервиса

1. Создать файл в `src/services/MyService.js`
2. Экспортировать класс с методами:
   - `constructor(bot, userStates)` - инициализация
   - `init()` - регистрация обработчиков, cron задач и т.д.
3. Инстанцировать в `BotManager` конструкторе
4. Вызвать `init()` в `BotManager._initServices()`

## Деплой

### Автоматический деплой через GitLab CI/CD

При пуше в основную ветку (`master`):
1. Запускается pipeline в GitLab CI
2. Проект деплоится на сервер
3. Docker Compose пересобирает и перезапускает контейнеры

```bash
# На сервере выполняется:
cd /opt/orchestra-back
git pull
docker compose up -d --build postgres back bot dozzle
```

### Ручной деплой

```bash
# На сервере
ssh root@213.226.126.196
cd /opt/orchestra-back
git pull
docker compose up -d --build bot
```

### Проверка после деплоя

```bash
# Проверить статус
docker compose ps

# Посмотреть логи
docker compose logs -f bot

# Проверить health check
docker inspect orkestr-bot | grep Health -A 10
```

## Troubleshooting

### Бот не запускается

1. Проверить логи:
```bash
docker compose logs bot
```

2. Проверить переменные окружения:
```bash
docker compose exec bot env | grep BOT_TOKEN
```

3. Проверить health check:
```bash
docker compose ps bot
```

### Бот не отвечает на команды

1. Проверить что бот запущен и слушает Telegram API
2. Проверить логи на ошибки подключения
3. Проверить валидность BOT_TOKEN

### Ошибки при работе с API

1. Проверить что backend (контейнер `back`) запущен:
```bash
docker compose ps back
```

2. Проверить подключение между контейнерами:
```bash
docker compose exec bot ping back -c 3
```

3. Проверить SERVER_URL в .env:
```bash
# Должно быть: SERVER_URL=back:3000
```

### Ошибки Google Sheets

1. Проверить что файл `google-secret.json` существует
2. Проверить права Service Account на таблицу
3. Проверить SPREADSHEET_ID в .env

## TODO / Будущие улучшения

- [ ] Добавить unit тесты
- [ ] Рефакторинг в TypeScript
- [ ] Улучшить обработку ошибок
- [ ] Добавить rate limiting
- [ ] Миграция на Prisma для локальных данных (репетиции, викторины)
- [ ] Webhook mode вместо long polling (для production)
- [ ] Метрики и мониторинг (Prometheus/Grafana)

## Лицензия

ISC
