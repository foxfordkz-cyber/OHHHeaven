#!/usr/bin/env bash
# One QA round (task B06): the browser walk on a fresh build of a branch, in its own worktree.
#   scripts/e2e/cycle.sh                                   # the integrator branch (B04), the default below
#   scripts/e2e/cycle.sh origin/claude/global-entrepreneur-product-133cix
# The worktree lives next to the repository (../ohh-qa-<name>); dependencies are installed only when the lockfile changed.
# The result: docs/qa/runs/<time>-<name>/RUN.md, results.json and screenshots (not committed: docs/qa/.gitignore).
set -euo pipefail
HERE="$(cd "$(dirname "$0")/../.." && pwd)"
REF="${1:-origin/claude/cool-archimedes-blis6z}"
NAME="$(basename "$REF")"
WT="$(dirname "$HERE")/ohh-qa-${NAME}"
STAMP="$(date -u +%Y%m%d-%H%M)"
OUT="$HERE/docs/qa/runs/${STAMP}-${NAME}"

git -C "$HERE" fetch -q origin
if [ ! -d "$WT" ]; then git -C "$HERE" worktree add -q --detach "$WT" "$REF"; else git -C "$WT" checkout -q --detach "$REF"; fi
COMMIT="$(git -C "$WT" rev-parse --short HEAD)"
echo "QA round on $REF @ $COMMIT in $WT"

LOCK_SUM="$(sha1sum "$WT/package-lock.json" | cut -d' ' -f1)"
if [ ! -f "$WT/node_modules/.qa-lock" ] || [ "$(cat "$WT/node_modules/.qa-lock")" != "$LOCK_SUM" ]; then
  (cd "$WT" && npm ci --no-audit --no-fund >/dev/null) && echo "$LOCK_SUM" > "$WT/node_modules/.qa-lock"
fi
(cd "$WT" && npm run build >/dev/null)

mkdir -p "$OUT"
echo "$REF @ $COMMIT" > "$OUT/COMMIT"
node "$HERE/scripts/e2e/journey.mjs" --root "$WT" --out "$OUT" "${@:2}"
