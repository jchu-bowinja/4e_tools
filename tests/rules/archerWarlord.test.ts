import { describe, expect, it } from "vitest";
import { CLASS_FEATURE_CHOICE_NONE, getClassFeatureChoiceGroups } from "../../src/rules/classFeatureChoices";
import { collectClassFeatureIdsFromClass } from "../../src/rules/characterClassFeatures";
import {
  ARCHER_WARLORD_CLASS_FEATURE_ID,
  effectiveClassArmorProficienciesText,
  hasArcherWarlordSelection,
  proficiencyGrantsFromClassFeatureRaw,
  weaponAttackAbilityForCharacter
} from "../../src/rules/classFeatureProficiencies";
import { collectCharacterProficiencyGrants } from "../../src/rules/featProficiencies";
import type { CharacterBuild, ClassDef, ClassFeature, RulesIndex, Weapon } from "../../src/rules/models";
import { getClassTraitRows } from "../../src/rules/supportTraits";

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
  raw: {
    rules: {
      grant: [{ attrs: { name: "ID_INTERNAL_PROFICIENCY_MILITARY_RANGED", type: "Proficiency" } }],
      textstring: [{ attrs: { name: "ranged basic,bow group:key ability", value: "str" } }]
    }
  }
};

const longbow: Weapon = {
  id: "w_longbow",
  name: "Longbow",
  slug: "longbow",
  weaponCategory: "Military Ranged",
  weaponGroup: "Bow",
  proficiencyBonus: 2,
  raw: {}
};

const index: RulesIndex = {
  races: [],
  classes: [warlordClass],
  feats: [],
  powers: [],
  skills: [],
  languages: [],
  armors: [],
  abilityScores: [],
  racialTraits: [],
  classFeatures: [archerWarlord],
  grantedClassFeatureNamesBySupportId: {
    ID_FMP_CLASS_8: ["Commanding Presence", "Inspiring Word"]
  },
  classFeatureChoiceGroupsByClassId: {
    ID_FMP_CLASS_8: []
  }
};

describe("Archer Warlord", () => {
  it("offers an optional Archer Warlord choice vs standard proficiencies", () => {
    const groups = getClassFeatureChoiceGroups(index, warlordClass);
    const archer = groups.find((g) => g.parentFeatureName === "Archer Warlord" && g.optional);
    expect(archer).toBeTruthy();
    expect(archer?.options.map((o) => o.id)).toEqual([
      CLASS_FEATURE_CHOICE_NONE,
      ARCHER_WARLORD_CLASS_FEATURE_ID
    ]);
  });

  it("grants military ranged and drops chainmail / light shields when selected", () => {
    const build: CharacterBuild = {
      name: "Test",
      level: 1,
      raceId: "race",
      classId: "ID_FMP_CLASS_8",
      abilityScores: { STR: 16, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 14 },
      trainedSkillIds: [],
      featIds: [],
      powerIds: [],
      classSelections: {
        [`classFeatureOptional:${ARCHER_WARLORD_CLASS_FEATURE_ID}`]: ARCHER_WARLORD_CLASS_FEATURE_ID
      }
    };
    expect(hasArcherWarlordSelection(build)).toBe(true);
    const armor = String(warlordClass.raw.specific?.["Armor Proficiencies"]);
    expect(effectiveClassArmorProficienciesText(armor, build)).not.toMatch(/chainmail/i);
    expect(effectiveClassArmorProficienciesText(armor, build)).not.toMatch(/light shield/i);

    const grants = collectCharacterProficiencyGrants(index, build);
    expect(grants.some((g) => g.kind === "weaponCategory" && g.value.includes("military ranged"))).toBe(
      true
    );

    const parsed = proficiencyGrantsFromClassFeatureRaw(archerWarlord.raw);
    expect(parsed.some((g) => g.value.includes("military ranged"))).toBe(true);
  });

  it("uses Strength for bow attacks when Archer Warlord is active", () => {
    const build: CharacterBuild = {
      name: "Test",
      level: 1,
      raceId: "race",
      classId: "ID_FMP_CLASS_8",
      abilityScores: { STR: 16, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 14 },
      trainedSkillIds: [],
      featIds: [],
      powerIds: [],
      classSelections: {
        [`classFeatureOptional:${ARCHER_WARLORD_CLASS_FEATURE_ID}`]: ARCHER_WARLORD_CLASS_FEATURE_ID
      }
    };
    expect(weaponAttackAbilityForCharacter(longbow, index, build)).toBe("STR");
  });

  it("includes Archer Warlord on traits only when chosen", () => {
    const withArcher: CharacterBuild = {
      name: "A",
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
    const withoutArcher: CharacterBuild = { ...withArcher, classSelections: undefined };
    expect(collectClassFeatureIdsFromClass(index, withArcher)).toContain(ARCHER_WARLORD_CLASS_FEATURE_ID);
    expect(collectClassFeatureIdsFromClass(index, withoutArcher)).not.toContain(
      ARCHER_WARLORD_CLASS_FEATURE_ID
    );
    const namesWith = getClassTraitRows(warlordClass, index, withArcher).map((r) => r.name);
    const namesWithout = getClassTraitRows(warlordClass, index, withoutArcher).map((r) => r.name);
    expect(namesWith.some((n) => n.includes("Archer Warlord"))).toBe(true);
    expect(namesWithout.some((n) => n.includes("Archer Warlord"))).toBe(false);
  });
});
