# Исправление сборки web на сервере

Если на сервере при `docker compose build web` видишь:

- `WORKDIR /app`, `COPY . .`, ошибки `Cannot find module '@shared/types/script'` —

значит там старая версия `docker-compose.yml` и `web/Dockerfile`. Нужно обновить два места.

## 1. docker-compose.yml — секция web

Должно быть (контекст — **корень** проекта, не `./web`):

```yaml
web:
  build:
    context: .
    dockerfile: web/Dockerfile
    args:
      VITE_API_BASE_URL: /api
```

Не должно быть: `context: ./web` и `dockerfile: Dockerfile`.

## 2. web/Dockerfile — полная замена

Замени содержимое файла `web/Dockerfile` на:

```dockerfile
# Сборка фронта (Vite). Контекст сборки — корень (см. docker-compose).
FROM node:22-alpine AS builder

WORKDIR /workspace

ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

COPY web/package.json web/package-lock.json ./web/
RUN cd web && npm ci

COPY web/ ./web/
COPY app/ ./app/

WORKDIR /workspace/web
RUN npm run build

FROM nginx:alpine

COPY --from=builder /workspace/web/dist /usr/share/nginx/html
COPY web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

## 3. После правок на сервере

```bash
cd /opt/orchestra-back   # или твой каталог
docker compose build web --no-cache
```

Убедись, что в корне проекта есть папки `web/` и `app/` (в т.ч. `app/src/shared/`).
