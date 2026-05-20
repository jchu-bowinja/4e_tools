import { isAugmentableAtWillPower } from "./featMulticlassSlotSwap";
import { getFeatMulticlassSlotSwapOffer } from "./featMulticlassSlotSwap";
import type { CharacterBuild, HybridClassDef, ParagonPath, Power, RulesIndex } from "./models";
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
  /** Pool from Psionic Augmentation (single-class or hybrid). */
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

function hybridClassIsPsionic(index: RulesIndex, hybrid: HybridClassDef | undefined): boolean {
  if (!hybrid) return false;
  if (String(hybrid.powerSource ?? "").toLowerCase().includes("psionic")) return true;
  const baseId = hybrid.baseClassId ?? undefined;
  return classIsPsionic(index, baseId);
}

/** Hybrid with at least one psionic component (Psionic Augmentation hybrid). */
export function hybridHasPsionicComponent(index: RulesIndex, build: CharacterBuild): boolean {
  if (build.characterStyle !== "hybrid") return false;
  const ha = index.hybridClasses?.find((h) => h.id === build.hybridClassIdA);
  const hb = index.hybridClasses?.find((h) => h.id === build.hybridClassIdB);
  return hybridClassIsPsionic(index, ha) || hybridClassIsPsionic(index, hb);
}

/** Augmentable at-will powers currently in hybrid at-will slots. */
export function collectHybridAugmentableAtWillPowers(index: RulesIndex, build: CharacterBuild): Power[] {
  const slots = build.classPowerSlots ?? {};
  const out: Power[] = [];
  const seen = new Set<string>();
  for (const [key, rawId] of Object.entries(slots)) {
    if (!key.startsWith("hybrid:aw")) continue;
    const pid = String(rawId ?? "").trim();
    if (!pid || seen.has(pid)) continue;
    const p = index.powers.find((x) => x.id === pid);
    if (p && isAugmentableAtWillPower(p)) {
      seen.add(pid);
      out.push(p);
    }
  }
  return out;
}

/**
 * PHB3 hybrid power point option: assumes PP at each augmentation breakpoint (not encounter picks).
 * Gains at 3rd/7th depend on printed level of augmentable at-wills in slots.
 */
export function hybridPsionicPowerPointsFromAugmentableAtWills(
  augmentableAtWills: readonly Power[],
  characterLevel: number
): number {
  if (augmentableAtWills.length === 0 || characterLevel < 1) return 0;
  const minPrinted = Math.min(...augmentableAtWills.map((p) => p.level ?? 1));
  let total = 0;
  if (characterLevel >= 1) total += 2;
  if (characterLevel >= 3) total += minPrinted <= 3 ? 2 : 1;
  if (characterLevel >= 7) total += minPrinted <= 7 ? 2 : 1;
  if (characterLevel >= 13) total += 1;
  if (characterLevel >= 17) total += 2;
  if (characterLevel >= 21) total += 2;
  if (characterLevel >= 23) total += 2;
  if (characterLevel >= 27) total += 2;
  return total;
}

export function hybridPsionicBasePowerPoints(index: RulesIndex, build: CharacterBuild): number {
  if (!hybridHasPsionicComponent(index, build)) return 0;
  const atWills = collectHybridAugmentableAtWillPowers(index, build);
  return hybridPsionicPowerPointsFromAugmentableAtWills(atWills, build.level);
}

/** Character uses Psionic Augmentation (single-class psionic or psionic hybrid). */
export function buildHasPsionicAugmentationClass(index: RulesIndex, build: CharacterBuild): boolean {
  if (build.characterStyle === "hybrid") return hybridHasPsionicComponent(index, build);
  return classIsPsionic(index, build.classId);
}

export function psionicAugmentationPoolLabel(index: RulesIndex, build: CharacterBuild): string {
  return build.characterStyle === "hybrid" && hybridHasPsionicComponent(index, build)
    ? "Hybrid Psionic Augmentation"
    : "Psionic Augmentation";
}

export function basePsionicPowerPointsForBuild(index: RulesIndex, build: CharacterBuild): number {
  if (build.characterStyle === "hybrid") {
    return hybridPsionicBasePowerPoints(index, build);
  }
  if (!classIsPsionic(index, build.classId)) return 0;
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
  const mcId = multiclassEntryClassId(index, build);
  if (!mcId || !classIsPsionic(index, mcId)) return 0;
  if (build.characterStyle === "hybrid") {
    if (hybridHasPsionicComponent(index, build)) return 0;
    return 1;
  }
  const primaryId = build.classId;
  if (!primaryId || classIsPsionic(index, primaryId)) return 0;
  return 1;
}

/** Compendium class feature: +2 power points at paragon tier (PHB3). */
export const PARAGON_POWER_POINTS_CLASS_FEATURE_ID = "ID_FMP_CLASS_FEATURE_1818";

function paragonPathGrantEntries(path: ParagonPath): { featureId: string; grantLevel: number }[] {
  const out: { featureId: string; grantLevel: number }[] = [];
  const rules = path.raw?.rules as { grant?: unknown } | undefined;
  const grant = rules?.grant;
  const rows = Array.isArray(grant) ? grant : grant ? [grant] : [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const attrs = (row as { attrs?: Record<string, unknown> }).attrs ?? {};
    const gtype = String(attrs.type ?? "").toLowerCase();
    if (gtype !== "class feature") continue;
    const featureId = String(attrs.name ?? "").trim();
    if (!featureId.startsWith("ID_")) continue;
    const grantLevel = Math.max(1, parseInt(String(attrs.Level ?? "11"), 10) || 11);
    out.push({ featureId, grantLevel });
  }
  return out;
}

/** Selected paragon path grants Paragon Power Points at the character's level. */
export function paragonPathGrantsParagonPowerPoints(
  path: ParagonPath | undefined,
  characterLevel: number
): boolean {
  if (!path || characterLevel < 11) return false;
  if (path.grantedClassFeatureIds?.includes(PARAGON_POWER_POINTS_CLASS_FEATURE_ID)) return true;
  for (const { featureId, grantLevel } of paragonPathGrantEntries(path)) {
    if (featureId === PARAGON_POWER_POINTS_CLASS_FEATURE_ID && characterLevel >= grantLevel) {
      return true;
    }
  }
  for (const sa of path.statAdds ?? []) {
    const name = String(sa.name ?? "").toLowerCase();
    if (name.includes("power point")) {
      const n = parseInt(String(sa.value ?? "").replace(/[^\d-]/g, ""), 10);
      if (n >= 2) return true;
    }
  }
  return false;
}

/**
 * +2 at 11+ from paragon tier: class Psionic Augmentation when no path, or path that grants Paragon Power Points.
 * Excludes paragon multiclassing (uses paragonMulticlassPowerPointBonus instead).
 */
export function paragonTierPowerPointBonus(index: RulesIndex, build: CharacterBuild): number {
  if (build.level < 11 || build.paragonMulticlassing) return 0;
  if (!buildHasPsionicAugmentationClass(index, build)) return 0;
  if (build.paragonPathId) {
    const path = index.paragonPaths.find((p) => p.id === build.paragonPathId);
    return paragonPathGrantsParagonPowerPoints(path, build.level) ? 2 : 0;
  }
  return 2;
}

/** +2 at 11 when paragon multiclassing into a psionic class (both psionic, or non-psionic → psionic). */
export function paragonMulticlassPowerPointBonus(index: RulesIndex, build: CharacterBuild): number {
  if (!build.paragonMulticlassing || build.level < 11) return 0;
  const mcId = multiclassEntryClassId(index, build);
  if (!mcId || !classIsPsionic(index, mcId)) return 0;
  if (build.characterStyle === "hybrid") return 2;
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

  const paragonMcBonus = paragonMulticlassPowerPointBonus(index, build);
  if (paragonMcBonus > 0) {
    lines.push({
      label: "Paragon multiclassing",
      delta: paragonMcBonus,
      detail: "Psionic multiclass at 11th level"
    });
  }

  const paragonTierBonus = paragonTierPowerPointBonus(index, build);
  if (paragonTierBonus > 0) {
    const path = build.paragonPathId
      ? index.paragonPaths.find((p) => p.id === build.paragonPathId)
      : undefined;
    lines.push({
      label: path?.name ?? "Paragon tier",
      delta: paragonTierBonus,
      detail: path ? "Paragon Power Points (path)" : "Paragon Power Points (class)"
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
