import { describe, expect, it } from "vitest";
import { computeBuilderLikeDerivedStats } from "../../src/rules/derivedStatsFromBuild";
import type { CharacterBuild, RulesIndex } from "../../src/rules/models";

const emptySupportIndex = (): RulesIndex =>
  ({
    skills: [],
    feats: [],
    themes: [],
    paragonPaths: [],
    epicDestinies: [],
    hybridClasses: [],
    classes: []
  }) as RulesIndex;

describe("computeBuilderLikeDerivedStats", () => {
  it("adds support passive AC when a feat has statAdds", () => {
    const build: CharacterBuild = {
      name: "T",
      level: 1,
      abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 10 },
      trainedSkillIds: [],
      featIds: ["feat_ac"],
      powerIds: [],
      raceId: "r1",
      classId: "c1"
    };
    const index: RulesIndex = {
      ...emptySupportIndex(),
      feats: [
        {
          id: "feat_ac",
          name: "Tough Hide",
          slug: "tough-hide",
          prereqTokens: [],
          statAdds: [{ name: "AC", value: "+2" }],
          raw: {}
        } as never
      ],
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
    const heavy = {
      id: "armor_chain",
      name: "Chainmail",
      armorType: "Heavy",
      armorBonus: 6,
      raw: {}
    } as never;
    const derived = computeBuilderLikeDerivedStats(index, build, { speed: 6 } as never, heavy, undefined, {
      legality: { classDefenseBonuses: undefined }
    });
    expect(derived.defenses.ac).toBe(10 + 0 + 6 + 2);
    expect(derived.acBreakdown.supportAcBonus).toBe(2);
  });
});
