import {
  featGrantedPowerIdsExcludedFromClassFeaturePicks,
  paragonPathClassFeaturePowerIds
} from "./grantedPowersQuery";
import type { CharacterBuild, ClassDef, ClassFeature, Power, RulesIndex } from "./models";
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

/** Optional class features keyed by class id when compendium does not list them on `_PARSED_CLASS_FEATURE`. */
const OPTIONAL_CLASS_FEATURE_NAMES_BY_CLASS_ID: Record<string, string[]> = {
  ID_FMP_CLASS_104: ["Signs of Influence"]
};

export interface ClassFeatureChoiceGroup {
  key: string;
  kind: ClassFeatureChoiceKind;
  parentFeatureId: string;
  parentFeatureName: string;
  pickCount: number;
  /** Character level required before this pick group is offered (defaults to 1). */
  minLevel?: number;
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

/** Essentials / Arcanist mage cantrip list (compendium `Mage Cantrips` row is often incomplete). */
export const WIZARD_MAGE_CANTRIP_POWER_NAMES = [
  "Chameleon's Mask",
  "Disrupt Undead",
  "Ghost Sound",
  "Light",
  "Mage Hand",
  "Prestidigitation",
  "Spook",
  "Suggestion",
  "Water Stride",
  "Whispering Wind"
] as const;

const MAGE_CANTRIPS_FEATURE_IDS = new Set([
  "ID_FMP_CLASS_FEATURE_2870",
  "ID_FMP_CLASS_FEATURE_130"
]);

function parsePowerIdsFromField(spec: Record<string, unknown> | undefined, field: string): string[] {
  const raw = String(spec?.[field] ?? "").trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((id) => id.startsWith("ID_FMP_POWER"));
}

const wizardCantripIdsByIndex = new WeakMap<RulesIndex, Map<string, string>>();

function wizardCantripPowerIdByNormalizedName(index: RulesIndex): Map<string, string> {
  const cached = wizardCantripIdsByIndex.get(index);
  if (cached) return cached;
  const wizardClassId = index.classes.find((c) => c.name === "Wizard")?.id;
  const byName = new Map<string, string>();
  for (const p of index.powers) {
    if (wizardClassId && p.classId && p.classId !== wizardClassId) continue;
    const key = p.name.trim().toLowerCase();
    if (!key || byName.has(key)) continue;
    byName.set(key, p.id);
  }
  wizardCantripIdsByIndex.set(index, byName);
  return byName;
}

function supplementWizardMageCantripPowerIds(index: RulesIndex): Set<string> {
  const byName = wizardCantripPowerIdByNormalizedName(index);
  const ids = new Set<string>();
  for (const name of WIZARD_MAGE_CANTRIP_POWER_NAMES) {
    const id = byName.get(name.trim().toLowerCase());
    if (id) ids.add(id);
  }
  return ids;
}

function classFeatureSelectRules(cf: ClassFeature | undefined): ClassFeatureSelectRule[] {
  const rules = cf?.raw?.rules as Record<string, unknown> | undefined;
  const select = rules?.select;
  return Array.isArray(select) ? (select as ClassFeatureSelectRule[]) : [];
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
    const cat = String(attrs.Category ?? "");
    for (const token of cat.split("|")) {
      const tid = token.trim();
      if (!tid.startsWith("ID_")) continue;
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
 * All power ids a class feature power pick may offer: `specific.Powers`, resolved `select`
 * categories (including other class features), and known supplements (wizard cantrips).
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
    const cat = String(attrs.Category ?? "").trim();
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

  if (
    MAGE_CANTRIPS_FEATURE_IDS.has(parentFeatureId) ||
    cf.name === "Mage Cantrips" ||
    cf.name === "Arcanist Cantrips"
  ) {
    for (const pid of supplementWizardMageCantripPowerIds(index)) ids.add(pid);
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
    const cat = String(attrs.Category ?? "").trim();
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

/** Warlord (and similar): pick one * Leader feature from parsed class features not auto-granted. */
function supplementLeaderPickChoiceGroups(
  index: RulesIndex,
  cls: ClassDef,
  groups: ClassFeatureChoiceGroup[]
): ClassFeatureChoiceGroup[] {
  if (groups.some((g) => g.parentFeatureName === "Leader" && g.kind === "classFeature")) {
    return groups;
  }
  const granted = new Set(index.grantedClassFeatureNamesBySupportId?.[cls.id] ?? []);
  const parsed = parseTraitNamesFromField(specOf(cls), "_PARSED_CLASS_FEATURE");
  const leaderNames = parsed.filter((n) => n.endsWith(" Leader") && !granted.has(n));
  if (leaderNames.length < 2) return groups;

  const { byName } = buildClassFeatureLookups(index);
  const features = leaderNames
    .map((name) => byName.get(name))
    .filter((f): f is ClassFeature => !!f);
  if (features.length < 2) return groups;

  const ids = features.map((f) => f.id).sort();
  const options: ClassFeatureChoiceOption[] = features
    .map((f) => ({
      id: f.id,
      name: f.name,
      parentFeatureId: "",
      parentFeatureName: "Leader",
      shortDescription: f.shortDescription ?? null,
      body: f.body ?? null,
      powerIds: []
    }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

  return [
    ...groups,
    {
      key: `classFeaturePair:${ids.join(":")}`,
      kind: "classFeature",
      parentFeatureId: "",
      parentFeatureName: "Leader",
      pickCount: 1,
      powerIds: [],
      options
    }
  ];
}

/** Opt-in parsed features (e.g. Archer Warlord) vs default class proficiencies. */
function supplementOptionalParsedClassFeatureGroups(
  index: RulesIndex,
  cls: ClassDef,
  groups: ClassFeatureChoiceGroup[]
): ClassFeatureChoiceGroup[] {
  const optionIds = new Set(
    groups.flatMap((g) => g.options.map((o) => o.id).filter((id) => id.startsWith("ID_")))
  );
  const granted = new Set(index.grantedClassFeatureNamesBySupportId?.[cls.id] ?? []);
  const parsed = parseTraitNamesFromField(specOf(cls), "_PARSED_CLASS_FEATURE");
  const { byName } = buildClassFeatureLookups(index);

  const candidates = parsed.filter((name) => {
    if (granted.has(name) || name.endsWith(" Leader")) return false;
    const feature = byName.get(name);
    if (!feature || optionIds.has(feature.id)) return false;
    return true;
  });

  if (candidates.length !== 1) return groups;

  const feature = byName.get(candidates[0]!);
  if (!feature) return groups;

  const key = `classFeatureOptional:${feature.id}`;
  if (groups.some((g) => g.key === key)) return groups;

  const standardOption: ClassFeatureChoiceOption = {
    id: CLASS_FEATURE_CHOICE_NONE,
    name: "Standard (default class proficiencies)",
    parentFeatureId: feature.id,
    parentFeatureName: feature.name,
    shortDescription: null,
    body: null,
    powerIds: []
  };
  const featureOption: ClassFeatureChoiceOption = {
    id: feature.id,
    name: feature.name,
    parentFeatureId: feature.id,
    parentFeatureName: feature.name,
    shortDescription: feature.shortDescription ?? null,
    body: feature.body ?? null,
    powerIds: []
  };

  return [
    ...groups,
    {
      key,
      kind: "classFeature",
      parentFeatureId: feature.id,
      parentFeatureName: feature.name,
      pickCount: 1,
      optional: true,
      powerIds: [],
      options: [standardOption, featureOption]
    }
  ];
}

/** Optional features from source books (e.g. HotF Signs of Influence on bard). */
function supplementMappedOptionalClassFeatureGroups(
  index: RulesIndex,
  cls: ClassDef,
  groups: ClassFeatureChoiceGroup[]
): ClassFeatureChoiceGroup[] {
  const mapped = OPTIONAL_CLASS_FEATURE_NAMES_BY_CLASS_ID[cls.id];
  if (!mapped?.length) return groups;

  const { byName } = buildClassFeatureLookups(index);
  const existingKeys = new Set(groups.map((g) => g.key));
  const out = [...groups];

  for (const featureName of mapped) {
    const feature = byName.get(featureName);
    if (!feature) continue;

    const optKey = `classFeatureOptional:${feature.id}`;
    if (!existingKeys.has(optKey)) {
      out.push({
        key: optKey,
        kind: "classFeature",
        parentFeatureId: feature.id,
        parentFeatureName: feature.name,
        pickCount: 1,
        optional: true,
        powerIds: [],
        options: [
          {
            id: CLASS_FEATURE_CHOICE_NONE,
            name: `No ${feature.name}`,
            parentFeatureId: feature.id,
            parentFeatureName: feature.name,
            shortDescription: null,
            body: null,
            powerIds: []
          },
          {
            id: feature.id,
            name: feature.name,
            parentFeatureId: feature.id,
            parentFeatureName: feature.name,
            shortDescription: feature.shortDescription ?? null,
            body: feature.body ?? null,
            powerIds: []
          }
        ]
      });
      existingKeys.add(optKey);
    }

    const nested = optionsFromClassFeatureSelect(index, feature);
    if (nested.length < 2) continue;

    const levelGates = levelGatedClassFeatureSelects(feature);
    if (!levelGates.length) continue;

    for (const { minLevel, pickCount } of levelGates) {
      const pickKey =
        minLevel <= 1 ? `classFeature:${feature.id}` : `classFeature:${feature.id}:${minLevel}`;
      if (existingKeys.has(pickKey)) continue;
      out.push({
        key: pickKey,
        kind: "classFeature",
        parentFeatureId: feature.id,
        parentFeatureName:
          minLevel <= 1 ? feature.name : `${feature.name} (level ${minLevel})`,
        pickCount,
        minLevel,
        visibleWhen: { groupKey: optKey, optionId: feature.id },
        powerIds: [],
        options: nested
      });
      existingKeys.add(pickKey);
    }
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

  groups = supplementLeaderPickChoiceGroups(index, cls, groups);
  groups = supplementOptionalParsedClassFeatureGroups(index, cls, groups);
  groups = supplementMappedOptionalClassFeatureGroups(index, cls, groups);

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
  classSelections: Record<string, string> | undefined,
  characterLevel: number
): string[] {
  if (!classId) return [];
  const cls = index.classes.find((c) => c.id === classId);
  const groups = getClassFeatureChoiceGroups(index, cls);
  const rs = effectiveClassSelectionsForChoiceGroups(index, classId, classSelections, groups);
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
