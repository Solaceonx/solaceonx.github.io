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

# Brawl Stars updates run every 2 hours in GitHub Actions (.github/workflows/brawl-update.yml).

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  if git diff --quiet -- coc-data.js coc-snapshots.json royale-data.js royale-snapshots.json royale-battle-history.json; then
    exit 0
  fi

  git add coc-data.js coc-snapshots.json royale-data.js royale-snapshots.json royale-battle-history.json
  git commit -m "Update game snapshots"

  if git remote get-url origin >/dev/null 2>&1; then
    git pull --rebase --autostash origin main
    git push origin HEAD
  fi
fi
