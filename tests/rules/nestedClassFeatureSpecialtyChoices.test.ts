import { describe, expect, it } from "vitest";
import index from "../../generated/rules_index.json";
import {
  filterVisibleClassFeatureChoiceGroups,
  getClassFeatureChoiceGroups
} from "../../src/rules/classFeatureChoices";
import { collectClassFeatureIdsFromClass } from "../../src/rules/characterClassFeatures";
import {
  collectGrantedPowerIdsFromActiveClassFeatures
} from "../../src/rules/grantedPowersQuery";
import type { CharacterBuild, RulesIndex } from "../../src/rules/models";

const rules = index as RulesIndex;

const baseBuild = (): CharacterBuild => ({
  name: "test",
  level: 1,
  abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 16 },
  featIds: [],
  powerIds: [],
  trainedSkillIds: []
});

describe("nested class feature specialty choices (Elementalist)", () => {
  it("adds Elemental Specialty pick under Air Elementalist", () => {
    const elementalist = rules.classes.find((c) => c.slug === "elementalist");
    expect(elementalist).toBeDefined();

    const groups = getClassFeatureChoiceGroups(rules, elementalist);
    const nested = groups.find((g) => g.key === "classFeature:ID_FMP_CLASS_FEATURE_4336");
    expect(nested).toBeDefined();
    expect(nested?.kind).toBe("classFeature");
    expect(nested?.parentFeatureName).toBe("Elemental Specialty");
    expect(nested?.visibleWhen).toEqual({
      groupKey: "classFeature:ID_FMP_CLASS_FEATURE_4335",
      optionId: "ID_FMP_CLASS_FEATURE_4336"
    });
    expect(nested?.options.map((o) => o.name)).toEqual(
      expect.arrayContaining(["Howling Zephyr", "Static Charge"])
    );
  });

  it("shows specialty pick only when Air Elementalist is selected", () => {
    const elementalist = rules.classes.find((c) => c.slug === "elementalist");
    const groups = getClassFeatureChoiceGroups(rules, elementalist!);

    const hidden = filterVisibleClassFeatureChoiceGroups(groups, {
      "classFeature:ID_FMP_CLASS_FEATURE_4335": "ID_FMP_CLASS_FEATURE_4337"
    });
    expect(hidden.some((g) => g.key === "classFeature:ID_FMP_CLASS_FEATURE_4336")).toBe(false);

    const visible = filterVisibleClassFeatureChoiceGroups(groups, {
      "classFeature:ID_FMP_CLASS_FEATURE_4335": "ID_FMP_CLASS_FEATURE_4336",
      "classFeature:ID_FMP_CLASS_FEATURE_4336": "ID_INTERNAL_CLASS_FEATURE_HOWLING_ZEPHYR"
    });
    expect(visible.some((g) => g.key === "classFeature:ID_FMP_CLASS_FEATURE_4336")).toBe(true);
  });

  it("grants Howling Zephyr at-will when specialty is picked", () => {
    const elementalist = rules.classes.find((c) => c.slug === "elementalist");
    const build: CharacterBuild = {
      ...baseBuild(),
      classId: elementalist!.id,
      classSelections: {
        "classFeature:ID_FMP_CLASS_FEATURE_4335": "ID_FMP_CLASS_FEATURE_4336",
        "classFeature:ID_FMP_CLASS_FEATURE_4336": "ID_INTERNAL_CLASS_FEATURE_HOWLING_ZEPHYR"
      }
    };

    const active = collectClassFeatureIdsFromClass(rules, build);
    expect(active).toContain("ID_INTERNAL_CLASS_FEATURE_HOWLING_ZEPHYR");

    const granted = collectGrantedPowerIdsFromActiveClassFeatures(rules, build);
    expect(granted).toContain("ID_FMP_POWER_16231");
  });
});
