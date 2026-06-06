#!/bin/bash
set -e

echo "=== ALL CONTAINER LOGS > 50k ==="
find /var/lib/docker/containers -name '*-json.log' -size +50k -printf '%s %p\n' 2>/dev/null | sort -rn

echo "=== SEARCH OLD BACK CONTAINER dd25466 ==="
find /var/lib/docker/containers -path '*dd25466*' -ls 2>/dev/null || echo "not found"

echo "=== SEARCH sync/push IN ALL LOGS ==="
for f in $(find /var/lib/docker/containers -name '*-json.log' 2>/dev/null); do
  c=$(grep -c 'sync/push' "$f" 2>/dev/null || true)
  j=$(grep -c '2026-06-05' "$f" 2>/dev/null || true)
  v=$(grep -c 'cmlbf2rso000401uqc8pouqan' "$f" 2>/dev/null || true)
  if [ "$c" -gt 0 ] || [ "$j" -gt 0 ] || [ "$v" -gt 0 ]; then
    echo "push=$c jun5=$j vassa=$v size=$(stat -c%s "$f") $f"
  fi
done

echo "=== NGINX JUN5 sync/push ==="
zgrep -h 'sync/push' /var/log/nginx/access.log* 2>/dev/null | grep '05/Jun/2026' | wc -l
zgrep -h 'sync/push' /var/log/nginx/access.log* 2>/dev/null | grep '05/Jun/2026' | tail -10

echo "=== DOZZLE / OTHER ==="
find /opt /root /tmp -maxdepth 4 -name '*vassa*' -o -name '*sync*log*' 2>/dev/null | head -20

echo "=== EXTRACT FROM BEST CANDIDATE ==="
BEST=""
BEST_SIZE=0
for f in $(find /var/lib/docker/containers -name '*-json.log' 2>/dev/null); do
  v=$(grep -c 'cmlbf2rso000401uqc8pouqan' "$f" 2>/dev/null || true)
  if [ "$v" -gt 0 ]; then
    sz=$(stat -c%s "$f")
    if [ "$sz" -gt "$BEST_SIZE" ]; then
      BEST="$f"
      BEST_SIZE=$sz
    fi
  fi
done

if [ -n "$BEST" ]; then
  echo "Best log: $BEST ($BEST_SIZE bytes)"
  grep 'cmlbf2rso000401uqc8pouqan' "$BEST" | grep -E 'lightFaders|lightPrograms|theaterSpotlight|GlobalLightChannel|faderId' | wc -l
  grep 'cmlbf2rso000401uqc8pouqan' "$BEST" | grep lightPrograms | awk '{print length}' | sort -rn | head -5
  python3 <<PY
import json, re, sys

log = """$BEST"""
best_lines = []
with open(log, 'r', errors='replace') as f:
    for line in f:
        if 'cmlbf2rso000401uqc8pouqan' not in line:
            continue
        if not any(k in line for k in ['lightFaders','lightPrograms','theaterSpotlight','GlobalLightChannel','faderId','lightChannelRoles']):
            continue
        try:
            obj = json.loads(line)
            msg = obj.get('log','')
        except Exception:
            msg = line
        best_lines.append((len(msg), msg))

best_lines.sort(reverse=True)
print('matching lines:', len(best_lines))
for n, (ln, msg) in enumerate(best_lines[:8]):
    print(f'--- line {n+1} len={ln} ---')
    print(msg[:2000])
PY
else
  echo "No vassa logs found in any container log"
fi
