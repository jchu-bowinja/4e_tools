import { describe, expect, it } from "vitest";
import { sheetStateFromBuild, toBuildLikeState, computeSheetDerivedData } from "../../src/features/characterSheet/selectors";
import {
  characterBuildInventoryItems,
  characterSheetInventoryItems,
  isEquipmentDerivedInventoryItem,
  updateSheetEquipmentFromBuild
} from "../../src/features/characterSheet/sheetEquipment";
import type { CharacterSheetState } from "../../src/features/characterSheet/model";
import { setStandardSlotBase } from "../../src/features/builder/equipmentBuildUpdates";
import type { CharacterBuild, MagicItem, RulesIndex } from "../../src/rules/models";

const plate: { id: string; name: string; slug: string; armorBonus: number; raw: Record<string, unknown> } = {
  id: "ID_ARMOR_PLATE",
  name: "Plate Armor",
  slug: "plate-armor",
  armorBonus: 8,
  raw: {}
};

const blackIron: MagicItem = {
  id: "ID_BLACK_IRON_2",
  name: "Black Iron Armor +2",
  slug: "black-iron-armor-2",
  magicItemType: "Armor",
  enhancementBonus: 2,
  statAdds: [{ name: "resist:fire", value: "+5", type: "resist" }],
  raw: {}
};

const cloak: MagicItem = {
  id: "ID_CLOAK_1",
  name: "Cloak of Resistance +1",
  slug: "cloak-of-resistance-1",
  magicItemType: "Neck Slot Item",
  enhancementBonus: 1,
  statAdds: [{ name: "Fortitude Defense", value: "+1" }],
  raw: {}
};

const index: RulesIndex = {
  meta: { version: 1, counts: {} },
  races: [{ id: "race_human", name: "Human", slug: "human", speed: 6, raw: {} }],
  classes: [
    {
      id: "class_fighter",
      name: "Fighter",
      slug: "fighter",
      hitPointsAt1: 15,
      hitPointsPerLevel: 6,
      healingSurgesBase: 9,
      raw: {}
    }
  ],
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
  magicItems: [blackIron, cloak]
};

describe("sheetStateFromBuild equipment", () => {
  it("stores characterEquipment and builds inventory labels with plus", () => {
    const build: CharacterBuild = {
      name: "Hero",
      level: 9,
      raceId: "race_human",
      classId: "class_fighter",
      abilityScores: { STR: 16, CON: 14, DEX: 12, INT: 10, WIS: 10, CHA: 8 },
      trainedSkillIds: [],
      featIds: [],
      powerIds: [],
      equipment: {
        armor: { baseId: plate.id, enchantmentId: blackIron.id, enhancement: 2 },
        neck: { enchantmentId: cloak.id, enhancement: 1 }
      }
    };
    const sheet = sheetStateFromBuild(build, index);
    expect(sheet.characterEquipment?.armor?.enhancement).toBe(2);
    expect(sheet.characterEquipment?.neck?.enhancement).toBe(1);
    const armorInv = sheet.inventory.find((i) => i.id === sheet.equipment.armor);
    expect(armorInv?.name).toContain("Plate Armor");
    expect(armorInv?.name).toContain("+2");
    expect(sheet.inventory.some((i) => i.notes === "Neck slot")).toBe(true);
  });

  it("toBuildLikeState uses characterEquipment for magic defense bonuses", () => {
    const build: CharacterBuild = {
      name: "Hero",
      level: 9,
      raceId: "race_human",
      classId: "class_fighter",
      abilityScores: { STR: 16, CON: 14, DEX: 12, INT: 10, WIS: 10, CHA: 8 },
      trainedSkillIds: [],
      featIds: [],
      powerIds: [],
      equipment: {
        neck: { enchantmentId: cloak.id, enhancement: 1 }
      }
    };
    const sheet = sheetStateFromBuild(build, index);
    const derived = computeSheetDerivedData(sheet, index);
    const baseline = computeSheetDerivedData(
      {
        ...sheet,
        characterEquipment: { neck: { enhancement: 0 } },
        inventory: [],
        equipment: {}
      },
      index
    );
    expect(derived.defenses.fortitude).toBe(baseline.defenses.fortitude + 1);
  });

  it("characterBuildInventoryItems lists equipment with equipped slots", () => {
    const build: CharacterBuild = {
      name: "Hero",
      level: 9,
      raceId: "race_human",
      classId: "class_fighter",
      abilityScores: { STR: 16, CON: 14, DEX: 12, INT: 10, WIS: 10, CHA: 8 },
      trainedSkillIds: [],
      featIds: [],
      powerIds: [],
      equipment: {
        armor: { baseId: plate.id, enchantmentId: blackIron.id, enhancement: 2 },
        neck: { enchantmentId: cloak.id, enhancement: 1 }
      }
    };
    const items = characterBuildInventoryItems(build, index);
    expect(items).toHaveLength(2);
    expect(items[0]?.equippedSlot).toBe("Armor");
    expect(items[0]?.name).toContain("Plate Armor");
    expect(items[1]?.name).toContain("Cloak");
  });
});

describe("characterSheetInventoryItems", () => {
  it("includes manual inventory rows with equipped slot labels", () => {
    const build: CharacterBuild = {
      name: "Hero",
      level: 1,
      raceId: "race_human",
      classId: "class_fighter",
      abilityScores: { STR: 16, CON: 14, DEX: 12, INT: 10, WIS: 10, CHA: 8 },
      trainedSkillIds: [],
      featIds: [],
      powerIds: [],
      equipment: { armor: { baseId: plate.id, enhancement: 0 }, neck: { enhancement: 0 } }
    };
    const sheet: CharacterSheetState = {
      ...sheetStateFromBuild(build, index),
      inventory: [
        ...sheetStateFromBuild(build, index).inventory,
        { id: "manual-potion", name: "Potion", kind: "gear", quantity: 2, slotHints: [] }
      ]
    };
    const rows = characterSheetInventoryItems(sheet);
    expect(rows.some((r) => r.id === "manual-potion" && r.name === "Potion")).toBe(true);
    expect(rows.find((r) => r.equippedSlot === "Armor")).toBeDefined();
  });
});

describe("sheet equipment editing", () => {
  it("updateSheetEquipmentFromBuild preserves manual inventory items", () => {
    const build: CharacterBuild = {
      name: "Hero",
      level: 9,
      raceId: "race_human",
      classId: "class_fighter",
      abilityScores: { STR: 16, CON: 14, DEX: 12, INT: 10, WIS: 10, CHA: 8 },
      trainedSkillIds: [],
      featIds: [],
      powerIds: [],
      equipment: { neck: { enhancement: 0 } }
    };
    const sheet = {
      ...sheetStateFromBuild(build, index),
      inventory: [
        ...sheetStateFromBuild(build, index).inventory,
        { id: "manual-potion", name: "Potion", kind: "gear" as const, quantity: 2, slotHints: [] }
      ]
    };
    const next = updateSheetEquipmentFromBuild(sheet, index, (b) =>
      setStandardSlotBase(b, "armor", plate.id)
    );
    expect(next.characterEquipment?.armor?.baseId).toBe(plate.id);
    expect(next.inventory.some((i) => i.id === "manual-potion")).toBe(true);
    expect(isEquipmentDerivedInventoryItem(next.inventory.find((i) => i.id === next.equipment.armor)!)).toBe(true);
  });
});
