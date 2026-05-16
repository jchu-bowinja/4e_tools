import type { ClassDef, ClassFeature, EpicDestiny, HybridClassDef, ParagonPath, RulesIndex, Theme } from "./models";

export interface TraitDisplayRow {
  id: string;
  name: string;
  shortDescription?: string | null;
}

const TRAIT_BODY_FALLBACK_MAX_LEN = 240;

export function parseFeatureLevel(feature: ClassFeature): number | undefined {
  const raw = feature.raw?.specific as Record<string, unknown> | undefined;
  const level = raw?.Level;
  if (typeof level === "number" && Number.isFinite(level)) return level;
  if (typeof level === "string") {
    const parsed = Number.parseInt(level.trim(), 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

export function featureIsAvailableAtLevel(feature: ClassFeature, characterLevel: number): boolean {
  const featureLevel = parseFeatureLevel(feature);
  if (featureLevel == null) return true;
  return featureLevel <= characterLevel;
}

/** Theme features often include level in the compendium name; paragon/epic usually do not. */
export function traitNameForDisplay(feature: ClassFeature, includeLevel = true): string {
  const name = feature.name.trim();
  if (!includeLevel || /^Level\s+\d+/i.test(name)) return name;
  const level = parseFeatureLevel(feature);
  if (level == null) return name;
  return `Level ${level} ${name}`;
}

/** Compendium short text, or a single-line excerpt from feature body (common on epic destinies). */
export function traitDescriptionForDisplay(feature: ClassFeature): string | undefined {
  const short = typeof feature.shortDescription === "string" ? feature.shortDescription.trim() : "";
  if (short) return short;
  const body = typeof feature.body === "string" ? feature.body.trim() : "";
  if (!body) return undefined;
  const oneLine = body.replace(/\s+/g, " ").trim();
  if (oneLine.length <= TRAIT_BODY_FALLBACK_MAX_LEN) return oneLine;
  return `${oneLine.slice(0, TRAIT_BODY_FALLBACK_MAX_LEN - 1)}…`;
}

function specOf(entity: { raw: Record<string, unknown> } | undefined): Record<string, unknown> | undefined {
  return entity?.raw?.specific as Record<string, unknown> | undefined;
}

/** Comma-separated internal_ids (e.g. paragon path `Class Features`). */
export function parseTraitIdsFromField(spec: Record<string, unknown> | undefined, field: string): string[] {
  const raw = String(spec?.[field] ?? "").trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.startsWith("ID_"));
}

/** Comma-separated display names (e.g. class `_PARSED_CLASS_FEATURE`). */
export function parseTraitNamesFromField(spec: Record<string, unknown> | undefined, field: string): string[] {
  const raw = String(spec?.[field] ?? "").trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function buildClassFeatureLookups(index: RulesIndex): {
  byId: Map<string, ClassFeature>;
  byName: Map<string, ClassFeature>;
} {
  const byId = new Map<string, ClassFeature>();
  const byName = new Map<string, ClassFeature>();
  for (const feature of index.classFeatures ?? []) {
    byId.set(feature.id, feature);
    if (feature.name.trim()) {
      byName.set(feature.name.trim(), feature);
    }
  }
  return { byId, byName };
}

export function resolveTraitDisplayRows(
  ids: string[],
  names: string[],
  byId: Map<string, ClassFeature>,
  byName: Map<string, ClassFeature>,
  options?: { includeLevelInName?: boolean; maxLevel?: number }
): TraitDisplayRow[] {
  const includeLevelInName = options?.includeLevelInName ?? false;
  const maxLevel = options?.maxLevel;
  const rows: TraitDisplayRow[] = [];
  const seen = new Set<string>();

  for (const id of ids) {
    if (seen.has(id)) continue;
    const feature = byId.get(id);
    if (!feature) continue;
    if (maxLevel != null && !featureIsAvailableAtLevel(feature, maxLevel)) continue;
    seen.add(id);
    rows.push({
      id: feature.id,
      name: traitNameForDisplay(feature, includeLevelInName),
      shortDescription: traitDescriptionForDisplay(feature)
    });
  }

  for (const name of names) {
    const feature = byName.get(name);
    const id = feature?.id ?? `name:${name}`;
    if (seen.has(id)) continue;
    seen.add(id);
    rows.push({
      id,
      name: feature ? traitNameForDisplay(feature, includeLevelInName) : name,
      shortDescription: feature ? traitDescriptionForDisplay(feature) : undefined
    });
  }

  return rows;
}

export function getClassTraitRows(cls: ClassDef | undefined, index: RulesIndex): TraitDisplayRow[] {
  if (!cls) return [];
  const spec = specOf(cls);
  const { byId, byName } = buildClassFeatureLookups(index);
  return resolveTraitDisplayRows([], parseTraitNamesFromField(spec, "_PARSED_CLASS_FEATURE"), byId, byName);
}

export function getHybridClassTraitRows(
  hybridA: HybridClassDef | undefined,
  hybridB: HybridClassDef | undefined,
  index: RulesIndex
): TraitDisplayRow[] {
  const { byId, byName } = buildClassFeatureLookups(index);
  const names = [
    ...parseTraitNamesFromField(specOf(hybridA), "_PARSED_CLASS_FEATURE"),
    ...parseTraitNamesFromField(specOf(hybridB), "_PARSED_CLASS_FEATURE")
  ];
  return resolveTraitDisplayRows([], names, byId, byName);
}

export function getThemeTraitRows(
  theme: Theme | undefined,
  index: RulesIndex,
  characterLevel: number
): TraitDisplayRow[] {
  if (!theme) return [];
  const spec = specOf(theme);
  const { byId, byName } = buildClassFeatureLookups(index);
  return resolveTraitDisplayRows(parseTraitIdsFromField(spec, "_PARSED_SUB_FEATURES"), [], byId, byName, {
    maxLevel: characterLevel
  });
}

export function getParagonTraitRows(
  path: ParagonPath | undefined,
  index: RulesIndex,
  characterLevel: number
): TraitDisplayRow[] {
  if (!path) return [];
  const spec = specOf(path);
  const { byId, byName } = buildClassFeatureLookups(index);
  return resolveTraitDisplayRows(parseTraitIdsFromField(spec, "Class Features"), [], byId, byName, {
    includeLevelInName: true,
    maxLevel: characterLevel
  });
}

export function getEpicDestinyTraitRows(
  destiny: EpicDestiny | undefined,
  index: RulesIndex,
  characterLevel: number
): TraitDisplayRow[] {
  if (!destiny) return [];
  const spec = specOf(destiny);
  const { byId, byName } = buildClassFeatureLookups(index);
  return resolveTraitDisplayRows(parseTraitIdsFromField(spec, "Class Features"), [], byId, byName, {
    includeLevelInName: true,
    maxLevel: characterLevel
  });
}
