#!/bin/bash
set -e
cd /opt/orchestra-back
SCENE='cmlbf2rso000401uqc8pouqan:script'

echo "=== SAFETY BACKUP ==="
TS=$(date +%Y%m%d_%H%M%S)
docker compose exec -T postgres pg_dump -U orkestr -d dophamin_orkestr -Fc -f /tmp/before_theater_restore_${TS}.dump
docker cp orkestr-postgres:/tmp/before_theater_restore_${TS}.dump ./backups/before_theater_restore_${TS}.dump
echo "backup: ./backups/before_theater_restore_${TS}.dump"

python3 <<'PY'
import json

SCENE = "cmlbf2rso000401uqc8pouqan:script"

light_faders = {
    "v": 1,
    "count": 8,
    "faders": [
        {
            "id": 1,
            "label": "F1",
            "channel": 2,
            "intensity": 1,
            "enabled": True,
            "links": [
                {"channel": 1},
                {"channel": 3, "spotlightId": 5},
                {"channel": 4, "spotlightId": 6},
                {"channel": 5},
            ],
        },
        {"id": 2, "label": "F2", "channel": 2, "intensity": 1, "enabled": True, "links": [{"channel": 2}]},
        {"id": 3, "label": "F3", "channel": 3, "intensity": 1, "enabled": True, "links": [{"channel": 3, "spotlightId": 5}]},
        {"id": 4, "label": "F4", "channel": 4, "intensity": 1, "enabled": True, "links": [{"channel": 4, "spotlightId": 6}]},
        {"id": 5, "label": "F5", "channel": 5, "intensity": 1, "enabled": True, "links": [{"channel": 5}]},
        {"id": 6, "label": "F6", "channel": 6, "intensity": 1, "enabled": True, "links": [{"channel": 6}]},
        {"id": 7, "label": "F7", "channel": 7, "intensity": 1, "enabled": True, "links": [{"channel": 7}]},
        {"id": 8, "label": "F8", "channel": 8, "intensity": 1, "enabled": True, "links": [{"channel": 8}]},
    ],
}

light_programs = {
    "v": 1,
    "activeProgramId": 1,
    "programs": [
        {
            "id": 1,
            "label": "Программа 1",
            "faders": [{"faderId": i, "intensity": 1, "enabled": True} for i in range(1, 9)],
        }
    ],
}

light_channel_roles = {
    "v": 1,
    "sofitChannels": [1, 2, 3, 4, 5, 6, 7],
    "recordChannels": list(range(1, 17)),
}

light_channels = [f"{i}|#ffffff" if i <= 7 else f"{i}|#4488ff" for i in range(1, 17)]

sql = []
sql.append(f"UPDATE \"Scene\" SET")
sql.append(f"  \"lightFaders\" = $j${json.dumps(light_faders, ensure_ascii=False)}$j$::jsonb,")
sql.append(f"  \"lightPrograms\" = $j${json.dumps(light_programs, ensure_ascii=False)}$j$::jsonb,")
sql.append(f"  \"lightChannelRoles\" = $j${json.dumps(light_channel_roles, ensure_ascii=False)}$j$::jsonb,")
sql.append(f"  \"updatedAt\" = NOW()")
sql.append(f"WHERE id = '{SCENE}';")
sql.append(f"DELETE FROM \"GlobalLightChannel\" WHERE \"sceneId\"='{SCENE}';")
for idx, raw in enumerate(light_channels):
    sql.append(
        "INSERT INTO \"GlobalLightChannel\" (id, \"sceneId\", raw, index) VALUES ("
        f"'restore-ch-{idx}', '{SCENE}', '{raw.replace(chr(39), chr(39)+chr(39))}', {idx}"
        ");"
    )
sql.append("""
UPDATE "TheaterSpotlight" ts
SET "faderId" = v.fader_id
FROM (
  VALUES (5, 3), (6, 4)
) AS v(spot_id, fader_id)
JOIN "Step" st ON st."sourceId" = 5 AND st."sceneId" = 'cmlbf2rso000401uqc8pouqan:script'
WHERE ts."stepId" = st.id AND ts."sourceId" = v.spot_id;
""")

open('/tmp/restore_theater.sql', 'w', encoding='utf-8').write('\n'.join(sql))
print('wrote /tmp/restore_theater.sql')
PY

cat /tmp/restore_theater.sql | docker compose exec -T postgres psql -U orkestr -d dophamin_orkestr

echo "=== VERIFY ==="
docker compose exec -T postgres psql -U orkestr -d dophamin_orkestr <<'SQL'
SELECT length("lightFaders"::text) as f_len,
       length("lightPrograms"::text) as p_len,
       "lightChannelRoles"::text as roles
FROM "Scene" WHERE id = 'cmlbf2rso000401uqc8pouqan:script';

SELECT count(*) FROM "GlobalLightChannel" WHERE "sceneId"='cmlbf2rso000401uqc8pouqan:script';

SELECT ts."sourceId", ts.channel, ts."faderId"
FROM "TheaterSpotlight" ts
JOIN "Step" st ON st.id = ts."stepId"
WHERE st."sceneId"='cmlbf2rso000401uqc8pouqan:script' AND st."sourceId"=5
ORDER BY ts."sourceId";
SQL
