import type { ClassPowerSlotDef } from "./classPowerSlots";
import type { CharacterBuild, Feat, FeatPowerReplaceOffer, RulesIndex } from "./models";

export function getFeatPowerReplaceOffers(feat: Feat): FeatPowerReplaceOffer[] {
  return feat.powerReplaceOffers?.length ? [...feat.powerReplaceOffers] : [];
}

/** Named `power-replace` offer (fixed replacement power), not multiclass slot swap. */
export function getNamedFeatPowerReplaceOffer(feat: Feat): FeatPowerReplaceOffer | undefined {
  const offers = getFeatPowerReplaceOffers(feat);
  return offers[0];
}

/** @deprecated Use getNamedFeatPowerReplaceOffer for named swaps only. */
export function getFeatPowerReplaceOffer(feat: Feat): FeatPowerReplaceOffer | undefined {
  return getNamedFeatPowerReplaceOffer(feat);
}

export function replacementPowerIdForActiveSwap(
  index: RulesIndex,
  build: CharacterBuild,
  featId: string
): string | undefined {
  const state = build.featPowerReplacements?.[featId];
  if (!state?.slotKey) return undefined;
  const feat = index.feats.find((f) => f.id === featId);
  if (!feat) return undefined;
  if (feat.multiclassSlotSwapOffers?.length) return state.replacementPowerId;
  const named = getNamedFeatPowerReplaceOffer(feat);
  if (named) return named.replacementPowerId;
  return state.replacementPowerId;
}

/** Class slots eligible for a feat’s power-replace offer at the character’s level. */
export function eligibleSlotsForReplaceOffer(
  slotDefs: ClassPowerSlotDef[],
  offer: FeatPowerReplaceOffer
): ClassPowerSlotDef[] {
  return slotDefs.filter(
    (d) => d.bucket === offer.usageBucket && d.gainLevel >= offer.minSlotGainLevel
  );
}

/** Replacement power ids from active swaps on selected feats (allowed in class slots). */
export function activeFeatReplacementPowerIds(index: RulesIndex, build: CharacterBuild): Set<string> {
  const ids = new Set<string>();
  const replacements = build.featPowerReplacements;
  if (!replacements) return ids;
  for (const featId of build.featIds) {
    const replId = replacementPowerIdForActiveSwap(index, build, featId);
    if (replId) ids.add(replId);
  }
  return ids;
}

export function isSlotUsedByAnotherFeatSwap(
  build: CharacterBuild,
  slotKey: string,
  exceptFeatId?: string
): string | undefined {
  const replacements = build.featPowerReplacements;
  if (!replacements) return undefined;
  for (const [featId, state] of Object.entries(replacements)) {
    if (featId === exceptFeatId) continue;
    if (state.slotKey === slotKey) return featId;
  }
  return undefined;
}

/** Enable a power-replace on a class slot (stores original pick, sets replacement in slot). */
export function enableFeatPowerReplace(
  build: CharacterBuild,
  featId: string,
  slotKey: string,
  replacementPowerId: string
): CharacterBuild {
  const slots = { ...(build.classPowerSlots || {}) };
  const prior = slots[slotKey]?.trim() || undefined;
  slots[slotKey] = replacementPowerId;
  return {
    ...build,
    classPowerSlots: slots,
    featPowerReplacements: {
      ...(build.featPowerReplacements || {}),
      [featId]: { slotKey, originalPowerId: prior, replacementPowerId }
    }
  };
}

/** Disable a feat power-replace and restore the prior class pick when possible. */
export function disableFeatPowerReplace(build: CharacterBuild, featId: string): CharacterBuild {
  const state = build.featPowerReplacements?.[featId];
  if (!state) return build;
  const slots = { ...(build.classPowerSlots || {}) };
  if (state.originalPowerId) slots[state.slotKey] = state.originalPowerId;
  else delete slots[state.slotKey];
  const nextReplacements = { ...(build.featPowerReplacements || {}) };
  delete nextReplacements[featId];
  return {
    ...build,
    classPowerSlots: Object.keys(slots).length > 0 ? slots : undefined,
    featPowerReplacements: Object.keys(nextReplacements).length > 0 ? nextReplacements : undefined
  };
}

export function toggleFeatPowerReplace(
  build: CharacterBuild,
  featId: string,
  slotKey: string,
  replacementPowerId: string,
  enabled: boolean
): CharacterBuild {
  if (enabled) return enableFeatPowerReplace(build, featId, slotKey, replacementPowerId);
  return disableFeatPowerReplace(build, featId);
}

export interface FeatPowerReplaceRow {
  feat: Feat;
  offer: FeatPowerReplaceOffer;
  activeSlotKey?: string;
  eligibleSlots: ClassPowerSlotDef[];
}

/** Selected feats that offer a named power-replace. */
export function collectFeatPowerReplaceRows(
  index: RulesIndex,
  build: Pick<CharacterBuild, "featIds" | "featPowerReplacements">,
  slotDefs: ClassPowerSlotDef[]
): FeatPowerReplaceRow[] {
  const rows: FeatPowerReplaceRow[] = [];
  for (const featId of build.featIds) {
    const feat = index.feats.find((f) => f.id === featId);
    if (!feat) continue;
    const offer = getNamedFeatPowerReplaceOffer(feat);
    if (!offer) continue;
    const eligible = eligibleSlotsForReplaceOffer(slotDefs, offer);
    if (eligible.length === 0) continue;
    rows.push({
      feat,
      offer,
      activeSlotKey: build.featPowerReplacements?.[featId]?.slotKey,
      eligibleSlots: eligible
    });
  }
  return rows;
}

/** Drop invalid swaps (feat removed, slot gone, ineligible level). */
export function pruneFeatPowerReplacements(
  build: CharacterBuild,
  index: RulesIndex,
  slotDefs: ClassPowerSlotDef[]
): CharacterBuild {
  const replacements = build.featPowerReplacements;
  if (!replacements || Object.keys(replacements).length === 0) return build;

  let next = build;
  for (const [featId, state] of Object.entries(replacements)) {
    if (!build.featIds.includes(featId)) {
      next = disableFeatPowerReplace(next, featId);
      continue;
    }
    const feat = index.feats.find((f) => f.id === featId);
    const offer = feat ? getNamedFeatPowerReplaceOffer(feat) : undefined;
    if (!offer) {
      next = disableFeatPowerReplace(next, featId);
      continue;
    }
    const eligible = eligibleSlotsForReplaceOffer(slotDefs, offer);
    const slotOk = eligible.some((d) => d.key === state.slotKey);
    if (!slotOk) {
      next = disableFeatPowerReplace(next, featId);
    }
  }
  return next;
}
