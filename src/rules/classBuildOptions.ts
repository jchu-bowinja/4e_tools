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
  /** Player-facing build label when PHB talent name differs (e.g. Arena Training → Arena Fighter). */
  displayName?: string | null;
  parentFeatureId: string;
  parentFeatureName: string;
  shortDescription?: string | null;
  body?: string | null;
  powerIds: string[];
}

/** Label shown in UI; compendium `name` stays for prereqs and grants. */
export function classBuildOptionLabel(opt: Pick<ClassBuildOptionRow, "name" | "displayName">): string {
  const display = opt.displayName?.trim();
  return display || opt.name;
}

export function getClassBuildOptions(index: RulesIndex, cls: ClassDef | undefined): ClassBuildOptionRow[] {
  if (!cls) return [];
  const rich = index.classBuildOptionsByClassId?.[cls.id] ?? [];
  if (rich.length > 0) {
    return rich.map((r) => ({
      id: String(r.id),
      name: String(r.name || r.id),
      displayName: r.displayName ?? null,
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

