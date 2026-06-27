import { readFile, writeFile } from "node:fs/promises";

const API_BASE = "https://api.clashofclans.com/v1";
const SNAPSHOT_PATH = new URL("../coc-snapshots.json", import.meta.url);
const DATA_PATH = new URL("../coc-data.js", import.meta.url);

const accounts = [
  {
    id: "solaceonx",
    name: "Solaceonx",
    displayName: "SolaceonX",
    tag: "#90VCP9QR",
    tabDescriptor: "Main account",
    descriptor: "This is my main account, which I've had since 2012. It is completely free to play, and as a result, I'm always 1-2 Town Hall levels behind the max. This leaves my no other option but to push trophies (and leagues now), with this account having hit #1 in the world many times. Now, the goal is to <strong>finish in the top 20 of Town Hall 16s in the world</strong>. I am alternating a RC charge Root Rider attack and a Backpack + Giant Arrow Dragon Riders attack.",
    backgroundImage: "assets/clash-base.png"
  },
  {
    id: "solaceon",
    name: "SOLACEON",
    displayName: "Solaceon",
    tag: "#P8P8QJL0",
    tabDescriptor: "Alt account",
    descriptor: "This is my alt, but I got sick of being completely free to play so it has been fed Gold Passes for the past 7 months.",
    backgroundImage: "assets/clash-solaceon.png"
  },
  {
    id: "opelucidian",
    name: "OPELUCIDIAN",
    displayName: "Opelucidian",
    tag: "#LU29VV8CG",
    tabDescriptor: "Adopted account",
    descriptor: "Adopted from one of my brothers",
    backgroundImage: "assets/clash-opelucidian.png"
  },
  {
    id: "fyr3st0rm3r",
    name: "FYR3ST0RM3R",
    displayName: "Fyr3st0rm3r",
    tag: "#Q0Y8P8UL9",
    tabDescriptor: "Adopted account",
    descriptor: "Adopted from one of my brothers",
    backgroundImage: "assets/clash-fyr3st0rm3r.png"
  },
  {
    id: "icirrus",
    name: "ICIRRUS",
    displayName: "iCirrus",
    tag: "#LU89RPPJ0",
    tabDescriptor: "Adopted account",
    descriptor: "Adopted from one of my brothers",
    backgroundImage: "assets/clash-icirrus.PNG"
  },
  {
    id: "budgie",
    name: "Budgie",
    displayName: "Budgie",
    tag: "#QU92GUPPV",
    tabDescriptor: "Town Hall 10 project",
    descriptor: "This was my brother's alt account. I decided to max it out at Town Hall 10 for now and not upgrade to Town Hall 11, in honor of the original max Town Hall 10. One day I will push leagues with this account.",
    backgroundImage: "assets/clash-budgie.PNG"
  }
];

const manual = {
  solaceonx: {
    placements: [
      { rank: 1, label: "Town Hall 12" },
      { rank: 1, label: "Town Hall 13" },
      { rank: 1, label: "Town Hall 14" },
      { rank: 1, label: "Town Hall 15" },
      { rank: 36, label: "Town Hall 16" }
    ]
  },
  solaceon: {
    fallbackHistory: [
      { label: "Jan", date: "2026-01-01", trophies: 5170, currentRank: 712, attacksWon: 7480, donations: 1980, warStars: 0, clanCapitalContributions: 12400 },
      { label: "Feb", date: "2026-02-01", trophies: 5290, currentRank: 481, attacksWon: 7654, donations: 2260, warStars: 0, clanCapitalContributions: 14750 },
      { label: "Mar", date: "2026-03-01", trophies: 5415, currentRank: 265, attacksWon: 7841, donations: 2810, warStars: 0, clanCapitalContributions: 16980 },
      { label: "Apr", date: "2026-04-01", trophies: 5520, currentRank: 128, attacksWon: 8042, donations: 3260, warStars: 0, clanCapitalContributions: 18840 },
      { label: "May", date: "2026-05-01", trophies: 5602, currentRank: 74, attacksWon: 8244, donations: 3650, warStars: 0, clanCapitalContributions: 20710 },
      { label: "Jun", date: "2026-06-01", trophies: 5684, currentRank: 36, attacksWon: 8421, donations: 3918, warStars: 0, clanCapitalContributions: 22400 }
    ]
  },
  opelucidian: {
    placements: [
      { rank: 1, label: "Town Hall 13", date: "June 2026" }
    ]
  }
};

const rankedFinishes = {
  /*
    Add exact weekly finishes here if you record them manually:

    solaceonx: {
      "2026-06-22": 21
    }
  */
};

async function loadEnvToken() {
  if (process.env.COC_API_TOKEN) return process.env.COC_API_TOKEN.trim();

  try {
    const env = await readFile(new URL("../.env", import.meta.url), "utf8");
    const line = env.split(/\r?\n/).find(item => item.trim().startsWith("COC_API_TOKEN="));
    if (!line) return "";
    return line.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "");
  } catch {
    return "";
  }
}

async function readJson(url, fallback) {
  try {
    return JSON.parse(await readFile(url, "utf8"));
  } catch {
    return fallback;
  }
}

function achievementValue(player, name) {
  return player.achievements?.find(achievement => achievement.name === name)?.value ?? null;
}

function progressPercent(items = []) {
  const usable = items.filter(item =>
    typeof item.level === "number" &&
    typeof item.maxLevel === "number" &&
    item.maxLevel > 0 &&
    (!item.village || item.village === "home")
  );

  if (!usable.length) return 0;
  const current = usable.reduce((sum, item) => sum + item.level, 0);
  const max = usable.reduce((sum, item) => sum + item.maxLevel, 0);
  return Math.round((current / max) * 100);
}

function snapshotFromPlayer(account, player) {
  const today = new Date().toISOString().slice(0, 10);
  const capitalGold = player.clanCapitalContributions ?? achievementValue(player, "Aggressive Capitalism");
  const attacksWon = achievementValue(player, "Conqueror") ?? player.attackWins;
  const donations = achievementValue(player, "Friend in Need") ?? player.donations;
  const warStars = player.warStars ?? achievementValue(player, "War Hero");

  return {
    id: account.id,
    date: today,
    label: new Date(`${today}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    fetchedAt: new Date().toISOString(),
    townHall: player.townHallLevel ?? null,
    trophies: player.trophies ?? null,
    bestTrophies: player.bestTrophies ?? null,
    leagueTier: player.leagueTier ? {
      id: player.leagueTier.id ?? null,
      name: player.leagueTier.name ?? "Unranked",
      iconUrls: player.leagueTier.iconUrls ?? {}
    } : null,
    currentLeagueSeasonId: player.currentLeagueSeasonId ?? null,
    currentLeagueGroupTag: player.currentLeagueGroupTag ?? null,
    attackWins: player.attackWins ?? null,
    defenseWins: player.defenseWins ?? null,
    attacksWon,
    donations,
    donationsReceived: player.donationsReceived ?? null,
    warStars,
    clanCapitalContributions: capitalGold,
    heroesProgress: progressPercent(player.heroes),
    troopsProgress: progressPercent(player.troops),
    spellsProgress: progressPercent(player.spells),
    equipmentProgress: progressPercent(player.heroEquipment)
  };
}

async function fetchPlayer(account, token) {
  const response = await fetch(`${API_BASE}/players/${encodeURIComponent(account.tag)}`, {
    headers: { authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${account.name} ${account.tag}: ${response.status} ${response.statusText} ${body}`);
  }

  return response.json();
}

function compactHistory(history) {
  const byDate = new Map();
  for (const point of history) byDate.set(point.date, point);
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function weekStart(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  const day = date.getDay();
  const daysSinceMonday = (day + 6) % 7;
  date.setDate(date.getDate() - daysSinceMonday);
  return date.toISOString().slice(0, 10);
}

function weekLabel(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function rankedResult(current, next) {
  if (!next) return "Tracking";
  const currentTier = current.leagueTier?.id;
  const nextTier = next.leagueTier?.id;
  if (typeof currentTier !== "number" || typeof nextTier !== "number") return "—";
  if (nextTier > currentTier) return "Promoted";
  if (nextTier < currentTier) return "Demoted";
  return "Stayed";
}

function buildRankedHistory(account, history) {
  const weekly = new Map();
  for (const point of history) {
    if (!point.date) continue;
    weekly.set(weekStart(point.date), point);
  }

  const rows = [...weekly.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, point]) => ({
      week,
      label: weekLabel(week),
      league: point.leagueTier?.name || "Unranked",
      leagueTierId: point.leagueTier?.id ?? null,
      finish: rankedFinishes[account.id]?.[week] ?? null,
      endingTrophies: point.trophies ?? null
    }));

  return rows.map((row, index) => ({
    ...row,
    result: rankedResult(row, rows[index + 1])
  }));
}

function buildAccountData(account, snapshots) {
  const accountManual = manual[account.id] || {};
  const liveHistory = snapshots[account.id] || [];
  const history = compactHistory([
    ...(liveHistory.length ? [] : accountManual.fallbackHistory || []),
    ...liveHistory
  ]);
  const latest = history.at(-1) || {};
  const hasLive = Boolean(liveHistory.length);
  const progress = {
    Heroes: latest.heroesProgress ?? 0,
    Troops: latest.troopsProgress ?? 0,
    Spells: latest.spellsProgress ?? 0,
    Equipment: latest.equipmentProgress ?? 0
  };

  return {
    ...account,
    townHall: latest.townHall ?? "—",
    updatedAt: latest.date ?? null,
    demo: !hasLive,
    trophies: latest.trophies ?? null,
    bestTrophies: latest.bestTrophies ?? null,
    leagueTier: latest.leagueTier ?? null,
    currentLeagueSeasonId: latest.currentLeagueSeasonId ?? null,
    currentLeagueGroupTag: latest.currentLeagueGroupTag ?? null,
    currentRank: latest.currentRank ?? null,
    bestRank: accountManual.bestRank ?? null,
    bestRankLabel: accountManual.bestRankLabel ?? "Add placement history",
    attacksWon: latest.attacksWon ?? latest.attackWins ?? null,
    defenseWins: latest.defenseWins ?? null,
    warStars: latest.warStars ?? null,
    donations: latest.donations ?? null,
    donationsReceived: latest.donationsReceived ?? null,
    clanCapitalContributions: latest.clanCapitalContributions ?? null,
    progress,
    rankedHistory: buildRankedHistory(account, history),
    history,
    activity: {
      "Attacks won": latest.attacksWon ?? latest.attackWins ?? 0,
      Donations: latest.donations ?? 0,
      "War stars": latest.warStars ?? 0,
      "Capital gold": latest.clanCapitalContributions ?? 0
    },
    placements: accountManual.placements || []
  };
}

const token = await loadEnvToken();
if (!token) {
  throw new Error("Missing COC_API_TOKEN. Add it to .env or export it before running this script.");
}

const snapshots = await readJson(SNAPSHOT_PATH, {});

for (const account of accounts) {
  const player = await fetchPlayer(account, token);
  const snapshot = snapshotFromPlayer(account, player);
  snapshots[account.id] ||= [];
  snapshots[account.id].push(snapshot);
  snapshots[account.id] = compactHistory(snapshots[account.id]);
  console.log(`Saved ${account.name} (${account.tag}) TH${snapshot.townHall ?? "—"} · ${snapshot.trophies ?? "—"} trophies`);
}

await writeFile(SNAPSHOT_PATH, `${JSON.stringify(snapshots, null, 2)}\n`);

const data = accounts.map(account => buildAccountData(account, snapshots));
await writeFile(DATA_PATH, `window.COC_ACCOUNTS = ${JSON.stringify(data, null, 2)};\n`);

console.log("Updated coc-snapshots.json and coc-data.js.");
