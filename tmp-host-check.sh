#!/bin/bash
cd /opt/orchestra-back
docker compose exec -T postgres psql -U orkestr -d dophamin_orkestr <<'EOSQL'
SELECT length(coalesce("lightFaders"::text,'')) f_len,
       "lightFaders"::text LIKE '%null%' as f_nullish
FROM "Scene" WHERE id='cmlbf2rso000401uqc8pouqan:script';

SELECT count(*) ch FROM "GlobalLightChannel" WHERE "sceneId"='cmlbf2rso000401uqc8pouqan:script';

SELECT st."sourceId", st.title, count(ts.id) sp
FROM "Step" st LEFT JOIN "TheaterSpotlight" ts ON ts."stepId"=st.id
WHERE st."sceneId"='cmlbf2rso000401uqc8pouqan:script' AND st."deletedAt" IS NULL
GROUP BY st."sourceId", st.title ORDER BY st."sourceId";

SELECT ts."sourceId", ts.label, ts.channel, ts."faderId", ts."isRgb"
FROM "TheaterSpotlight" ts JOIN "Step" st ON st.id=ts."stepId"
WHERE st."sceneId"='cmlbf2rso000401uqc8pouqan:script'
ORDER BY st."sourceId", ts."sourceId";
EOSQL
