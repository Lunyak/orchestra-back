#!/bin/bash
LOG=/var/lib/docker/containers/04d1e2c7be52182199fe6561cab00f6a583952e366cd3be52f962cbf4e4b7242/04d1e2c7be52182199fe6561cab00f6a583952e366cd3be52f962cbf4e4b7242-json.log

echo "=== CADDY LOG: sync/push jun5 ==="
grep '2026-06-05' "$LOG" | grep 'sync/push' | wc -l
grep '2026-06-05' "$LOG" | grep 'sync/push' | tail -10

echo "=== CADDY: vassa mentions jun5 evening ==="
grep '2026-06-05T1[789]\|2026-06-05T2[0123]' "$LOG" | grep -i 'vassa\|cmlbf2rso' | head -20

echo "=== SEARCH ALL LOGS FOR rawBody lightFaders ==="
for f in $(find /var/lib/docker/containers -name '*-json.log' 2>/dev/null); do
  n=$(grep -c 'rawBody.*lightFaders' "$f" 2>/dev/null || true)
  if [ "$n" -gt 0 ]; then echo "$n $f"; fi
done

echo "=== SEARCH ALL LOGS FOR POST /sync/push ==="
for f in $(find /var/lib/docker/containers -name '*-json.log' 2>/dev/null); do
  n=$(grep -c 'POST /sync/push received' "$f" 2>/dev/null || true)
  if [ "$n" -gt 0 ]; then echo "$n $f"; fi
done

echo "=== EXTRACT sync push from caddy/back if any ==="
python3 <<'PY'
import json, glob, re

patterns = ['lightFaders', 'lightPrograms', 'theaterSpotlight', 'faderId', 'GlobalLightChannel']
best = []

for path in glob.glob('/var/lib/docker/containers/*/*-json.log'):
    try:
        with open(path, 'r', errors='replace') as f:
            for line in f:
                if 'POST /sync/push received' not in line and 'cmlbf2rso000401uqc8pouqan' not in line:
                    continue
                if '2026-06-05' not in line:
                    continue
                if not any(p in line for p in patterns):
                    continue
                try:
                    obj = json.loads(line)
                    msg = obj.get('log', '')
                except Exception:
                    msg = line
                best.append((len(msg), path, msg))
    except Exception as e:
        pass

best.sort(reverse=True)
print('hits', len(best))
for ln, path, msg in best[:10]:
    print('---', ln, path.split('/')[-2][:12], '---')
    print(msg[:2500])
PY
