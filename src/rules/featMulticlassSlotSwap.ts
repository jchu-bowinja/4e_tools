import type { ClassPowerSlotDef } from "./classPowerSlots";
import {
  attackPowerBucketFromUsage,
  powerPrintedLevelEligibleForSlot
} from "./classPowerSlots";
import { getClassPowersForLevelRange } from "./classPowersQuery";
import {
  disableFeatPowerReplace,
  enableFeatPowerReplace,
  isSlotUsedByAnotherFeatSwap,
  replacementPowerIdForActiveSwap
} from "./featPowerReplace";
import type {
  CharacterBuild,
  Feat,
  FeatMulticlassSlotSwapOffer,
  Power,
  RulesIndex
} from "./models";
import { multiclassEntryClassId } from "./paragonMulticlassing";

/** Minimum character level to benefit from multiclass power-swap feats. */
const MULTICLASS_SLOT_SWAP_MIN_LEVEL: Record<string, number> = {
  "Novice Power": 4,
  "Acolyte Power": 8,
  "Adept Power": 10,
  "Psionic Complement": 4,
  "Psionic Dabbler": 4,
  "Psionic Conventionalist": 4
};

export function getFeatMulticlassSlotSwapOffer(feat: Feat): FeatMulticlassSlotSwapOffer | undefined {
  const offers = feat.multiclassSlotSwapOffers;
  return offers?.length ? offers[0] : undefined;
}

export function minLevelForMulticlassSlotSwapFeat(feat: Feat): number {
  return MULTICLASS_SLOT_SWAP_MIN_LEVEL[feat.name] ?? 1;
}

/** Psionic at-will attack powers with the Augmentable keyword. */
export function isAugmentableAtWillPower(p: Power): boolean {
  const kw = String((p.raw?.specific as Record<string, unknown> | undefined)?.Keywords || "").toLowerCase();
  if (!kw.includes("augmentable")) return false;
  return attackPowerBucketFromUsage(p.usage) === "atWill";
}

function replacementBucketForOffer(offer: FeatMulticlassSlotSwapOffer): FeatMulticlassSlotSwapOffer["usageBucket"] {
  return offer.replacementUsageBucket ?? offer.usageBucket;
}

export function eligibleSlotsForMulticlassSwap(
  slotDefs: ClassPowerSlotDef[],
  offer: FeatMulticlassSlotSwapOffer,
  characterLevel: number,
  build?: Pick<CharacterBuild, "classPowerSlots">,
  index?: RulesIndex
): ClassPowerSlotDef[] {
  return slotDefs.filter((d) => {
    if (d.bucket !== offer.usageBucket) return false;
    if (d.gainLevel > offer.maxSlotGainLevel || d.gainLevel > characterLevel) return false;
    if (!offer.requireAugmentableSlot || !build || !index) return true;
    const pid = build.classPowerSlots?.[d.key]?.trim();
    if (!pid) return true;
    const p = index.powers.find((x) => x.id === pid);
    return Boolean(p && isAugmentableAtWillPower(p));
  });
}

/** Multiclass-class powers legal as a replacement for a class slot swap. */
export function multiclassPowersForSlotSwap(
  index: RulesIndex,
  multiclassClassId: string,
  slotDef: ClassPowerSlotDef,
  offer: FeatMulticlassSlotSwapOffer
): Power[] {
  const bucket = replacementBucketForOffer(offer);
  if (bucket === "utility") {
    return getClassPowersForLevelRange(index, multiclassClassId, slotDef.gainLevel, "utility").filter((p) =>
      powerPrintedLevelEligibleForSlot(p, slotDef)
    );
  }
  const attacks = getClassPowersForLevelRange(index, multiclassClassId, slotDef.gainLevel, "attack");
  let pool = attacks.filter(
    (p) =>
      powerPrintedLevelEligibleForSlot(p, slotDef) && attackPowerBucketFromUsage(p.usage) === bucket
  );
  if (offer.requireAugmentableReplacement) {
    pool = pool.filter(isAugmentableAtWillPower);
  }
  return pool;
}

export interface MulticlassSlotSwapRow {
  feat: Feat;
  offer: FeatMulticlassSlotSwapOffer;
  multiclassClassId: string;
  activeSlotKey?: string;
  activeReplacementPowerId?: string;
  eligibleSlots: ClassPowerSlotDef[];
}

export function collectMulticlassSlotSwapRows(
  index: RulesIndex,
  build: Pick<CharacterBuild, "featIds" | "level" | "featPowerReplacements" | "classPowerSlots">,
  slotDefs: ClassPowerSlotDef[]
): MulticlassSlotSwapRow[] {
  const mcClassId = multiclassEntryClassId(index, build as CharacterBuild);
  if (!mcClassId) return [];

  const rows: MulticlassSlotSwapRow[] = [];
  for (const featId of build.featIds) {
    const feat = index.feats.find((f) => f.id === featId);
    if (!feat) continue;
    const offer = getFeatMulticlassSlotSwapOffer(feat);
    if (!offer) continue;
    if (build.level < minLevelForMulticlassSlotSwapFeat(feat)) continue;
    const eligible = eligibleSlotsForMulticlassSwap(slotDefs, offer, build.level, build, index);
    if (eligible.length === 0) continue;
    const state = build.featPowerReplacements?.[featId];
    rows.push({
      feat,
      offer,
      multiclassClassId: mcClassId,
      activeSlotKey: state?.slotKey,
      activeReplacementPowerId: state?.replacementPowerId,
      eligibleSlots: eligible
    });
  }
  return rows;
}

export function enableMulticlassSlotSwap(
  build: CharacterBuild,
  featId: string,
  slotKey: string,
  replacementPowerId: string
): CharacterBuild {
  return enableFeatPowerReplace(build, featId, slotKey, replacementPowerId);
}

export function updateMulticlassSlotSwapReplacement(
  build: CharacterBuild,
  featId: string,
  replacementPowerId: string
): CharacterBuild {
  const state = build.featPowerReplacements?.[featId];
  if (!state?.slotKey) return build;
  return enableFeatPowerReplace(build, featId, state.slotKey, replacementPowerId);
}

export function toggleMulticlassSlotSwap(
  build: CharacterBuild,
  featId: string,
  slotKey: string,
  replacementPowerId: string,
  enabled: boolean
): CharacterBuild {
  if (enabled) {
    let next = build;
    const otherFeatId = isSlotUsedByAnotherFeatSwap(build, slotKey, featId);
    if (otherFeatId) next = disableFeatPowerReplace(next, otherFeatId);
    return enableMulticlassSlotSwap(next, featId, slotKey, replacementPowerId);
  }
  return disableFeatPowerReplace(build, featId);
}

/** Drop invalid multiclass swaps (feat removed, bad slot, illegal replacement power). */
export function pruneMulticlassSlotSwaps(
  build: CharacterBuild,
  index: RulesIndex,
  slotDefs: ClassPowerSlotDef[]
): CharacterBuild {
  const replacements = build.featPowerReplacements;
  if (!replacements) return build;

  const mcClassId = multiclassEntryClassId(index, build);
  let next = build;
  for (const [featId, state] of Object.entries(replacements)) {
    const feat = index.feats.find((f) => f.id === featId);
    const offer = feat ? getFeatMulticlassSlotSwapOffer(feat) : undefined;
    if (!offer) continue;
    if (!build.featIds.includes(featId) || !mcClassId || build.level < minLevelForMulticlassSlotSwapFeat(feat!)) {
      next = disableFeatPowerReplace(next, featId);
      continue;
    }
    const eligible = eligibleSlotsForMulticlassSwap(slotDefs, offer, build.level, next, index);
    const slotDef = eligible.find((d) => d.key === state.slotKey);
    if (!slotDef) {
      next = disableFeatPowerReplace(next, featId);
      continue;
    }
    const replId = replacementPowerIdForActiveSwap(index, next, featId);
    if (!replId) {
      next = disableFeatPowerReplace(next, featId);
      continue;
    }
    const legal = multiclassPowersForSlotSwap(index, mcClassId, slotDef, offer).some((p) => p.id === replId);
    if (!legal) {
      next = disableFeatPowerReplace(next, featId);
    }
  }
  return next;
}
