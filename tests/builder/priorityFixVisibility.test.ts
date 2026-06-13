import { describe, expect, it } from "vitest";
import index from "../../generated/rules_index.json";
import type { CharacterBuild, RulesIndex } from "../../src/rules/models";
import {
  autoGrantedClassPowerNames,
  CLASS_BUILD_OPTION_SELECTION_KEY,
  essentialsBuildPrefilledSlotPowerNames,
  themeGrantedPowerNames,
  visibleClassFeaturePickGroupsOnClassTab,
  visiblePowerPickGroupsOnPowersTab
} from "./builderChoiceVisibility";

const rules = index as RulesIndex;

const baseBuild = (): CharacterBuild => ({
  name: "test",
  level: 1,
  abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 16 },
  featIds: [],
  powerIds: [],
  trainedSkillIds: []
});

describe("priority fix builder visibility", () => {
  it("P1a — Warlock Infernal Pact shows Hellish Rebuke variant pick on Powers tab", () => {
    const warlock = rules.classes.find((c) => c.slug === "warlock");
    expect(warlock).toBeDefined();

    const build: CharacterBuild = {
      ...baseBuild(),
      classId: warlock!.id,
      classSelections: {
        "classFeature:ID_FMP_CLASS_FEATURE_777": "ID_FMP_CLASS_FEATURE_773"
      }
    };

    const groups = visiblePowerPickGroupsOnPowersTab(rules, build);
    const infernalPick = groups.find((g) => g.key === "classPower:ID_FMP_CLASS_FEATURE_773");
    expect(infernalPick).toBeDefined();
    expect(infernalPick!.label).toBe("Infernal Pact");
    expect(infernalPick!.optionNames).toEqual(
      expect.arrayContaining(["Hellish Rebuke", "Gift to Avernus"])
    );
    expect(infernalPick!.optionNames.length).toBeGreaterThanOrEqual(2);
  });

  it("P1a — Wizard Tome of Readiness shows level-scoped encounter pool on Powers tab", () => {
    const wizard = rules.classes.find((c) => c.slug === "wizard");
    expect(wizard).toBeDefined();

    const build: CharacterBuild = {
      ...baseBuild(),
      classId: wizard!.id,
      classSelections: {
        "classFeature:ID_FMP_CLASS_FEATURE_444": "ID_FMP_CLASS_FEATURE_1511"
      }
    };

    const groups = visiblePowerPickGroupsOnPowersTab(rules, build);
    const tomePick = groups.find((g) => g.key === "classPower:ID_FMP_CLASS_FEATURE_1511");
    expect(tomePick).toBeDefined();
    expect(tomePick!.optionNames.length).toBeGreaterThan(10);
    expect(tomePick!.optionNames).toContain("Burning Hands");
  });

  it("P1b — Elementalist Air shows Elemental Specialty pick on Class tab", () => {
    const elementalist = rules.classes.find((c) => c.slug === "elementalist");
    expect(elementalist).toBeDefined();

    const build: CharacterBuild = {
      ...baseBuild(),
      classId: elementalist!.id,
      classSelections: {
        "classFeature:ID_FMP_CLASS_FEATURE_4335": "ID_FMP_CLASS_FEATURE_4336"
      }
    };

    const groups = visibleClassFeaturePickGroupsOnClassTab(rules, build);
    const specialty = groups.find((g) => g.key === "classFeature:ID_FMP_CLASS_FEATURE_4336");
    expect(specialty).toBeDefined();
    expect(specialty!.label).toBe("Elemental Specialty");
    expect(specialty!.optionNames).toEqual(
      expect.arrayContaining(["Howling Zephyr", "Static Charge"])
    );
  });

  it("P1e — Battle Cleric build pre-fills visible class power slot picks", () => {
    const cleric = rules.classes.find((c) => c.slug === "cleric");
    expect(cleric).toBeDefined();

    const build: CharacterBuild = {
      ...baseBuild(),
      classId: cleric!.id,
      abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 16, CHA: 10 },
      classSelections: {
        [CLASS_BUILD_OPTION_SELECTION_KEY]: "ID_FMP_BUILD_6"
      }
    };

    const prefilled = essentialsBuildPrefilledSlotPowerNames(rules, build);
    expect(prefilled.length).toBeGreaterThan(0);
  });

  it("P0 — Infernal Pact default boon appears in auto-granted class powers", () => {
    const warlock = rules.classes.find((c) => c.slug === "warlock");
    expect(warlock).toBeDefined();

    const build: CharacterBuild = {
      ...baseBuild(),
      classId: warlock!.id,
      classSelections: {
        "classFeature:ID_FMP_CLASS_FEATURE_777": "ID_FMP_CLASS_FEATURE_773"
      }
    };

    const granted = autoGrantedClassPowerNames(rules, build);
    const darkOne = rules.powers.find((p) => p.id === "ID_FMP_POWER_2095")?.name;
    expect(darkOne).toBeDefined();
    expect(granted).toContain(darkOne);
  });

  it("P0 theme fix — Bloodsworn theme power is visible at level 1", () => {
    const bloodsworn = rules.themes.find((t) => t.slug === "bloodsworn");
    expect(bloodsworn).toBeDefined();

    const build: CharacterBuild = {
      ...baseBuild(),
      classId: rules.classes.find((c) => c.slug === "wizard")!.id,
      themeId: bloodsworn!.id
    };

    expect(themeGrantedPowerNames(rules, build)).toContain("Bloodied Determination");
  });
});
