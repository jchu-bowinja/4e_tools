import type { CharacterBuild, Race, RacialTrait, RulesIndex } from "./models";
import {
  HUMAN_POWER_OPTION_RACE_KEY,
  ID_RACIAL_TRAIT_HEROIC_EFFORT,
  ID_RACIAL_TRAIT_HUMAN_POWER_SELECTION
} from "./grantedPowersQuery";
import { expandRacialTraitIdsWithGrantedChildren } from "./racialTraitGrants";
import { getRaceExtraTraitIds, resolveDisplayedRacialTraitsForRace } from "./raceSubraces";
import { parseRacialTraitIdsFromRace } from "./racialTraits";

/**
 * All racial trait internal ids that mechanically apply to this build: top-level race traits,
 * chosen bundle options (subrace, manifestation, …), structural children, `rules.grant` racial trait
 * children (e.g. Moon Elf Skill Bonuses → Insight Bonus), past-life past spirit, and Human Power
 * Selection → Heroic Effort when that option is selected.
 *
 * Excludes bundle parent rows and unselected bundle variants (same visibility rules as the Race tab).
 * Does not include race-level `skillBonus-*` picks (skill ids +2 via {@link collectRaceSkillBonusFlatBySkillId}).
 */
export function collectActiveRacialTraitIds(
  race: Race | undefined,
  traitsById: Map<string, RacialTrait>,
  raceSelections?: Record<string, string>,
  races?: Race[]
): string[] {
  if (!race) return [];

  const seen = new Set<string>();
  const out: string[] = [];
  const push = (id: string | undefined) => {
    const tid = id?.trim();
    if (!tid || seen.has(tid)) return;
    seen.add(tid);
    out.push(tid);
  };

  for (const row of resolveDisplayedRacialTraitsForRace(race, traitsById, raceSelections)) {
    push(row.id);
  }

  for (const id of getRaceExtraTraitIds(race, traitsById, raceSelections, races)) {
    push(id);
  }

  if (parseRacialTraitIdsFromRace(race).includes(ID_RACIAL_TRAIT_HUMAN_POWER_SELECTION)) {
    const pick = raceSelections?.[HUMAN_POWER_OPTION_RACE_KEY];
    if (pick === ID_RACIAL_TRAIT_HEROIC_EFFORT) {
      push(ID_RACIAL_TRAIT_HEROIC_EFFORT);
    }
  }

  return expandRacialTraitIdsWithGrantedChildren(out, traitsById);
}

/** Resolved trait rows for {@link collectActiveRacialTraitIds} (skips missing index rows). */
export function collectActiveRacialTraits(
  race: Race | undefined,
  traitsById: Map<string, RacialTrait>,
  raceSelections?: Record<string, string>,
  races?: Race[]
): RacialTrait[] {
  return collectActiveRacialTraitIds(race, traitsById, raceSelections, races)
    .map((id) => traitsById.get(id))
    .filter((t): t is RacialTrait => Boolean(t));
}

export function collectActiveRacialTraitIdsFromBuild(
  index: Pick<RulesIndex, "races" | "racialTraits">,
  build: Pick<CharacterBuild, "raceId" | "raceSelections">
): string[] {
  const races = index.races ?? [];
  const race = races.find((r) => r.id === build.raceId);
  const traitsById = new Map((index.racialTraits ?? []).map((t) => [t.id, t]));
  return collectActiveRacialTraitIds(race, traitsById, build.raceSelections, races);
}

export function collectActiveRacialTraitsFromBuild(
  index: Pick<RulesIndex, "races" | "racialTraits">,
  build: Pick<CharacterBuild, "raceId" | "raceSelections">
): RacialTrait[] {
  const races = index.races ?? [];
  const race = races.find((r) => r.id === build.raceId);
  const traitsById = new Map((index.racialTraits ?? []).map((t) => [t.id, t]));
  return collectActiveRacialTraits(race, traitsById, build.raceSelections, races);
}
