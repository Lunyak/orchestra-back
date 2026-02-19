# Развёртывание на VPS (213.226.126.196)

На сервере поднимаются **PostgreSQL** и **NestJS-бэкенд**. Десктопное приложение «Оркестр» (Electron) живёт в отдельном репозитории и подключается к API по адресу сервера.

---

Если репозиторий приватный, настройте доступ:

- **HTTPS:** `git clone https://oauth2:TOKEN@gitlab.com/dopamin-service/orchestra-back.git orchestra-back`
- **SSH:** добавьте свой публичный ключ в GitLab (Settings → SSH Keys) и клонируйте по `git@gitlab.com:dopamin-service/orchestra-back.git`.

### 1.4 Файл окружения

```bash
cd /opt/orchestra-back
cp .env.example .env
nano .env
```

Задайте **надёжный** `JWT_SECRET` (длинная случайная строка):

```env
JWT_SECRET=ваш-длинный-секрет-для-jwt-минимум-32-символа
```

Сохраните и выйдите (Ctrl+O, Enter, Ctrl+X).

### 1.5 (Рекомендуется) Не открывать PostgreSQL в интернет

В продакшене порт 5432 лучше не публиковать. Создайте переопределение:

```bash
cd /opt/orchestra-back
nano docker-compose.override.yml
```

Содержимое (убираем `ports` у postgres):

```yaml
services:
  postgres:
    ports: []
```

Сохраните. Тогда PostgreSQL будет доступен только контейнеру `back` внутри Docker-сети.

---

## 2. Запуск приложения

```bash
cd /opt/orchestra-back
docker compose up -d --build
```

Проверка:

```bash
docker compose ps
curl -s http://localhost:3000
```

- **Web (фронт, без HTTPS):** http://213.226.126.196:8080 — SPA + проксирование API на бэкенд.
- **API (бэкенд):** http://213.226.126.196:3000 — напрямую, если нужен отдельный доступ.

В браузере открывайте основной адрес: запросы к API идут через тот же хост по пути `/api`.

---

## 3. Обновление (ручной деплой)

После изменений в коде:

```bash
ssh root@213.226.126.196
cd /opt/orchestra-back
git pull
docker compose up -d --build
```

Или одной строкой с вашей машины:

```bash
ssh root@213.226.126.196 "cd /opt/orchestra-back && git pull && docker compose up -d --build"
```

---

## 4. Автодеплой через GitLab CI/CD

При пуше в `master` можно автоматически деплоить на сервер.

**Важно:** перед первым автодеплоем на сервере обязательно выполните **раздел 1** (первоначальная настройка): установка Docker, **клонирование репозитория в `/opt/orchestra-back`**, создание `.env`. Без этого job `deploy` упадёт с ошибкой `No such file or directory: /opt/orchestra-back`.

Настройка CI/CD:

1. **GitLab → проект → Settings → CI/CD → Variables:**

   - `SSH_PRIVATE_KEY` — приватный ключ для входа на сервер (`root@213.226.126.196`), тип **Variable**, включить **Mask variable**.
   - `DEPLOY_HOST` — `213.226.126.196` (можно не маскировать).

2. **На сервере:** добавьте в `~/.ssh/authorized_keys` публичный ключ, соответствующий `SSH_PRIVATE_KEY`.

3. В репозитории уже добавлен этап `deploy` в `.gitlab-ci.yml`. После настройки переменных каждый push в `master` будет подключаться по SSH и выполнять `git pull` и `docker compose up -d --build`.

---

## 5. (Опционально) Nginx и HTTPS

Ниже два варианта. Рекомендуется **вариант A (Caddy в Docker)**, потому что он:

- не требует ставить Nginx/Certbot на хост,
- автоматически продлевает сертификаты,
- “прячет” прямые порты `back:3000`, `web:80`, `admin:80` наружу.

### 5A. HTTPS через Caddy (в Docker, рекомендовано)

**Предпосылки:**

- У вас есть домены и A-записи на VPS (например `orchestra.ваш-домен.ru` и `admin.orchestra.ваш-домен.ru` → `213.226.126.196`).
- Открыты входящие порты **80** и **443** (firewall / security group).

**Шаги:**

1) На сервере в `/opt/orchestra-back` откройте `.env` и добавьте:

```env
WEB_DOMAIN=orchestra.ваш-домен.ru
ADMIN_DOMAIN=admin.orchestra.ваш-домен.ru
ACME_EMAIL=you@example.com
```

2) Поднимите приложение с HTTPS-оверлеем:

```bash
cd /opt/orchestra-back
docker compose -f docker-compose.yml -f docker-compose.https.yml up -d --build
```

3) Проверка:

- Web: `https://orchestra.ваш-домен.ru`
- Admin: `https://admin.orchestra.ваш-домен.ru`
- API ходит через тот же домен по пути `/api/*` (префикс `/api` “снимается” на HTTPS‑шлюзе).

**Важно про порты:** в режиме HTTPS `docker-compose.https.yml` отключает публикацию портов `web/admin/back` наружу, чтобы не было конфликтов и лишнего доступа.

### 5B. HTTPS через Nginx + certbot (на хосте)

Если есть домен (например, `api.ваш-домен.ru`), можно поставить Nginx и выдать сертификат Let's Encrypt:

1. Указать A-запись домена на `213.226.126.196`.
2. Установить Nginx и certbot: `apt install -y nginx certbot python3-certbot-nginx`.
3. Выдать сертификат: `certbot --nginx -d api.ваш-домен.ru`.
4. Настроить проксирование с Nginx на `http://127.0.0.1:3000`.

Тогда в приложении использовать `https://api.ваш-домен.ru` вместо `http://213.226.126.196:3000`.

---

## 6. Полезные команды

| Действие                           | Команда                                                       |
| ---------------------------------- | ------------------------------------------------------------- |
| Логи всех сервисов                 | `docker compose logs -f`                                      |
| Логи только бэкенда                | `docker compose logs -f back`                                 |
| Остановить                         | `docker compose down`                                         |
| Остановить и удалить БД            | `docker compose down -v` (осторожно: данные БД будут удалены) |
| Dozzle (просмотр логов в браузере) | Открыть http://213.226.126.196:9999 (если порт открыт)        |

---

## 7. Бранч для деплоя

По умолчанию CI/CD деплоит при пуше в `master`. Чтобы деплоить с другой ветки, в `.gitlab-ci.yml` в job `deploy` измените правило, например:

```yaml
rules:
  - if: $CI_COMMIT_BRANCH == "main"
```

и на сервере в `/opt/orchestra-back` переключитесь на эту ветку: `git checkout main`.

---

## 8. Перенос данных БД с локальной машины на сервер

Параметры БД в проекте: пользователь `orkestr`, пароль `orkestr_secret`, база `dophamin_orkestr`.

### Шаг 1: Дамп локальной БД

**Если PostgreSQL запущен в Docker локально** (в папке проекта выполнен `docker compose up -d`):

```bash
cd /путь/к/orchestra-servises   # или orchestra-back
docker compose exec postgres pg_dump -U orkestr -d dophamin_orkestr --no-owner --no-acl -F c -f /tmp/dophamin_backup.dump
docker compose cp postgres:/tmp/dophamin_backup.dump ./dophamin_backup.dump
```

**Если PostgreSQL установлен на машине** (не в Docker):

```bash
pg_dump -U orkestr -d dophamin_orkestr -h localhost -p 5432 --no-owner --no-acl -F c -f dophamin_backup.dump
```

(Пароль запросит; по умолчанию в docker-compose: `orkestr_secret`.)

### Шаг 2: Скопировать дамп на сервер

```bash
scp dophamin_backup.dump root@213.226.126.196:/tmp/
```

(Подставьте свой IP/пользователя, если другой.)

### Шаг 3: Восстановить дамп на сервере

На сервере:

```bash
cd /opt/orchestra-back
# Положить дамп в контейнер postgres
docker cp /tmp/dophamin_backup.dump orkestr-postgres:/tmp/

# Восстановить (очищает текущие данные и заливает из дампа)
docker compose exec postgres pg_restore -U orkestr -d dophamin_orkestr --no-owner --no-acl --clean --if-exists -v /tmp/dophamin_backup.dump

# Удалить файл из контейнера
docker compose exec postgres rm /tmp/dophamin_backup.dump
```

На сервере можно удалить копию дампа: `rm /tmp/dophamin_backup.dump`.

**Важно:** `--clean --if-exists` удаляет существующие объекты перед восстановлением. Если на сервере уже есть пользователи/проекты и нужно только добавить данные без удаления — не используйте `--clean`; тогда возможны конфликты по первичным ключам. Для полной замены БД на сервере данным с локальной машины — команда выше подходит.
