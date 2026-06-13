import { describe, expect, it } from "vitest";
import index from "../../generated/rules_index.json";
import {
  collectClassFeaturePowerChoiceIds,
  filterVisibleClassFeatureChoiceGroups,
  getClassFeatureChoiceGroups
} from "../../src/rules/classFeatureChoices";
import {
  collectGrantedPowerIdsFromActiveClassFeatures,
  grantedPowerIdsFromActiveClassFeature
} from "../../src/rules/grantedPowersQuery";
import type { CharacterBuild, ClassFeature, RulesIndex } from "../../src/rules/models";

const rules = index as RulesIndex;

const baseBuild = (): CharacterBuild => ({
  name: "test",
  level: 1,
  abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 16 },
  featIds: [],
  powerIds: [],
  trainedSkillIds: []
});

describe("nested class feature power choices", () => {
  it("adds Hellish Rebuke variant pick under Infernal Pact (warlock)", () => {
    const warlock = rules.classes.find((c) => c.slug === "warlock");
    expect(warlock).toBeDefined();

    const groups = getClassFeatureChoiceGroups(rules, warlock);
    const nested = groups.find((g) => g.key === "classPower:ID_FMP_CLASS_FEATURE_773");
    expect(nested).toBeDefined();
    expect(nested?.kind).toBe("power");
    expect(nested?.parentFeatureName).toBe("Infernal Pact");
    expect(nested?.visibleWhen).toEqual({
      groupKey: "classFeature:ID_FMP_CLASS_FEATURE_777",
      optionId: "ID_FMP_CLASS_FEATURE_773"
    });
    expect(nested?.powerIds).toEqual(
      expect.arrayContaining(["ID_FMP_POWER_1458", "ID_FMP_POWER_12307"])
    );
  });

  it("shows nested pick only when Infernal Pact is selected", () => {
    const warlock = rules.classes.find((c) => c.slug === "warlock");
    const groups = getClassFeatureChoiceGroups(rules, warlock);
    const hidden = filterVisibleClassFeatureChoiceGroups(groups, {
      "classFeature:ID_FMP_CLASS_FEATURE_777": "ID_FMP_CLASS_FEATURE_772"
    });
    expect(hidden.some((g) => g.key === "classPower:ID_FMP_CLASS_FEATURE_773")).toBe(false);

    const visible = filterVisibleClassFeatureChoiceGroups(groups, {
      "classFeature:ID_FMP_CLASS_FEATURE_777": "ID_FMP_CLASS_FEATURE_773"
    });
    expect(visible.some((g) => g.key === "classPower:ID_FMP_CLASS_FEATURE_773")).toBe(true);
  });

  it("grants default boon until variant is picked, then uses the variant", () => {
    const warlock = rules.classes.find((c) => c.slug === "warlock");
    const infernal = rules.classFeatures?.find((f) => f.id === "ID_FMP_CLASS_FEATURE_773");
    expect(infernal).toBeDefined();

    const defaultOnly = grantedPowerIdsFromActiveClassFeature(infernal!, [warlock!.id], {
      "classFeature:ID_FMP_CLASS_FEATURE_777": "ID_FMP_CLASS_FEATURE_773"
    });
    expect(defaultOnly).toContain("ID_FMP_POWER_2095");

    const withVariant = grantedPowerIdsFromActiveClassFeature(infernal!, [warlock!.id], {
      "classFeature:ID_FMP_CLASS_FEATURE_777": "ID_FMP_CLASS_FEATURE_773",
      "classPower:ID_FMP_CLASS_FEATURE_773": "ID_FMP_POWER_1458"
    });
    expect(withVariant).toEqual(["ID_FMP_POWER_1458"]);
    expect(withVariant).not.toContain("ID_FMP_POWER_2095");
  });

  it("includes variant in character power ids when picked", () => {
    const warlock = rules.classes.find((c) => c.slug === "warlock");
    const build: CharacterBuild = {
      ...baseBuild(),
      classId: warlock!.id,
      classSelections: {
        "classFeature:ID_FMP_CLASS_FEATURE_777": "ID_FMP_CLASS_FEATURE_773",
        "classPower:ID_FMP_CLASS_FEATURE_773": "ID_FMP_POWER_12307"
      }
    };

    const granted = collectGrantedPowerIdsFromActiveClassFeatures(rules, build);
    expect(granted).toContain("ID_FMP_POWER_12307");
    expect(granted).not.toContain("ID_FMP_POWER_2095");

    const picks = collectClassFeaturePowerChoiceIds(rules, build);
    expect(picks).toContain("ID_FMP_POWER_12307");
  });
});
