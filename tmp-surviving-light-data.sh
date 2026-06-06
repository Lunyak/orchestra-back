#!/bin/bash
cd /opt/orchestra-back
docker compose exec -T postgres psql -U orkestr -d dophamin_orkestr <<'SQL'
SELECT st."sourceId", st.title,
  length(coalesce(st."lightKadrs"::text,'')) as lk_len,
  st."lightKadrs"::text as light_kadrs
FROM "Step" st
WHERE st."sceneId"='cmlbf2rso000401uqc8pouqan:script' AND st."deletedAt" IS NULL
ORDER BY st."sourceId";

SELECT st."sourceId", left(st.markdown, 500) as md
FROM "Step" st
WHERE st."sceneId"='cmlbf2rso000401uqc8pouqan:script' AND st."deletedAt" IS NULL
  AND st.markdown ILIKE '%lightpanel%'
ORDER BY st."sourceId";
SQL

echo "=== RECONSTRUCT FROM LOG FRAGMENTS ==="
python3 <<'PY'
import re, json

lines = open('/tmp/vassa_sync_logs.txt').read().splitlines()
scene_updates = []
for line in lines:
    m = re.search(r"rawBody: '(.+)'$", line)
    if not m:
        continue
    raw = m.group(1)
    ts = re.search(r'(\d{4}-\d{2}-\d{2}T[\d:.]+)', line)
    ts = ts.group(1) if ts else ''
    if 'lightFaders' in raw or 'lightPrograms' in raw or 'theaterSpotlight' in raw or 'GlobalLightChannel' in raw:
        scene_updates.append((ts, raw))

print('scene/light lines:', len(scene_updates))
for ts, raw in scene_updates:
    print('---', ts, 'len', len(raw), '---')
    print(raw)

# try parse partial JSON by padding
for ts, raw in reversed(scene_updates):
    if 'lightFaders' not in raw:
        continue
    # extract what we can with regex
    m = re.search(r'"lightFaders":(\{.*)', raw)
    if m:
        frag = m.group(1)
        print('\nFADERS FRAGMENT AT', ts)
        print(frag[:800])
PY
