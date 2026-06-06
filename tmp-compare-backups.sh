#!/bin/bash
set -e
cd /opt/orchestra-back
DUMP_APR=/opt/orchestra-back/backups/dophamin_orkestr_20260418_130105.dump
DUMP_SAF=/opt/orchestra-back/backups/safety_20260606_093207.dump

for DB in check_apr18 check_safety; do
  docker compose exec -T postgres psql -U orkestr -d postgres -c "DROP DATABASE IF EXISTS $DB;"
  docker compose exec -T postgres psql -U orkestr -d postgres -c "CREATE DATABASE $DB;"
done

cat "$DUMP_APR" | docker compose exec -T postgres pg_restore -U orkestr -d check_apr18 2>&1 | tail -2
cat "$DUMP_SAF" | docker compose exec -T postgres pg_restore -U orkestr -d check_safety 2>&1 | tail -2

compare_db() {
  local DB=$1
  local LABEL=$2
  echo "===== $LABEL ($DB) ====="
  docker compose exec -T postgres psql -U orkestr -d "$DB" <<'EOSQL'
SELECT count(*) as channels FROM "GlobalLightChannel" glc
JOIN "Scene" s ON s.id = glc."sceneId"
JOIN "Project" p ON p.id = s."projectId" WHERE p.slug = 'vassa-iron';

SELECT glc.index, left(glc.raw, 40) as raw FROM "GlobalLightChannel" glc
JOIN "Scene" s ON s.id = glc."sceneId"
JOIN "Project" p ON p.id = s."projectId" WHERE p.slug = 'vassa-iron' ORDER BY glc.index;

SELECT count(*) as plot FROM "GlobalLightPlot" glp
JOIN "Scene" s ON s.id = glp."sceneId"
JOIN "Project" p ON p.id = s."projectId" WHERE p.slug = 'vassa-iron';

SELECT count(*) as spotlights FROM "TheaterSpotlight" ts
JOIN "Step" st ON st.id = ts."stepId"
JOIN "Scene" sc ON sc.id = st."sceneId"
JOIN "Project" p ON p.id = sc."projectId" WHERE p.slug = 'vassa-iron';

SELECT left(s."lightFaders"::text, 120) as faders,
       left(s."lightPrograms"::text, 120) as programs
FROM "Scene" s JOIN "Project" p ON p.id = s."projectId"
WHERE p.slug = 'vassa-iron' LIMIT 1;

SELECT ts."sourceId", ts.label, ts.channel, ts."faderId"
FROM "TheaterSpotlight" ts
JOIN "Step" st ON st.id = ts."stepId"
JOIN "Scene" sc ON sc.id = st."sceneId"
JOIN "Project" p ON p.id = sc."projectId"
WHERE p.slug = 'vassa-iron'
ORDER BY st."order", ts."sourceId" LIMIT 25;
EOSQL
}

compare_db check_apr18 "APR 18 BACKUP"
compare_db check_safety "SAFETY JUN 6 BACKUP"
