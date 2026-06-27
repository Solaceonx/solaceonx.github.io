import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";

const API_BASE = "https://api.brawlstars.com/v1";
const SNAPSHOT_PATH = new URL("../brawl-snapshots.json", import.meta.url);
const DATA_PATH = new URL("../brawl-data.js", import.meta.url);
const HIGHLIGHTS_DIR = new URL("../assets/brawl_highlights/", import.meta.url);
const BRAWLER_IMAGE_DIR = new URL("../assets/brawlers/", import.meta.url);
const REAL_RANKED_MODES = new Set(["brawlball", "gemgrab", "heist", "bounty", "hotzone", "knockout", "wipeout"]);

async function loadEnv() {
  const env = {};
  try {
    const text = await readFile(new URL("../.env", import.meta.url), "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const [key, ...rest] = trimmed.split("=");
      env[key] = rest.join("=").trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    // Environment file is optional.
  }
  return {
    token: process.env.BRAWL_API_TOKEN || env.BRAWL_API_TOKEN || "",
    playerTag: process.env.BRAWL_PLAYER_TAG || env.BRAWL_PLAYER_TAG || ""
  };
}

async function readJson(url, fallback) {
  try {
    return JSON.parse(await readFile(url, "utf8"));
  } catch {
    return fallback;
  }
}

async function fetchJson(path, token) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${response.status} ${response.statusText} ${body}`);
  }

  return response.json();
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function labelFor(dateString) {
  return new Date(`${dateString}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric"
  });
}

function compactHistory(history) {
  const byDate = new Map();
  for (const point of history) byDate.set(point.date, point);
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function normalizeTag(tag) {
  const trimmed = tag.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
}

function modeLabel(battle) {
  const raw = battle?.event?.mode || battle?.battle?.mode || battle?.battle?.type || "Unknown mode";
  return humanizeMode(raw);
}

function normalizeMode(mode) {
  return String(mode || "").replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function humanizeMode(mode) {
  const normalized = normalizeMode(mode);
  const names = {
    brawlball: "Brawl Ball",
    brawlhockey: "Brawl Hockey",
    gemgrab: "Gem Grab",
    heist: "Heist",
    bounty: "Bounty",
    hotzone: "Hot Zone",
    knockout: "Knockout",
    wipeout: "Wipeout",
    soloshowdown: "Solo Showdown",
    duoshowdown: "Duo Showdown",
    tripleshowdown: "Triple Showdown",
    volleybrawl: "Volley Brawl",
    basketbrawl: "Basket Brawl",
    duels: "Duels",
    hunters: "Hunters",
    takedown: "Takedown",
    siege: "Siege",
    presentplunder: "Present Plunder",
    payload: "Payload",
    holdthetrophy: "Hold the Trophy",
    trophyescape: "Trophy Escape",
    unknownmode: "Unknown mode"
  };

  return names[normalized] || String(mode || "Unknown mode")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

function battleKey(item) {
  return [
    item.battleTime,
    item.event?.id,
    item.event?.mode,
    item.battle?.mode,
    item.battle?.type
  ].filter(Boolean).join(":");
}

function flattenPlayers(value, out = []) {
  if (!value) return out;
  if (Array.isArray(value)) {
    for (const item of value) flattenPlayers(item, out);
    return out;
  }
  if (typeof value === "object") {
    if (value.tag && value.brawler) out.push(value);
    for (const key of ["players", "teams", "starPlayer"]) flattenPlayers(value[key], out);
  }
  return out;
}

function findSelf(item, playerTag) {
  return flattenPlayers(item.battle).find(player => player.tag === playerTag) || null;
}

function resultFor(item) {
  const battle = item.battle || {};
  if (battle.result) return battle.result.toLowerCase();
  if (typeof battle.trophyChange === "number") return battle.trophyChange >= 0 ? "win" : "loss";
  if (typeof battle.rank === "number") return battle.rank <= 4 ? "win" : "loss";
  return "";
}

function isRankedBattle(item) {
  const typeText = `${item.battle?.type || ""}`.toLowerCase();
  const mode = normalizeMode(modeLabel(item));
  const rankedType = typeText.includes("ranked") || typeText.includes("power league");
  return rankedType && REAL_RANKED_MODES.has(mode);
}

function addCount(map, key, amount = 1) {
  if (!key) return;
  map[key] = (map[key] || 0) + amount;
}

function objectToRows(object, key = "name", images = {}) {
  return Object.entries(object || {})
    .map(([name, count]) => ({ [key]: name, count, image: images[name]?.image || null }))
    .sort((a, b) => b.count - a.count || String(a[key]).localeCompare(String(b[key])));
}

function brawlerImagePath(id) {
  return id ? `assets/brawlers/${id}.png` : null;
}

function collectBrawlerImages(player, battlelog) {
  const images = {};
  const add = (brawler) => {
    if (!brawler?.name || !brawler?.id) return;
    images[brawler.name] = {
      id: brawler.id,
      image: brawlerImagePath(brawler.id)
    };
  };

  for (const brawler of player.brawlers || []) add(brawler);
  for (const item of battlelog || []) {
    for (const playerEntry of flattenPlayers(item.battle)) add(playerEntry.brawler);
  }

  return images;
}

async function fileExists(url) {
  try {
    await access(url);
    return true;
  } catch {
    return false;
  }
}

async function downloadBrawlerImages(images) {
  await mkdir(BRAWLER_IMAGE_DIR, { recursive: true });
  const ids = [...new Set(Object.values(images).map(item => item.id).filter(Boolean))];

  for (const id of ids) {
    const target = new URL(`${id}.png`, BRAWLER_IMAGE_DIR);
    if (await fileExists(target)) continue;

    const response = await fetch(`https://cdn.brawlify.com/brawlers/borderless/${id}.png`);
    if (!response.ok) continue;
    const bytes = Buffer.from(await response.arrayBuffer());
    await writeFile(target, bytes);
  }
}

function rankedPointsFrom(player) {
  return player.rankedPoints
    ?? player.rankedElo
    ?? player.rankPoints
    ?? player.ranked?.points
    ?? player.ranked?.score
    ?? player.powerLeague?.points
    ?? null;
}

function lifetimeWinsFrom(player) {
  return [
    player["3vs3Victories"],
    player.soloVictories,
    player.duoVictories
  ].reduce((sum, value) => sum + (Number(value) || 0), 0);
}

function latestOrEmpty(history) {
  return history.at(-1) || {
    seenBattleKeys: [],
    trophyGamesTotal: 0,
    trophyWinsTotal: 0,
    trophyLossesTotal: 0,
    rankedGamesTotal: 0,
    rankedWinsTotal: 0,
    rankedLossesTotal: 0,
    trophyModeCounts: {},
    trophyBrawlerCounts: {},
    rankedModeCounts: {},
    rankedCurrentBrawlerCounts: {},
    rankedAllTimeBrawlerCounts: {}
  };
}

function snapshotFrom(player, battlelog, previous) {
  const date = todayKey();
  const brawlerImages = collectBrawlerImages(player, battlelog);
  const seen = new Set(previous.seenBattleKeys || []);
  const newBattles = [...battlelog].reverse().filter(item => {
    const key = battleKey(item);
    return key && !seen.has(key);
  });

  const trophyModeCounts = { ...(previous.trophyModeCounts || {}) };
  const trophyBrawlerCounts = { ...(previous.trophyBrawlerCounts || {}) };
  const rankedModeCounts = { ...(previous.rankedModeCounts || {}) };
  const rankedCurrentBrawlerCounts = { ...(previous.rankedCurrentBrawlerCounts || {}) };
  const rankedAllTimeBrawlerCounts = { ...(previous.rankedAllTimeBrawlerCounts || {}) };
  let trophyGamesTotal = previous.trophyGamesTotal || 0;
  let trophyWinsTotal = previous.trophyWinsTotal || 0;
  let trophyLossesTotal = previous.trophyLossesTotal || 0;
  let rankedGamesTotal = previous.rankedGamesTotal || 0;
  let rankedWinsTotal = previous.rankedWinsTotal || 0;
  let rankedLossesTotal = previous.rankedLossesTotal || 0;

  for (const item of newBattles) {
    const key = battleKey(item);
    const self = findSelf(item, player.tag);
    const brawler = self?.brawler?.name;
    const mode = modeLabel(item);
    const result = resultFor(item);
    seen.add(key);

    if (isRankedBattle(item)) {
      rankedGamesTotal += 1;
      if (result === "victory" || result === "win") rankedWinsTotal += 1;
      else if (result === "defeat" || result === "loss") rankedLossesTotal += 1;
      addCount(rankedModeCounts, mode);
      addCount(rankedAllTimeBrawlerCounts, brawler);
      addCount(rankedCurrentBrawlerCounts, brawler);
    } else {
      trophyGamesTotal += 1;
      if (result === "victory" || result === "win") trophyWinsTotal += 1;
      else if (result === "defeat" || result === "loss") trophyLossesTotal += 1;
      addCount(trophyModeCounts, mode);
      addCount(trophyBrawlerCounts, brawler);
    }
  }

  const trophyRecentGames = battlelog
    .filter(item => !isRankedBattle(item))
    .slice(0, 12)
    .map(item => {
      const self = findSelf(item, player.tag);
      return {
        brawler: self?.brawler?.name || "Unknown",
        image: brawlerImages[self?.brawler?.name]?.image || null,
        mode: modeLabel(item),
        result: resultFor(item),
        battleTime: item.battleTime || null
      };
    });

  const topBrawlers = (player.brawlers || [])
    .slice()
    .sort((a, b) => (b.trophies || 0) - (a.trophies || 0))
    .slice(0, 10)
    .map(brawler => ({
      name: brawler.name,
      trophies: brawler.trophies || 0,
      power: brawler.power || null,
      rank: brawler.rank || null,
      image: brawlerImages[brawler.name]?.image || null,
      games: trophyBrawlerCounts[brawler.name] || 0
    }));

  return {
    date,
    label: labelFor(date),
    fetchedAt: new Date().toISOString(),
    tag: player.tag,
    name: player.name,
    trophies: player.trophies ?? null,
    highestTrophies: player.highestTrophies ?? null,
    lifetimeWinsTotal: lifetimeWinsFrom(player),
    threeVsThreeVictories: player["3vs3Victories"] ?? null,
    soloVictories: player.soloVictories ?? null,
    duoVictories: player.duoVictories ?? null,
    rankedPoints: rankedPointsFrom(player),
    trophyGamesTotal,
    trophyWinsTotal,
    trophyLossesTotal,
    rankedGamesTotal,
    rankedWinsTotal,
    rankedLossesTotal,
    trophyRecentGames,
    trophyModeCounts,
    trophyBrawlerCounts,
    rankedModeCounts,
    rankedCurrentBrawlerCounts,
    rankedAllTimeBrawlerCounts,
    brawlerImages,
    topBrawlers,
    seenBattleKeys: [...seen].slice(-600)
  };
}

async function highlights() {
  try {
    const names = await readdir(HIGHLIGHTS_DIR);
    return names
      .filter(name => /\.(png|jpe?g|webp)$/i.test(name))
      .sort((a, b) => a.localeCompare(b))
      .map(name => `assets/brawl_highlights/${name}`);
  } catch {
    return [];
  }
}

function buildPageData(history, highlightPaths) {
  const latest = latestOrEmpty(history);
  const seasonResets = [];
  for (let index = 1; index < history.length; index++) {
    const prev = history[index - 1];
    const point = history[index];
    if (typeof prev.rankedPoints === "number" && typeof point.rankedPoints === "number" && point.rankedPoints < prev.rankedPoints) {
      seasonResets.push({ date: point.date, label: point.label });
    }
  }

  return {
    trophy: {
      history: history.map(point => ({ date: point.date, label: point.label, trophies: point.trophies })).filter(point => typeof point.trophies === "number"),
      recentGames: latest.trophyRecentGames || [],
      gamesHistory: history.map(point => ({ date: point.date, label: point.label, games: point.trophyGamesTotal })).filter(point => typeof point.games === "number"),
      lifetimeWinsHistory: history.map(point => ({ date: point.date, label: point.label, wins: point.lifetimeWinsTotal })).filter(point => typeof point.wins === "number"),
      winsHistory: history.map(point => ({ date: point.date, label: point.label, wins: point.trophyWinsTotal })).filter(point => typeof point.wins === "number"),
      lossesHistory: history.map(point => ({ date: point.date, label: point.label, losses: point.trophyLossesTotal })).filter(point => typeof point.losses === "number"),
      modes: objectToRows(latest.trophyModeCounts, "mode"),
      topBrawlers: latest.topBrawlers || []
    },
    ranked: {
      pointsHistory: history.map(point => ({ date: point.date, label: point.label, points: point.rankedPoints })).filter(point => typeof point.points === "number"),
      gamesHistory: history.map(point => ({ date: point.date, label: point.label, games: point.rankedGamesTotal })).filter(point => typeof point.games === "number"),
      winsHistory: history.map(point => ({ date: point.date, label: point.label, wins: point.rankedWinsTotal })).filter(point => typeof point.wins === "number"),
      lossesHistory: history.map(point => ({ date: point.date, label: point.label, losses: point.rankedLossesTotal })).filter(point => typeof point.losses === "number"),
      modes: objectToRows(latest.rankedModeCounts, "mode"),
      currentSeasonBrawlers: objectToRows(latest.rankedCurrentBrawlerCounts, "name", latest.brawlerImages || {}),
      allTimeBrawlers: objectToRows(latest.rankedAllTimeBrawlerCounts, "name", latest.brawlerImages || {}),
      seasonResets
    },
    highlights: highlightPaths
  };
}

const { token, playerTag } = await loadEnv();
const normalizedTag = normalizeTag(playerTag);

if (!token) throw new Error("Missing BRAWL_API_TOKEN. Add it to .env before running this script.");
if (!normalizedTag) throw new Error("Missing BRAWL_PLAYER_TAG. Add your Brawl Stars player tag to .env before running this script.");

const encodedTag = encodeURIComponent(normalizedTag);
const [player, battlelog] = await Promise.all([
  fetchJson(`/players/${encodedTag}`, token),
  fetchJson(`/players/${encodedTag}/battlelog`, token)
]);

const existingHistory = await readJson(SNAPSHOT_PATH, []);
const previous = latestOrEmpty(existingHistory);
const snapshot = snapshotFrom(player, Array.isArray(battlelog.items) ? battlelog.items : [], previous);
await downloadBrawlerImages(snapshot.brawlerImages || {});
const history = compactHistory([...existingHistory, snapshot]);
const highlightPaths = await highlights();

await writeFile(SNAPSHOT_PATH, `${JSON.stringify(history, null, 2)}\n`);
await writeFile(DATA_PATH, `window.BRAWL_DATA = ${JSON.stringify(buildPageData(history, highlightPaths), null, 2)};\n`);

console.log(`Saved Brawl Stars snapshot for ${snapshot.name} (${snapshot.tag}) · ${snapshot.trophies ?? "—"} trophies`);
console.log("Updated brawl-snapshots.json and brawl-data.js.");
