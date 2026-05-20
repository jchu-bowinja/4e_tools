import type { ClassDef, RulesIndex } from "./models";

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
}

export function getClassFeatureChoiceGroups(
  index: RulesIndex,
  cls: ClassDef | undefined
): ClassFeatureChoiceGroup[] {
  if (!cls) return [];
  const raw = index.classFeatureChoiceGroupsByClassId?.[cls.id] ?? [];
  return raw.map((g) => {
    const vw = g.visibleWhen;
    const visibleWhen =
      vw && typeof vw.groupKey === "string" && typeof vw.optionId === "string"
        ? { groupKey: String(vw.groupKey), optionId: String(vw.optionId) }
        : undefined;
    return {
    key: String(g.key),
    kind: g.kind === "power" ? "power" : "classFeature",
    parentFeatureId: String(g.parentFeatureId || ""),
    parentFeatureName: String(g.parentFeatureName || "Class feature"),
    pickCount: Math.max(1, Number(g.pickCount) || 1),
    powerIds: (g.powerIds ?? []).map((p) => String(p)),
    visibleWhen,
    options: (g.options ?? []).map((o) => ({
      id: String(o.id),
      name: String(o.name || o.id),
      parentFeatureId: String(o.parentFeatureId || ""),
      parentFeatureName: String(o.parentFeatureName || ""),
      shortDescription: o.shortDescription ?? null,
      body: o.body ?? null,
      powerIds: (o.powerIds ?? []).map((p) => String(p))
    }))
  };
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
