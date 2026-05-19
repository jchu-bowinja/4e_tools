import { describe, expect, it } from "vitest";
import { normalizeCharacterBuild } from "../../src/rules/equipment";
import {
  aggregateMagicItemDefenseBonuses,
  computeMagicItemCombatBonuses,
  isArmorMagicItem,
  isMagicItemForSlot,
  isShieldMagicItem,
  magicItemAttackBonus,
  stripLegacyMagicItemBonuses,
  weaponMatchesMagicItem
} from "../../src/rules/magicItemEquipment";
import type { Armor, CharacterBuild, MagicItem, RulesIndex, Weapon } from "../../src/rules/models";
import { magicShieldOptions } from "../../src/features/builder/magicItemOptions";
const blackIron: MagicItem = {
  id: "ID_FMP_MAGIC_ITEM_32",
  name: "Black Iron Armor +2",
  slug: "black-iron-armor-2",
  level: 9,
  magicItemType: "Armor",
  armorTypes: ["Scale", "Plate"],
  enhancementBonus: 2,
  statAdds: [
    { name: "Armor Class", value: "+2", type: "Enhancement" },
    { name: "Armor Enhancement Bonus", value: "+2" },
    { name: "resist:fire", value: "+5", type: "resist" }
  ],
  raw: {}
};

const longswordPlus3: MagicItem = {
  id: "ID_TEST_WEAPON",
  name: "Flaming Longsword +3",
  slug: "flaming-longsword-3",
  level: 15,
  magicItemType: "Weapon",
  weaponTypes: ["Heavy Blade"],
  enhancement: "+3 attack rolls and damage rolls",
  enhancementBonus: 3,
  raw: {}
};

const guardianShield: MagicItem = {
  id: "ID_GUARDIAN_SHIELD",
  name: "Guardian Shield (heroic tier)",
  slug: "guardian-shield-heroic",
  level: 10,
  magicItemType: "Arms Slot Item",
  isEnchant: "Shield",
  raw: { specific: { _IsEnchant: "Shield" } }
};

const turathiShield: MagicItem = {
  id: "ID_TURATHI",
  name: "Shield of Turathi Defiance (paragon tier)",
  slug: "shield-of-turathi-defiance",
  level: 16,
  magicItemType: "Armor",
  armorTypes: ["Heavy Shields", "Light Shields"],
  raw: {}
};

const lightShield: Armor = {
  id: "a_light_shield",
  name: "Light Shield",
  slug: "light-shield",
  armorType: "Shield",
  armorCategory: "Light Shields",
  armorBonus: 1,
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
  magicItems: [blackIron, longswordPlus3, guardianShield, turathiShield],
  armors: [lightShield]
};

describe("magicItemEquipment", () => {
  it("excludes enhancement-only statAdds when aggregating enchantment defenses", () => {
    const d = aggregateMagicItemDefenseBonuses([blackIron], 9);
    expect(d.ac).toBe(0);
  });

  it("computes per-slot weapon attack bonuses", () => {
    const build: CharacterBuild = {
      name: "Hero",
      level: 15,
      abilityScores: { STR: 16, CON: 14, DEX: 12, INT: 10, WIS: 10, CHA: 8 },
      trainedSkillIds: [],
      featIds: [],
      powerIds: [],
      equipment: {
        armor: { enchantmentId: blackIron.id, enhancement: 2 },
        mainHand: { enchantmentId: longswordPlus3.id, enhancement: 3 },
        neck: { enhancement: 0 }
      }
    };
    const bonuses = computeMagicItemCombatBonuses(index, build);
    expect(bonuses.defenses.ac).toBe(2);
    expect(bonuses.mainWeaponAttack).toBe(3);
    expect(bonuses.offHandWeaponAttack).toBe(0);
  });

  it("matches weapon groups for magic weapon filtering", () => {
    const weapon: Weapon = {
      id: "w1",
      name: "Longsword",
      slug: "longsword",
      weaponGroup: "Heavy Blade",
      raw: {}
    };
    expect(weaponMatchesMagicItem(weapon, longswordPlus3)).toBe(true);
    expect(isArmorMagicItem(blackIron)).toBe(true);
    expect(magicItemAttackBonus(longswordPlus3)).toBe(3);
  });

  it("classifies shield enchants separately from body armor and arms slot", () => {
    expect(isShieldMagicItem(guardianShield)).toBe(true);
    expect(isShieldMagicItem(blackIron)).toBe(false);
    expect(isShieldMagicItem(turathiShield)).toBe(true);
    expect(isArmorMagicItem(guardianShield)).toBe(false);
    expect(isMagicItemForSlot(guardianShield, "arms")).toBe(false);
    expect(isMagicItemForSlot(guardianShield, "head")).toBe(false);

    const shieldOptions = magicShieldOptions(index, lightShield);
    expect(shieldOptions.map((m) => m.id)).toEqual(
      expect.arrayContaining([guardianShield.id, turathiShield.id])
    );
    expect(shieldOptions.some((m) => m.id === blackIron.id)).toBe(false);
  });

  it("classifies magic-only equipment slots by type and item slot", () => {
    const head: MagicItem = {
      id: "head1",
      name: "Helm of Eyes",
      slug: "helm-of-eyes",
      magicItemType: "Head Slot Item",
      itemSlot: "Head",
      raw: {}
    };
    const ring: MagicItem = {
      id: "ring1",
      name: "Ring of Protection",
      slug: "ring-of-protection",
      magicItemType: "Ring",
      itemSlot: "Ring",
      raw: {}
    };
    expect(isMagicItemForSlot(head, "head")).toBe(true);
    expect(isMagicItemForSlot(head, "ring1")).toBe(false);
    expect(isMagicItemForSlot(ring, "ring1")).toBe(true);
    expect(isMagicItemForSlot(ring, "ring2")).toBe(true);
  });

  it("strips legacy manual magicItemBonuses", () => {
    const cleaned = stripLegacyMagicItemBonuses({
      name: "X",
      magicItemBonuses: { ac: 2 }
    });
    expect(cleaned).not.toHaveProperty("magicItemBonuses");
  });
});
