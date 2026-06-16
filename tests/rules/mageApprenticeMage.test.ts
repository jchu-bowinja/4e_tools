import { describe, expect, it } from "vitest";
import index from "../../generated/rules_index.json";
import {
  filterSchoolProgressionChoiceOptions,
  getClassFeatureChoiceGroups,
  syncAutoResolvedSchoolProgressionSelections
} from "../../src/rules/classFeatureChoices";
import type { RulesIndex } from "../../src/rules/models";

const rules = index as RulesIndex;
const mage = rules.classes.find((c) => c.slug === "mage")!;

const MAGE_APPRENTICE_L1_CHOICE_KEY = "classFeature:ID_FMP_CLASS_FEATURE_2867";
const MAGE_APPRENTICE_L4_CHOICE_KEY = "classFeature:ID_FMP_CLASS_FEATURE_3043:4";
const MAGE_EXPERT_L5_CHOICE_KEY = "classFeature:ID_FMP_CLASS_FEATURE_2871:5";
const MAGE_EXPERT_L8_CHOICE_KEY = "classFeature:ID_FMP_CLASS_FEATURE_3050:8";
const MAGE_MASTER_CHOICE_KEY = "classFeature:ID_FMP_CLASS_FEATURE_2872:10";

describe("mage Apprentice Mage choices", () => {
  it("class feature choice groups are ordered by minLevel", () => {
    const groups = getClassFeatureChoiceGroups(rules, mage).filter((g) => g.kind === "classFeature");
    const levels = groups.map((g) => g.minLevel ?? 1);
    expect(levels).toEqual([...levels].sort((a, b) => a - b));
  });

  it("level 4 apprentice mage lists schools like level 1", () => {
    const groups = rules.classFeatureChoiceGroupsByClassId?.[mage.id] ?? [];
    const l1 = groups.find((g) => g.key === "classFeature:ID_FMP_CLASS_FEATURE_2867");
    const l4 = groups.find((g) => g.parentFeatureName === "Level 4 Apprentice Mage");
    expect(l1?.options?.length).toBeGreaterThanOrEqual(4);
    const l1Schools = (l1?.options ?? []).map((o) => o.name).sort();
    const l4Names = (l4?.options ?? []).map((o) => o.name);
    expect(l4Names).not.toContain("Level 1 Apprentice Mage");
    for (const name of l1Schools) {
      expect(l4Names).toContain(name);
    }
    expect(l4Names).not.toContain("Renegade Red Wizard Apprentice");
    expect(l4?.pickCount).toBe(1);
  });

  it("level 5 expert mage only offers experts for chosen apprentice schools", () => {
    const groups = getClassFeatureChoiceGroups(rules, mage);
    const l5 = groups.find((g) => g.key === MAGE_EXPERT_L5_CHOICE_KEY)!;
    const selections = {
      [MAGE_APPRENTICE_L1_CHOICE_KEY]: "ID_FMP_CLASS_FEATURE_2878",
      [MAGE_APPRENTICE_L4_CHOICE_KEY]: "ID_FMP_CLASS_FEATURE_3217"
    };
    const names = filterSchoolProgressionChoiceOptions(rules, l5, selections).map((o) => o.name);
    expect(names).toEqual(["Enchantment Expert", "Pyromancy Expert"]);
  });

  it("level 8 expert mage only offers the second apprentice school", () => {
    const groups = getClassFeatureChoiceGroups(rules, mage);
    const l8 = groups.find((g) => g.key === MAGE_EXPERT_L8_CHOICE_KEY)!;
    const selections = {
      [MAGE_APPRENTICE_L1_CHOICE_KEY]: "ID_FMP_CLASS_FEATURE_2878",
      [MAGE_APPRENTICE_L4_CHOICE_KEY]: "ID_FMP_CLASS_FEATURE_3217",
      [MAGE_EXPERT_L5_CHOICE_KEY]: "ID_FMP_CLASS_FEATURE_2807"
    };
    const names = filterSchoolProgressionChoiceOptions(rules, l8, selections).map((o) => o.name);
    expect(names).toEqual(["Pyromancy Expert"]);
  });

  it("level 8 expert mage auto-selects the second school at level 8+", () => {
    const groups = getClassFeatureChoiceGroups(rules, mage);
    const selections = {
      [MAGE_APPRENTICE_L1_CHOICE_KEY]: "ID_FMP_CLASS_FEATURE_2878",
      [MAGE_APPRENTICE_L4_CHOICE_KEY]: "ID_FMP_CLASS_FEATURE_3217",
      [MAGE_EXPERT_L5_CHOICE_KEY]: "ID_FMP_CLASS_FEATURE_2807"
    };
    const synced = syncAutoResolvedSchoolProgressionSelections(rules, selections, groups, 8);
    expect(synced[MAGE_EXPERT_L8_CHOICE_KEY]).toBe("ID_FMP_CLASS_FEATURE_3218");
  });

  it("master mage only offers masters for chosen expert schools", () => {
    const groups = getClassFeatureChoiceGroups(rules, mage);
    const master = groups.find((g) => g.key === MAGE_MASTER_CHOICE_KEY)!;
    const selections = {
      [MAGE_EXPERT_L5_CHOICE_KEY]: "ID_FMP_CLASS_FEATURE_2807",
      [MAGE_EXPERT_L8_CHOICE_KEY]: "ID_FMP_CLASS_FEATURE_3218"
    };
    const names = filterSchoolProgressionChoiceOptions(rules, master, selections).map((o) => o.name);
    expect(names).toEqual(["Enchantment Master", "Pyromancy Master"]);
  });
});
