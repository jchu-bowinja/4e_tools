import { describe, expect, it } from "vitest";
import index from "../../generated/rules_index.json";
import {
  applyClassFeaturePowerIdReplacements,
  applyClassFeaturePowerReplacementsToSlots,
  collectClassFeaturePowerReplacementMap,
  classFeaturePowerSwapChoiceGroups
} from "../../src/rules/classFeaturePowerReplace";
import type { CharacterBuild, RulesIndex } from "../../src/rules/models";

const rules = index as RulesIndex;

describe("class feature power replace", () => {
  it("indexes Star Pact level 13 automatic upgrade rule", () => {
    const feature = rules.classFeatures?.find((f) => f.id === "ID_FMP_CLASS_FEATURE_3708");
    expect(feature?.powerReplacementRules).toEqual([
      {
        replacementPowerId: "ID_FMP_POWER_13918",
        originalPowerId: "ID_FMP_POWER_13914"
      }
    ]);
  });

  it("indexes Warpriest level 15 daily swap options", () => {
    const warpriest = rules.classes.find((c) => c.slug === "warpriest");
    expect(warpriest).toBeDefined();
    const groups = classFeaturePowerSwapChoiceGroups(rules, warpriest!.id);
    const lvl15 = groups.find((g) => g.parentFeatureName === "Level 15 Warpriest Daily Power");
    expect(lvl15).toBeDefined();
    expect(lvl15!.powerIds.length).toBeGreaterThanOrEqual(3);
    expect(lvl15!.minLevel).toBe(15);
  });

  it("applies id:id replacement helper", () => {
    expect(
      applyClassFeaturePowerIdReplacements(
        ["ID_FMP_POWER_13914"],
        new Map([["ID_FMP_POWER_13914", "ID_FMP_POWER_13918"]])
      )
    ).toEqual(["ID_FMP_POWER_13918"]);
  });

  it("collects replacement map when upgrade feature is directly active", () => {
    const build: CharacterBuild = {
      name: "test",
      level: 13,
      classId: rules.classes.find((c) => c.slug === "warlock")!.id,
      abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 16 },
      featIds: [],
      powerIds: ["ID_FMP_POWER_13914"],
      trainedSkillIds: [],
      classSelections: {}
    };

    const miniIndex = {
      ...rules,
      classFeatures: [
        ...(rules.classFeatures ?? []),
        {
          id: "ID_TEST_STAR_UPGRADE",
          name: "Test Star Upgrade",
          slug: "test",
          raw: {
            specific: { Level: "13" },
            rules: {
              replace: [{ attrs: { "power-replace": "ID_FMP_POWER_13918:ID_FMP_POWER_13914" } }]
            }
          },
          powerReplacementRules: [
            { replacementPowerId: "ID_FMP_POWER_13918", originalPowerId: "ID_FMP_POWER_13914" }
          ]
        }
      ],
      grantedClassFeatureNamesBySupportId: {
        ...rules.grantedClassFeatureNamesBySupportId,
        [build.classId!]: ["Test Star Upgrade"]
      }
    } as RulesIndex;

    const map = collectClassFeaturePowerReplacementMap(miniIndex, build);
    expect(map.get("ID_FMP_POWER_13914")).toBe("ID_FMP_POWER_13918");
  });

  it("rewrites class power slots when a replacement applies", () => {
    const slots = applyClassFeaturePowerReplacementsToSlots(
      { "encounter:1": "ID_FMP_POWER_13914" },
      new Map([["ID_FMP_POWER_13914", "ID_FMP_POWER_13918"]])
    );
    expect(slots?.["encounter:1"]).toBe("ID_FMP_POWER_13918");
  });

  it("activates Star Pact L13 upgrade through trait package chain", () => {
    const binder = rules.classes.find((c) => c.slug === "binder");
    expect(binder).toBeDefined();
    expect(rules.traitPackageIdByClassFeatureId?.["ID_FMP_CLASS_FEATURE_3699"]).toBe(
      "ID_FMP_TRAIT_PACKAGE_824"
    );

    const build: CharacterBuild = {
      name: "Star Binder",
      level: 13,
      classId: binder!.id,
      abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 16 },
      featIds: [],
      powerIds: ["ID_FMP_POWER_13914"],
      trainedSkillIds: [],
      classSelections: {
        "classFeature:ID_FMP_CLASS_FEATURE_3652": "ID_FMP_CLASS_FEATURE_3699"
      },
      classPowerSlots: { "encounter:1": "ID_FMP_POWER_13914" }
    };

    const map = collectClassFeaturePowerReplacementMap(rules, build);
    expect(map.get("ID_FMP_POWER_13914")).toBe("ID_FMP_POWER_13918");
  });

  it("offers DMG2 defender encounter swap pool for fighter", () => {
    const fighter = rules.classes.find((c) => c.slug === "fighter");
    expect(fighter).toBeDefined();
    const groups = classFeaturePowerSwapChoiceGroups(rules, fighter!.id);
    const defender = groups.find((g) => g.parentFeatureName === "Level 03 Defender Encounter Power");
    expect(defender).toBeDefined();
    expect(defender!.minLevel).toBe(3);
    expect(defender!.powerIds.length).toBeGreaterThan(3);
  });
});
