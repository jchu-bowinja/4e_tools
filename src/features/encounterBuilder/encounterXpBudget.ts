import { standardMonsterXpForLevel } from "../monsterEditor/monsterLevelDelta";

export type EncounterDifficulty = "easy" | "standard" | "hard";

/**
 * DMG: easy ≈ party−2, standard ≈ party to party+1, hard ≈ party+2 to party+4.
 * We pick a single encounter level within those bands as the XP budget index.
 */
export function encounterLevelForDifficulty(partyLevel: number, difficulty: EncounterDifficulty): number {
  const p = Math.min(30, Math.max(1, Math.trunc(partyLevel)));
  switch (difficulty) {
    case "easy":
      return Math.max(1, p - 2);
    case "standard":
      return p;
    case "hard":
      return Math.min(30, p + 3);
    default:
      return p;
  }
}

/**
 * Target encounter XP (DMG): XP for one standard monster of the encounter's level × number of PCs.
 */
export function targetEncounterXp(encounterLevel: number, pcCount: number): number | undefined {
  const L = Math.trunc(encounterLevel);
  const n = Math.trunc(pcCount);
  if (n < 1) return undefined;
  const base = standardMonsterXpForLevel(L);
  if (base === undefined) return undefined;
  return base * n;
}

/**
 * Allowed monster levels for encounter builder picks: within one level of the party (DMG still allows
 * wider bands for manual builds; the generator stays narrow for predictability).
 */
export function threatLevelBand(partyLevel: number, _difficulty: EncounterDifficulty): { min: number; max: number } {
  const p = Math.min(30, Math.max(1, Math.trunc(partyLevel)));
  return { min: Math.max(1, p - 1), max: Math.min(30, p + 1) };
}
