#!/usr/bin/env bash
# Собирает новые и обновлённые отчёты из всех веток исследователей в текущую ветку.
# Запуск из корня репозитория: bash research/collect.sh
#
# Берёт только то, что автор ветки сам добавил или изменил (сравнение с общей базой),
# поэтому старые копии WINNER.md и отчётов из отставших веток не затирают новые.
# Если файл отличается и в ветке, и у нас, берётся версия с более поздним коммитом.
# HANDOFF.md не трогает: его сводят руками.
set -euo pipefail

MAIN="claude/global-entrepreneur-product-133cix"
git fetch -q origin '+refs/heads/*:refs/remotes/origin/*'

for ref in $(git for-each-ref --format='%(refname:short)' refs/remotes/origin | grep -v -e "/${MAIN}\$" -e '/HEAD$'); do
  base=$(git merge-base HEAD "$ref" 2>/dev/null) || continue
  for f in $(git diff --name-only --diff-filter=AM "$base" "$ref" -- research/reports research/full research/WINNER.md docs packs data proto sim build/RULES.md agents); do
    if ! git cat-file -e "HEAD:$f" 2>/dev/null; then
      git checkout -q "$ref" -- "$f"
      echo "NEW      $f  <- $ref"
    elif [ "$(git rev-parse "HEAD:$f")" != "$(git rev-parse "$ref:$f")" ]; then
      ours=$(git log -1 --format=%ct HEAD -- "$f")
      theirs=$(git log -1 --format=%ct "$ref" -- "$f")
      if [ "$theirs" -gt "$ours" ]; then
        git checkout -q "$ref" -- "$f"
        echo "UPDATED  $f  <- $ref"
      else
        echo "SKIPPED  $f  (в $ref версия старше нашей)"
      fi
    fi
  done
done

echo "--- изменения в рабочей копии ---"
git status --short
