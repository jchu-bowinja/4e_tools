import type { ClassPowerSlotDef } from "./classPowerSlots";
import { powerPrintedLevelEligibleForSlot } from "./classPowerSlots";
import { getClassPowersForLevelRange } from "./classPowersQuery";
import {
  disableFeatPowerReplace,
  eligibleSlotsForReplaceOffer,
  enableFeatPowerReplace,
  isSlotUsedByAnotherFeatSwap,
  replacementPowerIdForActiveSwap
} from "./featPowerReplace";
import type {
  CharacterBuild,
  Class,
  Feat,
  FeatPowerReplaceOffer,
  Power,
  RulesIndex
} from "./models";
import { multiclassEntryClassId } from "./paragonMulticlassing";

export function nonClassSlotSwapSourceClassSelectionKey(featId: string): string {
  return `featNonClassSwapSource:${featId}`;
}

export function getNonClassSlotSwapOffer(feat: Feat): FeatPowerReplaceOffer | undefined {
  return feat.powerReplaceOffers?.find((o) => o.requireNonClassReplacement);
}

/** Class ids the character already belongs to (exclude from non-class power sources). */
export function characterOwnedClassIds(index: RulesIndex, build: CharacterBuild): Set<string> {
  const ids = new Set<string>();
  if (build.classId) ids.add(build.classId);
  for (const hybridId of [build.hybridClassIdA, build.hybridClassIdB]) {
    if (!hybridId) continue;
    ids.add(hybridId);
    const hybrid = index.hybridClasses?.find((h) => h.id === hybridId);
    if (hybrid?.baseClassId) ids.add(hybrid.baseClassId);
  }
  const mcClassId = multiclassEntryClassId(index, build);
  if (mcClassId) ids.add(mcClassId);
  return ids;
}

export function classesForNonClassSlotSwap(index: RulesIndex, build: CharacterBuild): Class[] {
  const owned = characterOwnedClassIds(index, build);
  return index.classes
    .filter((c) => c.id && !owned.has(c.id))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

/** Utility powers from another class legal for a non-class slot swap. */
export function nonClassPowersForSlotSwap(
  index: RulesIndex,
  sourceClassId: string,
  slotDef: ClassPowerSlotDef,
  offer: FeatPowerReplaceOffer
): Power[] {
  if (offer.usageBucket !== "utility") return [];
  return getClassPowersForLevelRange(index, sourceClassId, slotDef.gainLevel, "utility").filter((p) =>
    powerPrintedLevelEligibleForSlot(p, slotDef)
  );
}

export interface NonClassSlotSwapRow {
  feat: Feat;
  offer: FeatPowerReplaceOffer;
  activeSlotKey?: string;
  activeSourceClassId?: string;
  activeReplacementPowerId?: string;
  eligibleSlots: ClassPowerSlotDef[];
  sourceClasses: Class[];
}

export function collectNonClassSlotSwapRows(
  index: RulesIndex,
  build: Pick<CharacterBuild, "featIds" | "featPowerReplacements" | "classPowerSlots" | "classId" | "hybridClassIdA" | "hybridClassIdB">,
  slotDefs: ClassPowerSlotDef[]
): NonClassSlotSwapRow[] {
  const sourceClasses = classesForNonClassSlotSwap(index, build as CharacterBuild);
  if (sourceClasses.length === 0) return [];

  const rows: NonClassSlotSwapRow[] = [];
  for (const featId of build.featIds) {
    const feat = index.feats.find((f) => f.id === featId);
    if (!feat) continue;
    const offer = getNonClassSlotSwapOffer(feat);
    if (!offer) continue;
    const eligible = eligibleSlotsForReplaceOffer(slotDefs, offer, build.classPowerSlots);
    if (eligible.length === 0) continue;
    const state = build.featPowerReplacements?.[featId];
    rows.push({
      feat,
      offer,
      activeSlotKey: state?.slotKey,
      activeSourceClassId: state?.replacementClassId,
      activeReplacementPowerId: state?.replacementPowerId,
      eligibleSlots: eligible,
      sourceClasses
    });
  }
  return rows;
}

export function enableNonClassSlotSwap(
  build: CharacterBuild,
  featId: string,
  slotKey: string,
  sourceClassId: string,
  replacementPowerId: string
): CharacterBuild {
  return enableFeatPowerReplace(build, featId, slotKey, replacementPowerId, { replacementClassId: sourceClassId });
}

export function updateNonClassSlotSwapSourceClass(
  build: CharacterBuild,
  index: RulesIndex,
  featId: string,
  sourceClassId: string,
  slotDefs: ClassPowerSlotDef[]
): CharacterBuild {
  const state = build.featPowerReplacements?.[featId];
  if (!state?.slotKey) return build;
  const feat = index.feats.find((f) => f.id === featId);
  const offer = feat ? getNonClassSlotSwapOffer(feat) : undefined;
  const slotDef = slotDefs.find((d) => d.key === state.slotKey);
  if (!offer || !slotDef) return build;
  const legal = nonClassPowersForSlotSwap(index, sourceClassId, slotDef, offer);
  const keepPower = legal.some((p) => p.id === state.replacementPowerId);
  if (keepPower && state.replacementPowerId) {
    return enableNonClassSlotSwap(build, featId, state.slotKey, sourceClassId, state.replacementPowerId);
  }
  return disableFeatPowerReplace(build, featId);
}

export function updateNonClassSlotSwapReplacement(
  build: CharacterBuild,
  featId: string,
  replacementPowerId: string
): CharacterBuild {
  const state = build.featPowerReplacements?.[featId];
  if (!state?.slotKey || !state.replacementClassId) return build;
  return enableNonClassSlotSwap(build, featId, state.slotKey, state.replacementClassId, replacementPowerId);
}

export function toggleNonClassSlotSwap(
  build: CharacterBuild,
  featId: string,
  slotKey: string,
  sourceClassId: string,
  replacementPowerId: string,
  enabled: boolean
): CharacterBuild {
  if (enabled) {
    let next = build;
    const otherFeatId = isSlotUsedByAnotherFeatSwap(build, slotKey, featId);
    if (otherFeatId) next = disableFeatPowerReplace(next, otherFeatId);
    return enableNonClassSlotSwap(next, featId, slotKey, sourceClassId, replacementPowerId);
  }
  return disableFeatPowerReplace(build, featId);
}

export function pruneNonClassSlotSwaps(
  build: CharacterBuild,
  index: RulesIndex,
  slotDefs: ClassPowerSlotDef[]
): CharacterBuild {
  const replacements = build.featPowerReplacements;
  if (!replacements) return build;

  const owned = characterOwnedClassIds(index, build);
  let next = build;
  for (const [featId, state] of Object.entries(replacements)) {
    const feat = index.feats.find((f) => f.id === featId);
    const offer = feat ? getNonClassSlotSwapOffer(feat) : undefined;
    if (!offer) continue;
    if (!build.featIds.includes(featId)) {
      next = disableFeatPowerReplace(next, featId);
      continue;
    }
    const eligible = eligibleSlotsForReplaceOffer(slotDefs, offer, next.classPowerSlots);
    const slotDef = eligible.find((d) => d.key === state.slotKey);
    if (!slotDef) {
      next = disableFeatPowerReplace(next, featId);
      continue;
    }
    const sourceClassId = state.replacementClassId?.trim();
    if (!sourceClassId || owned.has(sourceClassId)) {
      next = disableFeatPowerReplace(next, featId);
      continue;
    }
    const replId = replacementPowerIdForActiveSwap(index, next, featId);
    if (!replId) {
      next = disableFeatPowerReplace(next, featId);
      continue;
    }
    const legal = nonClassPowersForSlotSwap(index, sourceClassId, slotDef, offer).some((p) => p.id === replId);
    if (!legal) {
      next = disableFeatPowerReplace(next, featId);
    }
  }
  return next;
}
