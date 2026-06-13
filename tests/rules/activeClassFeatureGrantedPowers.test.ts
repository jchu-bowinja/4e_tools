import { describe, expect, it } from "vitest";
import index from "../../generated/rules_index.json";
import type { CharacterBuild, ClassFeature, RulesIndex } from "../../src/rules/models";
import {
  collectGrantedPowerIdsFromActiveClassFeatures,
  grantedPowerIdsFromClassFeatureGrants,
  powerSelectableIdsFromClassFeature
} from "../../src/rules/grantedPowersQuery";
import { collectCharacterPowerIdsForSelections } from "../../src/rules/powerSelections";

const rules = index as RulesIndex;

const baseBuild = (): CharacterBuild => ({
  name: "test",
  level: 1,
  abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 16 },
  featIds: [],
  powerIds: [],
  trainedSkillIds: []
});

describe("active class feature granted powers", () => {
  it("excludes grant ids that also appear on the same feature Power select list", () => {
    const feature: ClassFeature = {
      id: "cf_pick",
      name: "Pick One",
      slug: "pick-one",
      raw: {
        rules: {
          select: [
            {
              attrs: {
                type: "Power",
                Category: "ID_FMP_POWER_A|ID_FMP_POWER_B"
              }
            }
          ],
          grant: [
            { attrs: { type: "Power", name: "ID_FMP_POWER_A" } },
            { attrs: { type: "Power", name: "ID_FMP_POWER_FIXED" } }
          ]
        }
      }
    };
    expect(powerSelectableIdsFromClassFeature(feature)).toEqual(
      new Set(["ID_FMP_POWER_A", "ID_FMP_POWER_B"])
    );
    expect(grantedPowerIdsFromClassFeatureGrants(feature, ["ID_FMP_CLASS_7"])).toEqual([
      "ID_FMP_POWER_FIXED"
    ]);
  });

  it("grants non-selectable power ids from rules.grant", () => {
    const feature: ClassFeature = {
      id: "cf_fey",
      name: "Fey Pact",
      slug: "fey-pact",
      raw: {
        rules: {
          grant: [
            { attrs: { type: "Power", name: "ID_FMP_POWER_1456" } },
            { attrs: { type: "Power", name: "ID_FMP_POWER_2094" } }
          ]
        }
      }
    };
    expect(grantedPowerIdsFromClassFeatureGrants(feature, ["ID_FMP_CLASS_7"])).toEqual([
      "ID_FMP_POWER_1456",
      "ID_FMP_POWER_2094"
    ]);
  });

  it("grants Fey Pact boon powers when Eldritch Pact picks Fey Pact (warlock)", () => {
    const warlock = rules.classes.find((c) => c.slug === "warlock");
    expect(warlock).toBeDefined();

    const build: CharacterBuild = {
      ...baseBuild(),
      classId: warlock!.id,
      classSelections: {
        "classFeature:ID_FMP_CLASS_FEATURE_777": "ID_FMP_CLASS_FEATURE_772"
      }
    };

    const granted = collectGrantedPowerIdsFromActiveClassFeatures(rules, build);
    expect(granted).toContain("ID_FMP_POWER_1456");
    expect(granted).toContain("ID_FMP_POWER_2094");

    const allPowerIds = collectCharacterPowerIdsForSelections(rules, build);
    expect(allPowerIds.has("ID_FMP_POWER_1456")).toBe(true);
    expect(allPowerIds.has("ID_FMP_POWER_2094")).toBe(true);
  });

  it("grants default Infernal Pact boon but not variant-only picks from the select list", () => {
    const warlock = rules.classes.find((c) => c.slug === "warlock");
    expect(warlock).toBeDefined();

    const build: CharacterBuild = {
      ...baseBuild(),
      classId: warlock!.id,
      classSelections: {
        "classFeature:ID_FMP_CLASS_FEATURE_777": "ID_FMP_CLASS_FEATURE_773"
      }
    };

    const granted = collectGrantedPowerIdsFromActiveClassFeatures(rules, build);
    expect(granted).toContain("ID_FMP_POWER_2095");
    expect(granted).not.toContain("ID_FMP_POWER_1458");
    expect(granted).not.toContain("ID_FMP_POWER_12307");
  });

  it("does not treat theme feature grants as class grants (Bloodsworn + wizard)", () => {
    const wizard = rules.classes.find((c) => c.slug === "wizard");
    const bloodsworn = rules.themes?.find((t) => t.slug === "bloodsworn");
    expect(wizard).toBeDefined();
    expect(bloodsworn).toBeDefined();

    const build: CharacterBuild = {
      ...baseBuild(),
      classId: wizard!.id,
      themeId: bloodsworn!.id
    };

    const classGranted = collectGrantedPowerIdsFromActiveClassFeatures(rules, build);
    expect(classGranted).not.toContain("ID_FMP_POWER_16429");
  });

  it("grants Aegis of Shielding power when selected (swordmage)", () => {
    const swordmage = rules.classes.find((c) => c.slug === "swordmage");
    expect(swordmage).toBeDefined();

    const build: CharacterBuild = {
      ...baseBuild(),
      classId: swordmage!.id,
      classSelections: {
        "classFeature:ID_FMP_CLASS_FEATURE_518": "ID_FMP_CLASS_FEATURE_886"
      }
    };

    const granted = collectGrantedPowerIdsFromActiveClassFeatures(rules, build);
    expect(granted).toContain("ID_FMP_POWER_3323");
    expect(collectCharacterPowerIdsForSelections(rules, build).has("ID_FMP_POWER_3323")).toBe(true);
  });
});
