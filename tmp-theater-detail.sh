#!/bin/bash
cd /opt/orchestra-back
docker compose exec -T postgres psql -U orkestr -d dophamin_orkestr <<'EOSQL'
SELECT tl."stageWidth", tl."stageDepth", tl."hallDepth", tl.extras::text
FROM "TheaterLayout" tl
JOIN "Scene" s ON s.id = tl."sceneId"
JOIN "Project" p ON p.id = s."projectId" WHERE p.slug = 'vassa-iron';

SELECT s."lightFaders", s."lightPrograms", s."lightChannelRoles"
FROM "Scene" s JOIN "Project" p ON p.id = s."projectId"
WHERE p.slug = 'vassa-iron';

SELECT st."order", st.title, length(coalesce(st.markdown,'')) as md_len,
  (SELECT count(*) FROM "TheaterSpotlight" ts WHERE ts."stepId"=st.id) as sp
FROM "Step" st
JOIN "Scene" sc ON sc.id = st."sceneId"
JOIN "Project" p ON p.id = sc."projectId"
WHERE p.slug = 'vassa-iron' AND st."deletedAt" IS NULL
ORDER BY st."order";
EOSQL
