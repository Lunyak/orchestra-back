# Сборка фронта (Vite). Контекст сборки — корень orchestra-servises (см. docker-compose).
FROM node:22-alpine AS builder

WORKDIR /workspace

# Переменные окружения для Vite (передаются через docker-compose build args)
ARG VITE_API_BASE_URL=/api
ARG VITE_LINK_WEB_LOCAL
ARG VITE_LINK_WEB_SERVER
ARG VITE_LINK_MINIO
ARG VITE_LINK_DOZZLE

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_LINK_WEB_LOCAL=$VITE_LINK_WEB_LOCAL
ENV VITE_LINK_WEB_SERVER=$VITE_LINK_WEB_SERVER
ENV VITE_LINK_MINIO=$VITE_LINK_MINIO
ENV VITE_LINK_DOZZLE=$VITE_LINK_DOZZLE

# Сначала зависимости admin и app
COPY admin/package.json admin/package-lock.json ./admin/
COPY app/package.json app/package-lock.json ./app/
RUN cd admin && npm ci
RUN cd app && npm ci

# Код admin и app (для импортов общих стилей)
COPY admin/ ./admin/
COPY app/ ./app/

WORKDIR /workspace/admin
RUN npm run build

# Раздача статики и проксирование API (node вместо nginx — не тянем образ с Docker Hub, обходим rate limit)
FROM node:22-alpine

WORKDIR /app
COPY --from=builder /workspace/admin/dist ./dist
COPY admin/server.mjs ./

ENV PORT=80
EXPOSE 80
CMD ["node", "server.mjs"]
