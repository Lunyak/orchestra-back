FROM node:22-alpine AS builder

WORKDIR /workspace/client

COPY client/package.json client/package-lock.json ./
RUN npm ci

COPY client/ ./
RUN npm run build

FROM node:22-alpine

WORKDIR /app
COPY --from=builder /workspace/client/build ./build
COPY client/server.mjs ./

ENV PORT=80
EXPOSE 80
CMD ["node", "server.mjs"]

