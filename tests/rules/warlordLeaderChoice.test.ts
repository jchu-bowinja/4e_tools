import { describe, expect, it } from "vitest";
import { getClassFeatureChoiceGroups } from "../../src/rules/classFeatureChoices";
import { collectClassFeatureIdsFromClass } from "../../src/rules/characterClassFeatures";
import type { CharacterBuild, ClassDef, ClassFeature, RulesIndex } from "../../src/rules/models";
import { getClassTraitRows } from "../../src/rules/supportTraits";

const warlordClass: ClassDef = {
  id: "ID_FMP_CLASS_8",
  name: "Warlord",
  slug: "warlord",
  raw: {
    specific: {
      _PARSED_CLASS_FEATURE:
        "Archer Warlord, Battlefront Leader, Canny Leader, Combat Leader, Commanding Presence, Inspiring Word"
    }
  }
};

const battlefront: ClassFeature = {
  id: "ID_FMP_CLASS_FEATURE_2287",
  name: "Battlefront Leader",
  slug: "battlefront-leader",
  raw: { specific: { Level: "1" } }
};
const canny: ClassFeature = {
  id: "ID_FMP_CLASS_FEATURE_2285",
  name: "Canny Leader",
  slug: "canny-leader",
  raw: { specific: { Level: "1" } }
};
const combat: ClassFeature = {
  id: "ID_FMP_CLASS_FEATURE_443",
  name: "Combat Leader",
  slug: "combat-leader",
  raw: { specific: { Level: "1" } }
};
const commanding: ClassFeature = {
  id: "ID_FMP_CLASS_FEATURE_316",
  name: "Commanding Presence",
  slug: "commanding-presence",
  raw: { specific: { Level: "1" } }
};
const inspiring: ClassFeature = {
  id: "ID_FMP_CLASS_FEATURE_317",
  name: "Inspiring Word",
  slug: "inspiring-word",
  raw: { specific: { Level: "1" } }
};

const index: RulesIndex = {
  races: [],
  classes: [warlordClass],
  feats: [],
  powers: [],
  skills: [],
  languages: [],
  armors: [],
  abilityScores: [],
  racialTraits: [],
  classFeatures: [battlefront, canny, combat, commanding, inspiring],
  grantedClassFeatureNamesBySupportId: {
    ID_FMP_CLASS_8: ["Commanding Presence", "Inspiring Word"]
  },
  classFeatureChoiceGroupsByClassId: {
    ID_FMP_CLASS_8: [
      {
        key: "classFeature:ID_FMP_CLASS_FEATURE_316",
        kind: "classFeature",
        parentFeatureId: "ID_FMP_CLASS_FEATURE_316",
        parentFeatureName: "Commanding Presence",
        pickCount: 1,
        options: [
          {
            id: "ID_FMP_SUB",
            name: "Tactical Presence",
            parentFeatureId: "ID_FMP_CLASS_FEATURE_316",
            parentFeatureName: "Commanding Presence"
          }
        ]
      }
    ]
  }
};

describe("warlord leader pick", () => {
  it("adds a pick-one Leader group for the three leader features", () => {
    const groups = getClassFeatureChoiceGroups(index, warlordClass);
    const leader = groups.find((g) => g.parentFeatureName === "Leader");
    expect(leader).toBeTruthy();
    expect(leader?.pickCount).toBe(1);
    expect(leader?.options.map((o) => o.name).sort()).toEqual([
      "Battlefront Leader",
      "Canny Leader",
      "Combat Leader"
    ]);
  });

  it("only includes the selected leader on the character", () => {
    const build: CharacterBuild = {
      name: "Test",
      level: 1,
      raceId: "race",
      classId: "ID_FMP_CLASS_8",
      abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 14 },
      trainedSkillIds: [],
      featIds: [],
      powerIds: [],
      classSelections: {
        "classFeaturePair:ID_FMP_CLASS_FEATURE_2285:ID_FMP_CLASS_FEATURE_2287:ID_FMP_CLASS_FEATURE_443":
          "ID_FMP_CLASS_FEATURE_2285",
        "classFeature:ID_FMP_CLASS_FEATURE_316": "ID_FMP_SUB"
      }
    };
    const ids = collectClassFeatureIdsFromClass(index, build);
    expect(ids).toContain("ID_FMP_CLASS_FEATURE_2285");
    expect(ids).not.toContain("ID_FMP_CLASS_FEATURE_2287");
    expect(ids).not.toContain("ID_FMP_CLASS_FEATURE_443");
    expect(ids).toContain("ID_FMP_CLASS_FEATURE_316");
    expect(ids).toContain("ID_FMP_CLASS_FEATURE_317");

    const traitNames = getClassTraitRows(warlordClass, index, build).map((r) => r.name);
    expect(traitNames.some((n) => n.includes("Canny Leader"))).toBe(true);
    expect(traitNames.some((n) => n.includes("Battlefront Leader"))).toBe(false);
    expect(traitNames.some((n) => n.includes("Combat Leader"))).toBe(false);
  });
});
