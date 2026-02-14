# Настройка Telegram Бота

## Проблема
Если вы видите ошибку:
```
❌ Ошибка запуска Telegram бота: Bot launch timeout
⚠️ Приложение продолжит работу без Telegram бота
```

## Решение

### 1. Получите токен бота

1. Откройте Telegram и найдите [@BotFather](https://t.me/BotFather)
2. Отправьте команду `/newbot`
3. Следуйте инструкциям: укажите имя и username бота
4. Скопируйте полученный токен (формат: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`)

### 2. Получите ваш Telegram ID

1. Найдите [@userinfobot](https://t.me/userinfobot)
2. Отправьте `/start`
3. Скопируйте ваш ID (число, например: `123456789`)

### 3. Настройте переменные окружения

#### Для production (Docker на сервере):

Создайте файл `.env` в корне проекта:

```bash
cd /opt/orchestra-back
nano .env
```

Добавьте:

```env
BOT_TOKEN=ваш_токен_от_BotFather
OWNER_TELEGRAM_ID=ваш_telegram_id
JWT_SECRET=длинная-случайная-строка-минимум-32-символа
ADMIN_SECRET=другая-длинная-случайная-строка
```

Сохраните (Ctrl+O, Enter, Ctrl+X) и перезапустите:

```bash
docker compose down
docker compose up -d
docker logs -f orkestr-back
```

#### Для development (локальная разработка):

Создайте `.env` в папке `back/`:

```bash
cd back
cp ../.env.example .env
# Отредактируйте .env и добавьте ваши токены
```

### 4. Проверка

После перезапуска вы должны увидеть:

```
🤖 Initializing Telegram bot (token: 1234567890...)
🚀 Launching Telegram bot...
✅ Telegram бот запущен успешно
```

### Возможные проблемы

#### 1. Timeout при запуске
```
❌ Ошибка запуска Telegram бота: Bot launch timeout (10s)
```

**Причины:**
- Нет доступа к `api.telegram.org` (firewall/сеть)
- Telegram API временно недоступен

**Решение:**
```bash
# Проверьте доступ к Telegram API
curl -v https://api.telegram.org/

# Если нет доступа, проверьте firewall
# Для России может потребоваться VPN/прокси
```

#### 2. Неверный токен
```
❌ Ошибка запуска Telegram бота
   Telegram API error: 401 - Unauthorized
```

**Решение:**
- Проверьте токен в `.env`
- Получите новый токен у @BotFather командой `/token`

#### 3. Токен уже используется
```
   Telegram API error: 409 - Conflict
```

**Решение:**
- Остановите другие процессы, использующие бота
- Или создайте нового бота для разработки/тестирования

## Отключение бота

Если бот не нужен, просто не указывайте `BOT_TOKEN` в `.env`. Приложение запустится без бота.

## Полезные команды бота

- `/start` - Начать работу
- `/profile` - Показать профиль
- `/register` - Регистрация
- `/setrehearsal` - Создать репетицию (только админ)
- `/who` - Кто придет на репетицию
- `/menu` - Показать меню
- `/help` - Помощь
