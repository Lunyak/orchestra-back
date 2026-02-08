# Сборка фронта (Vite)
FROM node:22-alpine AS builder

WORKDIR /app

ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npm run build

# Раздача статики и проксирование API (node вместо nginx — обходим rate limit Docker Hub)
FROM node:22-alpine

WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY server.mjs ./

ENV PORT=80
EXPOSE 80
CMD ["node", "server.mjs"]
