import type { CharacterBuild, Power, RulesIndex } from "./models";
import { collectMulticlassEntryFeatIds } from "./featGrantFlags";
import { getClassPowersForLevelRange } from "./classPowersQuery";
import { MULTICLASS_POWER_CHAIN } from "./multiclassValidation";

import type { ParagonMulticlassPowers } from "./models";

function selectedFeatNames(index: RulesIndex, build: CharacterBuild): Set<string> {
  const names = new Set<string>();
  for (const id of build.featIds ?? []) {
    const f = index.feats.find((x) => x.id === id);
    if (f?.name) names.add(f.name);
  }
  return names;
}

export function hasFullMulticlassPowerChain(index: RulesIndex, build: CharacterBuild): boolean {
  const names = selectedFeatNames(index, build);
  return MULTICLASS_POWER_CHAIN.every((step) => names.has(step.featName));
}

/** Class id of the multiclass destination (from entry feat CountsAsClass). */
export function multiclassEntryClassId(index: RulesIndex, build: CharacterBuild): string | undefined {
  const entryIds = collectMulticlassEntryFeatIds(index, build);
  if (entryIds.length !== 1) return undefined;
  const feat = index.feats.find((f) => f.id === entryIds[0]);
  return feat?.countsAsClassIds?.[0];
}

export function canChooseParagonMulticlassing(index: RulesIndex, build: CharacterBuild): boolean {
  if (build.level < 11) return false;
  if (!hasFullMulticlassPowerChain(index, build)) return false;
  return Boolean(multiclassEntryClassId(index, build));
}

export function paragonMulticlassAttackPowers(
  index: RulesIndex,
  classId: string,
  maxLevel: number
): Power[] {
  return getClassPowersForLevelRange(index, classId, maxLevel, "attack");
}

export function paragonMulticlassUtilityPowers(
  index: RulesIndex,
  classId: string,
  maxLevel: number
): Power[] {
  return getClassPowersForLevelRange(index, classId, maxLevel, "utility");
}

function usageMatches(power: Power, usage: string): boolean {
  return String(power.usage || "").toLowerCase().includes(usage);
}

export function filterParagonMulticlassAtWillOptions(powers: Power[]): Power[] {
  return powers.filter((p) => usageMatches(p, "at-will"));
}

export function filterParagonMulticlassEncounterOptions(powers: Power[]): Power[] {
  return powers.filter((p) => usageMatches(p, "encounter"));
}

export function filterParagonMulticlassDailyOptions(powers: Power[]): Power[] {
  return powers.filter((p) => usageMatches(p, "daily"));
}

/** PHB paragon multiclassing validation errors. */
export function validateParagonMulticlassing(index: RulesIndex, build: CharacterBuild): string[] {
  const errors: string[] = [];
  if (!build.paragonMulticlassing) return errors;

  if (build.level < 11) {
    errors.push("Paragon multiclassing is only available at level 11 or higher.");
    return errors;
  }

  if (build.paragonPathId) {
    errors.push("Clear paragon path when using paragon multiclassing.");
  }

  if (!hasFullMulticlassPowerChain(index, build)) {
    errors.push("Paragon multiclassing requires Novice Power, Acolyte Power, and Adept Power.");
  }

  const mcClassId = multiclassEntryClassId(index, build);
  if (!mcClassId) {
    errors.push("Paragon multiclassing requires exactly one multiclass training feat with a resolved class.");
    return errors;
  }

  const picks = build.paragonMulticlassPowers ?? {};
  const atk7 = paragonMulticlassAttackPowers(index, mcClassId, 7);
  const util10 = paragonMulticlassUtilityPowers(index, mcClassId, 10);
  const atk19 = paragonMulticlassAttackPowers(index, mcClassId, 19);

  const assertPower = (id: string | undefined, pool: Power[], label: string) => {
    if (!id) return;
    if (!pool.some((p) => p.id === id)) {
      errors.push(`Paragon multiclass ${label}: selected power is not a legal choice for your multiclass class.`);
    }
  };

  if (build.level >= 11) {
    if (picks.atWillSwapPowerId) {
      assertPower(picks.atWillSwapPowerId, filterParagonMulticlassAtWillOptions(atk7), "at-will swap");
    }
    if (picks.encounterPowerId) {
      assertPower(picks.encounterPowerId, filterParagonMulticlassEncounterOptions(atk7), "encounter");
    }
  }
  if (build.level >= 12 && picks.utilityPowerId) {
    assertPower(picks.utilityPowerId, util10, "utility");
  }
  if (build.level >= 20 && picks.dailyPowerId) {
    assertPower(picks.dailyPowerId, filterParagonMulticlassDailyOptions(atk19), "daily");
  }

  return errors;
}
