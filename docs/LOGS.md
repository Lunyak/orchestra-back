# Логи Orchestra Services

## Как смотреть логи на сервере

### Вариант 1: Dozzle (логи в браузере) 🌐

В проект добавлен **Dozzle** — веб-интерфейс для просмотра логов всех контейнеров.

**Адрес:** [http://213.226.126.196:9999](http://213.226.126.196:9999)

**Включить Dozzle на сервере:**
```bash
cd /opt/orchestra-back
docker compose up -d dozzle
```

В Dozzle можно:
- Выбрать контейнер (bot, back, web, admin, postgres, minio)
- Смотреть логи в реальном времени
- Искать по тексту
- Копировать логи
- Не нужен SSH — только браузер!

---

### Вариант 2: Терминал (SSH + docker compose logs)

Зайти на сервер по SSH и перейти в каталог проекта:
```bash
ssh root@213.226.126.196
cd /opt/orchestra-back
```

#### Логи бота (последние + в реальном времени)

```bash
docker compose logs -f bot
# или с явным именем контейнера:
docker compose logs -f orkestr-bot
```

`-f` — «следить» за новыми строками (как `tail -f`). Выход: **Ctrl+C**.

#### Последние N строк (без слежения)

```bash
docker compose logs --tail 200 bot
```

#### Только ошибки бота

```bash
docker compose logs bot 2>&1 | grep -iE 'error|ошибка|Error|Ошибка|failed|Failed'
```

#### Логи за последний час

```bash
docker compose logs --since 1h bot
```

#### Логи backend сервера

```bash
docker compose logs -f back
docker compose logs --tail 100 back
```

#### Логи базы данных PostgreSQL

```bash
docker compose logs -f postgres
docker compose logs --tail 100 postgres
```

#### Все сервисы сразу

```bash
docker compose logs -f
```

Будут идти логи всех контейнеров: bot, back, web, admin, postgres, minio, dozzle.

---

## Быстрая проверка «есть ли ошибки»

Отфильтровать ошибки бота за последние 500 строк:

```bash
cd /opt/orchestra-back
docker compose logs --tail 500 bot 2>&1 | grep -iE 'error|ошибка|Error|Ошибка|failed|Failed'
```

Если вывод пустой — ошибок не было.

Проверить все сервисы:

```bash
docker compose logs --tail 500 2>&1 | grep -iE 'error|ошибка|Error|Ошибка|failed|Failed'
```

---

## Сохранить логи в файл

Если нужно скачать логи для анализа:

```bash
docker compose logs --no-log-prefix bot > "bot-$(date +%Y%m%d-%H%M).log" 2>&1
```

Потом скачать с сервера через `scp`:

```bash
# На локальной машине:
scp root@213.226.126.196:/opt/orchestra-back/bot-*.log ./
```

---

## Проверка статуса контейнеров

Посмотреть какие контейнеры запущены и их статус:

```bash
docker compose ps
```

Посмотреть использование ресурсов (CPU, RAM):

```bash
docker stats
```

---

## Health checks

Все сервисы имеют health checks. Проверить здоровье:

```bash
docker compose ps
```

Колонка `Status` покажет `healthy` или `unhealthy`.

**Health endpoints:**
- Backend: http://213.226.126.196:3000/
- Bot: внутренний endpoint на порту 3001 (не опубликован наружу)

---

## Перезапуск контейнера при проблемах

Если какой-то сервис завис или работает некорректно:

```bash
# Перезапустить только бота
docker compose restart bot

# Перезапустить backend
docker compose restart back

# Перезапустить все
docker compose restart
```

---

## Структура логирования

### Bot
- Использует `console.log`, `console.error`, `console.warn`
- Health check на порту 3001 (внутренний)
- Restart policy: `unless-stopped`

### Backend
- NestJS с встроенным логированием
- Health check на порту 3000
- Restart policy: `unless-stopped`

### PostgreSQL
- Стандартные логи PostgreSQL
- Health check: `pg_isready`
- Restart policy: `unless-stopped`

Все логи попадают в stdout/stderr процессов и перехватываются Docker (драйвер `json-file`).

---

## Полезные программы

| Программа      | Что это                                  | Как использовать                                                                                  |
| -------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **Dozzle**     | Веб-просмотр логов                       | http://213.226.126.196:9999                                                                       |
| **Portainer**  | Веб-панель: контейнеры, логи, перезапуск | `docker run -d -p 9000:9000 -v /var/run/docker.sock:/var/run/docker.sock portainer/portainer-ce` |
| **Lazydocker** | Терминальный интерфейс (TUI)             | На сервере: установить lazydocker, запустить `lazydocker`                                         |

---

## Где лежат логи Docker (на хосте)

По умолчанию:
- Linux: `/var/lib/docker/containers/<container_id>/<container_id>-json.log`

Узнать `container_id`:
```bash
docker compose ps -a
# или
docker inspect orkestr-bot --format '{{.Id}}'
```

Обычно проще пользоваться `docker compose logs` или Dozzle.
