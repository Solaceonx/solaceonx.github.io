#!/bin/zsh
set -eu

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

cd "/Users/lyxia/Projects/site"

"/opt/homebrew/bin/npm" run update:coc

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  if git diff --quiet -- coc-data.js coc-snapshots.json; then
    exit 0
  fi

  git add coc-data.js coc-snapshots.json
  git commit -m "Update Clash of Clans snapshots"

  if git remote get-url origin >/dev/null 2>&1; then
    git push origin HEAD
  fi
fi
