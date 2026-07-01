import { readFile, writeFile } from "node:fs/promises";

const API_BASE = "https://api.clashroyale.com/v1";
const PLAYER_TAG = "#JL8UYPQC";
const SNAPSHOT_PATH = new URL("../royale-snapshots.json", import.meta.url);
const BATTLE_HISTORY_PATH = new URL("../royale-battle-history.json", import.meta.url);
const DATA_PATH = new URL("../royale-data.js", import.meta.url);
const HERO_CARD_NAMES = [
  "Knight",
  "Giant",
  "Mini P.E.K.K.A",
  "Musketeer",
  "Ice Golem",
  "Wizard",
  "Goblins",
  "Mega Minion",
  "Barbarian Barrel",
  "Magic Archer",
  "Balloon",
  "Bowler",
  "Dark Prince",
  "Tombstone"
];

async function loadEnvToken() {
  if (process.env.CR_API_TOKEN) return process.env.CR_API_TOKEN.trim();

  try {
    const env = await readFile(new URL("../.env", import.meta.url), "utf8");
    const line = env.split(/\r?\n/).find(item => item.trim().startsWith("CR_API_TOKEN="));
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

function compactHistory(history) {
  const byDate = new Map();
  for (const point of history) byDate.set(point.date, point);
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
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

function battleResult(battle) {
  const teamCrowns = battle.team?.[0]?.crowns ?? 0;
  const opponentCrowns = battle.opponent?.[0]?.crowns ?? 0;
  if (teamCrowns > opponentCrowns) return "win";
  if (teamCrowns < opponentCrowns) return "loss";
  return "draw";
}

function battleMode(battle) {
  return battle.gameMode?.name || battle.type || "Battle";
}

function humanizeBattleMode(mode) {
  const labels = {
    Ladder: "Trophy Road",
    TeamVsTeam: "2v2",
    Showdown_Friendly: "Friendly Battle",
    ClanMate: "Friendly Battle",
    Tournament: "Tournament",
    Challenge: "Challenge"
  };
  if (labels[mode]) return labels[mode];
  return String(mode || "Battle")
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

function battleCategory(mode) {
  return /^(ladder|trophy road)$/i.test(String(mode || "")) ? "trophy-road" : "other";
}

function normalizeStoredBattle(battle) {
  const rawMode = battle.mode || "Battle";
  return {
    result: battle.result || "draw",
    mode: humanizeBattleMode(rawMode),
    category: battle.category || battleCategory(rawMode),
    crowns: battle.crowns || "0-0",
    trophyChange: typeof battle.trophyChange === "number" ? battle.trophyChange : null,
    opponent: battle.opponent || null,
    battleTime: battle.battleTime || null
  };
}

function normalizeBattle(battle) {
  const rawMode = battleMode(battle);
  const player = battle.team?.find(member => member.tag === PLAYER_TAG) || battle.team?.[0];
  return normalizeStoredBattle({
    result: battleResult(battle),
    mode: rawMode,
    category: battleCategory(rawMode),
    crowns: `${player?.crowns ?? 0}-${battle.opponent?.[0]?.crowns ?? 0}`,
    trophyChange: player?.trophyChange,
    opponent: battle.opponent?.[0]?.name,
    battleTime: battle.battleTime ?? null
  });
}

function battleKey(battle) {
  return battle.battleTime || [
    battle.result,
    battle.mode,
    battle.crowns,
    battle.opponent
  ].join("|");
}

function mergeBattleHistory(existing, snapshots, currentBattles) {
  const merged = new Map();
  const candidates = [
    ...existing,
    ...snapshots.flatMap(snapshot => snapshot.recentBattles || []),
    ...currentBattles
  ];

  for (const candidate of candidates) {
    const battle = normalizeStoredBattle(candidate);
    merged.set(battleKey(battle), battle);
  }

  return [...merged.values()]
    .sort((a, b) => String(b.battleTime || "").localeCompare(String(a.battleTime || "")))
    .slice(0, 5000);
}

function isMode(battle, pattern) {
  const text = `${battleMode(battle)} ${battle.type || ""}`.toLowerCase();
  return pattern.test(text);
}

function summarizeBattles(battles) {
  const recentBattles = battles.slice(0, 20);
  const finished = recentBattles.filter(battle => battleResult(battle) !== "draw");
  const wins = finished.filter(battle => battleResult(battle) === "win").length;
  const losses = finished.length - wins;

  return {
    recentWins: wins,
    recentLosses: losses,
    recentWinRate: finished.length ? Math.round((wins / finished.length) * 100) : null,
    recentBattles: recentBattles.map(normalizeBattle),
    twoVTwo: summarizeMode(battles, /2v2|2-vs-2|party/),
    challenges: summarizeMode(battles, /challenge|grand|classic/),
    pathOfLegends: summarizeMode(battles, /path|league|ranked/)
  };
}

function summarizeMode(battles, pattern) {
  const modeBattles = battles.filter(battle => isMode(battle, pattern));
  const decided = modeBattles.filter(battle => battleResult(battle) !== "draw");
  const wins = decided.filter(battle => battleResult(battle) === "win").length;
  const losses = decided.length - wins;
  return {
    wins,
    losses,
    games: decided.length,
    winRate: decided.length ? Math.round((wins / decided.length) * 100) : null
  };
}

function percentFrom(current, max) {
  if (!max) return 0;
  return Math.round((current / max) * 100);
}

function displayLevel(item) {
  if (typeof item.level !== "number") return null;
  if (typeof item.maxLevel !== "number") return item.level;
  return item.level + Math.max(0, 16 - item.maxLevel);
}

function displayMaxLevel(item) {
  if (typeof item.maxLevel !== "number") return null;
  return item.maxLevel + Math.max(0, 16 - item.maxLevel);
}

function levelProgress(items = []) {
  const usable = items.filter(item =>
    typeof item.level === "number" &&
    typeof item.maxLevel === "number" &&
    item.maxLevel > 0
  );

  const current = usable.reduce((sum, item) => sum + displayLevel(item), 0);
  const max = usable.reduce((sum, item) => sum + displayMaxLevel(item), 0);
  const maxed = usable.filter(item => displayLevel(item) >= displayMaxLevel(item)).length;

  return {
    current,
    max,
    total: usable.length,
    maxed,
    percent: percentFrom(current, max)
  };
}

function evolutionProgress(cards = []) {
  const evolvable = cards.filter(card =>
    typeof card.maxEvolutionLevel === "number" &&
    card.maxEvolutionLevel > 0
  );

  const current = evolvable.reduce((sum, card) => sum + (card.evolutionLevel || 0), 0);
  const max = evolvable.reduce((sum, card) => sum + card.maxEvolutionLevel, 0);
  const unlocked = evolvable.filter(card => (card.evolutionLevel || 0) >= card.maxEvolutionLevel).length;

  return {
    current,
    max,
    total: evolvable.length,
    unlocked,
    percent: percentFrom(current, max)
  };
}

function levelDistribution(cards = []) {
  const usable = cards.filter(card => typeof displayLevel(card) === "number");
  const total = usable.length;
  const byLevel = new Map();

  for (const card of usable) {
    const level = displayLevel(card);
    byLevel.set(level, (byLevel.get(level) || 0) + 1);
  }

  return [...byLevel.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([level, count]) => ({
      level,
      count,
      percent: total ? Math.round((count / total) * 1000) / 10 : 0
    }));
}

function collectionProgress(player) {
  const cards = player.cards || [];
  const heroCards = cards.filter(card => HERO_CARD_NAMES.includes(card.name));
  const unlockedHeroes = heroCards.filter(card => Boolean(card.evolutionLevel));
  const maxedCards = cards.filter(card => displayLevel(card) >= displayMaxLevel(card)).length;

  return {
    cardLevels: levelProgress(cards),
    maxedCards: {
      current: maxedCards,
      total: cards.length,
      percent: percentFrom(maxedCards, cards.length),
      levelDistribution: levelDistribution(cards)
    },
    evolutions: evolutionProgress(cards),
    heroes: {
      unlocked: unlockedHeroes.length,
      total: HERO_CARD_NAMES.length,
      percent: percentFrom(unlockedHeroes.length, HERO_CARD_NAMES.length),
      names: unlockedHeroes.map(card => card.name)
    },
    towerTroops: levelProgress(player.supportCards || [])
  };
}

function snapshotFrom(player, battles) {
  const date = todayKey();
  const battleSummary = summarizeBattles(battles);

  return {
    date,
    label: labelFor(date),
    fetchedAt: new Date().toISOString(),
    tag: player.tag ?? PLAYER_TAG,
    name: player.name ?? "Clash Royale",
    trophies: player.trophies ?? null,
    bestTrophies: player.bestTrophies ?? null,
    expLevel: player.expLevel ?? null,
    wins: player.wins ?? null,
    losses: player.losses ?? null,
    battleCount: player.battleCount ?? null,
    threeCrownWins: player.threeCrownWins ?? null,
    challengeCardsWon: player.challengeCardsWon ?? null,
    challengeMaxWins: player.challengeMaxWins ?? null,
    tournamentCardsWon: player.tournamentCardsWon ?? null,
    tournamentBattleCount: player.tournamentBattleCount ?? null,
    favoriteCard: player.currentFavouriteCard?.name ?? null,
    currentDeck: (player.currentDeck || []).map(card => ({
      name: card.name,
      level: card.level ?? null,
      maxLevel: card.maxLevel ?? null,
      iconUrl: card.iconUrls?.medium || card.iconUrls?.large || null
    })),
    collectionProgress: collectionProgress(player),
    ...battleSummary
  };
}

function latestOrFallback(history) {
  return history.at(-1) || {
    date: null,
    label: "Now",
    trophies: 8124,
    bestTrophies: 8420,
    wins: 0,
    losses: 0,
    recentWins: 0,
    recentLosses: 0,
    recentWinRate: null,
    recentBattles: [],
    collectionProgress: {
      cardLevels: { current: 0, max: 0, total: 0, maxed: 0, percent: 0 },
      maxedCards: { current: 0, total: 0, percent: 0 },
      evolutions: { current: 0, max: 0, total: 0, unlocked: 0, percent: 0 },
      heroes: { unlocked: 0, total: HERO_CARD_NAMES.length, percent: 0, names: [] },
      towerTroops: { current: 0, max: 0, total: 0, maxed: 0, percent: 0 }
    },
    twoVTwo: { wins: 0, losses: 0, games: 0, winRate: null },
    challenges: { wins: 0, losses: 0, games: 0, winRate: null },
    pathOfLegends: { wins: 0, losses: 0, games: 0, winRate: null }
  };
}

function buildPageData(history, battleHistory) {
  const latest = latestOrFallback(history);
  const battleWinRate = latest.recentWinRate ?? null;
  const recentTrackedBattles = battleHistory.slice(0, 200);
  const trophyRoadBattles = recentTrackedBattles
    .filter(battle => battle.category === "trophy-road")
    .slice(0, 30);
  const otherBattles = recentTrackedBattles
    .filter(battle => battle.category !== "trophy-road")
    .slice(0, 20);
  const summarizeTracked = battles => {
    const decided = battles.filter(battle => battle.result !== "draw");
    const wins = decided.filter(battle => battle.result === "win").length;
    const losses = decided.filter(battle => battle.result === "loss").length;
    const trophyChange = battles.reduce(
      (total, battle) => total + (typeof battle.trophyChange === "number" ? battle.trophyChange : 0),
      0
    );
    return {
      wins,
      losses,
      games: battles.length,
      winRate: decided.length ? Math.round((wins / decided.length) * 1000) / 10 : null,
      trophyChange
    };
  };
  const overallWinRate = latest.wins + latest.losses
    ? Math.round((latest.wins / (latest.wins + latest.losses)) * 1000) / 10
    : null;

  return {
    updatedAt: latest.date ? `Updated ${latest.date}` : "Waiting for Clash Royale snapshot",
    tag: latest.tag ?? PLAYER_TAG,
    name: latest.name ?? "Clash Royale",
    currentTrophies: latest.trophies,
    bestTrophies: latest.bestTrophies,
    recentWinRate: battleWinRate,
    overallWinRate,
    totalGames: latest.battleCount ?? (latest.wins ?? 0) + (latest.losses ?? 0),
    favoriteCard: latest.favoriteCard,
    currentDeck: latest.currentDeck || [],
    collectionProgress: latest.collectionProgress,
    trophyHistory: history.map(point => ({
      label: point.label || labelFor(point.date),
      date: point.date,
      trophies: point.trophies
    })).filter(point => typeof point.trophies === "number"),
    winHistory: history.map(point => ({
      label: point.label || labelFor(point.date),
      date: point.date,
      wins: point.wins
    })).filter(point => typeof point.wins === "number"),
    lossHistory: history.map(point => ({
      label: point.label || labelFor(point.date),
      date: point.date,
      losses: point.losses
    })).filter(point => typeof point.losses === "number"),
    gameHistory: history.map(point => ({
      label: point.label || labelFor(point.date),
      date: point.date,
      games: point.battleCount ?? (point.wins ?? 0) + (point.losses ?? 0)
    })).filter(point => typeof point.games === "number"),
    overallWinRateHistory: history.map(point => ({
      label: point.label || labelFor(point.date),
      date: point.date,
      winRate: point.wins + point.losses
        ? Math.round((point.wins / (point.wins + point.losses)) * 1000) / 10
        : null
    })).filter(point => typeof point.winRate === "number"),
    battleHistory: recentTrackedBattles,
    recentBattles: recentTrackedBattles.slice(0, 20),
    trophyRoadBattles,
    trophyRoadSummary: summarizeTracked(trophyRoadBattles),
    otherBattles,
    otherBattlesSummary: summarizeTracked(otherBattles),
    modes: [
      {
        label: "2v2",
        wins: latest.twoVTwo?.wins ?? 0,
        losses: latest.twoVTwo?.losses ?? 0,
        note: "Recent 2v2 games from the battle log."
      },
      {
        label: "Challenges",
        wins: latest.challenges?.wins ?? 0,
        losses: latest.challenges?.losses ?? 0,
        note: `Best challenge run: ${latest.challengeMaxWins ?? "—"} wins.`
      },
      {
        label: "Path of Legends",
        wins: latest.pathOfLegends?.wins ?? 0,
        losses: latest.pathOfLegends?.losses ?? 0,
        note: "Recent ranked games when the API labels them clearly."
      },
      {
        label: "Lifetime",
        wins: latest.wins ?? 0,
        losses: latest.losses ?? 0,
        note: `${latest.threeCrownWins ?? "—"} three-crown wins.`
      }
    ],
    history
  };
}

const token = await loadEnvToken();
if (!token) {
  throw new Error("Missing CR_API_TOKEN. Add it to .env before running this script.");
}

const encodedTag = encodeURIComponent(PLAYER_TAG);
const [player, battlelog] = await Promise.all([
  fetchJson(`/players/${encodedTag}`, token),
  fetchJson(`/players/${encodedTag}/battlelog`, token)
]);

const snapshot = snapshotFrom(player, Array.isArray(battlelog) ? battlelog : []);
const history = compactHistory([
  ...(await readJson(SNAPSHOT_PATH, [])),
  snapshot
]);
const battleHistory = mergeBattleHistory(
  await readJson(BATTLE_HISTORY_PATH, []),
  history,
  snapshot.recentBattles
);

await writeFile(SNAPSHOT_PATH, `${JSON.stringify(history, null, 2)}\n`);
await writeFile(BATTLE_HISTORY_PATH, `${JSON.stringify(battleHistory, null, 2)}\n`);
await writeFile(DATA_PATH, `window.ROYALE_DATA = ${JSON.stringify(buildPageData(history, battleHistory), null, 2)};\n`);

console.log(`Saved Clash Royale snapshot for ${snapshot.name} (${snapshot.tag}) · ${snapshot.trophies ?? "—"} trophies`);
console.log(`Tracked ${battleHistory.length} unique battles.`);
console.log("Updated royale-snapshots.json, royale-battle-history.json, and royale-data.js.");
