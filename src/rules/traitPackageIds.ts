import { collectClassFeatureIdsFromClass } from "./characterClassFeatures";
import type { CharacterBuild, RulesIndex } from "./models";

/** Essentials trait package ids activated by selected pact/domain/school class features. */
export function collectActiveTraitPackageIds(
  index: RulesIndex,
  activeClassFeatureIds: Iterable<string>
): Set<string> {
  const map = index.traitPackageIdByClassFeatureId ?? {};
  const out = new Set<string>();
  for (const fid of activeClassFeatureIds) {
    const pkg = map[fid]?.trim();
    if (pkg) out.add(pkg);
  }
  return out;
}

export function collectActiveTraitPackageIdsForBuild(
  index: RulesIndex,
  build: CharacterBuild
): Set<string> {
  return collectActiveTraitPackageIds(index, collectClassFeatureIdsFromClass(index, build));
}
