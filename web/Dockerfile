# Сборка фронта (Vite). Контекст сборки — корень orchestra-servises (см. docker-compose).
FROM node:22-alpine AS builder

WORKDIR /workspace

# API в продакшене идёт через тот же хост по /api (nginx проксирует на back)
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Сначала зависимости web
COPY web/package.json web/package-lock.json ./web/
RUN cd web && npm ci

# Код web и app (для алиасов @shared, @app)
COPY web/ ./web/
COPY app/ ./app/

WORKDIR /workspace/web
RUN npm run build

# Раздача статики и проксирование API
FROM nginx:alpine

COPY --from=builder /workspace/web/dist /usr/share/nginx/html
COPY web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
