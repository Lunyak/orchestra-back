#!/bin/bash
echo "=== FIND ALL LOGS WITH JUN5 sync push ==="
for f in $(find /var/lib/docker/containers -name '*-json.log*' 2>/dev/null); do
  n=$(grep -c '2026-06-05.*sync/push received' "$f" 2>/dev/null || true)
  if [ "$n" -gt 0 ]; then echo "$n $f"; fi
done

echo "=== FIND deleted/orphan container dirs ==="
find /var/lib/docker/containers -maxdepth 1 -type d 2>/dev/null | while read d; do
  id=$(basename "$d")
  if [ "$id" = "containers" ]; then continue; fi
  running=$(docker ps -aq --filter id="$id" 2>/dev/null)
  if [ -z "$running" ]; then
    sz=$(du -sh "$d" 2>/dev/null | cut -f1)
    jun=$(grep -c '2026-06-05' "$d"/*-json.log 2>/dev/null || echo 0)
    push=$(grep -c 'sync/push received' "$d"/*-json.log 2>/dev/null || echo 0)
    if [ "$jun" -gt 0 ] || [ "$push" -gt 0 ]; then
      echo "ORPHAN $sz jun5=$jun push=$push $d"
    fi
  fi
done

echo "=== SEARCH applying Scene change jun5 ==="
for f in $(find /var/lib/docker/containers -name '*-json.log' 2>/dev/null); do
  n=$(grep -c '2026-06-05.*applying Scene change' "$f" 2>/dev/null || true)
  if [ "$n" -gt 0 ]; then echo "$n $f"; fi
done

echo "=== PG WAL / archive ==="
ls -la /var/lib/docker/volumes/ 2>/dev/null | head -10
docker compose -f /opt/orchestra-back/docker-compose.yml exec -T postgres psql -U orkestr -d postgres -c "SHOW archive_mode;" 2>/dev/null
docker compose -f /opt/orchestra-back/docker-compose.yml exec -T postgres psql -U orkestr -d postgres -c "SHOW data_directory;" 2>/dev/null

echo "=== lightKadrs in steps (may have channel refs) ==="
docker compose -f /opt/orchestra-back/docker-compose.yml exec -T postgres psql -U orkestr -d dophamin_orkestr <<'SQL'
SELECT st."sourceId", st.title, left(st."lightKadrs"::text, 400) as kadrs
FROM "Step" st
WHERE st."sceneId"='cmlbf2rso000401uqc8pouqan:script' AND st."deletedAt" IS NULL
  AND st."lightKadrs" IS NOT NULL AND st."lightKadrs"::text NOT IN ('null','[]','{}')
ORDER BY st."sourceId";
SQL
