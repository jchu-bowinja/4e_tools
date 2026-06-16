import type { CharacterBuild, RulesIndex } from "./models";
import { collectCharacterClassFeatureIds } from "./characterClassFeatures";
import { characterClassFeatureNames } from "./prereqContext";

export function characterHasRitualCasting(index: RulesIndex, build: CharacterBuild): boolean {
  const ritualFeatureNames = new Set(
    (index.classFeatures ?? []).filter((f) => f.grantsRitualCasting).map((f) => f.name)
  );
  for (const name of characterClassFeatureNames(index, build)) {
    if (ritualFeatureNames.has(name)) return true;
  }
  for (const featureId of collectCharacterClassFeatureIds(index, build)) {
    const feature = index.classFeatures?.find((f) => f.id === featureId);
    if (feature?.grantsRitualCasting) return true;
  }
  for (const featId of build.featIds) {
    const feat = index.feats.find((f) => f.id === featId);
    if (feat?.grantsRitualCasting) return true;
  }
  return false;
}

export function ritualCasterStatusMessage(index: RulesIndex, build: CharacterBuild): string | null {
  if (characterHasRitualCasting(index, build)) return null;
  return "This character needs Ritual Casting (class feature) or the Ritual Caster feat to master rituals.";
}
