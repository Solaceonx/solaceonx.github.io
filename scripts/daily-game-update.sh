#!/bin/zsh
set -eu

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

cd "/Users/lyxia/Projects/site"

"/opt/homebrew/bin/npm" run update:coc

if [ -f ".env" ] && grep -q '^CR_API_TOKEN=' ".env"; then
  "/opt/homebrew/bin/npm" run update:royale
else
  echo "Skipping Clash Royale update: add CR_API_TOKEN to .env to enable it."
fi

if [ -f ".env" ] && grep -q '^BRAWL_API_TOKEN=' ".env" && grep -q '^BRAWL_PLAYER_TAG=.' ".env"; then
  "/opt/homebrew/bin/npm" run update:brawl
else
  echo "Skipping Brawl Stars update: add BRAWL_API_TOKEN and BRAWL_PLAYER_TAG to .env to enable it."
fi

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  if git diff --quiet -- coc-data.js coc-snapshots.json royale-data.js royale-snapshots.json brawl-data.js brawl-snapshots.json; then
    exit 0
  fi

  git add coc-data.js coc-snapshots.json royale-data.js royale-snapshots.json brawl-data.js brawl-snapshots.json
  git commit -m "Update game snapshots"

  if git remote get-url origin >/dev/null 2>&1; then
    git push origin HEAD
  fi
fi
