import { describe, expect, it } from "vitest";
import { validateCharacterBuild } from "../../src/rules/characterValidator";
import {
  applyEssentialsBuildSuggestedPowerSlots,
  CLASS_BUILD_OPTION_SELECTION_KEY,
  essentialsClassBuildOptions,
  essentialsBuildSuggestedPowerIds,
  getClassBuildOptions,
  hasEssentialsClassBuildPicker,
  pruneClassBuildOptionSelection,
  selectedClassBuildOptionId
} from "../../src/rules/classBuildOptions";
import type { CharacterBuild, ClassDef, RulesIndex } from "../../src/rules/models";
import fullIndex from "../../generated/rules_index.json";

const cleric: ClassDef = {
  id: "ID_FMP_CLASS_2",
  name: "Cleric",
  slug: "cleric",
  raw: { specific: { "Build Options": "Battle Cleric, Devoted Cleric" } }
};

const index = {
  classes: [cleric],
  classBuildOptionsByClassId: {
    ID_FMP_CLASS_2: [
      {
        id: "ID_FMP_BUILD_6",
        name: "Battle Cleric",
        parentFeatureId: "",
        parentFeatureName: "Build Options",
        shortDescription: "Wisdom, Strength",
        body: "Battle cleric body",
        powerIds: ["ID_FMP_POWER_1"]
      },
      {
        id: "ID_FMP_BUILD_7",
        name: "Devoted Cleric",
        parentFeatureId: "",
        parentFeatureName: "Build Options",
        powerIds: []
      }
    ]
  }
} as unknown as RulesIndex;

describe("classBuildOptions", () => {
  it("reads Essentials build options from index", () => {
    const opts = essentialsClassBuildOptions(index, cleric);
    expect(opts).toHaveLength(2);
    expect(opts[0]!.id).toBe("ID_FMP_BUILD_6");
    expect(hasEssentialsClassBuildPicker(index, cleric)).toBe(true);
  });

  it("resolves selected build id from classSelections", () => {
    expect(
      selectedClassBuildOptionId({
        [CLASS_BUILD_OPTION_SELECTION_KEY]: "ID_FMP_BUILD_6"
      })
    ).toBe("ID_FMP_BUILD_6");
    expect(selectedClassBuildOptionId({ buildOption: "ID_FMP_BUILD_7" })).toBe("ID_FMP_BUILD_7");
  });

  it("prunes invalid build option when class changes", () => {
    const pruned = pruneClassBuildOptionSelection(index, "ID_FMP_CLASS_2", {
      buildOptionId: "ID_FMP_BUILD_6",
      other: "x"
    });
    expect(pruned?.buildOptionId).toBe("ID_FMP_BUILD_6");
    const cleared = pruneClassBuildOptionSelection(index, "ID_FMP_OTHER", {
      buildOptionId: "ID_FMP_BUILD_6"
    });
    expect(cleared?.buildOptionId).toBeUndefined();
  });

  it("validator does not require Essentials build when multiple options exist", () => {
    const build = {
      name: "Test",
      level: 1,
      raceId: "race",
      classId: "ID_FMP_CLASS_2",
      abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 10 },
      trainedSkillIds: [],
      featIds: [],
      powerIds: []
    };
    const miniIndex = {
      ...index,
      races: [{ id: "race", name: "Human", slug: "human", raw: {} }],
      powers: [],
      skills: [],
      languages: [],
      themes: [],
      paragonPaths: [],
      epicDestinies: [],
      backgrounds: [],
      feats: [],
      classFeatureChoiceGroupsByClassId: {}
    } as unknown as RulesIndex;
    const withoutPick = validateCharacterBuild(miniIndex, build);
    expect(withoutPick.errors.some((e) => e.includes("class build"))).toBe(false);
    const invalidPick = validateCharacterBuild(miniIndex, {
      ...build,
      classSelections: { buildOptionId: "ID_FMP_BUILD_INVALID" }
    });
    expect(invalidPick.errors.some((e) => e.includes("valid class build"))).toBe(true);
    const ok = validateCharacterBuild(miniIndex, {
      ...build,
      classSelections: { buildOptionId: "ID_FMP_BUILD_6" }
    });
    expect(ok.errors.some((e) => e.includes("class build"))).toBe(false);
  });

  it("falls back to compendium text when index has no rows", () => {
    const emptyIndex = { classes: [cleric], classBuildOptionsByClassId: {} } as unknown as RulesIndex;
    expect(getClassBuildOptions(emptyIndex, cleric).map((o) => o.name)).toEqual([
      "Battle Cleric",
      "Devoted Cleric"
    ]);
    expect(essentialsClassBuildOptions(emptyIndex, cleric)).toHaveLength(0);
  });

  it("returns suggested power ids for selected Essentials build", () => {
    const ids = essentialsBuildSuggestedPowerIds(index, cleric.id, {
      [CLASS_BUILD_OPTION_SELECTION_KEY]: "ID_FMP_BUILD_6"
    });
    expect(ids).toContain("ID_FMP_POWER_1");
  });

  it("pre-fills empty class power slots from Battle Cleric build", () => {
    const rules = fullIndex as RulesIndex;
    const clericDef = rules.classes.find((c) => c.slug === "cleric");
    expect(clericDef).toBeDefined();
    const build: CharacterBuild = {
      name: "test",
      level: 1,
      classId: clericDef!.id,
      abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 16, CHA: 10 },
      featIds: [],
      powerIds: [],
      trainedSkillIds: [],
      classSelections: { [CLASS_BUILD_OPTION_SELECTION_KEY]: "ID_FMP_BUILD_6" }
    };
    const slots = applyEssentialsBuildSuggestedPowerSlots(build, rules, 1, false);
    expect(slots && Object.keys(slots).length).toBeGreaterThan(0);
  });
});
