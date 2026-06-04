import {
  featGrantedPowerIdsExcludedFromClassFeaturePicks,
  paragonPathClassFeaturePowerIds
} from "./grantedPowersQuery";
import type { CharacterBuild, ClassDef, ClassFeature, Power, RulesIndex } from "./models";
import {
  applyMageSpellbookPowerGroupRules,
  applyWizardSpellbookPowerGroupRules,
  isWizardSpellbookPowerGroup,
  wizardSpellbookPowerChoiceLabel
} from "./wizardSpellbook";
import {
  buildClassFeatureLookups,
  parseTraitNamesFromField,
  specOf
} from "./supportTraits";

/** Optional class-feature choice: keep default proficiencies / omit the feature. */
export const CLASS_FEATURE_CHOICE_NONE = "__none__";

export type ClassFeatureChoiceKind = "classFeature" | "power";

export interface ClassFeatureChoiceOption {
  id: string;
  name: string;
  parentFeatureId: string;
  parentFeatureName: string;
  shortDescription?: string | null;
  body?: string | null;
  powerIds: string[];
}

/** Show this group only when another group has a specific option selected. */
export interface ClassFeatureChoiceVisibleWhen {
  groupKey: string;
  optionId: string;
}

/** Heroes of the Feywild optional bard feature (two picks at 1st, +1 at 13th and 17th). */
export const SIGNS_OF_INFLUENCE_CLASS_FEATURE_ID = "ID_FMP_CLASS_FEATURE_4139";

export interface ClassFeatureChoiceGroup {
  key: string;
  kind: ClassFeatureChoiceKind;
  parentFeatureId: string;
  parentFeatureName: string;
  pickCount: number;
  /** Character level required before this pick group is offered (defaults to 1). */
  minLevel?: number;
  /** Wizard Spellbook pool label from compendium (e.g. "Power Daily 1"). */
  spellbookSlotLabel?: string;
  /** Populated when `kind` is `power` (e.g. wizard cantrips). */
  powerIds: string[];
  options: ClassFeatureChoiceOption[];
  visibleWhen?: ClassFeatureChoiceVisibleWhen;
  /** Set when one class feature has multiple compendium power select pools (cleric Channel Divinity). */
  powerPoolIndex?: number;
  powerPoolCount?: number;
  /** When true, empty / `CLASS_FEATURE_CHOICE_NONE` means the optional feature is not taken. */
  optional?: boolean;
}

type ClassFeatureSelectRule = { attrs?: Record<string, string> };

function parsePowerIdsFromField(spec: Record<string, unknown> | undefined, field: string): string[] {
  const raw = String(spec?.[field] ?? "").trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((id) => id.startsWith("ID_FMP_POWER"));
}

function classFeatureSelectRules(cf: ClassFeature | undefined): ClassFeatureSelectRule[] {
  const rules = cf?.raw?.rules as Record<string, unknown> | undefined;
  const select = rules?.select;
  return Array.isArray(select) ? (select as ClassFeatureSelectRule[]) : [];
}

function classFeatureSelectCategory(attrs: Record<string, string>): string {
  return String(attrs.Category ?? attrs.category ?? "").trim();
}

function parentClassId(index: RulesIndex, classId: string | undefined): string | undefined {
  if (!classId) return undefined;
  const cls = index.classes.find((c) => c.id === classId);
  const parent = (cls?.raw?.specific as Record<string, unknown> | undefined)?.["_ParentClass"];
  return typeof parent === "string" && parent.startsWith("ID_") ? parent : undefined;
}

function powerOwnedByClass(
  powerClassId: string,
  classId: string | undefined,
  parentId: string | undefined
): boolean {
  if (!powerClassId || !classId) return true;
  return powerClassId === classId || (parentId != null && powerClassId === parentId);
}

function parsePositiveInt(text: unknown, fallback: number): number {
  const n = Number.parseInt(String(text ?? "").trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Level-gated `select` rows on a class feature (e.g. Signs of Influence at 1 / 13 / 17). */
export function levelGatedClassFeatureSelects(
  feature: ClassFeature
): Array<{ minLevel: number; pickCount: number }> {
  const out: Array<{ minLevel: number; pickCount: number }> = [];
  for (const item of classFeatureSelectRules(feature)) {
    const attrs = item.attrs ?? {};
    if (attrs.type !== "Class Feature") continue;
    out.push({
      minLevel: parsePositiveInt(attrs.Level, 1),
      pickCount: parsePositiveInt(attrs.number, 1)
    });
  }
  return out;
}

function optionsFromClassFeatureSelect(
  index: RulesIndex,
  parent: ClassFeature
): ClassFeatureChoiceOption[] {
  const parentId = parent.id;
  const parentName = parent.name;
  const { byId } = buildClassFeatureLookups(index);
  const subIds = parseTraitNamesFromField(specOf(parent), "_PARSED_SUB_FEATURES");
  if (subIds.length) {
    return subIds
      .map((sid) => byId.get(sid))
      .filter((f): f is ClassFeature => !!f)
      .map((child) => ({
        id: child.id,
        name: child.name,
        parentFeatureId: parentId,
        parentFeatureName: parentName,
        shortDescription: child.shortDescription ?? null,
        body: child.body ?? null,
        powerIds: []
      }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }
  const options: ClassFeatureChoiceOption[] = [];
  for (const item of classFeatureSelectRules(parent)) {
    const attrs = item.attrs ?? {};
    if (attrs.type !== "Class Feature") continue;
    const cat = classFeatureSelectCategory(attrs);
    for (const token of cat.split("|")) {
      const tid = token.trim();
      if (!tid.startsWith("ID_") || tid === parentId) continue;
      if (/^ID_(?:FMP|DBB)_CLASS_\d+$/.test(tid)) continue;
      const child = byId.get(tid);
      if (!child) continue;
      options.push({
        id: child.id,
        name: child.name,
        parentFeatureId: parentId,
        parentFeatureName: parentName,
        shortDescription: child.shortDescription ?? null,
        body: child.body ?? null,
        powerIds: []
      });
    }
  }
  return options.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

/**
 * All power ids a class feature power pick may offer: `specific.Powers` and resolved `select`
 * categories (including other class features). Cantrips and choice groups are pre-merged in ETL.
 */
export function classFeatureSelectablePowerIds(
  index: RulesIndex,
  parentFeatureId: string,
  visiting: Set<string> = new Set()
): Set<string> {
  if (visiting.has(parentFeatureId)) return new Set();
  visiting.add(parentFeatureId);

  const cf = index.classFeatures?.find((f) => f.id === parentFeatureId);
  if (!cf) return new Set();
  const spec = cf.raw?.specific as Record<string, unknown> | undefined;
  const ids = new Set<string>();
  for (const pid of parsePowerIdsFromField(spec, "Powers")) ids.add(pid);
  for (const pid of parsePowerIdsFromField(spec, "_DisplayPowers")) ids.add(pid);

  for (const item of classFeatureSelectRules(cf)) {
    const attrs = item.attrs ?? {};
    if (attrs.type !== "Power") continue;
    const cat = classFeatureSelectCategory(attrs);
    if (cat.startsWith("ID_FMP_POWER")) {
      for (const part of cat.split("|")) {
        const pid = part.trim();
        if (pid.startsWith("ID_FMP_POWER")) ids.add(pid);
      }
    } else if (
      cat.startsWith("ID_") &&
      cat.includes("_CLASS_FEATURE_") &&
      cat !== parentFeatureId
    ) {
      for (const pid of classFeatureSelectablePowerIds(index, cat, visiting)) ids.add(pid);
    }
  }

  return ids;
}

/** Power ids listed for this feature's power pick (used for feat/paragon exclusion bypass). */
export function classFeaturePowerSelectCategoryIds(
  index: RulesIndex,
  parentFeatureId: string
): Set<string> {
  return classFeatureSelectablePowerIds(index, parentFeatureId);
}

/** Compendium power-select pools for a class feature scoped to one class (`requires` on select). */
export function classFeaturePowerSelectPoolsForClass(
  index: RulesIndex,
  parentFeatureId: string,
  classId: string
): string[][] {
  const cf = index.classFeatures?.find((f) => f.id === parentFeatureId);
  if (!cf) return [];
  const paragonExclude = paragonPathClassFeaturePowerIds(index);
  const ownSelect = classFeaturePowerSelectCategoryIds(index, parentFeatureId);
  const pools: string[][] = [];
  for (const item of classFeatureSelectRules(cf)) {
    const attrs = item.attrs ?? {};
    if (attrs.type !== "Power") continue;
    const req = (attrs.requires || "").trim();
    if (req && req !== classId) continue;
    const cat = classFeatureSelectCategory(attrs);
    const pool: string[] = [];
    if (cat.startsWith("ID_") && cat.includes("_CLASS_FEATURE_")) {
      for (const pid of classFeatureSelectablePowerIds(index, cat)) {
        if (paragonExclude.has(pid) && !ownSelect.has(pid)) continue;
        pool.push(pid);
      }
    } else if (cat.includes("ID_FMP_POWER")) {
      for (const part of cat.split("|")) {
        const pid = part.trim();
        if (!pid.startsWith("ID_FMP_POWER")) continue;
        if (paragonExclude.has(pid) && !ownSelect.has(pid)) continue;
        pool.push(pid);
      }
    }
    if (pool.length) pools.push(pool);
  }
  return pools;
}

function isSlottedClassPowerGroupKey(key: string): boolean {
  return /^classPower:[^:]+:\d+$/.test(key);
}

/** Split monolithic power choice groups into per-pool groups when compendium data defines them. */
export function expandClassFeaturePowerChoiceGroups(
  index: RulesIndex,
  classId: string | undefined,
  groups: ClassFeatureChoiceGroup[]
): ClassFeatureChoiceGroup[] {
  if (!classId) return groups;
  const out: ClassFeatureChoiceGroup[] = [];
  for (const g of groups) {
    if (g.kind !== "power" || isSlottedClassPowerGroupKey(g.key)) {
      out.push(g);
      continue;
    }
    const pools = classFeaturePowerSelectPoolsForClass(index, g.parentFeatureId, classId);
    if (pools.length <= 1) {
      out.push(g);
      continue;
    }
    const poolCount = pools.length;
    pools.forEach((powerIds, poolIndex) => {
      out.push({
        ...g,
        key: `${g.key}:${poolIndex}`,
        pickCount: 1,
        powerIds,
        powerPoolIndex: poolIndex,
        powerPoolCount: poolCount
      });
    });
  }
  return out;
}

export function getClassFeatureChoiceGroups(
  index: RulesIndex,
  cls: ClassDef | undefined
): ClassFeatureChoiceGroup[] {
  if (!cls) return [];
  const raw = index.classFeatureChoiceGroupsByClassId?.[cls.id] ?? [];
  let groups = raw.map((g) => {
    const vw = g.visibleWhen;
    const visibleWhen =
      vw && typeof vw.groupKey === "string" && typeof vw.optionId === "string"
        ? { groupKey: String(vw.groupKey), optionId: String(vw.optionId) }
        : undefined;
    const key = String(g.key);
    const slotMatch = key.match(/^classPower:(.+):(\d+)$/);
    const poolIndex = slotMatch ? Number(slotMatch[2]) : undefined;
    return {
      key,
      kind: g.kind === "power" ? "power" : "classFeature",
      parentFeatureId: String(g.parentFeatureId || ""),
      parentFeatureName: String(g.parentFeatureName || "Class feature"),
      pickCount: Math.max(1, Number(g.pickCount) || 1),
      powerIds: (g.powerIds ?? []).map((p) => String(p)),
      visibleWhen,
      powerPoolIndex: poolIndex,
      powerPoolCount: slotMatch ? undefined : undefined,
      options: (g.options ?? []).map((o) => ({
        id: String(o.id),
        name: String(o.name || o.id),
        parentFeatureId: String(o.parentFeatureId || ""),
        parentFeatureName: String(o.parentFeatureName || ""),
        shortDescription: o.shortDescription ?? null,
        body: o.body ?? null,
        powerIds: (o.powerIds ?? []).map((p) => String(p))
      })),
      optional: Boolean((g as { optional?: boolean }).optional),
      minLevel:
        (g as { minLevel?: number }).minLevel != null
          ? Math.max(1, Number((g as { minLevel?: number }).minLevel) || 1)
          : undefined
    } satisfies ClassFeatureChoiceGroup;
  });

  const expanded = expandClassFeaturePowerChoiceGroups(index, cls.id, groups);
  const poolCounts = new Map<string, number>();
  for (const g of expanded) {
    if (g.kind !== "power" || g.powerPoolIndex == null) continue;
    const base = g.key.replace(/:\d+$/, "");
    poolCounts.set(base, (poolCounts.get(base) ?? 0) + 1);
  }
  const withPoolCounts = expanded.map((g) => {
    if (g.powerPoolIndex == null) return g;
    const base = g.key.replace(/:\d+$/, "");
    const count = poolCounts.get(base);
    return count && count > 1 ? { ...g, powerPoolCount: count } : g;
  });
  return sortClassFeatureChoiceGroupsByLevel(
    applyMageSpellbookPowerGroupRules(
      applyWizardSpellbookPowerGroupRules(index, withPoolCounts)
    )
  );
}

export function isClassFeatureChoiceGroupVisible(
  group: ClassFeatureChoiceGroup,
  classSelections: Record<string, string> | undefined,
  characterLevel?: number
): boolean {
  const minLevel = group.minLevel ?? 1;
  if (characterLevel != null && characterLevel < minLevel) return false;
  const when = group.visibleWhen;
  if (!when) return true;
  return classSelections?.[when.groupKey]?.trim() === when.optionId;
}

export function filterVisibleClassFeatureChoiceGroups(
  groups: ClassFeatureChoiceGroup[],
  classSelections: Record<string, string> | undefined,
  characterLevel?: number
): ClassFeatureChoiceGroup[] {
  return groups.filter((g) => isClassFeatureChoiceGroupVisible(g, classSelections, characterLevel));
}

/** Class tab pick groups: level 1 before level 4 before level 5, then name. */
export function sortClassFeatureChoiceGroupsByLevel(
  groups: ClassFeatureChoiceGroup[]
): ClassFeatureChoiceGroup[] {
  return [...groups].sort((a, b) => {
    const la = a.minLevel ?? 1;
    const lb = b.minLevel ?? 1;
    if (la !== lb) return la - lb;
    return a.parentFeatureName.localeCompare(b.parentFeatureName, undefined, {
      sensitivity: "base"
    });
  });
}

export const MAGE_APPRENTICE_L1_CHOICE_KEY = "classFeature:ID_FMP_CLASS_FEATURE_2867";
export const MAGE_APPRENTICE_L4_CHOICE_KEY = "classFeature:ID_FMP_CLASS_FEATURE_3043:4";
export const MAGE_EXPERT_L5_CHOICE_KEY = "classFeature:ID_FMP_CLASS_FEATURE_2871:5";
export const MAGE_EXPERT_L8_CHOICE_KEY = "classFeature:ID_FMP_CLASS_FEATURE_3050:8";
export const MAGE_MASTER_CHOICE_KEY = "classFeature:ID_FMP_CLASS_FEATURE_2872:10";
export const MAGE_CLASS_ID = "ID_FMP_CLASS_722";

function classFeaturePrereqName(cf: ClassFeature | undefined): string {
  if (!cf) return "";
  const raw = cf.raw as { prereqs?: string };
  return String(raw.prereqs ?? "").trim();
}

function mageApprenticeSchoolNames(
  index: RulesIndex,
  selections: Record<string, string>
): Set<string> {
  const { byId } = buildClassFeatureLookups(index);
  const names = new Set<string>();
  for (const key of [MAGE_APPRENTICE_L1_CHOICE_KEY, MAGE_APPRENTICE_L4_CHOICE_KEY]) {
    const id = selections[key]?.trim();
    if (!id?.startsWith("ID_")) continue;
    const cf = byId.get(id);
    if (cf?.name) names.add(cf.name);
  }
  return names;
}

function expertOptionAllowedForApprentice(
  index: RulesIndex,
  optionId: string,
  apprenticeNames: Set<string>
): boolean {
  if (!apprenticeNames.size) return true;
  const cf = index.classFeatures?.find((f) => f.id === optionId);
  const prereq = classFeaturePrereqName(cf);
  return !!prereq && apprenticeNames.has(prereq);
}

/** Level 5/8 Expert Mage: only schools chosen at Apprentice Mage (L8 = the other school vs L5). */
export function filterMageExpertMageChoiceOptions(
  index: RulesIndex,
  group: ClassFeatureChoiceGroup,
  selections: Record<string, string>
): ClassFeatureChoiceOption[] {
  const isL5 =
    group.key === MAGE_EXPERT_L5_CHOICE_KEY || group.parentFeatureName === "Level 5 Expert Mage";
  const isL8 =
    group.key === MAGE_EXPERT_L8_CHOICE_KEY || group.parentFeatureName === "Level 8 Expert Mage";
  if (!isL5 && !isL8) return group.options;

  const apprentices = mageApprenticeSchoolNames(index, selections);
  if (!apprentices.size) return group.options;

  let allowed = group.options.filter((o) =>
    expertOptionAllowedForApprentice(index, o.id, apprentices)
  );

  if (isL8) {
    const l5Id = selections[MAGE_EXPERT_L5_CHOICE_KEY]?.trim();
    if (l5Id?.startsWith("ID_")) {
      const l5Prereq = classFeaturePrereqName(index.classFeatures?.find((f) => f.id === l5Id));
      if (l5Prereq) {
        allowed = allowed.filter((o) => {
          const prereq = classFeaturePrereqName(index.classFeatures?.find((f) => f.id === o.id));
          return prereq && prereq !== l5Prereq;
        });
      }
    }
  }

  return allowed;
}

function mageExpertSchoolNames(
  index: RulesIndex,
  selections: Record<string, string>
): Set<string> {
  const { byId } = buildClassFeatureLookups(index);
  const names = new Set<string>();
  for (const key of [MAGE_EXPERT_L5_CHOICE_KEY, MAGE_EXPERT_L8_CHOICE_KEY]) {
    const id = selections[key]?.trim();
    if (!id?.startsWith("ID_")) continue;
    const cf = byId.get(id);
    if (cf?.name) names.add(cf.name);
  }
  return names;
}

function masterOptionAllowedForExpert(
  index: RulesIndex,
  optionId: string,
  expertNames: Set<string>
): boolean {
  if (!expertNames.size) return true;
  const cf = index.classFeatures?.find((f) => f.id === optionId);
  const prereq = classFeaturePrereqName(cf);
  return !!prereq && expertNames.has(prereq);
}

/** Master Mage (level 10): only schools chosen at Level 5 and Level 8 Expert Mage. */
export function filterMageMasterMageChoiceOptions(
  index: RulesIndex,
  group: ClassFeatureChoiceGroup,
  selections: Record<string, string>
): ClassFeatureChoiceOption[] {
  const isMaster =
    group.key === MAGE_MASTER_CHOICE_KEY || group.parentFeatureName === "Master Mage";
  if (!isMaster) return group.options;

  const experts = mageExpertSchoolNames(index, selections);
  if (!experts.size) return group.options;

  return group.options.filter((o) => masterOptionAllowedForExpert(index, o.id, experts));
}

/** Apprentice → Expert → Master mage school pick filtering. */
export function filterMageSchoolProgressionChoiceOptions(
  index: RulesIndex,
  group: ClassFeatureChoiceGroup,
  selections: Record<string, string>
): ClassFeatureChoiceOption[] {
  const master = filterMageMasterMageChoiceOptions(index, group, selections);
  if (master !== group.options) return master;
  return filterMageExpertMageChoiceOptions(index, group, selections);
}

/** Level 8 Expert Mage: the school not taken at level 5 (when that pick is known). */
export function resolveMageLevel8ExpertMageOptionId(
  index: RulesIndex,
  group: ClassFeatureChoiceGroup,
  selections: Record<string, string>
): string | undefined {
  const allowed = filterMageExpertMageChoiceOptions(index, group, selections);
  return allowed.length === 1 ? allowed[0]?.id : undefined;
}

export function isAutoMageLevel8ExpertMageGroup(
  index: RulesIndex,
  group: ClassFeatureChoiceGroup,
  selections: Record<string, string>
): boolean {
  if (
    group.key !== MAGE_EXPERT_L8_CHOICE_KEY &&
    group.parentFeatureName !== "Level 8 Expert Mage"
  ) {
    return false;
  }
  return resolveMageLevel8ExpertMageOptionId(index, group, selections) != null;
}

export function syncMageLevel8ExpertMageSelection(
  index: RulesIndex,
  classId: string | undefined,
  selections: Record<string, string> | undefined,
  groups: ClassFeatureChoiceGroup[],
  characterLevel: number
): Record<string, string> {
  const base = { ...(selections ?? {}) };
  if (characterLevel < 8 || classId !== MAGE_CLASS_ID) return base;

  const group = groups.find((g) => g.key === MAGE_EXPERT_L8_CHOICE_KEY);
  if (!group) return base;

  const autoId = resolveMageLevel8ExpertMageOptionId(index, group, base);
  if (autoId) {
    if (base[MAGE_EXPERT_L8_CHOICE_KEY] === autoId) return base;
    return { ...base, [MAGE_EXPERT_L8_CHOICE_KEY]: autoId };
  }

  const picked = base[MAGE_EXPERT_L8_CHOICE_KEY]?.trim();
  if (!picked?.startsWith("ID_")) return base;

  const legal = new Set(
    filterMageSchoolProgressionChoiceOptions(index, group, base).map((o) => o.id)
  );
  if (legal.has(picked)) return base;

  const next = { ...base };
  delete next[MAGE_EXPERT_L8_CHOICE_KEY];
  return next;
}

export function applyClassFeatureChoiceOptionFilters(
  index: RulesIndex,
  groups: ClassFeatureChoiceGroup[],
  selections: Record<string, string>
): ClassFeatureChoiceGroup[] {
  return groups.map((g) => {
    const options = filterMageSchoolProgressionChoiceOptions(index, g, selections);
    return options === g.options ? g : { ...g, options };
  });
}

export function pruneInvalidMageExpertMageSelections(
  index: RulesIndex,
  selections: Record<string, string>,
  groups: ClassFeatureChoiceGroup[]
): Record<string, string> {
  const next = { ...selections };
  let changed = false;
  for (const g of groups) {
    if (g.kind !== "classFeature") continue;
    const legal = new Set(filterMageSchoolProgressionChoiceOptions(index, g, next).map((o) => o.id));
    const picked = next[g.key]?.trim();
    if (picked?.startsWith("ID_") && !legal.has(picked)) {
      delete next[g.key];
      changed = true;
    }
  }
  return changed ? next : selections;
}

export function classFeatureChoiceLabel(group: ClassFeatureChoiceGroup): string {
  const levelNote =
    group.minLevel != null && group.minLevel > 1 ? ` (at level ${group.minLevel}+)` : "";
  const picks = `${group.pickCount} pick${group.pickCount === 1 ? "" : "s"}`;
  return `${group.parentFeatureName}${levelNote} — ${picks}`;
}

/** All class-feature option ids chosen under the same parent (across level-gated pick groups). */
export function collectClassFeatureSubOptionIds(
  groups: ClassFeatureChoiceGroup[],
  classSelections: Record<string, string> | undefined,
  characterLevel?: number
): string[] {
  const ids: string[] = [];
  for (const g of filterVisibleClassFeatureChoiceGroups(groups, classSelections, characterLevel)) {
    if (g.kind !== "classFeature" || g.optional) continue;
    if (g.pickCount > 1) {
      ids.push(...parseClassPowerChoiceSelection(classSelections?.[g.key]));
    } else {
      const picked = classSelections?.[g.key]?.trim();
      if (picked?.startsWith("ID_") && picked !== CLASS_FEATURE_CHOICE_NONE) ids.push(picked);
    }
  }
  return ids;
}

export function resolveClassFeatureChoiceIdsForGroup(
  group: ClassFeatureChoiceGroup,
  classSelections: Record<string, string> | undefined
): string[] {
  if (group.kind !== "classFeature") return [];
  if (group.pickCount > 1) {
    return parseClassPowerChoiceSelection(classSelections?.[group.key]);
  }
  const picked = classSelections?.[group.key]?.trim();
  return picked?.startsWith("ID_") && picked !== CLASS_FEATURE_CHOICE_NONE ? [picked] : [];
}

/** Drop selections for groups that are currently hidden (e.g. Sharpshooter sub-pick after choosing Weapon Talent). */
export function pruneHiddenClassFeatureSelections(
  classSelections: Record<string, string>,
  groups: ClassFeatureChoiceGroup[],
  characterLevel?: number
): Record<string, string> {
  const next = { ...classSelections };
  for (const g of groups) {
    if (!isClassFeatureChoiceGroupVisible(g, next, characterLevel)) {
      delete next[g.key];
    }
  }
  return next;
}

/** Stored power picks for a `classPower:${traitId}` group (comma-separated ids). */
export function classPowerChoiceSelectionKey(groupKey: string, slotIndex: number): string {
  return `${groupKey}:${slotIndex}`;
}

export function parseClassPowerChoiceSelection(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function formatClassPowerChoiceSelection(powerIds: string[]): string {
  return powerIds.filter(Boolean).join(",");
}

/**
 * Map legacy `classPower:featureId` (comma-separated picks) to per-pool keys
 * `classPower:featureId:0`, `classPower:featureId:1`, …
 */
export function migrateLegacyClassPowerSelections(
  index: RulesIndex,
  classId: string | undefined,
  classSelections: Record<string, string> | undefined,
  groups: ClassFeatureChoiceGroup[]
): Record<string, string> | undefined {
  if (!classSelections || !classId) return classSelections;
  let changed = false;
  const next = { ...classSelections };

  const slottedByBase = new Map<string, ClassFeatureChoiceGroup[]>();
  for (const g of groups) {
    if (g.kind !== "power") continue;
    const m = g.key.match(/^classPower:(.+):(\d+)$/);
    if (!m) continue;
    const base = `classPower:${m[1]}`;
    const list = slottedByBase.get(base) ?? [];
    list.push(g);
    slottedByBase.set(base, list);
  }

  for (const [base, slotGroups] of slottedByBase) {
    const legacy = next[base];
    if (!legacy) continue;
    const picks = parseClassPowerChoiceSelection(legacy);
    const ordered = [...slotGroups].sort(
      (a, b) => (a.powerPoolIndex ?? 0) - (b.powerPoolIndex ?? 0)
    );
    for (const g of ordered) {
      const legal = new Set(classFeaturePowerIdsForClass(index, g, classId));
      const pick = picks.find((p) => legal.has(p));
      if (pick) next[g.key] = pick;
    }
    delete next[base];
    changed = true;
  }

  return changed ? next : classSelections;
}

export function effectiveClassSelectionsForChoiceGroups(
  index: RulesIndex,
  classId: string | undefined,
  classSelections: Record<string, string> | undefined,
  groups: ClassFeatureChoiceGroup[],
  characterLevel?: number
): Record<string, string> {
  let next =
    migrateLegacyClassPowerSelections(index, classId, classSelections, groups) ?? {};
  next = pruneInvalidMageExpertMageSelections(index, next, groups);
  if (characterLevel != null) {
    next = syncMageLevel8ExpertMageSelection(index, classId, next, groups, characterLevel);
  }
  return next;
}

export function classFeaturePowerChoiceLabel(
  group: ClassFeatureChoiceGroup,
  index?: RulesIndex
): string {
  if (index && isWizardSpellbookPowerGroup(group)) {
    return wizardSpellbookPowerChoiceLabel(group, index);
  }
  if (group.powerPoolCount != null && group.powerPoolCount > 1 && group.powerPoolIndex != null) {
    return `${group.parentFeatureName} (choice ${group.powerPoolIndex + 1} of ${group.powerPoolCount})`;
  }
  return `${group.parentFeatureName} (${group.pickCount} pick${group.pickCount === 1 ? "" : "s"})`;
}

/**
 * Some compendium class-feature power groups (for example Channel Divinity) can include
 * cross-class ids. Restrict selectable powers to the currently selected class when owner data exists.
 */
export function classFeaturePowerIdsForClass(
  index: RulesIndex,
  group: ClassFeatureChoiceGroup,
  classId: string | undefined
): string[] {
  if (group.kind !== "power") return [];
  const byId = new Map(index.powers.map((p) => [p.id, p]));
  const paragonFeaturePowers = paragonPathClassFeaturePowerIds(index);
  const featOnlyPowers = featGrantedPowerIdsExcludedFromClassFeaturePicks(index);
  const ownSelect = classFeatureSelectablePowerIds(index, group.parentFeatureId);
  const candidates = new Set(group.powerIds);
  if (group.powerPoolIndex == null) {
    for (const pid of ownSelect) candidates.add(pid);
  }
  return [...candidates].filter((pid) => {
    if (paragonFeaturePowers.has(pid) && !ownSelect.has(pid)) return false;
    if (featOnlyPowers.has(pid) && !ownSelect.has(pid)) return false;
    const p = byId.get(pid);
    if (!p) return false;
    const owner = (p.classId || "").trim();
    return powerOwnedByClass(owner, classId, parentClassId(index, classId));
  });
}

/**
 * No real choice: pick count equals the number of legal options (e.g. paladin Channel Divinity).
 */
export function isFixedClassPowerChoiceGroup(
  index: RulesIndex,
  group: ClassFeatureChoiceGroup,
  classId: string | undefined
): boolean {
  if (group.kind !== "power" || !classId) return false;
  const legal = classFeaturePowerIdsForClass(index, group, classId);
  return legal.length > 0 && legal.length === group.pickCount;
}

export function fixedClassPowerChoiceIds(
  index: RulesIndex,
  group: ClassFeatureChoiceGroup,
  classId: string | undefined
): string[] {
  if (!isFixedClassPowerChoiceGroup(index, group, classId)) return [];
  return classFeaturePowerIdsForClass(index, group, classId);
}

export function resolveClassPowerChoiceIdsForGroup(
  index: RulesIndex,
  group: ClassFeatureChoiceGroup,
  classId: string | undefined,
  classSelections: Record<string, string> | undefined
): string[] {
  const fixed = fixedClassPowerChoiceIds(index, group, classId);
  if (fixed.length) return fixed;
  return parseClassPowerChoiceSelection(classSelections?.[group.key]);
}

export function filterClassFeatureChoiceGroupsRequiringSelection(
  groups: ClassFeatureChoiceGroup[],
  index: RulesIndex,
  classId: string | undefined
): ClassFeatureChoiceGroup[] {
  return groups.filter(
    (g) => g.kind !== "power" || !isFixedClassPowerChoiceGroup(index, g, classId)
  );
}

function collectClassFeaturePowerChoiceIdsForClass(
  index: RulesIndex,
  classId: string | undefined,
  classSelections: Record<string, string> | undefined,
  characterLevel: number
): string[] {
  if (!classId) return [];
  const cls = index.classes.find((c) => c.id === classId);
  const groups = getClassFeatureChoiceGroups(index, cls);
  const rs = effectiveClassSelectionsForChoiceGroups(
    index,
    classId,
    classSelections,
    groups,
    characterLevel
  );
  const ids: string[] = [];
  for (const g of filterVisibleClassFeatureChoiceGroups(groups, rs, characterLevel)) {
    if (g.kind !== "power") continue;
    ids.push(...resolveClassPowerChoiceIdsForGroup(index, g, classId, rs));
  }
  return ids;
}

/** Class feature power picks (Channel Divinity, cantrips, …) including auto-granted fixed sets. */
export function collectClassFeaturePowerChoiceIds(
  index: RulesIndex,
  build: Pick<
    CharacterBuild,
    "classId" | "characterStyle" | "hybridClassIdA" | "hybridClassIdB" | "classSelections" | "level"
  >
): string[] {
  const rs = build.classSelections;
  const level = build.level;
  if (build.characterStyle === "hybrid") {
    const ha = index.hybridClasses?.find((h) => h.id === build.hybridClassIdA);
    const hb = index.hybridClasses?.find((h) => h.id === build.hybridClassIdB);
    return [
      ...collectClassFeaturePowerChoiceIdsForClass(index, ha?.baseClassId, rs, level),
      ...collectClassFeaturePowerChoiceIdsForClass(index, hb?.baseClassId, rs, level)
    ];
  }
  return collectClassFeaturePowerChoiceIdsForClass(index, build.classId, rs, level);
}

export function resolveClassFeaturePowerChoicePowers(
  index: RulesIndex,
  build: Pick<
    CharacterBuild,
    "classId" | "characterStyle" | "hybridClassIdA" | "hybridClassIdB" | "classSelections" | "level"
  >
): Power[] {
  const byId = new Map(index.powers.map((p) => [p.id, p]));
  const seen = new Set<string>();
  const out: Power[] = [];
  for (const pid of collectClassFeaturePowerChoiceIds(index, build)) {
    if (seen.has(pid)) continue;
    const p = byId.get(pid);
    if (!p) continue;
    seen.add(pid);
    out.push(p);
  }
  return out;
}
