# Развёртывание на VPS (213.226.126.196)

На сервере поднимаются **PostgreSQL** и **NestJS-бэкенд**. Десктопное приложение «Оркестр» (Electron) живёт в отдельном репозитории и подключается к API по адресу сервера.

---

## 1. Первоначальная настройка сервера (один раз)

### 1.1 Подключение

```bash
ssh root@213.226.126.196
```

### 1.2 Установка Docker и Docker Compose

```bash
# Ubuntu/Debian
apt update && apt install -y ca-certificates curl
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt update && apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Проверка
docker --version
docker compose version
```

Если у вас другой дистрибутив, см. [Install Docker Engine](https://docs.docker.com/engine/install/).

### 1.3 Клонирование репозитория

```bash
# Установка git, если нет
apt install -y git

# Клонирование (подставьте свой URL и при необходимости токен/SSH-ключ)
mkdir -p /opt
cd /opt
git clone https://gitlab.com/dopamin-service/orchestra-back.git orchestra-back
cd orchestra-back
```

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

- **Web (фронт):** http://213.226.126.196 (порт 80) — SPA + проксирование API на бэкенд.
- **API (бэкенд):** http://213.226.126.196:3000 — напрямую, если нужен отдельный доступ.

В браузере открывайте основной адрес (порт 80): запросы к API идут через тот же хост по пути `/api`.

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
