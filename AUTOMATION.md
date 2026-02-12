# Автоматизация управления контейнерами

## Быстрый старт

### Локальная разработка (Dev)

```bash
# Запуск с hot-reload (изменения применяются автоматически)
make dev
# или
./scripts/dev.sh

# Остановка
make stop
```

### Production (локально)

```bash
# Запуск production-версии
make prod
# или
./scripts/prod.sh

# Перезапуск без пересборки
make restart

# Пересборка и перезапуск
make rebuild
```

### Полезные команды

```bash
make help           # Показать все доступные команды
make logs           # Просмотр логов всех сервисов
make logs-back      # Логи только бэкенда
make status         # Статус контейнеров
make backup-db      # Бэкап базы данных
make shell-back     # Открыть shell в контейнере бэкенда
make shell-postgres # Открыть psql в PostgreSQL
```

---

## 1. Автоматизация для Dev-окружения

### Что сделано:

✅ **Hot-reload для бэкенда** (NestJS)
- Изменения в коде применяются автоматически
- Не нужно перезапускать контейнер

✅ **Hot-reload для фронтенда** (Vite)
- Мгновенная перезагрузка в браузере
- HMR (Hot Module Replacement)

✅ **Автоматические миграции БД**
- При запуске автоматически применяются миграции Prisma

✅ **Volume mapping**
- Код маппится в контейнеры
- Изменения видны сразу

### Как использовать:

```bash
# Один раз запускаете
make dev

# Дальше просто редактируете код
# Все изменения применяются автоматически!
```

### Порты в dev-режиме:

- Backend API: `http://localhost:3000`
- Web Frontend: `http://localhost:5173` (Vite dev server)
- Admin Panel: `http://localhost:5174` (Vite dev server)
- PostgreSQL: `localhost:5432`
- MinIO Console: `http://localhost:9001`
- Dozzle (логи): `http://localhost:9999`

---

## 2. Автоматизация для Production

### A. Автоматический деплой через GitLab CI/CD

#### Шаг 1: Настройка SSH-ключа

На вашей локальной машине:

```bash
# Если у вас нет SSH-ключа, создайте его
ssh-keygen -t ed25519 -C "gitlab-ci@orchestra"

# Скопируйте публичный ключ на сервер
ssh-copy-id root@213.226.126.196

# Скопируйте приватный ключ (весь вывод)
cat ~/.ssh/id_ed25519
```

#### Шаг 2: Настройка переменных в GitLab

1. Откройте ваш проект на GitLab
2. Перейдите в **Settings → CI/CD → Variables**
3. Добавьте переменную:
   - **Key:** `SSH_PRIVATE_KEY`
   - **Value:** (вставьте приватный ключ, включая `-----BEGIN` и `-----END`)
   - **Type:** Variable
   - **Flags:** ✅ Mask variable, ✅ Protected (опционально)

4. Переменная `DEPLOY_HOST` уже задана в `.gitlab-ci.yml` (213.226.126.196)

#### Шаг 3: Проверка

После настройки, каждый push в `master` будет автоматически:

1. ✅ Проверять код (lint)
2. ✅ Запускать тесты
3. ✅ Собирать Docker-образы
4. ✅ Деплоить на сервер

Следите за процессом: **GitLab → CI/CD → Pipelines**

### B. Ручной деплой (если нужно)

Если CI/CD не настроен или нужно деплоить вручную:

```bash
# Из локальной машины
make deploy
# или
./scripts/deploy.sh

# С кастомными параметрами
DEPLOY_HOST=213.226.126.196 DEPLOY_USER=root ./scripts/deploy.sh
```

### C. Автоматический перезапуск контейнеров

В `docker-compose.yml` уже настроен `restart: unless-stopped` для всех сервисов:

✅ **Автоматически перезапускаются при:**
- Сбое контейнера
- Перезагрузке сервера
- Ошибке приложения

❌ **НЕ перезапускаются при:**
- Ручной остановке (`docker compose down`)
- Ошибке в `docker-compose.yml`

### D. Health checks

Настроены проверки здоровья для:

✅ **PostgreSQL** - проверка каждые 5 секунд
✅ **Backend** - проверка HTTP endpoint каждые 5 секунд

Зависимые сервисы ждут, пока зависимости станут healthy.

---

## 3. Мониторинг и логи

### Dozzle (встроенный просмотр логов)

```
http://213.226.126.196:9999  # на проде
http://localhost:9999         # локально
```

Веб-интерфейс для просмотра логов всех контейнеров в реальном времени.

### Командная строка

```bash
# Все логи
make logs

# Только бэкенд
make logs-back

# Логи конкретного сервиса
docker compose logs -f [service_name]

# Последние 100 строк
docker compose logs --tail=100 back
```

---

## 4. Продвинутая автоматизация

### A. Автоматические бэкапы БД

Создайте cron-задачу на сервере:

```bash
# На сервере
crontab -e

# Добавьте (бэкап каждый день в 3:00)
0 3 * * * cd /opt/orchestra-back && docker compose exec -T postgres pg_dump -U orkestr -d dophamin_orkestr --no-owner --no-acl -F c > /opt/backups/db_$(date +\%Y\%m\%d).dump && find /opt/backups -name "db_*.dump" -mtime +7 -delete
```

### B. Автоматическое обновление из Git

Если хотите автоматически подтягивать изменения каждые N минут (не рекомендуется для production!):

```bash
# На сервере - каждые 5 минут проверять обновления
*/5 * * * * cd /opt/orchestra-back && git fetch && [ $(git rev-list HEAD...origin/master --count) != 0 ] && git pull && docker compose up -d --build
```

**⚠️ Осторожно:** лучше использовать GitLab CI/CD для контролируемого деплоя!

### C. Оповещения при падении контейнеров

Установите [Watchtower](https://containrrr.dev/watchtower/) или [Autoheal](https://github.com/willfarrell/docker-autoheal):

```yaml
# Добавьте в docker-compose.yml
autoheal:
  image: willfarrell/autoheal:latest
  container_name: autoheal
  restart: always
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock
  environment:
    AUTOHEAL_CONTAINER_LABEL: all
```

### D. Мониторинг производительности

Добавьте Prometheus + Grafana:

```yaml
# docker-compose.monitoring.yml
services:
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
```

---

## 5. Troubleshooting

### Контейнер не перезапускается автоматически

```bash
# Проверьте restart policy
docker inspect orkestr-back | grep -A 5 RestartPolicy

# Должен быть: "Name": "unless-stopped"

# Если нет, обновите:
docker compose up -d --force-recreate
```

### GitLab CI/CD не деплоит

1. Проверьте переменные: **Settings → CI/CD → Variables**
2. Проверьте SSH-доступ с локальной машины:
   ```bash
   ssh root@213.226.126.196 "cd /opt/orchestra-back && pwd"
   ```
3. Посмотрите логи CI/CD: **CI/CD → Pipelines → [последний pipeline] → deploy**

### Hot-reload не работает в dev

```bash
# Пересоздайте контейнеры
make stop
make dev

# Проверьте, что volumes правильно подключены
docker compose -f docker-compose.yml -f docker-compose.dev.yml config | grep volumes -A 5
```

### Контейнеры занимают много места

```bash
# Очистка неиспользуемых образов и volumes
docker system prune -a --volumes

# Будьте осторожны! Это удалит все неиспользуемые данные
```

---

## 6. Рекомендации

### Для Dev-окружения:
✅ Используйте `make dev` для разработки
✅ Не делайте бэкапы dev-БД (можно пересоздать)
✅ Используйте отдельные порты для фронтенда (5173, 5174)

### Для Production:
✅ Настройте GitLab CI/CD для автоматического деплоя
✅ Регулярно делайте бэкапы БД (`make backup-db`)
✅ Используйте сильные пароли в `.env`
✅ Мониторьте логи через Dozzle
✅ Настройте HTTPS через Nginx + Let's Encrypt
✅ Не публикуйте порт PostgreSQL (5432) наружу

### Безопасность:
❌ Не коммитьте `.env` в Git
❌ Не используйте дефолтные пароли на проде
❌ Не давайте доступ к порту Docker (2375) извне
✅ Регулярно обновляйте Docker и образы
✅ Используйте SSH-ключи вместо паролей

---

## Итого

**До автоматизации:**
- 🔴 Ручной запуск/остановка контейнеров
- 🔴 Ручной деплой на сервер
- 🔴 Перезапуск при изменениях кода
- 🔴 Ручной мониторинг логов

**После автоматизации:**
- ✅ `make dev` → hot-reload, автоматические изменения
- ✅ Push в master → автоматический деплой на прод
- ✅ Автоматический перезапуск при сбоях
- ✅ Веб-интерфейс для логов (Dozzle)
- ✅ Health checks и зависимости
- ✅ Простые команды через Makefile

**Теперь вы пишете код, а деплой и управление контейнерами происходят автоматически! 🚀**
