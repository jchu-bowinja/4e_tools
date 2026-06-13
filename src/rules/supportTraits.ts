import { collectClassFeatureIdsFromClass } from "./characterClassFeatures";
import type {
  CharacterBuild,
  ClassDef,
  ClassFeature,
  EpicDestiny,
  Feat,
  HybridClassDef,
  ParagonPath,
  RacialTrait,
  RulesIndex,
  Theme
} from "./models";

export type TraitFeatAugmentation = {
  featId: string;
  featName: string;
  text: string;
};

export interface TraitDisplayRow {
  id: string;
  name: string;
  shortDescription?: string | null;
  /** False when shown on a support tab above the feature's compendium level. */
  availableAtLevel?: boolean;
  /** Feat augmentations that modify this class feature (not a compendium power). */
  featAugmentations?: TraitFeatAugmentation[];
}

export type TraitDisplayOptions = {
  includeLevelInName?: boolean;
  /** When set, rows above this level are omitted unless `includeUnavailable` is true. */
  characterLevel?: number;
  /** Include rows above `characterLevel` with `availableAtLevel: false` (support tab previews). */
  includeUnavailable?: boolean;
};

const TRAIT_BODY_FALLBACK_MAX_LEN = 240;

export function parseFeatureLevel(feature: ClassFeature): number | undefined {
  const raw = feature.raw?.specific as Record<string, unknown> | undefined;
  const level = raw?.Level;
  if (typeof level === "number" && Number.isFinite(level)) return level;
  if (typeof level === "string") {
    const parsed = Number.parseInt(level.trim(), 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  const fromName = /^Level\s+(\d+)\b/i.exec(feature.name.trim());
  if (fromName) {
    const parsed = Number.parseInt(fromName[1], 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

/** Order class feature ids by compendium level, then name. */
export function sortClassFeatureIdsByLevel(
  index: RulesIndex,
  ids: string[]
): string[] {
  const { byId } = buildClassFeatureLookups(index);
  return [...ids].sort((a, b) => {
    const fa = byId.get(a);
    const fb = byId.get(b);
    const la = fa ? (parseFeatureLevel(fa) ?? 1) : 999;
    const lb = fb ? (parseFeatureLevel(fb) ?? 1) : 999;
    if (la !== lb) return la - lb;
    return (fa?.name ?? a).localeCompare(fb?.name ?? b, undefined, { sensitivity: "base" });
  });
}

/** Sort trait rows by compendium feature level, then name. */
export function sortTraitDisplayRowsByLevel(
  rows: TraitDisplayRow[],
  byId: Map<string, ClassFeature>
): TraitDisplayRow[] {
  const levelOf = (row: TraitDisplayRow): number => {
    if (!row.id.startsWith("ID_")) return 999;
    const feature = byId.get(row.id);
    if (!feature) return 999;
    return parseFeatureLevel(feature) ?? 1;
  };
  return [...rows].sort((a, b) => {
    const diff = levelOf(a) - levelOf(b);
    if (diff !== 0) return diff;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
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

export function specOf(entity: { raw: Record<string, unknown> } | undefined): Record<string, unknown> | undefined {
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
  options?: TraitDisplayOptions
): TraitDisplayRow[] {
  const includeLevelInName = options?.includeLevelInName ?? false;
  const characterLevel = options?.characterLevel;
  const includeUnavailable = options?.includeUnavailable ?? false;
  const rows: TraitDisplayRow[] = [];
  const seen = new Set<string>();

  const pushRow = (feature: ClassFeature | undefined, id: string, name: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    const availableAtLevel =
      characterLevel == null || !feature || featureIsAvailableAtLevel(feature, characterLevel);
    if (characterLevel != null && !availableAtLevel && !includeUnavailable) return;
    rows.push({
      id,
      name,
      shortDescription: feature ? traitDescriptionForDisplay(feature) : undefined,
      availableAtLevel
    });
  };

  for (const id of ids) {
    const feature = byId.get(id);
    if (!feature) continue;
    pushRow(feature, feature.id, traitNameForDisplay(feature, includeLevelInName));
  }

  for (const name of names) {
    const feature = byName.get(name);
    const id = feature?.id ?? `name:${name}`;
    pushRow(
      feature,
      id,
      feature ? traitNameForDisplay(feature, includeLevelInName) : name
    );
  }

  return rows;
}

export function getClassTraitRows(
  cls: ClassDef | undefined,
  index: RulesIndex,
  buildOrLevel?: CharacterBuild | number,
  characterLevel?: number
): TraitDisplayRow[] {
  if (!cls) return [];
  const level =
    typeof buildOrLevel === "number"
      ? buildOrLevel
      : buildOrLevel?.level ?? characterLevel;
  const build = typeof buildOrLevel === "object" ? buildOrLevel : undefined;
  const { byId, byName } = buildClassFeatureLookups(index);

  if (build?.classId === cls.id) {
    const ids = collectClassFeatureIdsFromClass(index, build);
    const rows = resolveTraitDisplayRows(ids, [], byId, byName, {
      characterLevel: level
    });
    return sortTraitDisplayRowsByLevel(rows, byId);
  }

  const spec = specOf(cls);
  const rows = resolveTraitDisplayRows([], parseTraitNamesFromField(spec, "_PARSED_CLASS_FEATURE"), byId, byName, {
    characterLevel: level
  });
  return sortTraitDisplayRowsByLevel(rows, byId);
}

export function getHybridClassTraitRows(
  hybridA: HybridClassDef | undefined,
  hybridB: HybridClassDef | undefined,
  index: RulesIndex,
  characterLevel?: number
): TraitDisplayRow[] {
  const { byId, byName } = buildClassFeatureLookups(index);
  const names = [
    ...parseTraitNamesFromField(specOf(hybridA), "_PARSED_CLASS_FEATURE"),
    ...parseTraitNamesFromField(specOf(hybridB), "_PARSED_CLASS_FEATURE")
  ];
  const rows = resolveTraitDisplayRows([], names, byId, byName, {
    characterLevel
  });
  return sortTraitDisplayRowsByLevel(rows, byId);
}

export function getThemeTraitRows(
  theme: Theme | undefined,
  index: RulesIndex,
  characterLevel: number,
  options?: Pick<TraitDisplayOptions, "includeUnavailable">
): TraitDisplayRow[] {
  if (!theme) return [];
  const spec = specOf(theme);
  const { byId, byName } = buildClassFeatureLookups(index);
  const rows = resolveTraitDisplayRows(parseTraitIdsFromField(spec, "_PARSED_SUB_FEATURES"), [], byId, byName, {
    characterLevel,
    includeUnavailable: options?.includeUnavailable
  });
  return sortTraitDisplayRowsByLevel(rows, byId);
}

export function getParagonTraitRows(
  path: ParagonPath | undefined,
  index: RulesIndex,
  characterLevel: number,
  options?: Pick<TraitDisplayOptions, "includeUnavailable">
): TraitDisplayRow[] {
  if (!path) return [];
  const spec = specOf(path);
  const { byId, byName } = buildClassFeatureLookups(index);
  const rows = resolveTraitDisplayRows(parseTraitIdsFromField(spec, "Class Features"), [], byId, byName, {
    includeLevelInName: true,
    characterLevel,
    includeUnavailable: options?.includeUnavailable
  });
  return sortTraitDisplayRowsByLevel(rows, byId);
}

export function getEpicDestinyTraitRows(
  destiny: EpicDestiny | undefined,
  index: RulesIndex,
  characterLevel: number,
  options?: Pick<TraitDisplayOptions, "includeUnavailable">
): TraitDisplayRow[] {
  if (!destiny) return [];
  const spec = specOf(destiny);
  const { byId, byName } = buildClassFeatureLookups(index);
  const rows = resolveTraitDisplayRows(parseTraitIdsFromField(spec, "Class Features"), [], byId, byName, {
    includeLevelInName: true,
    characterLevel,
    includeUnavailable: options?.includeUnavailable
  });
  return sortTraitDisplayRowsByLevel(rows, byId);
}

/** Class features and racial traits granted by selected feats (`rules.grant` via ETL). */
export function getFeatGrantedTraitRows(index: RulesIndex, featIds: string[]): TraitDisplayRow[] {
  const { byId: cfById } = buildClassFeatureLookups(index);
  const racialById = new Map((index.racialTraits ?? []).map((t) => [t.id, t]));
  const rows: TraitDisplayRow[] = [];
  const seen = new Set<string>();

  const pushFeature = (feature: ClassFeature | undefined, labelPrefix?: string) => {
    if (!feature || seen.has(feature.id)) return;
    seen.add(feature.id);
    rows.push({
      id: feature.id,
      name: labelPrefix ? `${labelPrefix}: ${feature.name}` : feature.name,
      shortDescription: traitDescriptionForDisplay(feature)
    });
  };

  const pushRacialTrait = (trait: RacialTrait | undefined, labelPrefix?: string) => {
    if (!trait || seen.has(trait.id)) return;
    seen.add(trait.id);
    const short =
      typeof trait.shortDescription === "string" && trait.shortDescription.trim()
        ? trait.shortDescription.trim()
        : undefined;
    rows.push({
      id: trait.id,
      name: labelPrefix ? `${labelPrefix}: ${trait.name}` : trait.name,
      shortDescription: short
    });
  };

  for (const fid of featIds) {
    const feat: Feat | undefined = index.feats.find((f) => f.id === fid);
    if (!feat) continue;
    const prefix = feat.name;
    for (const cfId of feat.grantedClassFeatureIds ?? []) {
      pushFeature(cfById.get(cfId), prefix);
    }
    for (const rtId of feat.grantedRacialTraitIds ?? []) {
      pushRacialTrait(racialById.get(rtId), prefix);
    }
  }

  return rows;
}
