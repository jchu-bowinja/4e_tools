import type { MonsterIndexEntry } from "../monsterEditor/storage";
import { detectMonsterRank } from "../monsterEditor/monsterIndexFilters";
import { standardMonsterXpForLevel } from "../monsterEditor/monsterLevelDelta";
import {
  encounterLevelForDifficulty,
  targetEncounterXp,
  threatLevelBand,
  type EncounterDifficulty
} from "./encounterXpBudget";

export type EncounterTemplateKind = "balanced" | "commander" | "wolfPack" | "doubleLine" | "dragonsDen";

export interface GenerateEncounterRosterInput {
  indexRows: MonsterIndexEntry[];
  partyLevel: number;
  pcCount: number;
  difficulty: EncounterDifficulty;
  template: EncounterTemplateKind;
  /** Prefer creatures whose names share tokens with a random seed (weak thematic tie-in). */
  thematicClustering: boolean;
  /** Optional RNG in [0,1); defaults to Math.random (not seeded). */
  random?: () => number;
}

export interface GeneratedEncounterRosterPick {
  id: string;
  name: string;
  estimatedXp: number;
  level: number;
}

export interface GenerateEncounterRosterResult {
  ok: true;
  encounterLevel: number;
  targetXp: number;
  actualEstimatedXp: number;
  picks: GeneratedEncounterRosterPick[];
  /** Short DM-facing blurb; not a substitute for real scene prep. */
  encounterBlurb: string;
  notes: string[];
}

export interface GenerateEncounterRosterError {
  ok: false;
  error: string;
}

export type GenerateEncounterRosterOutcome = GenerateEncounterRosterResult | GenerateEncounterRosterError;

const RANK_XP_MULT = { minion: 0.25, standard: 1, elite: 2, solo: 5 } as const;

const NAME_STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "of",
  "and",
  "elite",
  "minion",
  "standard",
  "large",
  "medium",
  "small",
  "huge",
  "gargantuan",
  "young",
  "adult",
  "elder",
  "ancient"
]);

export function estimateXpForIndexRow(entry: MonsterIndexEntry): number | undefined {
  const level = Number(entry.level);
  if (!Number.isFinite(level)) return undefined;
  const L = Math.trunc(level);
  if (L < 1 || L > 30) return undefined;
  const base = standardMonsterXpForLevel(L);
  if (base === undefined) return undefined;
  const rank = detectMonsterRank(entry);
  const mult = RANK_XP_MULT[rank];
  return Math.max(0, Math.round(base * mult));
}

function randFn(input?: () => number): () => number {
  return typeof input === "function" ? input : Math.random;
}

function shuffleInPlace<T>(arr: T[], rand: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = t;
  }
}

export function nameTokens(name: string): string[] {
  return String(name ?? "")
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter((t) => t.length > 2 && !NAME_STOPWORDS.has(t));
}

function thematicScore(seedName: string, otherName: string): number {
  const a = new Set(nameTokens(seedName));
  if (a.size === 0) return 0;
  let s = 0;
  for (const t of nameTokens(otherName)) {
    if (a.has(t)) s++;
  }
  return s;
}

type IndexedCandidate = {
  entry: MonsterIndexEntry;
  xp: number;
  level: number;
  lane: "front" | "mid" | "back";
  rank: ReturnType<typeof detectMonsterRank>;
};

function combatLane(role: string): "front" | "mid" | "back" {
  const r = role.toLowerCase();
  if (r.includes("brute") || r.includes("soldier")) return "front";
  if (r.includes("artillery") || r.includes("controller")) return "back";
  return "mid";
}

function buildCandidates(
  rows: MonsterIndexEntry[],
  band: { min: number; max: number },
  opts?: { includeSolo?: boolean }
): IndexedCandidate[] {
  const includeSolo = opts?.includeSolo === true;
  const out: IndexedCandidate[] = [];
  for (const entry of rows) {
    if (String(entry.parseError ?? "").trim()) continue;
    const xp = estimateXpForIndexRow(entry);
    if (xp === undefined || xp <= 0) continue;
    const level = Number(entry.level);
    if (!Number.isFinite(level)) continue;
    const L = Math.trunc(level);
    if (L < band.min || L > band.max) continue;
    const rank = detectMonsterRank(entry);
    if (!includeSolo && rank === "solo") continue;
    out.push({
      entry,
      xp,
      level: L,
      lane: combatLane(entry.role ?? ""),
      rank
    });
  }
  return out;
}

function pickRandomWeightedTowardBudget(pool: IndexedCandidate[], budgetRemaining: number, rand: () => number): IndexedCandidate | null {
  if (pool.length === 0) return null;
  /** Prefer creatures that close the gap without overshooting. */
  const scored = pool.map((c) => {
    const over = c.xp > budgetRemaining;
    const gap = budgetRemaining - c.xp;
    const fit = over ? 1e6 + c.xp : Math.abs(gap);
    return { c, fit };
  });
  scored.sort((a, b) => a.fit - b.fit);
  const topK = Math.min(8, scored.length);
  const slice = scored.slice(0, topK);
  const idx = Math.floor(rand() * slice.length);
  return slice[idx]!.c;
}

function greedyCompose(
  starters: IndexedCandidate[],
  budget: number,
  rand: () => number,
  opts: { maxCreatures: number; maxBudgetRatio: number }
): IndexedCandidate[] {
  const picks: IndexedCandidate[] = [];
  let sum = 0;
  const maxSum = budget * opts.maxBudgetRatio;

  const pool = [...starters];
  shuffleInPlace(pool, rand);

  while (picks.length < opts.maxCreatures && sum < budget * 0.92) {
    const remain = maxSum - sum;
    if (remain <= 0) break;
    const viable = pool.filter((c) => sum + c.xp <= maxSum);
    if (viable.length === 0) break;
    const next = pickRandomWeightedTowardBudget(viable, budget - sum, rand);
    if (!next) break;
    picks.push(next);
    sum += next.xp;
    if (sum >= budget * 0.88 && sum <= maxSum) break;
  }

  // Top up if still very low
  if (sum < budget * 0.65 && picks.length < opts.maxCreatures) {
    for (let guard = 0; guard < 12 && sum < budget * 0.75; guard++) {
      const remain = maxSum - sum;
      const viable = pool.filter((c) => c.xp <= remain);
      if (viable.length === 0) break;
      const smallestFit = [...viable].sort((a, b) => a.xp - b.xp)[0];
      if (!smallestFit || sum + smallestFit.xp > maxSum) break;
      picks.push(smallestFit);
      sum += smallestFit.xp;
    }
  }

  return picks;
}

function composeCommander(candidates: IndexedCandidate[], budget: number, rand: () => number): IndexedCandidate[] {
  const leaders = candidates.filter(
    (c) => c.entry.role.toLowerCase().includes("controller") || c.entry.role.toLowerCase().includes("soldier")
  );
  const troops = candidates.filter((c) => {
    const r = c.entry.role.toLowerCase();
    return r.includes("brute") || r.includes("soldier");
  });
  shuffleInPlace(leaders, rand);
  shuffleInPlace(troops, rand);
  const leader = leaders[0];
  const pool: IndexedCandidate[] = leader ? [leader, ...troops.filter((t) => t.entry.id !== leader.entry.id)] : [...troops];
  if (pool.length === 0) return greedyCompose(candidates, budget, rand, { maxCreatures: 12, maxBudgetRatio: 1.1 });
  return greedyCompose(pool, budget, rand, { maxCreatures: 12, maxBudgetRatio: 1.1 });
}

function composeWolfPack(candidates: IndexedCandidate[], budget: number, rand: () => number): IndexedCandidate[] {
  const wolves = candidates.filter((c) => c.entry.role.toLowerCase().includes("skirmisher"));
  if (wolves.length === 0) return greedyCompose(candidates, budget, rand, { maxCreatures: 14, maxBudgetRatio: 1.1 });
  return greedyCompose(wolves, budget, rand, { maxCreatures: 14, maxBudgetRatio: 1.08 });
}

function composeDoubleLine(candidates: IndexedCandidate[], budget: number, rand: () => number): IndexedCandidate[] {
  const front = candidates.filter((c) => c.lane === "front");
  const back = candidates.filter((c) => c.lane === "back");
  shuffleInPlace(front, rand);
  shuffleInPlace(back, rand);
  const seeds: IndexedCandidate[] = [];
  if (front[0]) seeds.push(front[0]!);
  if (front[1]) seeds.push(front[1]!);
  if (back[0]) seeds.push(back[0]!);
  const pool = seeds.length > 0 ? [...new Map([...seeds, ...candidates].map((c) => [c.entry.id, c])).values()] : candidates;
  return greedyCompose(pool, budget, rand, { maxCreatures: 12, maxBudgetRatio: 1.1 });
}

function composeDragonsDen(candidates: IndexedCandidate[], budget: number, rand: () => number): IndexedCandidate[] {
  const solos = candidates.filter((c) => c.rank === "solo");
  if (solos.length === 0) return [];
  shuffleInPlace(solos, rand);
  const fit = solos.filter((s) => s.xp <= budget * 1.12).sort((a, b) => Math.abs(budget - b.xp) - Math.abs(budget - a.xp));
  const best = fit[0];
  if (!best) return [];
  if (best.xp >= budget * 0.75) return [best];
  return greedyCompose([best, ...solos], budget, rand, { maxCreatures: 6, maxBudgetRatio: 1.15 });
}

function applyThematicOrdering(candidates: IndexedCandidate[], rand: () => number): IndexedCandidate[] {
  if (candidates.length < 2) return candidates;
  const shuffled = [...candidates];
  shuffleInPlace(shuffled, rand);
  const seed = shuffled[0]!;
  if (nameTokens(seed.entry.name).length === 0) return shuffled;
  const copy = [...candidates].sort(
    (a, b) => thematicScore(seed.entry.name, b.entry.name) - thematicScore(seed.entry.name, a.entry.name)
  );
  return copy;
}

function buildBlurb(input: {
  template: EncounterTemplateKind;
  difficulty: EncounterDifficulty;
  partyLevel: number;
  picks: GeneratedEncounterRosterPick[];
}): string {
  const names = input.picks.slice(0, 4).map((p) => p.name);
  const tail = input.picks.length > 4 ? ` (+${input.picks.length - 4} more)` : "";
  const focus = names.length > 0 ? names.join(", ") : "creatures drawn from your index";
  const tone =
    input.difficulty === "easy"
      ? "lighter pressure"
      : input.difficulty === "hard"
        ? "sharp danger"
        : "solid challenge";
  const frame =
    input.template === "dragonsDen"
      ? "A standout boss-style fight"
      : input.template === "commander"
        ? "A leader directing troops"
        : input.template === "wolfPack"
          ? "A mobile pack tearing at the party"
          : input.template === "doubleLine"
            ? "A front rank holding the line while support strikes from behind"
            : "A mixed-role skirmish";
  return `${frame} for level ${input.picks[0]?.level ?? input.partyLevel} threats (${tone}). Spotlight: ${focus}${tail}. Tune terrain and motives to sell the scene.`;
}

export function generateEncounterRosterPlan(input: GenerateEncounterRosterInput): GenerateEncounterRosterOutcome {
  const rand = randFn(input.random);
  const partyLevel = Math.trunc(input.partyLevel);
  const pcCount = Math.trunc(input.pcCount);

  if (!Number.isFinite(partyLevel) || partyLevel < 1 || partyLevel > 30) {
    return { ok: false, error: "Party level must be between 1 and 30." };
  }
  if (!Number.isFinite(pcCount) || pcCount < 1 || pcCount > 12) {
    return { ok: false, error: "Party size should be between 1 and 12." };
  }

  const encounterLevel = encounterLevelForDifficulty(partyLevel, input.difficulty);
  const budget = targetEncounterXp(encounterLevel, pcCount);
  if (budget === undefined) {
    return { ok: false, error: "Could not compute target XP for this party." };
  }

  const band = threatLevelBand(partyLevel, input.difficulty);
  const candidatesNoSolo = buildCandidates(input.indexRows, band, { includeSolo: false });
  let candidates =
    input.template === "dragonsDen"
      ? buildCandidates(input.indexRows, band, { includeSolo: true })
      : candidatesNoSolo;
  const notes: string[] = [];

  if (candidates.length === 0) {
    return {
      ok: false,
      error: "No usable monsters in your loaded index for this level band and XP estimates. Load monsters or widen filters."
    };
  }

  if (input.thematicClustering) {
    candidates = applyThematicOrdering(candidates, rand);
  } else {
    shuffleInPlace(candidates, rand);
  }

  let composed: IndexedCandidate[] = [];
  if (input.template === "commander") {
    composed = composeCommander(candidates, budget, rand);
    if (composed.length === 0) {
      notes.push("Commander template fell back to a balanced mix (no suitable leaders/troops).");
      composed = greedyCompose(candidates, budget, rand, { maxCreatures: 12, maxBudgetRatio: 1.1 });
    }
  } else if (input.template === "wolfPack") {
    composed = composeWolfPack(candidates, budget, rand);
    if (composed.length === 0) {
      notes.push("Wolf pack template fell back to a balanced mix (no skirmishers in band).");
      composed = greedyCompose(candidates, budget, rand, { maxCreatures: 14, maxBudgetRatio: 1.1 });
    }
  } else if (input.template === "doubleLine") {
    composed = composeDoubleLine(candidates, budget, rand);
  } else if (input.template === "dragonsDen") {
    composed = composeDragonsDen(candidates, budget, rand);
    if (composed.length === 0) {
      notes.push("Dragon's den needs a solo in level band; falling back to balanced mix.");
      composed = greedyCompose(candidatesNoSolo, budget, rand, { maxCreatures: 10, maxBudgetRatio: 1.1 });
    }
  } else {
    composed = greedyCompose(candidates, budget, rand, { maxCreatures: 12, maxBudgetRatio: 1.1 });
  }

  if (composed.length === 0) {
    return { ok: false, error: "Could not assemble a roster under the XP budget with current monsters." };
  }

  const picks: GeneratedEncounterRosterPick[] = composed.map((c) => ({
    id: c.entry.id,
    name: c.entry.name,
    estimatedXp: c.xp,
    level: c.level
  }));

  const actualEstimatedXp = picks.reduce((s, p) => s + p.estimatedXp, 0);
  const blurb = buildBlurb({
    template: input.template,
    difficulty: input.difficulty,
    partyLevel,
    picks
  });

  if (actualEstimatedXp < budget * 0.7) {
    notes.push("Total XP is well under budget — consider harder difficulty, higher encounter level, or manual adds.");
  } else if (actualEstimatedXp > budget * 1.15) {
    notes.push("Total XP may read higher than the chosen encounter level; review before play.");
  }

  return {
    ok: true,
    encounterLevel,
    targetXp: budget,
    actualEstimatedXp,
    picks,
    encounterBlurb: blurb,
    notes
  };
}
