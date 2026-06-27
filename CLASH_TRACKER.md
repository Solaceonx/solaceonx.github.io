# Clash of Clans tracker notes

The dashboard is rendered from [`coc-data.js`](./coc-data.js). That keeps the site GitHub Pages-friendly because it does not require a public server.

## Updating live API snapshots

Do not commit your Supercell token. Put it in a local `.env` file:

```bash
COC_API_TOKEN=your_token_here
```

Then run:

```bash
npm run update:coc
```

That script fetches each account from the official Clash of Clans API, appends a dated entry to `coc-snapshots.json`, and regenerates `coc-data.js` for the public static site. Commit `coc-data.js` and `coc-snapshots.json` after updating if you want GitHub Pages to show the newest snapshot.

## Daily local auto-update

This Mac has a LaunchAgent installed at:

```bash
~/Library/LaunchAgents/local.luke-y-xia.coc-update.plist
```

It runs every day at 9:00 AM local time and calls:

```bash
/Users/lyxia/Projects/site/scripts/daily-coc-update.sh
```

The script runs `npm run update:coc`. If this folder is later initialized as a Git repo, it will also commit `coc-data.js` and `coc-snapshots.json`; if an `origin` remote exists, it will push too.

Useful commands:

```bash
launchctl print gui/501/local.luke-y-xia.coc-update
launchctl kickstart gui/501/local.luke-y-xia.coc-update
launchctl bootout gui/501 ~/Library/LaunchAgents/local.luke-y-xia.coc-update.plist
```

Logs are written to `coc-update.log` and `coc-update.err.log`, which are ignored by Git.

## What can come from the official API

The official Clash of Clans player endpoint can provide current profile data such as:

- trophies and best trophies;
- attack and defense wins;
- current-season donations;
- Town Hall level;
- hero, troop, spell, and equipment levels;
- achievement totals;
- clan capital contribution data where available.

## What needs snapshots or manual data

Historical charts and placement records are not supplied as a ready-made history. To graph them, a scheduled service must fetch each account periodically and save dated snapshots.

Building and wall completion percentages are manual fields because the player endpoint does not list every building/wall level.

## GitHub Pages limitation

Do not put a Clash of Clans API token in this repository or browser JavaScript. GitHub Pages is public and cannot protect secrets. The safer design is: fetch privately on your Mac, generate public static data, then push the generated files.

Official developer portal: https://developer.clashofclans.com/
