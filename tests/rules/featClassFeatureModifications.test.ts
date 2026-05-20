import { describe, expect, it } from "vitest";
import {
  collectFeatClassFeatureModificationsForBuild,
  collectFeatModificationsByClassFeatureId
} from "../../src/rules/featClassFeatureModifications";
import type { CharacterBuild, ClassFeature, RulesIndex } from "../../src/rules/models";

const virtueOfPrescience: ClassFeature = {
  id: "ID_FMP_CLASS_FEATURE_1347",
  name: "Virtue of Prescience",
  slug: "virtue-of-prescience",
  shortDescription: "Interrupt: grant ally Wis mod to defense.",
  body: "Once per encounter as an immediate interrupt…",
  raw: { specific: { Level: "1" } }
};

const index = {
  classes: [{ id: "ID_FMP_CLASS_104", name: "Bard", slug: "bard", raw: { specific: {} } }],
  hybridClasses: [],
  feats: [
    {
      id: "ID_FMP_FEAT_2892",
      name: "Moon Sight",
      slug: "moon-sight",
      prereqTokens: [],
      powerModifications: [
        {
          powerName: "Virtue of Prescience",
          powerId: null,
          classFeatureId: "ID_FMP_CLASS_FEATURE_1347",
          field: "Moon Sight",
          value: "The triggering enemy takes psychic damage equal to your wisdom modifier."
        }
      ],
      raw: {}
    }
  ],
  powers: [],
  skills: [],
  races: [],
  themes: [],
  paragonPaths: [],
  epicDestinies: [],
  backgrounds: [],
  rituals: [],
  items: [],
  classFeatures: [virtueOfPrescience],
  grantedClassFeatureNamesBySupportId: {
    ID_FMP_CLASS_104: ["Bardic Virtue", "Majestic Word"]
  }
} as unknown as RulesIndex;

describe("featClassFeatureModifications", () => {
  it("collects modifications by class feature id when no power exists", () => {
    const map = collectFeatModificationsByClassFeatureId(index, ["ID_FMP_FEAT_2892"]);
    expect(map.get("ID_FMP_CLASS_FEATURE_1347")).toHaveLength(1);
    expect(map.get("ID_FMP_CLASS_FEATURE_1347")?.[0]?.featName).toBe("Moon Sight");
  });

  it("surfaces mods only for class features the character has", () => {
    const build: CharacterBuild = {
      level: 5,
      classId: "ID_FMP_CLASS_104",
      featIds: ["ID_FMP_FEAT_2892"],
      classSelections: { buildOptionId: "ID_FMP_CLASS_FEATURE_1347" },
      powerIds: [],
      abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 16, CHA: 10 },
      trainedSkillIds: []
    };
    const rows = collectFeatClassFeatureModificationsForBuild(index, build);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.classFeatureName).toBe("Virtue of Prescience");
    expect(rows[0]?.augmentations[0]?.text).toContain("psychic damage");
  });

  it("does not attach class feature mods when target resolves as a power", () => {
    const indexWithPower = {
      ...index,
      feats: [
        {
          id: "F1",
          name: "Style",
          slug: "style",
          prereqTokens: [],
          powerModifications: [
            {
              powerName: "Crushing Surge",
              powerId: "P1",
              field: "Style",
              value: "Bonus."
            }
          ],
          raw: {}
        }
      ],
      powers: [{ id: "P1", name: "Crushing Surge", slug: "crushing-surge", raw: { specific: {} } }],
      classFeatures: [virtueOfPrescience]
    } as unknown as RulesIndex;
    const map = collectFeatModificationsByClassFeatureId(indexWithPower, ["F1"]);
    expect(map.size).toBe(0);
  });
});
