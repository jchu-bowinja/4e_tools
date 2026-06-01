import { describe, expect, it } from "vitest";
import {
  collectCharacterClassFeatureIds,
  collectClassFeatureIdsFromClass,
  getCharacterClassFeatureTraitRows
} from "../../src/rules/characterClassFeatures";
import { CLASS_BUILD_OPTION_SELECTION_KEY } from "../../src/rules/classBuildOptions";
import type { CharacterBuild, ClassDef, ClassFeature, RulesIndex } from "../../src/rules/models";

const rogueClass: ClassDef = {
  id: "ID_FMP_CLASS_6",
  name: "Rogue",
  slug: "rogue",
  raw: { specific: { _PARSED_CLASS_FEATURE: "Rogue Weapon Talent,Sharpshooter Talent" } }
};

const weaponTalent: ClassFeature = {
  id: "ID_WEAPON",
  name: "Rogue Weapon Talent",
  slug: "rogue-weapon-talent",
  raw: { specific: { Level: "1" } }
};

const sharpshooter: ClassFeature = {
  id: "ID_SHARP",
  name: "Sharpshooter Talent",
  slug: "sharpshooter-talent",
  raw: { specific: { Level: "1" } }
};

const artfulDodger: ClassFeature = {
  id: "ID_DODGER",
  name: "Artful Dodger",
  slug: "artful-dodger",
  raw: { specific: { Level: "1" } }
};

const sneakAttack: ClassFeature = {
  id: "ID_SNEAK",
  name: "Sneak Attack",
  slug: "sneak-attack",
  raw: { specific: { Level: "1" } }
};

const index: RulesIndex = {
  races: [],
  classes: [rogueClass],
  feats: [],
  powers: [],
  skills: [],
  languages: [],
  armors: [],
  abilityScores: [],
  racialTraits: [],
  classFeatures: [weaponTalent, sharpshooter, artfulDodger, sneakAttack],
  grantedClassFeatureNamesBySupportId: {
    ID_FMP_CLASS_6: ["Sneak Attack"]
  },
  classFeatureChoiceGroupsByClassId: {
    ID_FMP_CLASS_6: [
      {
        key: "classFeature:tactics",
        kind: "classFeature",
        parentFeatureId: "tactics",
        parentFeatureName: "Rogue Tactics",
        pickCount: 1,
        options: [
          {
            id: "ID_DODGER",
            name: "Artful Dodger",
            parentFeatureId: "tactics",
            parentFeatureName: "Rogue Tactics"
          }
        ]
      },
      {
        key: "classFeaturePair:ID_SHARP:ID_WEAPON",
        kind: "classFeature",
        parentFeatureId: "",
        parentFeatureName: "Class feature",
        pickCount: 1,
        options: [
          { id: "ID_WEAPON", name: "Rogue Weapon Talent", parentFeatureId: "", parentFeatureName: "Class feature" },
          { id: "ID_SHARP", name: "Sharpshooter Talent", parentFeatureId: "", parentFeatureName: "Class feature" }
        ]
      }
    ]
  }
};

const build: CharacterBuild = {
  name: "Test",
  level: 1,
  raceId: "race1",
  classId: "ID_FMP_CLASS_6",
  abilityScores: { STR: 10, CON: 10, DEX: 16, INT: 10, WIS: 10, CHA: 10 },
  trainedSkillIds: [],
  featIds: [],
  powerIds: [],
  classSelections: {
    "classFeature:tactics": "ID_DODGER",
    "classFeaturePair:ID_SHARP:ID_WEAPON": "ID_WEAPON"
  }
};

describe("characterClassFeatures", () => {
  it("includes granted and selected features but not unchosen pair options", () => {
    const ids = collectCharacterClassFeatureIds(index, build);
    expect(ids).toContain("ID_SNEAK");
    expect(ids).toContain("ID_DODGER");
    expect(ids).toContain("ID_WEAPON");
    expect(ids).not.toContain("ID_SHARP");
  });

  it("maps collected ids to trait rows for the sheet", () => {
    const rows = getCharacterClassFeatureTraitRows(index, build);
    expect(rows.map((r) => r.name).sort()).toEqual(
      ["Level 1 Artful Dodger", "Level 1 Rogue Weapon Talent", "Level 1 Sneak Attack"].sort()
    );
  });

  it("excludes paragon path and epic destiny from sheet class feature rows", () => {
    const pathFeature: ClassFeature = {
      id: "ID_PATH_FEAT",
      name: "Path Feature",
      slug: "path-feature",
      raw: { specific: { Level: "11" } }
    };
    const destinyFeature: ClassFeature = {
      id: "ID_DESTINY_FEAT",
      name: "Destiny Feature",
      slug: "destiny-feature",
      raw: { specific: { Level: "21" } }
    };
    const richIndex: RulesIndex = {
      ...index,
      classFeatures: [...index.classFeatures!, pathFeature, destinyFeature],
      paragonPaths: [
        {
          id: "path1",
          name: "Test Path",
          slug: "test-path",
          raw: { specific: { "Class Features": "ID_PATH_FEAT" } }
        }
      ],
      epicDestinies: [
        {
          id: "destiny1",
          name: "Test Destiny",
          slug: "test-destiny",
          raw: { specific: { "Class Features": "ID_DESTINY_FEAT" } }
        }
      ]
    };
    const withPath: CharacterBuild = {
      ...build,
      level: 21,
      paragonPathId: "path1",
      epicDestinyId: "destiny1"
    };
    const sheetRows = getCharacterClassFeatureTraitRows(richIndex, withPath).map((r) => r.id);
    expect(sheetRows).not.toContain("ID_PATH_FEAT");
    expect(sheetRows).not.toContain("ID_DESTINY_FEAT");
    const allIds = collectCharacterClassFeatureIds(richIndex, withPath);
    expect(allIds).toContain("ID_PATH_FEAT");
    expect(allIds).toContain("ID_DESTINY_FEAT");
  });

  it("does not treat Essentials build option id as a class feature", () => {
    const buildWithEssentials: CharacterBuild = {
      ...build,
      classSelections: {
        ...build.classSelections,
        [CLASS_BUILD_OPTION_SELECTION_KEY]: "ID_FMP_BUILD_999"
      }
    };
    const ids = collectClassFeatureIdsFromClass(index, buildWithEssentials);
    expect(ids).not.toContain("ID_FMP_BUILD_999");
  });
});
