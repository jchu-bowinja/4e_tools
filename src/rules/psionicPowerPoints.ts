import { getFeatMulticlassSlotSwapOffer } from "./featMulticlassSlotSwap";
import type { CharacterBuild, RulesIndex } from "./models";
import { multiclassEntryClassId } from "./paragonMulticlassing";

/**
 * Cumulative power points from the Psionic Augmentation class feature (PHB3 table).
 * Levels between listed breakpoints keep the previous total.
 */
const PSIONIC_AUGMENTATION_POWER_POINTS_BY_LEVEL: Record<number, number> = {
  1: 2,
  2: 2,
  3: 4,
  4: 4,
  5: 4,
  6: 4,
  7: 6,
  8: 6,
  9: 6,
  10: 6,
  11: 6,
  12: 6,
  13: 7,
  14: 7,
  15: 7,
  16: 7,
  17: 9,
  18: 9,
  19: 9,
  20: 9,
  21: 11,
  22: 11,
  23: 13,
  24: 13,
  25: 13,
  26: 13,
  27: 15,
  28: 15,
  29: 15,
  30: 15
};

/** Power points from PHB3 swap tier (printed level of the augmentable at-will). */
export function powerPointsForPrintedLevel(printedLevel: number): number {
  if (printedLevel <= 10) return 2;
  if (printedLevel <= 20) return 4;
  return 6;
}

export function classIsPsionic(index: RulesIndex, classId: string | undefined): boolean {
  if (!classId) return false;
  const cls = index.classes.find((c) => c.id === classId);
  const ps = String(cls?.powerSource ?? "").toLowerCase();
  return ps.includes("psionic");
}

export interface PsionicPowerPointAdjustmentLine {
  label: string;
  delta: number;
  detail?: string;
}

export interface PsionicPowerPointSummary {
  /** Pool from Psionic Augmentation on a psionic class (0 for non-psionic or hybrid). */
  baseFromClass: number;
  /** Net adjustment from heroic multiclass swaps + paragon multiclassing. */
  totalAdjustments: number;
  /** baseFromClass + totalAdjustments. */
  poolTotal: number;
  lines: PsionicPowerPointAdjustmentLine[];
  /** PHB3: non-psionic → psionic paragon MC loses one class at-will slot at 11+. */
  paragonPrimaryAtWillSlotPenalty: number;
}

export function basePsionicPowerPointsFromLevel(level: number): number {
  const lv = Math.max(1, Math.min(30, Math.floor(level)));
  return PSIONIC_AUGMENTATION_POWER_POINTS_BY_LEVEL[lv] ?? 2;
}

/** Primary class uses Psionic Augmentation (single-class psionic only; hybrid deferred). */
export function buildHasPsionicAugmentationClass(index: RulesIndex, build: CharacterBuild): boolean {
  if (build.characterStyle === "hybrid") return false;
  return classIsPsionic(index, build.classId);
}

export function basePsionicPowerPointsForBuild(index: RulesIndex, build: CharacterBuild): number {
  if (!buildHasPsionicAugmentationClass(index, build)) return 0;
  return basePsionicPowerPointsFromLevel(build.level);
}

export function showPsionicPowerPointSummary(summary: PsionicPowerPointSummary): boolean {
  return (
    summary.baseFromClass > 0 ||
    summary.lines.length > 0 ||
    summary.paragonPrimaryAtWillSlotPenalty > 0
  );
}

/** Lose one class at-will slot when paragon multiclassing into psionic from a non-psionic class. */
export function paragonMulticlassPrimaryAtWillSlotPenalty(
  index: RulesIndex,
  build: CharacterBuild
): number {
  if (!build.paragonMulticlassing || build.level < 11) return 0;
  if (build.characterStyle === "hybrid") return 0;
  const mcId = multiclassEntryClassId(index, build);
  if (!mcId || !classIsPsionic(index, mcId)) return 0;
  const primaryId = build.classId;
  if (!primaryId || classIsPsionic(index, primaryId)) return 0;
  return 1;
}

/** +2 at 11 when paragon multiclassing into a psionic class (both psionic, or non-psionic → psionic). */
export function paragonMulticlassPowerPointBonus(index: RulesIndex, build: CharacterBuild): number {
  if (!build.paragonMulticlassing || build.level < 11) return 0;
  if (build.characterStyle === "hybrid") return 0;
  const mcId = multiclassEntryClassId(index, build);
  if (!mcId || !classIsPsionic(index, mcId)) return 0;
  const primaryId = build.classId;
  if (!primaryId) return 0;
  if (!classIsPsionic(index, primaryId)) return 2;
  if (classIsPsionic(index, primaryId) && classIsPsionic(index, mcId)) return 2;
  return 0;
}

/** Active heroic psionic swap feats (Dabbler / Conventionalist) adjusting power points. */
export function heroicPsionicSwapPowerPointAdjustments(
  index: RulesIndex,
  build: CharacterBuild
): PsionicPowerPointAdjustmentLine[] {
  const lines: PsionicPowerPointAdjustmentLine[] = [];
  const replacements = build.featPowerReplacements;
  if (!replacements) return lines;

  for (const featId of build.featIds) {
    const feat = index.feats.find((f) => f.id === featId);
    const offer = feat ? getFeatMulticlassSlotSwapOffer(feat) : undefined;
    const change = offer?.powerPointSwapChange;
    if (!feat || !change) continue;

    const state = replacements[featId];
    if (!state?.slotKey || !state.replacementPowerId) continue;

    let printedLevel = 1;
    if (change === "gain") {
      const repl = index.powers.find((p) => p.id === state.replacementPowerId);
      printedLevel = repl?.level ?? 1;
    } else {
      const origId = state.originalPowerId;
      if (!origId) continue;
      const orig = index.powers.find((p) => p.id === origId);
      printedLevel = orig?.level ?? 1;
    }

    const magnitude = powerPointsForPrintedLevel(printedLevel);
    const delta = change === "gain" ? magnitude : -magnitude;
    const tier =
      printedLevel <= 10 ? "Lv 1–10" : printedLevel <= 20 ? "Lv 11–20" : "Lv 21–30";
    lines.push({
      label: feat.name,
      delta,
      detail: `${change === "gain" ? "Gain" : "Lose"} ${magnitude} (${tier} augmentable at-will)`
    });
  }
  return lines;
}

export function summarizePsionicPowerPointAdjustments(
  index: RulesIndex,
  build: CharacterBuild
): PsionicPowerPointSummary {
  const lines: PsionicPowerPointAdjustmentLine[] = [...heroicPsionicSwapPowerPointAdjustments(index, build)];

  const paragonBonus = paragonMulticlassPowerPointBonus(index, build);
  if (paragonBonus > 0) {
    lines.push({
      label: "Paragon multiclassing",
      delta: paragonBonus,
      detail: "Psionic multiclass at 11th level"
    });
  }

  const totalAdjustments = lines.reduce((sum, l) => sum + l.delta, 0);
  const paragonPrimaryAtWillSlotPenalty = paragonMulticlassPrimaryAtWillSlotPenalty(index, build);
  const baseFromClass = basePsionicPowerPointsForBuild(index, build);
  return {
    baseFromClass,
    totalAdjustments,
    poolTotal: baseFromClass + totalAdjustments,
    lines,
    paragonPrimaryAtWillSlotPenalty
  };
}
