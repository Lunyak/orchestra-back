# Orchestra Services

Монорепозиторий сервисов проекта Orchestra: бэкенд (NestJS + PostgreSQL), веб-фронтенд, админ-панель, хранилище (MinIO).

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
├── web/               # Веб-фронтенд
├── admin/             # Админ-панель
├── desktop/           # Electron-приложение (отдельный репо)
├── scripts/           # Скрипты автоматизации
│   ├── dev.sh        # Запуск dev с hot-reload
│   ├── prod.sh       # Запуск production
│   ├── stop.sh       # Остановка контейнеров
│   └── deploy.sh     # Деплой на сервер
├── docker-compose.yml       # Production конфигурация
├── docker-compose.dev.yml   # Dev конфигурация (hot-reload)
├── Makefile                 # Удобные команды
├── AUTOMATION.md            # 📖 Полное руководство по автоматизации
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

## 🛠 Настройка автодеплоя

### 1. Создайте SSH-ключ

```bash
ssh-keygen -t ed25519 -C "gitlab-ci@orchestra"
ssh-copy-id root@213.226.126.196
```

### 2. Добавьте в GitLab

**Settings → CI/CD → Variables:**

- **Key:** `SSH_PRIVATE_KEY`
- **Value:** (содержимое `~/.ssh/id_ed25519`)
- **Flags:** ✅ Mask variable

### 3. Готово!

Теперь каждый push в `master` автоматически:
1. Прогоняет тесты
2. Собирает образы
3. Деплоит на сервер

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

## 🔐 Безопасность

⚠️ **Обязательно:**

1. Создайте `.env` и задайте надежные пароли:
   ```env
   JWT_SECRET=ваш-длинный-секрет-минимум-32-символа
   ADMIN_SECRET=ваш-админ-секрет
   ```

2. Не коммитьте `.env` в Git

3. На production не публикуйте порт PostgreSQL (используйте `docker-compose.override.yml`)

## 📚 Документация

- **[AUTOMATION.md](./AUTOMATION.md)** - Полное руководство по автоматизации
- **[DEPLOY.md](./DEPLOY.md)** - Развертывание на VPS
- **[back/README.md](./back/README.md)** - Backend API
- **[admin/README.md](./admin/README.md)** - Админ-панель

## 🐛 Troubleshooting

### Hot-reload не работает

```bash
make stop
make dev
```

### Контейнер не запускается

```bash
docker compose logs [service_name]
make status
```

### GitLab CI/CD не деплоит

1. Проверьте переменные: Settings → CI/CD → Variables
2. Проверьте SSH-доступ: `ssh root@213.226.126.196`
3. Смотрите логи pipeline: CI/CD → Pipelines

### Очистка дискового пространства

```bash
docker system prune -a --volumes  # ОСТОРОЖНО: удалит все данные!
```

## 📝 Лицензия

Приватный проект.

---

**Теперь управление контейнерами полностью автоматизировано! 🎉**

- ✅ Dev: `make dev` → hot-reload
- ✅ Prod: push в master → автоматический деплой
- ✅ Мониторинг: Dozzle + health checks
- ✅ Простые команды: `make help`
