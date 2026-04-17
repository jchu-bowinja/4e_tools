import type { Ability, AsiChoices } from "./models";

/**
 * PHB-style feat schedule: one feat gained at each listed level (includes the 1st-level starting feat).
 * Not gained at 3, 5, 7, 9, 13, 15, 17, 19, 23, 25, 27, 29.
 */
export const FEAT_GAIN_LEVELS: readonly number[] = [1, 2, 4, 6, 8, 10, 11, 12, 14, 16, 18, 20, 21, 22, 24, 26, 28, 30];

/** Levels at which you choose +1 to two different ability scores (PHB). */
export const ASI_TWO_CHOICE_LEVELS: readonly number[] = [4, 8, 14, 18, 24, 28];

/** Automatic +1 to all abilities at these tiers (PHB). */
export const ASI_ALL_ABILITIES_LEVELS: readonly number[] = [11, 21];

export function totalFeatSlots(level: number, humanBonusFeat: boolean): number {
  let n = 0;
  for (const L of FEAT_GAIN_LEVELS) {
    if (L <= level) n += 1;
  }
  return n + (humanBonusFeat ? 1 : 0);
}

export function isHumanRace(raceName: string | undefined): boolean {
  return (raceName || "").trim().toLowerCase() === "human";
}

/** Class attack encounter powers known by level (PHB progression). */
export function expectedClassEncounterAttackSlots(level: number): number {
  if (level <= 2) return 1;
  if (level <= 6) return 2;
  if (level <= 12) return 3;
  return 4;
}

/** Class attack daily powers known by level (PHB progression). */
export function expectedClassDailyAttackSlots(level: number): number {
  if (level <= 4) return 1;
  if (level <= 8) return 2;
  if (level <= 14) return 3;
  return 4;
}

/**
 * At-will attack powers from class: 2 for all races; humans gain a third class at-will at 1st (PHB).
 */
export function expectedClassAtWillAttackSlots(level: number, human: boolean): number {
  if (level < 1) return 0;
  return 2 + (human ? 1 : 0);
}

/**
 * Class utility powers gained (PHB-style schedule used by core classes).
 * Gained at 2, 6, 10, 12, 16, 22, 26.
 */
export function expectedClassUtilityPowerCount(level: number): number {
  if (level < 2) return 0;
  if (level < 6) return 1;
  if (level < 10) return 2;
  if (level < 12) return 3;
  if (level < 16) return 4;
  if (level < 22) return 5;
  if (level < 26) return 6;
  return 7;
}

export type AsiPair = { first: Ability; second: Ability };

export function asiBonusesFromChoices(level: number, asiChoices: AsiChoices | undefined): Partial<Record<Ability, number>> {
  const out: Partial<Record<Ability, number>> = {};
  for (const m of ASI_TWO_CHOICE_LEVELS) {
    if (level < m) continue;
    const pick = asiChoices?.[String(m)] as AsiPair | undefined;
    if (!pick?.first || !pick?.second) continue;
    if (pick.first === pick.second) continue;
    out[pick.first] = (out[pick.first] || 0) + 1;
    out[pick.second] = (out[pick.second] || 0) + 1;
  }
  return out;
}

/** +1 to every ability at 11 and 21 (PHB). */
export function tierAllAbilityBonus(level: number): number {
  let n = 0;
  for (const L of ASI_ALL_ABILITIES_LEVELS) {
    if (level >= L) n += 1;
  }
  return n;
}

export function applyAsiBonusesToScores(
  base: Record<Ability, number>,
  level: number,
  asiChoices: AsiChoices | undefined
): Record<Ability, number> {
  const next: Record<Ability, number> = { ...base };
  const pairBonuses = asiBonusesFromChoices(level, asiChoices);
  for (const ab of ["STR", "CON", "DEX", "INT", "WIS", "CHA"] as Ability[]) {
    next[ab] = (next[ab] || 10) + (pairBonuses[ab] || 0);
  }
  const allBump = tierAllAbilityBonus(level);
  if (allBump > 0) {
    for (const ab of ["STR", "CON", "DEX", "INT", "WIS", "CHA"] as Ability[]) {
      next[ab] = (next[ab] || 10) + allBump;
    }
  }
  return next;
}

export function requiredAsiMilestonesUpTo(level: number): number[] {
  return ASI_TWO_CHOICE_LEVELS.filter((m) => m <= level);
}
