FROM node:22-alpine AS builder

WORKDIR /workspace/client

COPY client/package.json client/package-lock.json ./
RUN npm ci

COPY client/ ./
ARG WEB_DOMAIN
ARG SITE_SCHEME
ARG SITE_ORIGIN
ENV WEB_DOMAIN=${WEB_DOMAIN}
ENV SITE_SCHEME=${SITE_SCHEME}
ENV SITE_ORIGIN=${SITE_ORIGIN}
RUN npm run build

FROM node:22-alpine

WORKDIR /app
COPY --from=builder /workspace/client/build ./build
COPY client/server.mjs ./
COPY --from=builder /workspace/client/scripts ./scripts
COPY --from=builder /workspace/client/public/robots.txt ./public/robots.txt

ENV PORT=80
EXPOSE 80
CMD ["node", "server.mjs"]

