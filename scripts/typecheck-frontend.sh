#!/bin/sh
# Тот же tsc, что Docker web: npm run build → npx tsc && vite build
set -e
root="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
cd "$root"

typecheck_local() {
  (cd "$root/app" && npm run typecheck)
  (cd "$root/web" && npm run typecheck)
}

typecheck_docker() {
  docker compose -f "$root/docker-compose.yml" -f "$root/docker-compose.dev.yml" exec -T web \
    sh -c "cd /workspace/app && npx tsc -p tsconfig.json && cd /workspace/web && npx tsc --noEmit"
}

if [ -f "$root/app/node_modules/typescript/bin/tsc" ] && [ -f "$root/web/node_modules/typescript/bin/tsc" ]; then
  typecheck_local
elif docker compose -f "$root/docker-compose.yml" -f "$root/docker-compose.dev.yml" exec -T web true >/dev/null 2>&1; then
  typecheck_docker
else
  echo "Typecheck: npm ci в app/ и web/ или подними make dev (контейнер web)." >&2
  exit 1
fi
