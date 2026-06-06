#!/bin/bash
cd /opt/orchestra-back
docker compose exec -T postgres psql -U orkestr -d dophamin_orkestr <<'SQL'
UPDATE "TheaterSpotlight" ts
SET "faderId" = 1
FROM "Step" st
WHERE ts."stepId" = st.id
  AND st."sceneId" = 'cmlbf2rso000401uqc8pouqan:script'
  AND st."sourceId" = 5
  AND ts."sourceId" IN (5, 6);

SELECT ts."sourceId", ts.channel, ts."faderId"
FROM "TheaterSpotlight" ts
JOIN "Step" st ON st.id = ts."stepId"
WHERE st."sceneId" = 'cmlbf2rso000401uqc8pouqan:script' AND st."sourceId" = 5
ORDER BY ts."sourceId";
SQL
