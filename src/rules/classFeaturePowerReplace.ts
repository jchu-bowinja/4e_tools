import { collectCharacterClassFeatureIds } from "./characterClassFeatures";
import { getClassPowerIdsForUsagePool } from "./classPowersQuery";
import type {
  CharacterBuild,
  ClassFeature,
  ClassFeaturePowerReplacementRule,
  ClassFeaturePowerSwapRule,
  ClassPowerSlotDef,
  ClassRoleBucket,
  RulesIndex
} from "./models";
import { collectFeatPowerReplacementMap } from "./featPowerReplace";
import { classRoleBucket } from "./roleProgressionFeatures";
import { parseFeatureLevel } from "./supportTraits";

export const CLASS_POWER_SWAP_SELECTION_PREFIX = "classPowerSwap:";

export function classPowerSwapSelectionKey(featureId: string): string {
  return `${CLASS_POWER_SWAP_SELECTION_PREFIX}${featureId}`;
}

function parsePowerReplacementRules(feature: ClassFeature): ClassFeaturePowerReplacementRule[] {
  if (feature.powerReplacementRules?.length) return feature.powerReplacementRules;
  const rules = feature.raw?.rules as
    | { replace?: Array<{ attrs?: Record<string, string> }> }
    | undefined;
  const out: ClassFeaturePowerReplacementRule[] = [];
  for (const row of rules?.replace ?? []) {
    const pr = row.attrs?.["power-replace"]?.trim();
    if (!pr) continue;
    const parts = pr.split(":", 2);
    if (parts.length !== 2 || !parts[0]?.startsWith("ID_") || !parts[1]?.startsWith("ID_")) continue;
    out.push({ replacementPowerId: parts[0], originalPowerId: parts[1] });
  }
  return out;
}

function parsePowerSwapRules(feature: ClassFeature): ClassFeaturePowerSwapRule[] {
  if (feature.powerSwapRules?.length) return feature.powerSwapRules;
  return [];
}

function swapRuleAppliesToBuild(rule: ClassFeaturePowerSwapRule, build: CharacterBuild): boolean {
  if (!build.classId) return false;
  if (rule.classIds?.length && !rule.classIds.includes(build.classId)) return false;
  return true;
}

/** Legal pick list for a `powerswap` rule (fixed list or class usage pool). */
export function resolvePowerSwapLegalIds(
  index: RulesIndex,
  classId: string | undefined,
  rule: ClassFeaturePowerSwapRule
): string[] {
  if (rule.powerIds.length > 0) return rule.powerIds;
  if (!classId) return [];
  return getClassPowerIdsForUsagePool(index, classId, rule.usageBucket, rule.slotGainLevel);
}

function roleSwapAppliesToClass(
  index: RulesIndex,
  classId: string | undefined,
  roleBucket: ClassRoleBucket | undefined
): boolean {
  if (!roleBucket || !classId) return true;
  const cls = index.classes.find((c) => c.id === classId);
  return classRoleBucket(cls) === roleBucket;
}

/** Active automatic power id swaps from class features (pact upgrades, etc.). */
export function collectClassFeaturePowerReplacementMap(
  index: RulesIndex,
  build: CharacterBuild
): Map<string, string> {
  const byId = new Map((index.classFeatures ?? []).map((f) => [f.id, f]));
  const replacements = new Map<string, string>();
  for (const fid of collectCharacterClassFeatureIds(index, build)) {
    const feature = byId.get(fid);
    if (!feature) continue;
    for (const rule of parsePowerReplacementRules(feature)) {
      replacements.set(rule.originalPowerId, rule.replacementPowerId);
    }
  }
  return replacements;
}

/** Class-feature and feat automatic power id swaps (feat rules override on collision). */
export function collectAutomaticPowerReplacementMap(
  index: RulesIndex,
  build: CharacterBuild
): Map<string, string> {
  const replacements = collectClassFeaturePowerReplacementMap(index, build);
  for (const [originalPowerId, replacementPowerId] of collectFeatPowerReplacementMap(index, build)) {
    replacements.set(originalPowerId, replacementPowerId);
  }
  return replacements;
}

export function applyClassFeaturePowerIdReplacements(
  powerIds: Iterable<string>,
  replacements: Map<string, string>
): string[] {
  if (replacements.size === 0) return [...powerIds];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const pid of powerIds) {
    const next = replacements.get(pid) ?? pid;
    if (seen.has(next)) continue;
    seen.add(next);
    out.push(next);
  }
  return out;
}

export function applyClassFeaturePowerIdReplacementsToSet(
  powerIds: Set<string>,
  replacements: Map<string, string>
): void {
  if (replacements.size === 0) return;
  for (const pid of [...powerIds]) {
    const next = replacements.get(pid);
    if (next && next !== pid) {
      powerIds.delete(pid);
      powerIds.add(next);
    }
  }
}

export function applyClassFeaturePowerReplacementsToSlots(
  slots: Record<string, string> | undefined,
  replacements: Map<string, string>
): Record<string, string> | undefined {
  if (!slots || replacements.size === 0) return slots;
  let changed = false;
  const next = { ...slots };
  for (const [key, pid] of Object.entries(next)) {
    const repl = replacements.get(pid.trim());
    if (repl && repl !== pid) {
      next[key] = repl;
      changed = true;
    }
  }
  return changed ? next : slots;
}

/** Apply player picks for `powerswap` progression features to class power slots. */
export function applyClassFeaturePowerSwapSelections(
  build: CharacterBuild,
  index: RulesIndex,
  slotDefs: ClassPowerSlotDef[]
): Record<string, string> | undefined {
  const byId = new Map((index.classFeatures ?? []).map((f) => [f.id, f]));
  const rs = build.classSelections ?? {};
  let slots = { ...(build.classPowerSlots || {}) };
  let changed = false;

  for (const fid of collectCharacterClassFeatureIds(index, build)) {
    const feature = byId.get(fid);
    if (!feature) continue;
    for (const rule of parsePowerSwapRules(feature)) {
      if (!swapRuleAppliesToBuild(rule, build)) continue;
      const pick = rs[classPowerSwapSelectionKey(feature.id)]?.trim();
      const legalIds = resolvePowerSwapLegalIds(index, build.classId, rule);
      if (!pick || !legalIds.includes(pick)) continue;
      const slot = slotDefs.find(
        (d) => d.bucket === rule.usageBucket && d.gainLevel === rule.slotGainLevel
      );
      if (!slot) continue;
      if (slots[slot.key] !== pick) {
        slots[slot.key] = pick;
        changed = true;
      }
    }
  }

  return changed ? slots : build.classPowerSlots;
}

function featureAppliesToClass(index: RulesIndex, feature: ClassFeature, classId: string): boolean {
  const spec = feature.raw?.specific as Record<string, unknown> | undefined;
  const cfClass = String(spec?.Class ?? "").trim();
  if (!cfClass) return true;
  if (cfClass === classId) return true;
  const cls = index.classes.find((c) => c.id === classId);
  const parent = String((cls?.raw?.specific as Record<string, unknown> | undefined)?._ParentClass ?? "").trim();
  return Boolean(parent && parent === cfClass);
}

/** Power swap pick groups for Essentials progression features (Warpriest dailies, …). */
export function classFeaturePowerSwapChoiceGroups(
  index: RulesIndex,
  classId: string | undefined
): Array<{
  key: string;
  parentFeatureId: string;
  parentFeatureName: string;
  minLevel: number;
  powerIds: string[];
}> {
  if (!classId) return [];
  const out: Array<{
    key: string;
    parentFeatureId: string;
    parentFeatureName: string;
    minLevel: number;
    powerIds: string[];
  }> = [];
  for (const feature of index.classFeatures ?? []) {
    const swaps = parsePowerSwapRules(feature);
    if (swaps.length === 0) continue;
    const swap = swaps[0]!;
    if (swap.classIds?.length && classId && !swap.classIds.includes(classId)) continue;
    if (swap.roleBucket && !roleSwapAppliesToClass(index, classId, swap.roleBucket)) continue;
    if (!featureAppliesToClass(index, feature, classId)) continue;
    const powerIds = resolvePowerSwapLegalIds(index, classId, swap);
    if (powerIds.length === 0) continue;
    out.push({
      key: classPowerSwapSelectionKey(feature.id),
      parentFeatureId: feature.id,
      parentFeatureName: feature.name,
      minLevel: parseFeatureLevel(feature) ?? 1,
      powerIds
    });
  }
  return out.sort((a, b) => a.minLevel - b.minLevel || a.parentFeatureName.localeCompare(b.parentFeatureName));
}
