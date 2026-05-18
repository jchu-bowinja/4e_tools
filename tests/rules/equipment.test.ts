import { describe, expect, it } from "vitest";
import {
  computeEquipmentCombatBonuses,
  defaultEnhancementFromMagicItem,
  enchantmentDefenseBonusesFromItem,
  equipmentDuplicateEnchantmentWarnings,
  migrateLegacyEquipment,
  normalizeCharacterBuild,
  normalizeCharacterEquipment,
  parseEnhancementLevel,
  type LegacyCharacterBuildInput
} from "../../src/rules/equipment";
import { computeDerivedStats } from "../../src/rules/statCalculator";
import type { CharacterBuild, ClassDef, MagicItem, Race, RulesIndex } from "../../src/rules/models";

const blackIron: MagicItem = {
  id: "ID_FMP_MAGIC_ITEM_32",
  name: "Black Iron Armor +2",
  slug: "black-iron-armor-2",
  level: 9,
  magicItemType: "Armor",
  enhancementBonus: 2,
  enhancement: "+2 AC",
  statAdds: [
    { name: "Armor Enhancement Bonus", value: "+2" },
    { name: "resist:fire", value: "+5", type: "resist" }
  ],
  raw: {}
};

const cloak: MagicItem = {
  id: "ID_NECK_1",
  name: "Cloak +1",
  slug: "cloak-1",
  enhancementBonus: 1,
  statAdds: [{ name: "Fortitude Defense", value: "+1" }],
  raw: {}
};

const index: RulesIndex = {
  meta: { version: 1, counts: {} },
  races: [],
  classes: [],
  feats: [],
  powers: [],
  skills: [],
  languages: [],
  armors: [],
  abilityScores: [],
  racialTraits: [],
  themes: [],
  paragonPaths: [],
  epicDestinies: [],
  magicItems: [blackIron, cloak]
};

function legacyBuild(extra: LegacyCharacterBuildInput): CharacterBuild & LegacyCharacterBuildInput {
  return {
    name: "Hero",
    level: 9,
    abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 10 },
    trainedSkillIds: [],
    featIds: [],
    powerIds: [],
    ...extra
  };
}

describe("equipment phase 1", () => {
  it("parses enhancement levels 0-6", () => {
    expect(parseEnhancementLevel(3)).toBe(3);
    expect(parseEnhancementLevel(7)).toBeUndefined();
    expect(parseEnhancementLevel(-1)).toBeUndefined();
  });

  it("defaultEnhancementFromMagicItem uses lowest +N on the row", () => {
    expect(defaultEnhancementFromMagicItem(blackIron)).toBe(2);
    expect(
      defaultEnhancementFromMagicItem({
        id: "x",
        name: "Test",
        slug: "test",
        enhancement: "+3 AC",
        statAdds: [{ name: "Armor Enhancement Bonus", value: "+1" }],
        raw: {}
      })
    ).toBe(1);
  });

  it("normalizes neck to explicit enhancement 0", () => {
    expect(normalizeCharacterEquipment({})).toEqual({ neck: { enhancement: 0 } });
  });

  it("migrates legacy flat ids to equipment", () => {
    const equipment = migrateLegacyEquipment(
      legacyBuild({
        armorId: "ID_ARMOR_1",
        mainWeaponId: "ID_WEAPON_1",
        magicItemIds: { armor: blackIron.id, neck: cloak.id }
      }),
      index
    );
    expect(equipment.armor?.baseId).toBe("ID_ARMOR_1");
    expect(equipment.armor?.enchantmentId).toBe(blackIron.id);
    expect(equipment.armor?.enhancement).toBe(2);
    expect(equipment.mainHand?.baseId).toBe("ID_WEAPON_1");
    expect(equipment.neck?.enchantmentId).toBe(cloak.id);
    expect(equipment.neck?.enhancement).toBe(1);
  });

  it("normalizeCharacterBuild migrates legacy JSON and strips flat ids", () => {
    const normalized = normalizeCharacterBuild(
      legacyBuild({
        level: 5,
        armorId: "ID_ARMOR_1",
        implementId: "ID_IMP_1",
        magicItemIds: { implement: "ID_MAGIC_IMP" }
      }),
      index
    );
    expect(normalized.equipment?.armor?.baseId).toBe("ID_ARMOR_1");
    expect(normalized.equipment?.implement?.superiorImplementId).toBe("ID_IMP_1");
    expect(normalized.equipment?.neck).toEqual({ enhancement: 0 });
    expect("armorId" in normalized).toBe(false);
    expect("magicItemIds" in normalized).toBe(false);
  });

  it("preserves explicit equipment and drops stale legacy flat ids", () => {
    const normalized = normalizeCharacterBuild(
      legacyBuild({
        level: 1,
        armorId: "STALE_ARMOR",
        equipment: {
          armor: { baseId: "NEW_ARMOR", enhancement: 0 },
          neck: { enhancement: 0 }
        }
      }),
      index
    );
    expect(normalized.equipment?.armor?.baseId).toBe("NEW_ARMOR");
    expect("armorId" in normalized).toBe(false);
  });
});

const race: Race = {
  id: "r1",
  name: "Human",
  speed: 6,
  raw: {}
} as Race;

const cls: ClassDef = {
  id: "c1",
  name: "Fighter",
  hitPointsAt1: 15,
  hitPointsPerLevel: 6,
  healingSurgesBase: 9,
  raw: {}
} as ClassDef;

describe("equipment phase 2 combat bonuses", () => {
  it("uses slot enhancement for AC without double-counting armor enhancement statAdds", () => {
    const build: CharacterBuild = {
      name: "Hero",
      level: 9,
      abilityScores: { STR: 16, CON: 14, DEX: 12, INT: 10, WIS: 10, CHA: 8 },
      trainedSkillIds: [],
      featIds: [],
      powerIds: [],
      equipment: {
        armor: { baseId: "ID_ARMOR_1", enchantmentId: blackIron.id, enhancement: 2 },
        neck: { enhancement: 0 }
      }
    };
    const bonuses = computeEquipmentCombatBonuses(index, build);
    expect(bonuses.defenses.ac).toBe(2);
    expect(enchantmentDefenseBonusesFromItem(blackIron, 9).ac).toBe(0);
  });

  it("applies neck plus and enchantment NAD without double-counting defense statAdds", () => {
    const build: CharacterBuild = {
      name: "Hero",
      level: 4,
      abilityScores: { STR: 16, CON: 14, DEX: 12, INT: 10, WIS: 10, CHA: 8 },
      trainedSkillIds: [],
      featIds: [],
      powerIds: [],
      equipment: {
        neck: { enchantmentId: cloak.id, enhancement: 1 }
      }
    };
    const magicDefense = computeEquipmentCombatBonuses(index, build).defenses;
    const baseline = computeDerivedStats(
      { ...build, equipment: { neck: { enhancement: 0 } } },
      race,
      cls,
      undefined,
      undefined
    );
    const merged = computeDerivedStats(build, race, cls, undefined, undefined, undefined, undefined, undefined, magicDefense);
    expect(merged.defenses.fortitude).toBe(baseline.defenses.fortitude + 1);
    expect(merged.defenses.reflex).toBe(baseline.defenses.reflex + 1);
    expect(merged.defenses.will).toBe(baseline.defenses.will + 1);
  });

  it("uses weapon slot enhancement for attack bonus", () => {
    const longsword: MagicItem = {
      id: "ID_TEST_WEAPON",
      name: "Flaming Longsword +3",
      slug: "flaming-longsword-3",
      level: 15,
      magicItemType: "Weapon",
      enhancementBonus: 3,
      raw: {}
    };
    const weaponIndex: RulesIndex = { ...index, magicItems: [...index.magicItems!, longsword] };
    const build: CharacterBuild = {
      name: "Hero",
      level: 15,
      abilityScores: { STR: 16, CON: 14, DEX: 12, INT: 10, WIS: 10, CHA: 8 },
      trainedSkillIds: [],
      featIds: [],
      powerIds: [],
      equipment: {
        mainHand: { baseId: "W1", enchantmentId: longsword.id, enhancement: 3 },
        neck: { enhancement: 0 }
      }
    };
    const bonuses = computeEquipmentCombatBonuses(weaponIndex, build);
    expect(bonuses.mainWeaponAttack).toBe(3);
  });

  it("migrates legacy magicItemIds into equipment combat bonuses", () => {
    const build = legacyBuild({
      level: 9,
      abilityScores: { STR: 16, CON: 14, DEX: 12, INT: 10, WIS: 10, CHA: 8 },
      magicItemIds: { armor: blackIron.id, neck: cloak.id }
    });
    const bonuses = computeEquipmentCombatBonuses(index, build);
    expect(bonuses.defenses.ac).toBe(2);
    expect(bonuses.defenses.fortitude).toBe(1);
  });

  it("warns when the same enchantment is on both hands", () => {
    const warnings = equipmentDuplicateEnchantmentWarnings({
      name: "Hero",
      level: 1,
      abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 10 },
      trainedSkillIds: [],
      featIds: [],
      powerIds: [],
      equipment: {
        mainHand: { enchantmentId: "M1" },
        offHand: { enchantmentId: "M1" },
        neck: { enhancement: 0 }
      }
    });
    expect(warnings).toHaveLength(1);
  });
});
