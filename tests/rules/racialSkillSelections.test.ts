import { describe, expect, it } from "vitest";
import {
  autoGrantedTrainedSkillIds,
  effectiveTrainedSkillIdsForBuild,
  effectiveTrainedSkillIdSet
} from "../../src/rules/grantedSkillsQuery";
import {
  collectRaceSkillBonusFlatBySkillId,
  collectRacialSkillTrainingIdsFromBuild,
  RACIAL_SKILL_BONUS_PICK_AMOUNT
} from "../../src/rules/racialSkillSelections";
import { aggregateSupportPassiveOtherBonuses } from "../../src/rules/supportStatAdds";
import type { CharacterBuild, Race, RulesIndex } from "../../src/rules/models";

const skills = [
  { id: "SK_STEALTH", name: "Stealth", slug: "stealth", keyAbility: "Dexterity", raw: {} },
  { id: "SK_ARC", name: "Arcana", slug: "arcana", keyAbility: "Intelligence", raw: {} }
];

describe("collectRacialSkillTrainingIdsFromBuild", () => {
  it("reads skill ids from skillTraining raceSelection keys", () => {
    const build: CharacterBuild = {
      name: "T",
      level: 1,
      abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 10 },
      trainedSkillIds: [],
      featIds: [],
      powerIds: [],
      raceSelections: { "skillTraining:TR_EDU:0": "SK_ARC" }
    };
    expect(collectRacialSkillTrainingIdsFromBuild({ skills }, build)).toEqual(["SK_ARC"]);
  });

  it("ignores unknown skill ids", () => {
    const build: CharacterBuild = {
      name: "T",
      level: 1,
      abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 10 },
      trainedSkillIds: [],
      featIds: [],
      powerIds: [],
      raceSelections: { "skillTraining:TR_EDU:0": "SK_MISSING" }
    };
    expect(collectRacialSkillTrainingIdsFromBuild({ skills }, build)).toEqual([]);
  });
});

describe("collectRaceSkillBonusFlatBySkillId", () => {
  const kalashtar: Race = {
    id: "R_KAL",
    name: "Kalashtar",
    slug: "kalashtar",
    raw: {
      rules: {
        select: [{ attrs: { type: "Racial Trait", number: "1", Category: "Skill Bonus" } }]
      }
    }
  };

  it("grants +2 to the skill chosen in skillBonus-0", () => {
    const build: CharacterBuild = {
      name: "T",
      level: 1,
      raceId: "R_KAL",
      abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 10 },
      trainedSkillIds: [],
      featIds: [],
      powerIds: [],
      raceSelections: { "skillBonus-0": "SK_STEALTH" }
    };
    expect(collectRaceSkillBonusFlatBySkillId({ races: [kalashtar], skills }, build)).toEqual({
      SK_STEALTH: RACIAL_SKILL_BONUS_PICK_AMOUNT
    });
  });
});

describe("integration with grantedSkillsQuery and derived stats", () => {
  const kalashtar: Race = {
    id: "R_KAL",
    name: "Kalashtar",
    slug: "kalashtar",
    raw: {
      rules: {
        select: [{ attrs: { type: "Racial Trait", number: "1", Category: "Skill Bonus" } }]
      }
    }
  };

  const index: RulesIndex = {
    races: [kalashtar],
    racialTraits: [],
    skills,
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
    name: "T",
    level: 1,
    raceId: "R_KAL",
    classId: "c1",
    abilityScores: { STR: 10, CON: 10, DEX: 16, INT: 10, WIS: 10, CHA: 10 },
    trainedSkillIds: [],
    featIds: [],
    powerIds: [],
    raceSelections: {
      "skillBonus-0": "SK_STEALTH",
      "skillTraining:TR_BONUS:0": "SK_ARC"
    }
  };

  it("includes racial skill training from Skills tab picks without auto-grant", () => {
    expect(autoGrantedTrainedSkillIds(index, build)).not.toContain("SK_ARC");
    const withManual: CharacterBuild = { ...build, trainedSkillIds: ["SK_ARC", "SK_STEALTH"] };
    expect(effectiveTrainedSkillIdsForBuild(index, withManual).sort()).toEqual(["SK_ARC", "SK_STEALTH"]);
    expect(effectiveTrainedSkillIdSet(index, withManual).has("SK_ARC")).toBe(true);
  });

  it("adds racial skill bonus pick to support passive other", () => {
    expect(aggregateSupportPassiveOtherBonuses(index, build).skillFlatBySkillId.SK_STEALTH).toBe(2);
  });

  it("does not treat skill bonus pick as trained", () => {
    expect(autoGrantedTrainedSkillIds(index, build)).not.toContain("SK_STEALTH");
  });
});
