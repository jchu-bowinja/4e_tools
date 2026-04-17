import type { ClassDef, RulesIndex } from "./models";

function splitOptionList(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Returns class build options from compendium `specific["Build Options"]`.
 * These are broad "class build" picks (e.g. Battle Cleric, Great Weapon Fighter).
 */
export interface ClassBuildOptionRow {
  id: string;
  name: string;
  parentFeatureId: string;
  parentFeatureName: string;
  shortDescription?: string | null;
  body?: string | null;
  powerIds: string[];
}

export function getClassBuildOptions(index: RulesIndex, cls: ClassDef | undefined): ClassBuildOptionRow[] {
  if (!cls) return [];
  const rich = index.classBuildOptionsByClassId?.[cls.id] ?? [];
  if (rich.length > 0) {
    return rich.map((r) => ({
      id: String(r.id),
      name: String(r.name || r.id),
      parentFeatureId: String(r.parentFeatureId || ""),
      parentFeatureName: String(r.parentFeatureName || "Class Feature"),
      shortDescription: r.shortDescription ?? null,
      body: r.body ?? null,
      powerIds: (r.powerIds ?? []).map((p) => String(p))
    }));
  }
  const spec = (cls.raw?.specific as Record<string, unknown> | undefined) || {};
  const raw = String(spec["Build Options"] || "").trim();
  if (!raw) return [];
  return splitOptionList(raw).map((name) => ({
    id: name,
    name,
    parentFeatureId: "",
    parentFeatureName: "Build Options",
    shortDescription: null,
    body: null,
    powerIds: []
  }));
}

