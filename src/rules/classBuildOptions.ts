import type { CharacterBuild, ClassDef, RulesIndex } from "./models";

/** `classSelections` key for Essentials `ID_FMP_BUILD_*` picks. */
export const CLASS_BUILD_OPTION_SELECTION_KEY = "buildOptionId";

/** Legacy saves may use this key instead of `buildOptionId`. */
export const LEGACY_CLASS_BUILD_OPTION_SELECTION_KEY = "buildOption";

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

export function selectedClassBuildOptionId(
  classSelections?: CharacterBuild["classSelections"]
): string | undefined {
  const id =
    classSelections?.[CLASS_BUILD_OPTION_SELECTION_KEY]?.trim() ||
    classSelections?.[LEGACY_CLASS_BUILD_OPTION_SELECTION_KEY]?.trim();
  return id || undefined;
}

/** Essentials guided builds (`ID_FMP_BUILD_*` rows from ETL). */
export function essentialsClassBuildOptions(
  index: RulesIndex,
  cls: ClassDef | undefined
): ClassBuildOptionRow[] {
  return getClassBuildOptions(index, cls).filter((o) => o.id.startsWith("ID_FMP_BUILD_"));
}

export function hasEssentialsClassBuildPicker(
  index: RulesIndex,
  cls: ClassDef | undefined
): boolean {
  return essentialsClassBuildOptions(index, cls).length > 0;
}

/** Drop build pick when the class changes or the id is no longer valid. */
export function pruneClassBuildOptionSelection(
  index: RulesIndex,
  classId: string | undefined,
  classSelections?: Record<string, string>
): Record<string, string> | undefined {
  const picked = selectedClassBuildOptionId(classSelections);
  if (!picked) return classSelections;
  const cls = index.classes.find((c) => c.id === classId);
  const legal = new Set(essentialsClassBuildOptions(index, cls).map((o) => o.id));
  if (classId && legal.has(picked)) return classSelections;
  if (!classSelections) return undefined;
  const next = { ...classSelections };
  delete next[CLASS_BUILD_OPTION_SELECTION_KEY];
  delete next[LEGACY_CLASS_BUILD_OPTION_SELECTION_KEY];
  return Object.keys(next).length ? next : undefined;
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

