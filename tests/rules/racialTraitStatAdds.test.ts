import { describe, expect, it } from "vitest";
import { computeBuilderLikeDerivedStats } from "../../src/rules/derivedStatsFromBuild";
import {
  nadBonusesFromRacialTraitSpecific,
  statAddsFromRacialTrait,
  statAddsFromRules
} from "../../src/rules/racialTraitStatAdds";
import {
  aggregateSupportPassiveDefenseBonuses,
  aggregateSupportPassiveOtherBonuses
} from "../../src/rules/supportStatAdds";
import type { CharacterBuild, Race, RacialTrait, RulesIndex } from "../../src/rules/models";

describe("statAddsFromRacialTrait", () => {
  it("parses compendium attrs wrapper into StatAddEntry rows", () => {
    const adds = statAddsFromRules({
      statadd: [
        {
          attrs: {
            name: "Will Defense",
            value: "+1",
            type: "Racial"
          }
        },
        {
          attrs: {
            name: "Reflex Defense",
            value: "+1",
            condition: "while manifesting firesoul",
            requires: "watersoul|firesoul"
          }
        }
      ]
    });
    expect(adds).toEqual([
      { name: "Will Defense", value: "+1", type: "Racial" },
      {
        name: "Reflex Defense",
        value: "+1",
        condition: "while manifesting firesoul",
        requires: "watersoul|firesoul"
      }
    ]);
  });

  it("parses Bonus to Defense on trait specific", () => {
    const trait: RacialTrait = {
      id: "TR_NAD",
      name: "NAD Trait",
      slug: "nad",
      raw: { specific: { "Bonus to Defense": "+1 Fortitude, +1 Reflex" } }
    };
    expect(nadBonusesFromRacialTraitSpecific(trait)).toEqual({ fortitude: 1, reflex: 1 });
  });
});

describe("aggregate support bonuses from racial traits", () => {
  const githyankiWill: RacialTrait = {
    id: "TR_WILL",
    name: "Githyanki Willpower",
    slug: "gith-will",
    raw: { rules: { statadd: [{ attrs: { name: "Will Defense", value: "+1" } }] } }
  };
  const stealthBonus: RacialTrait = {
    id: "TR_STEALTH",
    name: "Stealth Bonus",
    slug: "stealth-bonus",
    raw: {
      rules: { statadd: [{ attrs: { name: "Stealth Misc", value: "+2", type: "Racial" } }] }
    }
  };
  const firesoul: RacialTrait = {
    id: "TR_FIRE",
    name: "Firesoul",
    slug: "firesoul",
    raw: {
      rules: {
        statadd: [
          {
            attrs: {
              name: "Reflex Defense",
              value: "+1",
              condition: "while manifesting firesoul"
            }
          }
        ]
      }
    }
  };

  const race: Race = {
    id: "R_GITH",
    name: "Githyanki",
    slug: "githyanki",
    raw: { specific: { "Racial Traits": "TR_WILL,TR_STEALTH" } }
  };

  const index: RulesIndex = {
    races: [race],
    racialTraits: [githyankiWill, stealthBonus, firesoul],
    skills: [{ id: "skill_stealth", name: "Stealth", slug: "stealth", keyAbility: "Dexterity", raw: {} }],
    feats: [],
    themes: [],
    paragonPaths: [],
    epicDestinies: [],
    classes: [
      {
        id: "c1",
        name: "Fighter",
        slug: "fighter",
        hitPointsAt1: 15,
        hitPointsPerLevel: 6,
        healingSurgesBase: 9,
        raw: { specific: {} }
      } as never
    ]
  };

  const build: CharacterBuild = {
    name: "Test",
    level: 1,
    raceId: "R_GITH",
    classId: "c1",
    abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 10 },
    trainedSkillIds: [],
    featIds: [],
    powerIds: []
  };

  it("adds unconditional NAD and skill misc from active racial traits", () => {
    expect(aggregateSupportPassiveDefenseBonuses(index, build).will).toBe(1);
    expect(aggregateSupportPassiveOtherBonuses(index, build).skillFlatBySkillId.skill_stealth).toBe(2);
  });

  it("applies manifestation reflex bonus when the matching soul trait is active", () => {
    const genasiRace: Race = {
      id: "R_GEN",
      name: "Genasi",
      slug: "genasi",
      raw: { specific: { "Racial Traits": "TR_FIRE" } }
    };
    const genasiIndex: RulesIndex = { ...index, races: [genasiRace], racialTraits: [firesoul] };
    const genasiBuild: CharacterBuild = { ...build, raceId: "R_GEN" };
    expect(aggregateSupportPassiveDefenseBonuses(genasiIndex, genasiBuild).reflex).toBe(1);
  });

  it("does not apply another soul's manifestation bonus", () => {
    const watersoul: RacialTrait = {
      id: "TR_WATER",
      name: "Watersoul",
      slug: "watersoul",
      raw: { rules: { statadd: [] } }
    };
    const genasiRace: Race = {
      id: "R_GEN",
      name: "Genasi",
      slug: "genasi",
      raw: { specific: { "Racial Traits": "TR_WATER" } }
    };
    const genasiIndex: RulesIndex = { ...index, races: [genasiRace], racialTraits: [firesoul, watersoul] };
    const genasiBuild: CharacterBuild = { ...build, raceId: "R_GEN" };
    expect(aggregateSupportPassiveDefenseBonuses(genasiIndex, genasiBuild).reflex).toBe(0);
  });

  it("flows into computeBuilderLikeDerivedStats will total", () => {
    const derived = computeBuilderLikeDerivedStats(index, build, race, undefined, undefined, {
      legality: { classDefenseBonuses: undefined }
    });
    expect(derived.willBreakdown.components.find((c) => c.key === "feat")?.value).toBe(1);
    expect(derived.defenses.will).toBe(10 + 1);
    expect(derived.supportPassiveOther.skillFlatBySkillId.skill_stealth).toBe(2);
  });
});

describe("tiered racial statadd on one trait", () => {
  it("resolves named references within the same trait", () => {
    const humanDefense: RacialTrait = {
      id: "TR_HD",
      name: "Human Defense Bonuses",
      slug: "human-defense",
      raw: {
        rules: {
          statadd: [
            { attrs: { name: "Human Defense Bonuses", value: "+1" } },
            { attrs: { name: "Fortitude Defense", value: "+Human Defense Bonuses", type: "Racial" } }
          ]
        }
      }
    };
    const race: Race = {
      id: "R_H",
      name: "Human",
      slug: "human",
      raw: { specific: { "Racial Traits": "TR_HD" } }
    };
    const index: RulesIndex = {
      races: [race],
      racialTraits: [humanDefense],
      skills: [],
      feats: [],
      themes: [],
      paragonPaths: [],
      epicDestinies: [],
      classes: []
    };
    const build: CharacterBuild = {
      name: "T",
      level: 1,
      raceId: "R_H",
      abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 10 },
      trainedSkillIds: [],
      featIds: [],
      powerIds: []
    };
    expect(aggregateSupportPassiveDefenseBonuses(index, build).fortitude).toBe(1);
    expect(statAddsFromRacialTrait(humanDefense)).toHaveLength(2);
  });
});
