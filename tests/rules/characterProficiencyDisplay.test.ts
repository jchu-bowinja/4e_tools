import { describe, expect, it } from "vitest";
import { CLASS_FEATURE_CHOICE_NONE } from "../../src/rules/classFeatureChoices";
import { ARCHER_WARLORD_CLASS_FEATURE_ID } from "../../src/rules/classFeatureProficiencies";
import {
  computeCharacterProficiencyDisplayLines,
  computeClassGrantedProficiencyDisplayLines,
  effectiveArmorProficiencyDisplayText
} from "../../src/rules/characterProficiencyDisplay";
import { appendFeatProficiencyPhrasesToArmorLine } from "../../src/rules/featProficiencies";
import type { CharacterBuild, ClassDef, ClassFeature, ProficiencyGrant, RulesIndex } from "../../src/rules/models";

describe("characterProficiencyDisplay", () => {
  const build = { featIds: [], classSelections: {} } as CharacterBuild;
  const emptyIndex = { classFeatures: [] } as unknown as RulesIndex;

  it("returns class-only weapon line without feat grants", () => {
    const lines = computeClassGrantedProficiencyDisplayLines(
      emptyIndex,
      { isHybrid: false, classSpecific: { "Weapon Proficiencies": "Simple melee, military ranged" } },
      build
    );
    expect(lines.weaponLine).toBe("Simple melee, military ranged");
    expect(lines.armorLine).toBe("");
  });

  it("appends military ranged from Archer Warlord class-feature grant", () => {
    const warlordClass: ClassDef = {
      id: "ID_FMP_CLASS_8",
      name: "Warlord",
      slug: "warlord",
      raw: {
        specific: {
          "Armor Proficiencies": "Cloth, leather, hide, chainmail; light shields",
          "Weapon Proficiencies": "Simple melee, military melee, simple ranged",
          _PARSED_CLASS_FEATURE:
            "Archer Warlord, Battlefront Leader, Canny Leader, Combat Leader, Commanding Presence, Inspiring Word"
        }
      }
    };
    const archerWarlord: ClassFeature = {
      id: ARCHER_WARLORD_CLASS_FEATURE_ID,
      name: "Archer Warlord",
      slug: "archer-warlord",
      mechanicalEffects: [
        { type: "removeArmorProficiencyPhrases", phrases: ["chainmail", "light shields"] },
        { type: "weaponKeyAbility", weaponGroup: "bow", ability: "STR" }
      ],
      raw: {
        rules: {
          grant: [{ attrs: { name: "ID_INTERNAL_PROFICIENCY_MILITARY_RANGED", type: "Proficiency" } }]
        }
      }
    };
    const index = {
      classes: [warlordClass],
      classFeatures: [archerWarlord],
      grantedClassFeatureNamesBySupportId: { ID_FMP_CLASS_8: ["Commanding Presence", "Inspiring Word"] },
      classFeatureChoiceGroupsByClassId: {
        ID_FMP_CLASS_8: [
          {
            key: `classFeatureOptional:${ARCHER_WARLORD_CLASS_FEATURE_ID}`,
            kind: "classFeature",
            parentFeatureId: ARCHER_WARLORD_CLASS_FEATURE_ID,
            parentFeatureName: "Archer Warlord",
            pickCount: 1,
            optional: true,
            options: [
              {
                id: CLASS_FEATURE_CHOICE_NONE,
                name: "Standard (default class proficiencies)",
                parentFeatureId: ARCHER_WARLORD_CLASS_FEATURE_ID,
                parentFeatureName: "Archer Warlord"
              },
              {
                id: ARCHER_WARLORD_CLASS_FEATURE_ID,
                name: "Archer Warlord",
                parentFeatureId: ARCHER_WARLORD_CLASS_FEATURE_ID,
                parentFeatureName: "Archer Warlord"
              }
            ]
          }
        ]
      }
    } as unknown as RulesIndex;
    const archerBuild: CharacterBuild = {
      name: "Test",
      level: 1,
      raceId: "race",
      classId: "ID_FMP_CLASS_8",
      abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 10 },
      trainedSkillIds: [],
      featIds: [],
      powerIds: [],
      classSelections: {
        [`classFeatureOptional:${ARCHER_WARLORD_CLASS_FEATURE_ID}`]: ARCHER_WARLORD_CLASS_FEATURE_ID
      }
    };
    const lines = computeClassGrantedProficiencyDisplayLines(
      index,
      {
        isHybrid: false,
        classSpecific: warlordClass.raw.specific as Record<string, unknown>
      },
      archerBuild
    );
    expect(lines.weaponLine).toMatch(/military ranged/i);
    expect(lines.armorLine).not.toMatch(/chainmail/i);
    expect(lines.armorLine).not.toMatch(/light shield/i);
  });

  it("merges class weapon line with feat weapon grants", () => {
    const grants: ProficiencyGrant[] = [{ kind: "weaponGroup", value: "axe", label: "Axe" }];
    const lines = computeCharacterProficiencyDisplayLines(
      { isHybrid: false, classSpecific: { "Weapon Proficiencies": "Simple melee" } },
      build,
      grants
    );
    expect(lines.weaponLine).toBe("Simple melee, axe");
  });

  it("applies Archer Warlord armor adjustment before feat armor grants", () => {
    const archerBuild = {
      featIds: [],
      classSelections: { warlord: "ID_FMP_CLASS_FEATURE_2286" }
    } as CharacterBuild;
    const grants: ProficiencyGrant[] = [{ kind: "armor", value: "plate", label: "Plate" }];
    const line = effectiveArmorProficiencyDisplayText(
      "Cloth, leather, hide, chainmail; light shields",
      archerBuild,
      grants
    );
    expect(line).not.toMatch(/chainmail/i);
    expect(line).not.toMatch(/light shield/i);
    expect(line).toMatch(/plate/i);
  });

  it("appends shield grants with shields suffix", () => {
    expect(
      appendFeatProficiencyPhrasesToArmorLine("Cloth, leather", [
        { kind: "shield", value: "heavy", label: "Heavy" }
      ])
    ).toBe("Cloth, leather, Heavy shields");
  });
});
