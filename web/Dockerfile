# Сборка фронта (Vite). Контекст сборки — корень orchestra-servises (см. docker-compose).
FROM node:22-alpine AS builder

WORKDIR /workspace

# API в продакшене идёт через тот же хост по /api (nginx проксирует на back)
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Сначала зависимости web и app
COPY web/package.json web/package-lock.json ./web/
COPY app/package.json app/package-lock.json ./app/
RUN cd web && npm ci
RUN cd app && npm ci

# Код web и app (для алиасов @shared, @app)
COPY web/ ./web/
COPY app/ ./app/

WORKDIR /workspace/web
RUN npm run build

# Раздача статики и проксирование API (node вместо nginx — не тянем образ с Docker Hub, обходим rate limit)
FROM node:22-alpine

WORKDIR /app
COPY --from=builder /workspace/web/dist ./dist
COPY web/server.mjs ./

ENV PORT=80
EXPOSE 80
CMD ["node", "server.mjs"]
