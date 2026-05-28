import { describe, expect, it } from "vitest";
import {
  CLASS_FEATURE_CHOICE_NONE,
  SIGNS_OF_INFLUENCE_CLASS_FEATURE_ID,
  filterVisibleClassFeatureChoiceGroups,
  getClassFeatureChoiceGroups
} from "../../src/rules/classFeatureChoices";
import { collectClassFeatureIdsFromClass } from "../../src/rules/characterClassFeatures";
import { validateCharacterBuild } from "../../src/rules/characterValidator";
import type { CharacterBuild, ClassDef, ClassFeature, RulesIndex } from "../../src/rules/models";

const bardClass: ClassDef = {
  id: "ID_FMP_CLASS_104",
  name: "Bard",
  slug: "bard",
  raw: { specific: {} }
};

const signsOfInfluence: ClassFeature = {
  id: SIGNS_OF_INFLUENCE_CLASS_FEATURE_ID,
  name: "Signs of Influence",
  slug: "signs-of-influence",
  shortDescription:
    "Gain two Signs of Influence options at 1st level and additional options at 13th and 17th levels",
  raw: {
    specific: {
      Level: "1",
      _PARSED_SUB_FEATURES:
        "ID_FMP_CLASS_FEATURE_4140, ID_FMP_CLASS_FEATURE_4141, ID_FMP_CLASS_FEATURE_4142, ID_FMP_CLASS_FEATURE_4143, ID_FMP_CLASS_FEATURE_4144"
    },
    rules: {
      select: [
        {
          attrs: {
            type: "Class Feature",
            number: "2",
            category:
              "ID_FMP_CLASS_FEATURE_4140|ID_FMP_CLASS_FEATURE_4141|ID_FMP_CLASS_FEATURE_4142|ID_FMP_CLASS_FEATURE_4143|ID_FMP_CLASS_FEATURE_4144"
          }
        },
        {
          attrs: {
            type: "Class Feature",
            number: "1",
            category:
              "ID_FMP_CLASS_FEATURE_4140|ID_FMP_CLASS_FEATURE_4141|ID_FMP_CLASS_FEATURE_4142|ID_FMP_CLASS_FEATURE_4143|ID_FMP_CLASS_FEATURE_4144",
            Level: "13"
          }
        },
        {
          attrs: {
            type: "Class Feature",
            number: "1",
            category:
              "ID_FMP_CLASS_FEATURE_4140|ID_FMP_CLASS_FEATURE_4141|ID_FMP_CLASS_FEATURE_4142|ID_FMP_CLASS_FEATURE_4143|ID_FMP_CLASS_FEATURE_4144",
            Level: "17"
          }
        }
      ]
    }
  }
};

const signOptions: ClassFeature[] = [
  { id: "ID_FMP_CLASS_FEATURE_4140", name: "Attract Attendants", slug: "attract-attendants", raw: {} },
  { id: "ID_FMP_CLASS_FEATURE_4141", name: "Demand Audience", slug: "demand-audience", raw: {} },
  { id: "ID_FMP_CLASS_FEATURE_4142", name: "Ritual Beneficiary", slug: "ritual-beneficiary", raw: {} },
  { id: "ID_FMP_CLASS_FEATURE_4143", name: "Travel in Style", slug: "travel-in-style", raw: {} },
  { id: "ID_FMP_CLASS_FEATURE_4144", name: "Welcome Guest", slug: "welcome-guest", raw: {} }
];

const index: RulesIndex = {
  races: [],
  classes: [bardClass],
  feats: [],
  powers: [],
  themes: [],
  paragonPaths: [],
  epicDestinies: [],
  skills: [],
  languages: [],
  armors: [],
  abilityScores: [],
  racialTraits: [],
  classFeatures: [signsOfInfluence, ...signOptions],
  grantedClassFeatureNamesBySupportId: {
    ID_FMP_CLASS_104: ["Bardic Virtue", "Majestic Word"]
  },
  classFeatureChoiceGroupsByClassId: {
    ID_FMP_CLASS_104: []
  }
};

const baseBuild: CharacterBuild = {
  name: "Test",
  level: 1,
  raceId: "race",
  classId: "ID_FMP_CLASS_104",
  abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 16 },
  trainedSkillIds: [],
  featIds: [],
  powerIds: []
};

describe("Bard Signs of Influence", () => {
  it("offers optional Signs of Influence with two level-1 sign picks", () => {
    const groups = getClassFeatureChoiceGroups(index, bardClass);
    const optional = groups.find((g) => g.optional && g.parentFeatureName === "Signs of Influence");
    expect(optional).toBeTruthy();
    expect(optional?.options.map((o) => o.id)).toEqual([
      CLASS_FEATURE_CHOICE_NONE,
      SIGNS_OF_INFLUENCE_CLASS_FEATURE_ID
    ]);

    const rs = { [`classFeatureOptional:${SIGNS_OF_INFLUENCE_CLASS_FEATURE_ID}`]: SIGNS_OF_INFLUENCE_CLASS_FEATURE_ID };
    const visible = filterVisibleClassFeatureChoiceGroups(groups, rs, 1);
    const level1 = visible.find((g) => g.key === `classFeature:${SIGNS_OF_INFLUENCE_CLASS_FEATURE_ID}`);
    expect(level1?.pickCount).toBe(2);
    expect(level1?.options).toHaveLength(5);
  });

  it("unlocks additional sign picks at levels 13 and 17", () => {
    const groups = getClassFeatureChoiceGroups(index, bardClass);
    const rs = { [`classFeatureOptional:${SIGNS_OF_INFLUENCE_CLASS_FEATURE_ID}`]: SIGNS_OF_INFLUENCE_CLASS_FEATURE_ID };
    const at12 = filterVisibleClassFeatureChoiceGroups(groups, rs, 12);
    const at13 = filterVisibleClassFeatureChoiceGroups(groups, rs, 13);
    const at17 = filterVisibleClassFeatureChoiceGroups(groups, rs, 17);
    expect(at12.some((g) => g.minLevel === 13)).toBe(false);
    expect(at13.filter((g) => g.parentFeatureId === SIGNS_OF_INFLUENCE_CLASS_FEATURE_ID && !g.optional)).toHaveLength(2);
    expect(at17.filter((g) => g.parentFeatureId === SIGNS_OF_INFLUENCE_CLASS_FEATURE_ID && !g.optional)).toHaveLength(3);
  });

  it("grants chosen sign features on the character", () => {
    const build: CharacterBuild = {
      ...baseBuild,
      classSelections: {
        [`classFeatureOptional:${SIGNS_OF_INFLUENCE_CLASS_FEATURE_ID}`]: SIGNS_OF_INFLUENCE_CLASS_FEATURE_ID,
        [`classFeature:${SIGNS_OF_INFLUENCE_CLASS_FEATURE_ID}`]: "ID_FMP_CLASS_FEATURE_4140,ID_FMP_CLASS_FEATURE_4141"
      }
    };
    const ids = collectClassFeatureIdsFromClass(index, build);
    expect(ids).toContain(SIGNS_OF_INFLUENCE_CLASS_FEATURE_ID);
    expect(ids).toContain("ID_FMP_CLASS_FEATURE_4140");
    expect(ids).toContain("ID_FMP_CLASS_FEATURE_4141");
  });

  it("requires two distinct signs at level 1 when Signs of Influence is taken", () => {
    const build: CharacterBuild = {
      ...baseBuild,
      classSelections: {
        [`classFeatureOptional:${SIGNS_OF_INFLUENCE_CLASS_FEATURE_ID}`]: SIGNS_OF_INFLUENCE_CLASS_FEATURE_ID,
        [`classFeature:${SIGNS_OF_INFLUENCE_CLASS_FEATURE_ID}`]: "ID_FMP_CLASS_FEATURE_4140"
      }
    };
    const { errors } = validateCharacterBuild(index, build);
    expect(errors.some((e) => e.includes("Signs of Influence") && e.includes("2 option"))).toBe(true);
  });
});
