import { describe, expect, it } from "vitest";
import { equipmentSlotGoldCost } from "../../src/rules/equipmentItemPrice";
import type { CharacterEquipment, MagicItem, RulesIndex } from "../../src/rules/models";

const plate = {
  id: "ID_ARMOR_PLATE",
  name: "Plate Armor",
  slug: "plate-armor",
  armorBonus: 8,
  raw: { specific: { Gold: "50" } }
};

const blackIron: MagicItem = {
  id: "ID_BLACK_IRON_2",
  name: "Black Iron Armor +2",
  slug: "black-iron-armor-2",
  magicItemType: "Armor",
  enhancementBonus: 2,
  gold: 4200,
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
  armors: [plate],
  weapons: [],
  implements: [],
  abilityScores: [],
  racialTraits: [],
  themes: [],
  paragonPaths: [],
  epicDestinies: [],
  magicItems: [blackIron]
};

describe("equipmentSlotGoldCost", () => {
  it("uses mundane base gold when no enchantment", () => {
    const equipment: CharacterEquipment = {
      armor: { baseId: plate.id, enhancement: 0 },
      neck: { enhancement: 0 }
    };
    expect(equipmentSlotGoldCost(index, "armor", equipment)).toBe(50);
  });

  it("uses magic item gold when enchantment is set", () => {
    const equipment: CharacterEquipment = {
      armor: { baseId: plate.id, enchantmentId: blackIron.id, enhancement: 2 },
      neck: { enhancement: 0 }
    };
    expect(equipmentSlotGoldCost(index, "armor", equipment)).toBe(4200);
  });
});
