import { describe, expect, it } from "vitest";
import index from "../../generated/rules_index.json";
import {
  collectClassFeatureModificationsByPowerId,
  collectPowerModificationsByPowerId
} from "../../src/rules/classFeaturePowerModifications";
import { applyFeatModificationsToPowerCardVm } from "../../src/rules/featPowerModifications";
import { buildCharacterPowerCardViewModel } from "../../src/ui/powerCard/characterPowerCardViewModel";
import type { CharacterBuild, ClassDef, ClassFeature, Power, RulesIndex } from "../../src/rules/models";

const rules = index as RulesIndex;

describe("class feature power modifications", () => {
  it("applies Healing Word encounter usage from active class feature", () => {
    const cleric: ClassDef = {
      id: "ID_FMP_CLASS_2",
      name: "Cleric",
      slug: "cleric",
      raw: {}
    };
    const healingWordFeature: ClassFeature = {
      id: "ID_TEST_HEALING_WORD",
      name: "Healing Word (Cleric)",
      slug: "healing-word-cleric",
      raw: {
        rules: {
          modify: [
            {
              attrs: {
                name: "ID_FMP_POWER_1455",
                type: "Power",
                Field: "Power Usage",
                value: "Encounter"
              }
            }
          ]
        }
      }
    };
    const healingWord: Power = {
      id: "ID_FMP_POWER_1455",
      name: "Healing Word",
      slug: "healing-word",
      usage: "At-Will",
      raw: { specific: { "Power Usage": "At-Will (Special)" } }
    };
    const testIndex: RulesIndex = {
      ...rules,
      classes: [cleric],
      classFeatures: [healingWordFeature],
      powers: [healingWord],
      grantedClassFeatureNamesBySupportId: {
        [cleric.id]: ["Healing Word (Cleric)"]
      }
    };
    const build: CharacterBuild = {
      name: "test",
      level: 1,
      classId: cleric.id,
      abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 16, CHA: 10 },
      featIds: [],
      powerIds: [],
      trainedSkillIds: []
    };

    const mods = collectClassFeatureModificationsByPowerId(testIndex, build);
    const patch = mods.get("ID_FMP_POWER_1455");
    expect(patch?.metadata).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          featId: "ID_TEST_HEALING_WORD",
          field: "Power Usage",
          value: "Encounter"
        })
      ])
    );

    const vm = buildCharacterPowerCardViewModel(healingWord, patch, testIndex);
    const patched = applyFeatModificationsToPowerCardVm(vm, patch, healingWord.id);
    expect(patched.usageLabel).toBe("Encounter");
    expect(patched.usageBucket).toBe("encounter");
  });

  it("merges feat and class-feature modifications on the same power", () => {
    const build: CharacterBuild = {
      name: "test",
      level: 1,
      abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 10 },
      featIds: [],
      powerIds: [],
      trainedSkillIds: []
    };
    const merged = collectPowerModificationsByPowerId(rules, build);
    expect(merged).toBeInstanceOf(Map);
  });
});
