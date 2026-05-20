import type { ClassFeature } from "./models";

/** Collapse punctuation/spacing for fuzzy class feature name match. */
export function normalizeClassFeatureMatchKey(name: string): string {
  let s = name.trim().toLowerCase();
  s = s.replace(/\u2019|\u2018/g, "'").replace(/`/g, "'");
  return s.replace(/[^a-z0-9]/g, "");
}

export type ClassFeatureNameLookups = {
  byExactName: Map<string, string>;
  byNormalizedKey: Map<string, string>;
  byId: Map<string, ClassFeature>;
};

export function buildClassFeatureNameLookups(
  features: ReadonlyArray<ClassFeature>
): ClassFeatureNameLookups {
  const byExactName = new Map<string, string>();
  const byNormalizedKey = new Map<string, string>();
  const byId = new Map<string, ClassFeature>();

  for (const f of features) {
    const id = f.id.trim();
    const name = f.name.trim();
    if (!id || !name) continue;
    byId.set(id, f);
    const exact = name.toLowerCase();
    if (!byExactName.has(exact)) byExactName.set(exact, id);
    const norm = normalizeClassFeatureMatchKey(name);
    if (norm && !byNormalizedKey.has(norm)) byNormalizedKey.set(norm, id);
  }
  return { byExactName, byNormalizedKey, byId };
}

/** Resolve a feat modification target to a class feature id when it is not a power. */
export function resolveClassFeatureReference(
  nameOrId: string,
  lookups: ClassFeatureNameLookups
): string | undefined {
  const raw = nameOrId.trim();
  if (!raw) return undefined;

  if (raw.startsWith("ID_") && lookups.byId.has(raw)) {
    return raw;
  }

  const exact = lookups.byExactName.get(raw.toLowerCase());
  if (exact) return exact;

  const norm = normalizeClassFeatureMatchKey(raw);
  const byNorm = lookups.byNormalizedKey.get(norm);
  if (byNorm) return byNorm;

  if (raw.startsWith("ID_")) return raw;
  return undefined;
}
