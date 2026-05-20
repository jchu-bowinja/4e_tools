import { getFeatMulticlassSlotSwapOffer } from "./featMulticlassSlotSwap";
import type { CharacterBuild, RulesIndex } from "./models";
import { multiclassEntryClassId } from "./paragonMulticlassing";

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
  /** Net adjustment from heroic multiclass swaps + paragon multiclassing. */
  total: number;
  lines: PsionicPowerPointAdjustmentLine[];
  /** PHB3: non-psionic → psionic paragon MC loses one class at-will slot at 11+. */
  paragonPrimaryAtWillSlotPenalty: number;
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

  const total = lines.reduce((sum, l) => sum + l.delta, 0);
  const paragonPrimaryAtWillSlotPenalty = paragonMulticlassPrimaryAtWillSlotPenalty(index, build);
  return { total, lines, paragonPrimaryAtWillSlotPenalty };
}
