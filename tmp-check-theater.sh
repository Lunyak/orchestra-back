#!/bin/bash
cd /opt/orchestra-back
docker compose exec -T postgres psql -U orkestr -d dophamin_orkestr <<'EOSQL'
SELECT s.id, s.name,
  s."lightFaders" IS NOT NULL as has_faders,
  s."lightPrograms" IS NOT NULL as has_programs,
  s."lightChannelRoles" IS NOT NULL as has_roles,
  s."updatedAt"
FROM "Scene" s
JOIN "Project" p ON p.id = s."projectId"
WHERE p.slug = 'vassa-iron' AND s."deletedAt" IS NULL;

SELECT count(*) as channel_count FROM "GlobalLightChannel" glc
JOIN "Scene" s ON s.id = glc."sceneId"
JOIN "Project" p ON p.id = s."projectId" WHERE p.slug = 'vassa-iron';

SELECT glc.index, glc.raw FROM "GlobalLightChannel" glc
JOIN "Scene" s ON s.id = glc."sceneId"
JOIN "Project" p ON p.id = s."projectId" WHERE p.slug = 'vassa-iron' ORDER BY glc.index;

SELECT count(*) as layout_count FROM "TheaterLayout" tl
JOIN "Scene" s ON s.id = tl."sceneId"
JOIN "Project" p ON p.id = s."projectId" WHERE p.slug = 'vassa-iron';

SELECT tl."hallWidth", tl."stageWidth", tl."seatRows", tl."seatsPerRow", tl.extras IS NOT NULL as has_extras
FROM "TheaterLayout" tl
JOIN "Scene" s ON s.id = tl."sceneId"
JOIN "Project" p ON p.id = s."projectId" WHERE p.slug = 'vassa-iron';

SELECT count(*) as plot_count FROM "GlobalLightPlot" glp
JOIN "Scene" s ON s.id = glp."sceneId"
JOIN "Project" p ON p.id = s."projectId" WHERE p.slug = 'vassa-iron';

SELECT count(*) as total_spotlights FROM "TheaterSpotlight" ts
JOIN "Step" st ON st.id = ts."stepId"
JOIN "Scene" sc ON sc.id = st."sceneId"
JOIN "Project" p ON p.id = sc."projectId"
WHERE p.slug = 'vassa-iron' AND st."deletedAt" IS NULL;

SELECT st."order", count(ts.id) as cnt
FROM "Step" st
LEFT JOIN "TheaterSpotlight" ts ON ts."stepId" = st.id
JOIN "Scene" sc ON sc.id = st."sceneId"
JOIN "Project" p ON p.id = sc."projectId"
WHERE p.slug = 'vassa-iron' AND st."deletedAt" IS NULL
GROUP BY st."order" ORDER BY st."order";

SELECT ts."sourceId", ts.label, ts.channel, ts."faderId", ts."isRgb"
FROM "TheaterSpotlight" ts
JOIN "Step" st ON st.id = ts."stepId"
JOIN "Scene" sc ON sc.id = st."sceneId"
JOIN "Project" p ON p.id = sc."projectId"
WHERE p.slug = 'vassa-iron' AND st."deletedAt" IS NULL
ORDER BY st."order", ts."sourceId" LIMIT 30;

SELECT left(s."lightFaders"::text, 300) as faders,
       left(s."lightPrograms"::text, 300) as programs
FROM "Scene" s
JOIN "Project" p ON p.id = s."projectId"
WHERE p.slug = 'vassa-iron' AND s."deletedAt" IS NULL;
EOSQL
ls -lah backups/ | tail -15
