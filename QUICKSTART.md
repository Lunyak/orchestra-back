# 🚀 Быстрый старт Orchestra

## Одна команда для начала работы

### Разработка (Dev)
```bash
make dev
```
**Готово!** Все изменения в коде применяются автоматически.

### Production (локально)
```bash
make prod
```

### Остановка
```bash
make stop
```

---

## Первый запуск (только один раз)

### 1. Создайте .env файл
```bash
cp .env.example .env
```

### 2. Измените пароли (ВАЖНО для production!)
```bash
nano .env
```

Задайте надежные значения для:
- `JWT_SECRET`
- `ADMIN_SECRET`
- `BOT_SECRET`

### 3. Запустите
```bash
make dev  # для разработки
# или
make prod # для production
```

---

## Доступные сервисы

### Dev-режим (`make dev`)
| Сервис          | URL                        |
|-----------------|----------------------------|
| Backend API     | http://localhost:3000      |
| Web Frontend    | http://localhost:5173      |
| Admin Panel     | http://localhost:5174      |
| PostgreSQL      | localhost:5432             |
| MinIO Console   | http://localhost:9001      |
| Dozzle (Логи)   | http://localhost:9999      |

### Production (`make prod`)
| Сервис          | URL                        |
|-----------------|----------------------------|
| Web             | http://localhost           |
| Backend API     | http://localhost:3000      |
| Admin Panel     | http://localhost:8081      |
| MinIO Console   | http://localhost:9001      |
| Dozzle (Логи)   | http://localhost:9999      |

---

## Полезные команды

```bash
make help           # Показать все команды
make logs           # Просмотр логов
make logs-back      # Логи только бэкенда
make status         # Статус контейнеров
make restart        # Перезапуск
make backup-db      # Бэкап БД
make shell-back     # Shell в контейнере бэкенда
make shell-postgres # PostgreSQL CLI
```

---

## Автодеплой на production сервер

### Настройка (один раз)

**1. Создайте SSH-ключ:**
```bash
ssh-keygen -t ed25519 -C "gitlab-ci@orchestra"
ssh-copy-id root@213.226.126.196
```

**2. Добавьте ключ в GitLab:**
- Откройте: **Settings → CI/CD → Variables**
- Добавьте переменную:
  - **Key:** `SSH_PRIVATE_KEY`
  - **Value:** содержимое файла `~/.ssh/id_ed25519`
  - Включите: ✅ **Mask variable**

**3. Готово!**

Теперь каждый `git push` в `master` автоматически деплоит на сервер.

### Ручной деплой (если нужно)
```bash
make deploy
```

---

## Troubleshooting

### Контейнер не запускается
```bash
make logs           # Смотрим логи
make status         # Проверяем статус
```

### Порт занят
```bash
make stop           # Остановить всё
# Затем запустить снова
```

### Hot-reload не работает
```bash
make stop
make dev
```

### Очистка (удалит ВСЕ данные!)
```bash
docker compose down -v
```

---

## Что дальше?

📖 **Подробная документация:**
- [AUTOMATION.md](./AUTOMATION.md) - Полное руководство по автоматизации
- [DEPLOY.md](./DEPLOY.md) - Развертывание на VPS
- [README.md](./README.md) - Общая информация

🎯 **Начните разработку:**
```bash
make dev
# Откройте код в редакторе
# Изменения применятся автоматически!
```

🚀 **Деплой в один клик:**
```bash
git add .
git commit -m "Your changes"
git push origin master
# Автоматический деплой на сервер!
```

---

**Больше не нужно вручную управлять контейнерами! 🎉**
