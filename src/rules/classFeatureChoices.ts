import {
  featGrantedPowerIdsExcludedFromClassFeaturePicks,
  paragonPathClassFeaturePowerIds
} from "./grantedPowersQuery";
import type { CharacterBuild, ClassDef, ClassFeature, Power, RulesIndex } from "./models";

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

export interface ClassFeatureChoiceGroup {
  key: string;
  kind: ClassFeatureChoiceKind;
  parentFeatureId: string;
  parentFeatureName: string;
  pickCount: number;
  /** Populated when `kind` is `power` (e.g. wizard cantrips). */
  powerIds: string[];
  options: ClassFeatureChoiceOption[];
  visibleWhen?: ClassFeatureChoiceVisibleWhen;
  /** Set when one class feature has multiple compendium power select pools (cleric Channel Divinity). */
  powerPoolIndex?: number;
  powerPoolCount?: number;
}

type ClassFeatureSelectRule = { attrs?: Record<string, string> };

function classFeatureSelectRules(cf: ClassFeature | undefined): ClassFeatureSelectRule[] {
  const rules = cf?.raw?.rules as Record<string, unknown> | undefined;
  const select = rules?.select;
  return Array.isArray(select) ? (select as ClassFeatureSelectRule[]) : [];
}

/** Power ids listed in a class feature's own `rules.select` Power categories. */
export function classFeaturePowerSelectCategoryIds(
  index: RulesIndex,
  parentFeatureId: string
): Set<string> {
  const cf = index.classFeatures?.find((f) => f.id === parentFeatureId);
  if (!cf) return new Set();
  const ids = new Set<string>();
  for (const item of classFeatureSelectRules(cf)) {
    const attrs = item.attrs ?? {};
    if (attrs.type !== "Power") continue;
    const cat = String(attrs.Category ?? "").trim();
    if (!cat.includes("ID_FMP_POWER")) continue;
    for (const part of cat.split("|")) {
      const pid = part.trim();
      if (pid.startsWith("ID_FMP_POWER")) ids.add(pid);
    }
  }
  return ids;
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
    const cat = String(attrs.Category ?? "").trim();
    const pool: string[] = [];
    if (cat.includes("ID_FMP_POWER")) {
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
    if (!pools.length) {
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
  const groups = raw.map((g) => {
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
      }))
    } satisfies ClassFeatureChoiceGroup;
  });

  const expanded = expandClassFeaturePowerChoiceGroups(index, cls.id, groups);
  const poolCounts = new Map<string, number>();
  for (const g of expanded) {
    if (g.kind !== "power" || g.powerPoolIndex == null) continue;
    const base = g.key.replace(/:\d+$/, "");
    poolCounts.set(base, (poolCounts.get(base) ?? 0) + 1);
  }
  return expanded.map((g) => {
    if (g.powerPoolIndex == null) return g;
    const base = g.key.replace(/:\d+$/, "");
    const count = poolCounts.get(base);
    return count && count > 1 ? { ...g, powerPoolCount: count } : g;
  });
}

export function isClassFeatureChoiceGroupVisible(
  group: ClassFeatureChoiceGroup,
  classSelections: Record<string, string> | undefined
): boolean {
  const when = group.visibleWhen;
  if (!when) return true;
  return classSelections?.[when.groupKey]?.trim() === when.optionId;
}

export function filterVisibleClassFeatureChoiceGroups(
  groups: ClassFeatureChoiceGroup[],
  classSelections: Record<string, string> | undefined
): ClassFeatureChoiceGroup[] {
  return groups.filter((g) => isClassFeatureChoiceGroupVisible(g, classSelections));
}

/** Drop selections for groups that are currently hidden (e.g. Sharpshooter sub-pick after choosing Weapon Talent). */
export function pruneHiddenClassFeatureSelections(
  classSelections: Record<string, string>,
  groups: ClassFeatureChoiceGroup[]
): Record<string, string> {
  const next = { ...classSelections };
  for (const g of groups) {
    if (!isClassFeatureChoiceGroupVisible(g, next)) {
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
  groups: ClassFeatureChoiceGroup[]
): Record<string, string> {
  return migrateLegacyClassPowerSelections(index, classId, classSelections, groups) ?? {};
}

export function classFeaturePowerChoiceLabel(group: ClassFeatureChoiceGroup): string {
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
  const ownSelect = classFeaturePowerSelectCategoryIds(index, group.parentFeatureId);
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
    if (!owner || !classId) return true;
    return owner === classId;
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
  classSelections: Record<string, string> | undefined
): string[] {
  if (!classId) return [];
  const cls = index.classes.find((c) => c.id === classId);
  const groups = getClassFeatureChoiceGroups(index, cls);
  const rs = effectiveClassSelectionsForChoiceGroups(index, classId, classSelections, groups);
  const ids: string[] = [];
  for (const g of filterVisibleClassFeatureChoiceGroups(groups, rs)) {
    if (g.kind !== "power") continue;
    ids.push(...resolveClassPowerChoiceIdsForGroup(index, g, classId, rs));
  }
  return ids;
}

/** Class feature power picks (Channel Divinity, cantrips, …) including auto-granted fixed sets. */
export function collectClassFeaturePowerChoiceIds(
  index: RulesIndex,
  build: Pick<CharacterBuild, "classId" | "characterStyle" | "hybridClassIdA" | "hybridClassIdB" | "classSelections">
): string[] {
  const rs = build.classSelections;
  if (build.characterStyle === "hybrid") {
    const ha = index.hybridClasses?.find((h) => h.id === build.hybridClassIdA);
    const hb = index.hybridClasses?.find((h) => h.id === build.hybridClassIdB);
    return [
      ...collectClassFeaturePowerChoiceIdsForClass(index, ha?.baseClassId, rs),
      ...collectClassFeaturePowerChoiceIdsForClass(index, hb?.baseClassId, rs)
    ];
  }
  return collectClassFeaturePowerChoiceIdsForClass(index, build.classId, rs);
}

export function resolveClassFeaturePowerChoicePowers(
  index: RulesIndex,
  build: Pick<CharacterBuild, "classId" | "characterStyle" | "hybridClassIdA" | "hybridClassIdB" | "classSelections">
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
