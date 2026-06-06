#!/bin/bash
set -e
cd /opt/orchestra-back
SCENE='cmlbf2rso000401uqc8pouqan:script'

echo "=== BACKUP ==="
TS=$(date +%Y%m%d_%H%M%S)
docker compose exec -T postgres pg_dump -U orkestr -d dophamin_orkestr -Fc -f /tmp/theater_full_${TS}.dump
docker cp orkestr-postgres:/tmp/theater_full_${TS}.dump ./backups/theater_full_${TS}.dump

python3 <<'PY'
import json, uuid

SCENE = "cmlbf2rso000401uqc8pouqan:script"

# 7 софитов + 9 RGB (каналы 8–16), привязка Fn -> софит/RGB n на канале n
# F1 из лога 17:48: доп. links на софиты 5,6 через каналы 3,4 — сохраняем в F1
light_faders = {
    "v": 1,
    "count": 8,
    "faders": [
        {
            "id": 1,
            "label": "F1",
            "channel": 1,
            "intensity": 1,
            "enabled": True,
            "links": [
                {"channel": 1, "spotlightId": 1},
                {"channel": 3, "spotlightId": 5},
                {"channel": 4, "spotlightId": 6},
            ],
        },
        {"id": 2, "label": "F2", "channel": 2, "intensity": 1, "enabled": True, "links": [{"channel": 2, "spotlightId": 2}]},
        {"id": 3, "label": "F3", "channel": 3, "intensity": 1, "enabled": True, "links": [{"channel": 3, "spotlightId": 3}]},
        {"id": 4, "label": "F4", "channel": 4, "intensity": 1, "enabled": True, "links": [{"channel": 4, "spotlightId": 4}]},
        {"id": 5, "label": "F5", "channel": 5, "intensity": 1, "enabled": True, "links": [{"channel": 5, "spotlightId": 5}]},
        {"id": 6, "label": "F6", "channel": 6, "intensity": 1, "enabled": True, "links": [{"channel": 6, "spotlightId": 6}]},
        {"id": 7, "label": "F7", "channel": 7, "intensity": 1, "enabled": True, "links": [{"channel": 7, "spotlightId": 7}]},
        {
            "id": 8,
            "label": "F8",
            "channel": 8,
            "intensity": 1,
            "enabled": True,
            "links": [{"channel": i, "spotlightId": i} for i in range(8, 17)],
        },
    ],
}

light_programs = {
    "v": 1,
    "activeProgramId": 1,
    "count": 8,
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

# канал: подпись|цвет
channel_specs = []
for i in range(1, 8):
    channel_specs.append(f"{i}|#fff4e0")  # софиты — тёплый
for i in range(8, 17):
    channel_specs.append(f"{i}|#4488ff")  # RGB — синий

def spotlight_row(sid, label, channel, fader_id, is_rgb, pos, target):
    return {
        "sourceId": sid,
        "label": label,
        "channel": channel,
        "faderId": fader_id,
        "isRgb": is_rgb,
        "position": pos,
        "target": target,
        "angleDeg": 20,
        "intensity": 0.7,
        "color": "#4488ff" if is_rgb else "#fff4e0",
        "enabled": True,
        "hidden": False,
    }

spotlights = []
# 7 софитов в ряд над сценой
for i in range(1, 8):
    x = -6 + (i - 1) * 2
    spotlights.append(spotlight_row(
        i, f"Софит {i}", i, i, False,
        [x, 6, 4], [x * 0.5, 1, 1],
    ))
# 9 RGB
rgb_labels = ["RGB 1"] + [f"RGB {i}" for i in range(9, 17)]
for idx, sid in enumerate(range(8, 17)):
    x = -8 + idx * 2
    spotlights.append(spotlight_row(
        sid, rgb_labels[idx], sid, 8, True,
        [x, 5.5, 3], [0, 0.5, 0],
    ))

sql = []
sql.append(f"UPDATE \"Scene\" SET")
sql.append(f"  \"lightFaders\" = $j${json.dumps(light_faders, ensure_ascii=False)}$j$::jsonb,")
sql.append(f"  \"lightPrograms\" = $j${json.dumps(light_programs, ensure_ascii=False)}$j$::jsonb,")
sql.append(f"  \"lightChannelRoles\" = $j${json.dumps(light_channel_roles, ensure_ascii=False)}$j$::jsonb,")
sql.append(f"  \"updatedAt\" = NOW()")
sql.append(f"WHERE id = '{SCENE}';")

sql.append(f"DELETE FROM \"GlobalLightChannel\" WHERE \"sceneId\"='{SCENE}';")
for idx, raw in enumerate(channel_specs):
    esc = raw.replace("'", "''")
    sql.append(
        f"INSERT INTO \"GlobalLightChannel\" (id, \"sceneId\", raw, index) "
        f"VALUES ('ch-{idx}-{uuid.uuid4().hex[:8]}', '{SCENE}', '{esc}', {idx});"
    )

# шаги 1 и 5 — основные для театра
sql.append(f"""
DELETE FROM "TheaterSpotlight" ts
USING "Step" st
WHERE ts."stepId" = st.id AND st."sceneId" = '{SCENE}' AND st."sourceId" IN (1, 5);
""")

for step_source in (1, 5):
    for sp in spotlights:
        pos = json.dumps(sp["position"])
        tgt = json.dumps(sp["target"])
        fid = "NULL" if sp["faderId"] is None else str(sp["faderId"])
        sql.append(f"""
INSERT INTO "TheaterSpotlight" (
  id, "stepId", "sourceId", label, position, target,
  "angleDeg", intensity, color, enabled, channel, "isRgb", "faderId", hidden
)
SELECT
  '{uuid.uuid4().hex}',
  st.id,
  {sp["sourceId"]},
  '{sp["label"].replace("'", "''")}',
  '{pos}'::jsonb,
  '{tgt}'::jsonb,
  {sp["angleDeg"]},
  {sp["intensity"]},
  '{sp["color"]}',
  true,
  {sp["channel"]},
  {'true' if sp["isRgb"] else 'false'},
  {fid},
  false
FROM "Step" st
WHERE st."sceneId" = '{SCENE}' AND st."sourceId" = {step_source} AND st."deletedAt" IS NULL;
""")

open("/tmp/full_theater_restore.sql", "w", encoding="utf-8").write("\n".join(sql))
print("spotlights:", len(spotlights), "x2 steps")
print("wrote /tmp/full_theater_restore.sql")
PY

cat /tmp/full_theater_restore.sql | docker compose exec -T postgres psql -U orkestr -d dophamin_orkestr -v ON_ERROR_STOP=1

echo "=== RESULT ==="
docker compose exec -T postgres psql -U orkestr -d dophamin_orkestr <<'EOSQL'
SELECT st."sourceId", st.title, count(ts.id) as spotlights
FROM "Step" st
LEFT JOIN "TheaterSpotlight" ts ON ts."stepId" = st.id
WHERE st."sceneId"='cmlbf2rso000401uqc8pouqan:script' AND st."sourceId" IN (1,5)
GROUP BY st."sourceId", st.title;

SELECT ts."sourceId", ts.label, ts.channel, ts."faderId", ts."isRgb"
FROM "TheaterSpotlight" ts
JOIN "Step" st ON st.id = ts."stepId"
WHERE st."sceneId"='cmlbf2rso000401uqc8pouqan:script' AND st."sourceId"=1
ORDER BY ts."sourceId";

SELECT left("lightFaders"::text, 300) FROM "Scene" WHERE id='cmlbf2rso000401uqc8pouqan:script';
EOSQL
