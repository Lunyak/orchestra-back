#!/bin/bash
cd /opt/orchestra-back

echo "=== LOG FILE INFO ==="
docker inspect orkestr-back --format '{{.LogPath}}' 2>/dev/null
LOG=$(docker inspect orkestr-back --format '{{.LogPath}}' 2>/dev/null)
if [ -f "$LOG" ]; then ls -lah "$LOG"; fi

echo "=== JUN 5 SYNC PUSH TIMES ==="
if [ -f "$LOG" ]; then
  grep '2026-06-05' "$LOG" | grep -c 'sync/push' || true
  grep '2026-06-05' "$LOG" | grep 'sync/push received' | head -30
fi

echo "=== JUN 5 EVENING (17:00-23:59) THEATER/LIGHT MENTIONS ==="
if [ -f "$LOG" ]; then
  grep '2026-06-05T1[789]\|2026-06-05T2[0123]' "$LOG" | grep -iE 'lightFaders|lightPrograms|theaterSpotlight|GlobalLightChannel|faderId|lightChannel' | head -50
fi

echo "=== JUN 5 FCaf CLIENT (evening) ==="
if [ -f "$LOG" ]; then
  grep 'fcaf6694' "$LOG" | head -20
fi

echo "=== JUN 5 FULL LINES WITH lightPrograms ==="
if [ -f "$LOG" ]; then
  grep '2026-06-05' "$LOG" | grep 'lightPrograms' | head -15
fi

echo "=== JUN 5 FULL LINES WITH lightFaders ==="
if [ -f "$LOG" ]; then
  grep '2026-06-05' "$LOG" | grep 'lightFaders' | head -15
fi

echo "=== JUN 5 theaterSpotlights ==="
if [ -f "$LOG" ]; then
  grep '2026-06-05' "$LOG" | grep 'theaterSpotlight' | head -15
fi

echo "=== DOCKER COMPOSE LOGS JUN5 ==="
docker compose logs --timestamps back 2>&1 | grep '2026-06-05' | grep 'sync/push' | wc -l
docker compose logs --timestamps back 2>&1 | grep '2026-06-05T2' | grep 'sync/push received' | head -20
