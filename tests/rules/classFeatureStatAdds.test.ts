import { describe, expect, it } from "vitest";
import { collectCharacterClassFeatureIds } from "../../src/rules/characterClassFeatures";
import { statAddsFromClassFeature } from "../../src/rules/classFeatureStatAdds";
import { computeBuilderLikeDerivedStats } from "../../src/rules/derivedStatsFromBuild";
import { aggregateSupportPassiveDefenseBonuses } from "../../src/rules/supportStatAdds";
import type { CharacterBuild, ClassFeature, RulesIndex } from "../../src/rules/models";

describe("class feature statAdds", () => {
  const neverFalter: ClassFeature = {
    id: "ID_NEVER",
    name: "Never Falter",
    slug: "never-falter",
    raw: {
      specific: { Level: "11" },
      rules: {
        statadd: [{ attrs: { name: "Will Defense", value: "+2" } }]
      }
    }
  };

  const index: RulesIndex = {
    races: [{ id: "R1", name: "Human", slug: "human", raw: {} }],
    classes: [
      {
        id: "C1",
        name: "Fighter",
        slug: "fighter",
        hitPointsAt1: 15,
        hitPointsPerLevel: 6,
        healingSurgesBase: 9,
        raw: { specific: {} }
      } as never
    ],
    classFeatures: [neverFalter],
    feats: [],
    skills: [],
    themes: [],
    paragonPaths: [],
    epicDestinies: [],
    grantedClassFeatureNamesBySupportId: {
      C1: ["Never Falter"]
    }
  };

  it("parses statadd from class feature raw rules", () => {
    expect(statAddsFromClassFeature(neverFalter)).toEqual([{ name: "Will Defense", value: "+2" }]);
  });

  it("includes granted features in collectCharacterClassFeatureIds at level", () => {
    const build: CharacterBuild = {
      name: "T",
      level: 11,
      raceId: "R1",
      classId: "C1",
      abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 10 },
      trainedSkillIds: [],
      featIds: [],
      powerIds: []
    };
    expect(collectCharacterClassFeatureIds(index, build)).toContain("ID_NEVER");
    const low: CharacterBuild = { ...build, level: 1 };
    expect(collectCharacterClassFeatureIds(index, low)).not.toContain("ID_NEVER");
  });

  it("adds class feature NAD bonuses to aggregate support defense", () => {
    const build: CharacterBuild = {
      name: "T",
      level: 11,
      raceId: "R1",
      classId: "C1",
      abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 10 },
      trainedSkillIds: [],
      featIds: [],
      powerIds: []
    };
    expect(aggregateSupportPassiveDefenseBonuses(index, build).will).toBe(2);
    const derived = computeBuilderLikeDerivedStats(index, build, index.races[0], undefined, undefined, {
      legality: { classDefenseBonuses: undefined }
    });
    expect(derived.willBreakdown.components.find((c) => c.key === "feat")?.value).toBe(2);
  });
});
