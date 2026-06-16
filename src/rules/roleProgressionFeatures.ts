import type { ClassDef, ClassFeature, ClassRoleBucket, RulesIndex } from "./models";
import { featureIsAvailableAtLevel, parseFeatureLevel } from "./supportTraits";

/** First role token from compendium class `Role` text (e.g. "Defender. You are…"). */
export function classRoleBucket(cls: ClassDef | undefined): ClassRoleBucket | undefined {
  const raw = String(cls?.role ?? (cls?.raw?.specific as Record<string, unknown> | undefined)?.Role ?? "")
    .trim()
    .toLowerCase();
  if (raw.startsWith("defender")) return "defender";
  if (raw.startsWith("leader")) return "leader";
  if (raw.startsWith("striker")) return "striker";
  if (raw.startsWith("controller")) return "controller";
  return undefined;
}

function roleFeatureAppliesToClass(
  feature: ClassFeature,
  classId: string | undefined,
  role: ClassRoleBucket | undefined
): boolean {
  if (!role || feature.roleProgression?.role !== role) return false;
  const swap = feature.powerSwapRules?.[0];
  if (swap?.classIds?.length && classId && !swap.classIds.includes(classId)) return false;
  return true;
}

/** DMG2 role milestone features (Level 03 Defender Encounter Power, …) for the build's class role. */
export function collectRoleProgressionClassFeatureIds(
  index: RulesIndex,
  classId: string | undefined,
  characterLevel: number
): string[] {
  if (!classId) return [];
  const cls = index.classes.find((c) => c.id === classId);
  const role = classRoleBucket(cls);
  if (!role) return [];
  const out: string[] = [];
  for (const feature of index.classFeatures ?? []) {
    if (!roleFeatureAppliesToClass(feature, classId, role)) continue;
    if (!featureIsAvailableAtLevel(feature, characterLevel)) continue;
    if (!feature.powerSwapRules?.length) continue;
    out.push(feature.id);
  }
  return out.sort(
    (a, b) =>
      (parseFeatureLevel(index.classFeatures?.find((f) => f.id === a)) ?? 0) -
      (parseFeatureLevel(index.classFeatures?.find((f) => f.id === b)) ?? 0)
  );
}
