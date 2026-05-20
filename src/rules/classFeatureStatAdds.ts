import { collectCharacterClassFeatureIds } from "./characterClassFeatures";
import { nadBonusesFromBonusToDefenseField, statAddsFromRules } from "./compendiumStatAdds";
import type { CharacterBuild, ClassFeature, RulesIndex, StatAddEntry } from "./models";

export function statAddsFromClassFeature(feature: ClassFeature | undefined): StatAddEntry[] {
  const rules = feature?.raw?.rules as Record<string, unknown> | undefined;
  return statAddsFromRules(rules);
}

export function nadBonusesFromClassFeatureSpecific(feature: ClassFeature | undefined) {
  const spec = feature?.raw?.specific as Record<string, unknown> | undefined;
  return nadBonusesFromBonusToDefenseField(spec);
}

export function collectActiveClassFeaturesFromBuild(
  index: Pick<RulesIndex, "classFeatures">,
  build: CharacterBuild
): ClassFeature[] {
  const byId = new Map((index.classFeatures ?? []).map((f) => [f.id, f]));
  return collectCharacterClassFeatureIds(index, build)
    .map((id) => byId.get(id))
    .filter((f): f is ClassFeature => Boolean(f));
}
