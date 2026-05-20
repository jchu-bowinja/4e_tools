import { describe, expect, it } from "vitest";
import type { ClassDef, RulesIndex } from "../../src/rules/models";
import {
  filterVisibleClassFeatureChoiceGroups,
  formatClassPowerChoiceSelection,
  getClassFeatureChoiceGroups,
  isClassFeatureChoiceGroupVisible,
  parseClassPowerChoiceSelection,
  pruneHiddenClassFeatureSelections
} from "../../src/rules/classFeatureChoices";

const rogueClass: ClassDef = {
  id: "ID_FMP_CLASS_6",
  name: "Rogue",
  slug: "rogue",
  raw: {}
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
  classFeatures: [],
  classFeatureChoiceGroupsByClassId: {
    ID_FMP_CLASS_6: [
      {
        key: "classFeature:parent",
        kind: "classFeature",
        parentFeatureId: "parent",
        parentFeatureName: "Rogue Tactics",
        pickCount: 1,
        options: [
          {
            id: "opt_a",
            name: "Artful Dodger",
            parentFeatureId: "parent",
            parentFeatureName: "Rogue Tactics"
          }
        ]
      },
      {
        key: "classPower:cantrips",
        kind: "power",
        parentFeatureId: "cantrips",
        parentFeatureName: "Arcanist Cantrips",
        pickCount: 2,
        powerIds: ["P1", "P2", "P3"]
      }
    ]
  }
};

describe("classFeatureChoices", () => {
  it("loads choice groups from index", () => {
    const groups = getClassFeatureChoiceGroups(index, rogueClass);
    expect(groups).toHaveLength(2);
    expect(groups[0]?.parentFeatureName).toBe("Rogue Tactics");
  });

  it("round-trips cantrip power selections", () => {
    const raw = formatClassPowerChoiceSelection(["P1", "P2"]);
    expect(parseClassPowerChoiceSelection(raw)).toEqual(["P1", "P2"]);
  });

  it("hides and prunes dependent groups when parent pick changes", () => {
    const pairKey = "classFeaturePair:weapon:sharp";
    const sharpKey = "classFeature:sharp";
    const groups = getClassFeatureChoiceGroups({
      ...index,
      classFeatureChoiceGroupsByClassId: {
        ID_FMP_CLASS_6: [
          {
            key: pairKey,
            kind: "classFeature",
            parentFeatureId: "",
            parentFeatureName: "Class feature",
            pickCount: 1,
            options: [
              { id: "weapon", name: "Rogue Weapon Talent", parentFeatureId: "", parentFeatureName: "Class feature" },
              { id: "sharp", name: "Sharpshooter Talent", parentFeatureId: "", parentFeatureName: "Class feature" }
            ]
          },
          {
            key: sharpKey,
            kind: "classFeature",
            parentFeatureId: "sharp",
            parentFeatureName: "Sharpshooter Talent",
            pickCount: 1,
            visibleWhen: { groupKey: pairKey, optionId: "sharp" },
            options: [
              { id: "crossbow", name: "Crossbow", parentFeatureId: "sharp", parentFeatureName: "Sharpshooter Talent" }
            ]
          }
        ]
      }
    }, rogueClass);
    const sharpGroup = groups.find((g) => g.key === sharpKey)!;
    expect(isClassFeatureChoiceGroupVisible(sharpGroup, { [pairKey]: "weapon" })).toBe(false);
    expect(isClassFeatureChoiceGroupVisible(sharpGroup, { [pairKey]: "sharp" })).toBe(true);
    expect(
      filterVisibleClassFeatureChoiceGroups(groups, { [pairKey]: "weapon" }).map((g) => g.key)
    ).toEqual([pairKey]);
    const pruned = pruneHiddenClassFeatureSelections(
      { [pairKey]: "weapon", [sharpKey]: "crossbow" },
      groups
    );
    expect(pruned).toEqual({ [pairKey]: "weapon" });
  });
});
