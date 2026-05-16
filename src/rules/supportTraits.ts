import type { ClassDef, ClassFeature, EpicDestiny, HybridClassDef, ParagonPath, RulesIndex, Theme } from "./models";

export interface TraitDisplayRow {
  id: string;
  name: string;
  shortDescription?: string | null;
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
  byName: Map<string, ClassFeature>
): TraitDisplayRow[] {
  const rows: TraitDisplayRow[] = [];
  const seen = new Set<string>();

  for (const id of ids) {
    if (seen.has(id)) continue;
    const feature = byId.get(id);
    if (!feature) continue;
    seen.add(id);
    rows.push({
      id: feature.id,
      name: feature.name,
      shortDescription: feature.shortDescription
    });
  }

  for (const name of names) {
    const feature = byName.get(name);
    const id = feature?.id ?? `name:${name}`;
    if (seen.has(id)) continue;
    seen.add(id);
    rows.push({
      id,
      name: feature?.name ?? name,
      shortDescription: feature?.shortDescription
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

export function getThemeTraitRows(theme: Theme | undefined, index: RulesIndex): TraitDisplayRow[] {
  if (!theme) return [];
  const spec = specOf(theme);
  const { byId, byName } = buildClassFeatureLookups(index);
  return resolveTraitDisplayRows(parseTraitIdsFromField(spec, "_PARSED_SUB_FEATURES"), [], byId, byName);
}

export function getParagonTraitRows(path: ParagonPath | undefined, index: RulesIndex): TraitDisplayRow[] {
  if (!path) return [];
  const spec = specOf(path);
  const { byId, byName } = buildClassFeatureLookups(index);
  return resolveTraitDisplayRows(parseTraitIdsFromField(spec, "Class Features"), [], byId, byName);
}

export function getEpicDestinyTraitRows(destiny: EpicDestiny | undefined, index: RulesIndex): TraitDisplayRow[] {
  if (!destiny) return [];
  const spec = specOf(destiny);
  const { byId, byName } = buildClassFeatureLookups(index);
  return resolveTraitDisplayRows(parseTraitIdsFromField(spec, "Class Features"), [], byId, byName);
}
