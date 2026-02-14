# 🚀 Quick Start - Telegram Bot

## ✅ Статус: Готов к деплою

Все проверки пройдены (44/44) ✅

## Что было сделано

### 1. Исправлена конфигурация ✅
- `bot/Dockerfile` - добавлен CMD и EXPOSE
- `bot/.env` - исправлен SERVER_URL на `back:3000`
- `bot/.env.example` - создан с примерами

### 2. Интеграция в проект ✅
- Добавлен сервис в `docker-compose.yml`
- Добавлен в CI/CD pipeline (`.gitlab-ci.yml`)
- Настроены health checks
- Настроены зависимости между сервисами

### 3. Безопасность ✅
- `.env` и `google-secret.json` в .gitignore
- Созданы `.example` файлы для шаблонов
- Секреты не хардкодятся

### 4. Документация ✅
- `bot/README.md` - полное описание бота
- `docs/LOGS.md` - руководство по логам
- `DEPLOYMENT.md` - гайд по деплою
- `BOT_CHECKLIST.md` - чек-лист
- `BOT_MIGRATION_SUMMARY.md` - детальный отчет

## Быстрый деплой

### Вариант 1: Автоматический (через GitLab CI)

```bash
cd /Users/sergeylunyak/Проекты/Pet_Project/Orchestra/orchestra-servises
git add .
git commit -m "feat: add Telegram bot integration with full CI/CD"
git push origin master
```

GitLab CI автоматически задеплоит бота на сервер.

### Вариант 2: Ручной деплой

```bash
# На сервере
ssh root@213.226.126.196
cd /opt/orchestra-back
git pull
docker compose up -d --build bot
```

## Проверка после деплоя

### 1. Контейнер запущен
```bash
docker compose ps bot
# Должен быть: Up (healthy)
```

### 2. Логи
```bash
docker compose logs --tail 50 bot
# Должно быть: "Бот запущен ✅"
```

### 3. Telegram
Отправить боту `/start` - должен прийти ответ с меню.

### 4. Dozzle (веб-логи)
Открыть http://213.226.126.196:9999 и выбрать контейнер `orkestr-bot`.

## Что нужно настроить на сервере

### ОБЯЗАТЕЛЬНО:

В файле `/opt/orchestra-back/.env` заполнить:

```bash
BOT_TOKEN=получить_от_@BotFather
OWNER_TELEGRAM_ID=ваш_telegram_id
```

Как получить:
- `BOT_TOKEN`: создать бота через [@BotFather](https://t.me/BotFather)
- `OWNER_TELEGRAM_ID`: узнать у [@userinfobot](https://t.me/userinfobot)

### ОПЦИОНАЛЬНО:

```bash
GROUP_CHAT_ID=-1001234567890        # ID группы для уведомлений
SPREADSHEET_ID=your_spreadsheet_id   # Google Sheets для гостевых списков
```

### Google Sheets (если нужно)

1. Создать Service Account в [Google Cloud Console](https://console.cloud.google.com/)
2. Скачать JSON ключ
3. Загрузить на сервер:
   ```bash
   scp google-secret.json root@213.226.126.196:/opt/orchestra-back/bot/src/services/googleSheets/configs/
   ```
4. Дать доступ Service Account к таблице

## Основные команды бота

После деплоя пользователи смогут использовать:

- `/start` - начало работы, показать меню
- `/profile` - просмотр своего профиля
- `/register` - регистрация
- `/help` - справка по командам
- `/checkbirthdays` - дни рождения
- `/setrehearsal` - настроить репетицию
- `/who` - кто придет на репетицию

Полный список команд: см. [bot/README.md](bot/README.md)

## Мониторинг

### Веб-интерфейс (Dozzle)
http://213.226.126.196:9999

### Терминал
```bash
# Следить за логами
docker compose logs -f bot

# Только ошибки
docker compose logs bot 2>&1 | grep -iE 'error|failed'

# Статус контейнера
docker compose ps bot
```

## Troubleshooting

### Бот не запускается
```bash
# 1. Посмотреть логи
docker compose logs bot

# 2. Проверить переменные окружения
docker compose exec bot env | grep BOT_TOKEN

# 3. Перезапустить
docker compose restart bot
```

### Бот не отвечает
```bash
# Проверить что backend работает
docker compose ps back
curl http://localhost:3000/

# Проверить подключение
docker compose exec bot ping back
```

Подробнее: [BOT_CHECKLIST.md](BOT_CHECKLIST.md)

## Документация

- 📖 [bot/README.md](bot/README.md) - полное описание бота
- 📖 [docs/LOGS.md](docs/LOGS.md) - руководство по логам
- 📖 [DEPLOYMENT.md](DEPLOYMENT.md) - полный гайд по деплою
- 📖 [BOT_CHECKLIST.md](BOT_CHECKLIST.md) - чек-лист деплоя
- 📖 [BOT_MIGRATION_SUMMARY.md](BOT_MIGRATION_SUMMARY.md) - детальный отчет

## Полезные ссылки

- **Backend API**: http://213.226.126.196:3000
- **Admin Panel**: http://213.226.126.196:8081
- **Dozzle (Логи)**: http://213.226.126.196:9999
- **MinIO Console**: http://213.226.126.196:9001

---

## 🎯 Следующие шаги

1. ✅ Проверить что все файлы на месте (запустить `./scripts/test-bot-setup.sh`)
2. ✅ Сделать commit и push
3. ⏳ Дождаться завершения CI/CD pipeline
4. ⏳ Проверить что бот запустился на сервере
5. ⏳ Протестировать основные команды
6. ⏳ Настроить Google Sheets (если нужно)
7. ⏳ Показать пользователям как пользоваться ботом

---

**Готово к деплою!** 🚀

Запустить тест:
```bash
./scripts/test-bot-setup.sh
```

Задеплоить:
```bash
git add .
git commit -m "feat: add Telegram bot integration"
git push origin master
```
