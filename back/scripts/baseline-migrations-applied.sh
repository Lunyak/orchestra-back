#!/usr/bin/env bash
# Помечает все папки из prisma/migrations как уже применённые (--applied), не выполняя SQL.
# Нужно, если БД создавалась вне Prisma Migrate (db push, дамп без _prisma_migrations, и т.п.),
# а объекты в public уже есть — иначе migrate deploy падает с "already exists".
#
# Использование (из каталога back, с заполненным .env и Node >= 20):
#   npm run migrate:baseline-applied
# Затем:
#   npx prisma migrate deploy
#
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ ! -f prisma/schema.prisma ]]; then
  echo "Запускай из каталога back (рядом с prisma/)." >&2
  exit 1
fi

while read -r name; do
  [[ -d "prisma/migrations/${name}" ]] || continue
  echo "→ migrate resolve --applied ${name}"
  set +e
  out=$(npx prisma migrate resolve --applied "${name}" 2>&1)
  ec=$?
  set -e
  if [[ "${ec}" -eq 0 ]]; then
    echo "${out}"
  elif echo "${out}" | grep -qiE 'already (applied|recorded)|P3008'; then
    echo "  (уже помечена, пропуск)"
  else
    echo "${out}" >&2
    exit 1
  fi
done < <(ls -1 prisma/migrations | grep -E '^[0-9]+_' | sort)

echo ""
echo "Готово. Дальше: npx prisma migrate deploy"
