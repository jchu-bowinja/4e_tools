import { describe, expect, it } from "vitest";
import { pruneStalePowerSelections } from "../../src/rules/powerSelections";
import type { CharacterBuild, Race, RacialTrait, RulesIndex } from "../../src/rules/models";

function raceWithTraits(raceId: string, name: string, traitIds: string[]): Race {
  return {
    id: raceId,
    name,
    slug: name.toLowerCase().replace(/\s+/g, "-"),
    raw: { specific: { "Racial Traits": traitIds.join(",") } }
  };
}

function trait(id: string, name: string, extraRaw?: Record<string, unknown>): RacialTrait {
  return { id, name, slug: name.toLowerCase(), raw: extraRaw ?? {} };
}

describe("powerSelections prune", () => {
  it("keeps selections for powers granted by selected subrace traits", () => {
    const parentTraitId = "ID_FMP_RACIAL_TRAIT_PARENT";
    const subraceTraitId = "ID_FMP_RACIAL_TRAIT_SUB";
    const grantedPowerId = "ID_FMP_POWER_1";
    const index = {
      races: [raceWithTraits("race_a", "Aasimar", [parentTraitId])],
      racialTraits: [
        trait(parentTraitId, "Aasimar Subrace", { specific: { _PARSED_SUB_FEATURES: subraceTraitId } }),
        trait(subraceTraitId, "Dawnborn", { specific: { Powers: grantedPowerId } })
      ],
      powers: [{ id: grantedPowerId, name: "Radiant Burst", slug: "radiant-burst", raw: {} }],
      feats: [],
      classes: [],
      skills: [],
      languages: [],
      armors: [],
      abilityScores: [],
      themes: [],
      paragonPaths: [],
      epicDestinies: []
    } as never as RulesIndex;
    const build: CharacterBuild = {
      name: "pc",
      level: 1,
      abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 10 },
      featIds: [],
      powerIds: [],
      trainedSkillIds: [],
      raceId: "race_a",
      raceSelections: { subrace: subraceTraitId },
      powerSelections: {
        [grantedPowerId]: { mode: "radiant" }
      }
    };
    const next = pruneStalePowerSelections(index, build);
    expect(next.powerSelections?.[grantedPowerId]).toEqual({ mode: "radiant" });
  });

  it("drops selection when subrace no longer grants the power", () => {
    const parentTraitId = "ID_FMP_RACIAL_TRAIT_PARENT";
    const oldSubraceTraitId = "ID_FMP_RACIAL_TRAIT_SUB_OLD";
    const newSubraceTraitId = "ID_FMP_RACIAL_TRAIT_SUB_NEW";
    const grantedPowerId = "ID_FMP_POWER_1";
    const index = {
      races: [raceWithTraits("race_a", "Aasimar", [parentTraitId])],
      racialTraits: [
        trait(parentTraitId, "Aasimar Subrace", { specific: { _PARSED_SUB_FEATURES: `${oldSubraceTraitId},${newSubraceTraitId}` } }),
        trait(oldSubraceTraitId, "Dawnborn", { specific: { Powers: grantedPowerId } }),
        trait(newSubraceTraitId, "Voidborn", { specific: { Powers: "" } })
      ],
      powers: [{ id: grantedPowerId, name: "Radiant Burst", slug: "radiant-burst", raw: {} }],
      feats: [],
      classes: [],
      skills: [],
      languages: [],
      armors: [],
      abilityScores: [],
      themes: [],
      paragonPaths: [],
      epicDestinies: []
    } as never as RulesIndex;
    const build: CharacterBuild = {
      name: "pc",
      level: 1,
      abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 10 },
      featIds: [],
      powerIds: [],
      trainedSkillIds: [],
      raceId: "race_a",
      raceSelections: { subrace: newSubraceTraitId },
      powerSelections: {
        [grantedPowerId]: { mode: "radiant" }
      }
    };
    const next = pruneStalePowerSelections(index, build);
    expect(next.powerSelections).toBeUndefined();
  });
});
