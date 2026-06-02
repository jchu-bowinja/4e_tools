import type { CharacterBuild, RulesIndex } from "./models";
import { collectCharacterClassFeatureIds } from "./characterClassFeatures";
import { characterClassFeatureNames } from "./prereqContext";

const RITUAL_CASTING_FEATURE_NAME = "Ritual Casting";

/** Feats that grant the ability to master and perform rituals (PHB). */
const RITUAL_CASTER_FEAT_NAMES = new Set(["Ritual Caster"]);

export function characterHasRitualCasting(index: RulesIndex, build: CharacterBuild): boolean {
  for (const name of characterClassFeatureNames(index, build)) {
    if (name === RITUAL_CASTING_FEATURE_NAME) return true;
  }
  for (const featureId of collectCharacterClassFeatureIds(index, build)) {
    const feature = index.classFeatures?.find((f) => f.id === featureId);
    if (feature?.name === RITUAL_CASTING_FEATURE_NAME) return true;
  }
  for (const featId of build.featIds) {
    const feat = index.feats.find((f) => f.id === featId);
    if (feat && RITUAL_CASTER_FEAT_NAMES.has(feat.name)) return true;
  }
  return false;
}

export function ritualCasterStatusMessage(index: RulesIndex, build: CharacterBuild): string | null {
  if (characterHasRitualCasting(index, build)) return null;
  return "This character needs Ritual Casting (class feature) or the Ritual Caster feat to master rituals.";
}
