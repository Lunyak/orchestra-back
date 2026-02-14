# Orchestra Services

Монорепозиторий сервисов проекта Orchestra: бэкенд (NestJS + PostgreSQL), веб-фронтенд, админ-панель, Telegram бот, хранилище (MinIO).

## 🚀 Быстрый старт

### Разработка (с hot-reload)

```bash
make dev
```

Все изменения в коде применяются автоматически, без перезапуска контейнеров!

- **Backend API:** http://localhost:3000
- **Web Frontend:** http://localhost:5173
- **Admin Panel:** http://localhost:5174
- **MinIO Console:** http://localhost:9001
- **Logs (Dozzle):** http://localhost:9999

### Production (локально)

```bash
make prod
```

- **Web:** http://localhost
- **API:** http://localhost:3000
- **Admin:** http://localhost:8081

### Полезные команды

```bash
make help           # Показать все команды
make dev            # Запуск dev-окружения с hot-reload
make prod           # Запуск production
make stop           # Остановить все контейнеры
make logs           # Просмотр логов
make status         # Статус контейнеров
make deploy         # Деплой на production сервер
make backup-db      # Бэкап базы данных
```

## 📦 Структура проекта

```
orchestra-servises/
├── back/              # NestJS API + Prisma ORM
├── bot/               # Telegram бот (Node.js + Telegraf)
├── web/               # Веб-фронтенд
├── admin/             # Админ-панель
├── desktop/           # Electron-приложение (отдельный репо)
├── docs/              # Документация
│   └── LOGS.md       # Руководство по логам
├── scripts/           # Скрипты автоматизации
│   ├── dev.sh        # Запуск dev с hot-reload
│   ├── prod.sh       # Запуск production
│   ├── stop.sh       # Остановка контейнеров
│   └── deploy.sh     # Деплой на сервер
├── docker-compose.yml       # Production конфигурация
├── docker-compose.dev.yml   # Dev конфигурация (hot-reload)
├── Makefile                 # Удобные команды
├── AUTOMATION.md            # 📖 Полное руководство по автоматизации
├── DEPLOYMENT.md            # 📖 Полный гайд по деплою
└── DEPLOY.md                # Инструкции по развертыванию на VPS
```

## 🔄 Автоматизация

### Для разработки (Dev)

✅ **Hot-reload** - изменения применяются автоматически
✅ **Автоматические миграции БД**
✅ **Volume mapping** - код синхронизируется с контейнерами
✅ **Debug порты** открыты

Просто запустите `make dev` и редактируйте код - всё обновится само!

### Для production

✅ **Автоматический деплой** через GitLab CI/CD
✅ **Автоматический перезапуск** при сбоях (`restart: unless-stopped`)
✅ **Health checks** для сервисов
✅ **Автоматические миграции** при деплое
✅ **Мониторинг логов** через Dozzle

**Подробнее:** см. [AUTOMATION.md](./AUTOMATION.md)

## 📊 Мониторинг

### Dozzle (веб-интерфейс для логов)

- Локально: http://localhost:9999
- На сервере: http://213.226.126.196:9999

### Командная строка

```bash
make logs              # Все логи
make logs-back         # Только бэкенд
docker compose ps      # Статус контейнеров
```

## 🗄 База данных

### Бэкап

```bash
make backup-db
```

### Восстановление

```bash
docker compose exec postgres pg_restore -U orkestr -d dophamin_orkestr --no-owner --no-acl --clean --if-exists -v /tmp/backup.dump
```

### Подключение

```bash
make shell-postgres
# или
psql postgresql://orkestr:orkestr_secret@localhost:5432/dophamin_orkestr
```

## 📚 Документация

- **[AUTOMATION.md](./AUTOMATION.md)** - Полное руководство по автоматизации
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Полный гайд по деплою и управлению
- **[DEPLOY.md](./DEPLOY.md)** - Развертывание на VPS
- **[docs/LOGS.md](./docs/LOGS.md)** - Руководство по просмотру логов
- **[BOT_CHECKLIST.md](./BOT_CHECKLIST.md)** - Чек-лист деплоя бота
- **[back/README.md](./back/README.md)** - Backend API
- **[bot/README.md](./bot/README.md)** - Telegram бот
- **[admin/README.md](./admin/README.md)** - Админ-панель

## 📝 Лицензия

Приватный проект.