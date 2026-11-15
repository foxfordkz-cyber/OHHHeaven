#!/usr/bin/env bash
# Every browser check against a deployed game, one command (task B06):
#   scripts/e2e/prod.sh https://<public address> [CLOCK_KEY]
# 1. the player's walk on 375 and 1440 (its own demo city, left paused, the season is not run to the end — BUGS.md №15);
# 2. the first minute at demo speed; 3. load speed of the first screen (compression, sizes);
# 4. the stage show in the pitch city, only when a clock key is given (the pitch city is put back to the start at the end).
# With CLOCK_KEY set on the server (needed for the pitch city), the walk can pause and move its own city only with the key.
# Results: docs/qa/runs/<time>-prod/ (not committed); a summary is printed at the end.
set -uo pipefail
URL="${1:?usage: scripts/e2e/prod.sh https://<public address> [CLOCK_KEY]}"
KEY="${2:-${CLOCK_KEY:-}}"
HERE="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$HERE/docs/qa/runs/$(date -u +%Y%m%d-%H%M)-prod"
mkdir -p "$OUT"
cd "$HERE"

echo "== health (waits up to 2 minutes: a host may start the server cold)"
for i in $(seq 1 24); do curl -sS -m 10 -o /dev/null -w "%{http_code}" "$URL/api/health" 2>/dev/null | grep -q 200 && break; sleep 5; done
curl -sS -m 20 "$URL/api/health" | head -c 400; echo
echo "== walk";         node scripts/e2e/journey.mjs --url "$URL" ${KEY:+--key "$KEY"} --out "$OUT/walk";        W=$?
echo "== first minute"; node scripts/e2e/first-minute.mjs --url "$URL" ${KEY:+--key "$KEY"} --out "$OUT/first-minute"; F=$?
echo "== speed";        node scripts/e2e/perf.mjs --url "$URL" | tee "$OUT/perf.txt";       P=${PIPESTATUS[0]}
S=skipped
if [ -n "$KEY" ]; then echo "== pitch show"; node scripts/e2e/pitch-show.mjs --url "$URL" --key "$KEY" --out "$OUT/pitch"; S=$?; fi

echo
echo "walk exit $W · first minute exit $F · speed exit $P · pitch show ${S}"
echo "results: ${OUT#$HERE/}"
[ "$W" = 0 ] && [ "$F" = 0 ] && [ "$P" = 0 ] && { [ "$S" = 0 ] || [ "$S" = skipped ]; }
