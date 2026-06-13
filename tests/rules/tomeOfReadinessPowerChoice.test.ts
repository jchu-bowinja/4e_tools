import { describe, expect, it } from "vitest";
import index from "../../generated/rules_index.json";
import {
  classFeaturePowerIdsForClass,
  filterVisibleClassFeatureChoiceGroups,
  getClassFeatureChoiceGroups
} from "../../src/rules/classFeatureChoices";
import { parsePowerSelectCategory, resolvePowerIdsFromCategory } from "../../src/rules/powerSelectCategory";
import type { RulesIndex } from "../../src/rules/models";

const rules = index as RulesIndex;

describe("Tome of Readiness encounter power pick", () => {
  it("parses $$LEVEL class encounter pool category", () => {
    const parsed = parsePowerSelectCategory("$$LEVEL,ID_FMP_CLASS_9,encounter");
    expect(parsed.kind).toBe("levelScopedClassPowerPool");
  });

  it("exposes nested power group with encounter pool when Tome of Readiness is selected", () => {
    const wizard = rules.classes.find((c) => c.slug === "wizard");
    expect(wizard).toBeDefined();

    const groups = getClassFeatureChoiceGroups(rules, wizard);
    const visible = filterVisibleClassFeatureChoiceGroups(groups, {
      "classFeature:ID_FMP_CLASS_FEATURE_444": "ID_FMP_CLASS_FEATURE_1511"
    }, 1);
    const nested = visible.find((g) => g.key === "classPower:ID_FMP_CLASS_FEATURE_1511");
    expect(nested).toBeDefined();

    const resolved = resolvePowerIdsFromCategory(
      "$$LEVEL,ID_FMP_CLASS_9,encounter",
      rules,
      { classId: wizard!.id }
    );
    expect(resolved).not.toEqual([]);
    if (resolved !== "dynamic") {
      expect(resolved.length).toBeGreaterThan(0);
    }

    const legal = classFeaturePowerIdsForClass(rules, nested!, wizard!.id, 1);
    expect(legal.length).toBeGreaterThan(10);
    const names = legal.map((id) => rules.powers.find((p) => p.id === id)?.name).filter(Boolean);
    expect(names).toContain("Burning Hands");
  });
});
