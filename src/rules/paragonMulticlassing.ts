import type { ClassPowerSlotDef } from "./classPowerSlots";
import { buildClassPowerSlotDefinitions } from "./classPowerSlots";
import type { CharacterBuild, Power, RulesIndex } from "./models";
import { collectMulticlassEntryFeatIds } from "./featGrantFlags";
import { bonusClassAtWillSlotFromRaceBuild } from "./grantedPowersQuery";
import { paragonMulticlassPrimaryAtWillSlotPenalty } from "./psionicPowerPoints";
import { getClassPowersForLevelRange } from "./classPowersQuery";
import { buildHybridPowerSlotDefinitions } from "./hybridPowerSlots";
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

export function paragonAtWillSlotDefs(index: RulesIndex, build: CharacterBuild): ClassPowerSlotDef[] {
  const bonus = bonusClassAtWillSlotFromRaceBuild(index, build);
  const penalty = paragonMulticlassPrimaryAtWillSlotPenalty(index, build);
  const defs =
    build.characterStyle === "hybrid"
      ? buildHybridPowerSlotDefinitions(build.level, bonus, penalty)
      : buildClassPowerSlotDefinitions(build.level, bonus, penalty);
  return defs.filter((d) => d.bucket === "atWill");
}

export function activeParagonAtWillSwapPowerId(build: CharacterBuild): string | undefined {
  const picks = build.paragonMulticlassPowers;
  if (!build.paragonMulticlassing || !picks?.atWillSwapSlotKey || !picks.atWillSwapPowerId) return undefined;
  return picks.atWillSwapPowerId;
}

export function isSlotUsedByParagonAtWillSwap(build: CharacterBuild, slotKey: string): boolean {
  return build.paragonMulticlassPowers?.atWillSwapSlotKey === slotKey;
}

/** Apply or clear paragon at-will swap on a class at-will slot. */
export function setParagonAtWillSwap(
  build: CharacterBuild,
  slotKey: string | undefined,
  replacementPowerId: string | undefined
): CharacterBuild {
  const priorPicks = build.paragonMulticlassPowers ?? {};
  let next = disableParagonAtWillSwap(build);

  if (!slotKey || !replacementPowerId) {
    const nextPicks: ParagonMulticlassPowers = { ...priorPicks };
    delete nextPicks.atWillSwapPowerId;
    delete nextPicks.atWillSwapSlotKey;
    delete nextPicks.atWillSwapOriginalPowerId;
    const hasOther = Boolean(
      nextPicks.encounterPowerId || nextPicks.utilityPowerId || nextPicks.dailyPowerId
    );
    return {
      ...next,
      paragonMulticlassPowers: hasOther ? nextPicks : undefined
    };
  }

  const slots = { ...(next.classPowerSlots || {}) };
  const originalPowerId = slots[slotKey]?.trim() || undefined;
  slots[slotKey] = replacementPowerId;
  const nextPicks: ParagonMulticlassPowers = {
    ...priorPicks,
    atWillSwapPowerId: replacementPowerId,
    atWillSwapSlotKey: slotKey,
    atWillSwapOriginalPowerId: originalPowerId
  };
  return {
    ...next,
    classPowerSlots: slots,
    paragonMulticlassPowers: nextPicks
  };
}

/** Restore the class at-will slot and strip swap metadata. */
export function disableParagonAtWillSwap(build: CharacterBuild): CharacterBuild {
  const picks = build.paragonMulticlassPowers;
  if (!picks?.atWillSwapSlotKey) return build;
  const slots = { ...(build.classPowerSlots || {}) };
  if (picks.atWillSwapOriginalPowerId) slots[picks.atWillSwapSlotKey] = picks.atWillSwapOriginalPowerId;
  else delete slots[picks.atWillSwapSlotKey];
  const nextPicks = { ...picks };
  delete nextPicks.atWillSwapPowerId;
  delete nextPicks.atWillSwapSlotKey;
  delete nextPicks.atWillSwapOriginalPowerId;
  const hasOther = Boolean(nextPicks.encounterPowerId || nextPicks.utilityPowerId || nextPicks.dailyPowerId);
  return {
    ...build,
    classPowerSlots: Object.keys(slots).length > 0 ? slots : undefined,
    paragonMulticlassPowers: hasOther ? nextPicks : undefined
  };
}

/** Power ids from paragon multiclass picks (level-gated). */
export function collectParagonMulticlassPowerIds(
  build: Pick<CharacterBuild, "level" | "paragonMulticlassing" | "paragonMulticlassPowers">
): string[] {
  if (!build.paragonMulticlassing || build.level < 11) return [];
  const picks = build.paragonMulticlassPowers;
  if (!picks) return [];
  const ids: string[] = [];
  if (picks.atWillSwapPowerId) ids.push(picks.atWillSwapPowerId);
  if (picks.encounterPowerId) ids.push(picks.encounterPowerId);
  if (build.level >= 12 && picks.utilityPowerId) ids.push(picks.utilityPowerId);
  if (build.level >= 20 && picks.dailyPowerId) ids.push(picks.dailyPowerId);
  return ids;
}

export function resolveParagonMulticlassPowers(index: RulesIndex, build: CharacterBuild): Power[] {
  const out: Power[] = [];
  for (const id of collectParagonMulticlassPowerIds(build)) {
    const p = index.powers.find((x) => x.id === id);
    if (p) out.push(p);
  }
  return out;
}

/** Clear paragon multiclassing when ineligible or picks are illegal. */
export function pruneParagonMulticlassing(index: RulesIndex, build: CharacterBuild): CharacterBuild {
  if (!build.paragonMulticlassing && !build.paragonMulticlassPowers) return build;
  if (!canChooseParagonMulticlassing(index, build)) {
    return {
      ...build,
      paragonMulticlassing: undefined,
      paragonMulticlassPowers: undefined
    };
  }
  const picks = build.paragonMulticlassPowers;
  if (!picks) return build;

  const mcClassId = multiclassEntryClassId(index, build);
  if (!mcClassId) {
    return { ...build, paragonMulticlassPowers: undefined };
  }

  const atk7 = paragonMulticlassAttackPowers(index, mcClassId, 7);
  const util10 = paragonMulticlassUtilityPowers(index, mcClassId, 10);
  const atk19 = paragonMulticlassAttackPowers(index, mcClassId, 19);
  const atkAll = paragonMulticlassAttackPowers(index, mcClassId, build.level);

  const legalAtWill = new Set(filterParagonMulticlassAtWillOptions(atkAll).map((p) => p.id));
  const legalEncounter = new Set(filterParagonMulticlassEncounterOptions(atk7).map((p) => p.id));
  const legalUtility = new Set(util10.map((p) => p.id));
  const legalDaily = new Set(filterParagonMulticlassDailyOptions(atk19).map((p) => p.id));

  const nextPicks = { ...picks };
  let changed = false;
  if (nextPicks.atWillSwapPowerId && !legalAtWill.has(nextPicks.atWillSwapPowerId)) {
    return disableParagonAtWillSwap(build);
  }
  const awSlots = paragonAtWillSlotDefs(index, build);
  if (nextPicks.atWillSwapSlotKey && !awSlots.some((d) => d.key === nextPicks.atWillSwapSlotKey)) {
    return disableParagonAtWillSwap(build);
  }
  if (nextPicks.encounterPowerId && !legalEncounter.has(nextPicks.encounterPowerId)) {
    delete nextPicks.encounterPowerId;
    changed = true;
  }
  if (build.level < 12 && nextPicks.utilityPowerId) {
    delete nextPicks.utilityPowerId;
    changed = true;
  } else if (nextPicks.utilityPowerId && !legalUtility.has(nextPicks.utilityPowerId)) {
    delete nextPicks.utilityPowerId;
    changed = true;
  }
  if (build.level < 20 && nextPicks.dailyPowerId) {
    delete nextPicks.dailyPowerId;
    changed = true;
  } else if (nextPicks.dailyPowerId && !legalDaily.has(nextPicks.dailyPowerId)) {
    delete nextPicks.dailyPowerId;
    changed = true;
  }

  if (!changed) return build;
  const hasAny = Boolean(
    nextPicks.atWillSwapPowerId ||
      nextPicks.encounterPowerId ||
      nextPicks.utilityPowerId ||
      nextPicks.dailyPowerId
  );
  return {
    ...build,
    paragonMulticlassPowers: hasAny ? nextPicks : undefined
  };
}
