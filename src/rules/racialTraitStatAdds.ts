import { collectActiveRacialTraitsFromBuild } from "./activeRacialTraits";
import { nadBonusesFromBonusToDefenseField, statAddsFromRules } from "./compendiumStatAdds";
import type { CharacterBuild, RacialTrait, RulesIndex, StatAddEntry } from "./models";

export { normalizeStatAddEntryAttrs, statAddsFromRules } from "./compendiumStatAdds";

export function statAddsFromRacialTrait(trait: RacialTrait): StatAddEntry[] {
  const rules = trait.raw?.rules as Record<string, unknown> | undefined;
  return statAddsFromRules(rules);
}

export function nadBonusesFromRacialTraitSpecific(trait: RacialTrait) {
  const spec = trait.raw?.specific as Record<string, unknown> | undefined;
  return nadBonusesFromBonusToDefenseField(spec);
}

/** All statadd rows from racial traits that apply to this build (one list per trait at consumption time). */
export function collectActiveRacialTraitStatAdds(
  index: Pick<RulesIndex, "races" | "racialTraits">,
  build: Pick<CharacterBuild, "raceId" | "raceSelections">
): StatAddEntry[][] {
  return collectActiveRacialTraitsFromBuild(index, build).map((trait) => statAddsFromRacialTrait(trait));
}
