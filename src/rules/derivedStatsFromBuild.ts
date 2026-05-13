import type { Armor, CharacterBuild, Race, RulesIndex } from "./models";
import type { CharacterLegality } from "./characterValidator";
import { validateCharacterBuild } from "./characterValidator";
import { computeHybridDerivedStats, parseHybridDefenseBonuses } from "./hybridDerivedStats";
import { computeDerivedStats, type DerivedStats } from "./statCalculator";
import { aggregateSupportPassiveDefenseBonuses, aggregateSupportPassiveOtherBonuses } from "./supportStatAdds";

export interface ComputeBuilderLikeDerivedStatsOptions {
  /**
   * When set, NAD picks from class / hybrid validation are taken from here instead of
   * calling validateCharacterBuild again (use in the builder where legality is already computed).
   */
  legality?: Pick<CharacterLegality, "classDefenseBonuses">;
}

/**
 * HP, defenses, and AC breakdown aligned with the character builder and sheet:
 * hybrid vs standard branching, class/hybrid NAD picks, and passive defenses from feats /
 * theme / paragon path / epic destiny (ETL statAdds + NAD-specific fields).
 */
export function computeBuilderLikeDerivedStats(
  index: RulesIndex,
  build: CharacterBuild,
  race: Race | undefined,
  armor: Armor | undefined,
  shield: Armor | undefined,
  options?: ComputeBuilderLikeDerivedStatsOptions
): DerivedStats {
  const supportPassiveDefense = aggregateSupportPassiveDefenseBonuses(index, build);
  const supportPassiveOther = aggregateSupportPassiveOtherBonuses(index, build);

  const hybridA =
    build.characterStyle === "hybrid" && build.hybridClassIdA
      ? index.hybridClasses?.find((h) => h.id === build.hybridClassIdA)
      : undefined;
  const hybridB =
    build.characterStyle === "hybrid" && build.hybridClassIdB
      ? index.hybridClasses?.find((h) => h.id === build.hybridClassIdB)
      : undefined;

  if (build.characterStyle === "hybrid" && hybridA && hybridB) {
    return computeHybridDerivedStats(
      build,
      race,
      hybridA,
      hybridB,
      armor,
      shield,
      parseHybridDefenseBonuses(hybridA, hybridB),
      supportPassiveDefense,
      supportPassiveOther
    );
  }

  const cls = index.classes?.find((c) => c.id === build.classId);
  const classDefenseBonuses =
    options?.legality !== undefined
      ? options.legality.classDefenseBonuses
      : validateCharacterBuild(index, build).classDefenseBonuses;

  return computeDerivedStats(
    build,
    race,
    cls,
    armor,
    shield,
    classDefenseBonuses,
    supportPassiveDefense,
    supportPassiveOther
  );
}
