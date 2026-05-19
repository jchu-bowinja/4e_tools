import { describe, expect, it } from "vitest";
import { sheetStateFromBuild, toBuildLikeState, computeSheetDerivedData } from "../../src/features/characterSheet/selectors";
import {
  addAcquiredEquipmentToBuild,
  addAcquiredEquipmentToSheet,
  characterBuildInventoryItems,
  equipInventoryItemOnBuild,
  unequipInventoryItemOnBuild,
  characterSheetInventoryItems,
  equipSlotDropdownChoices,
  isEquipmentDerivedInventoryItem,
  equipSlotShouldDisplay,
  selectedEquipSlotItemId,
  updateSheetEquipmentFromBuild
} from "../../src/features/characterSheet/sheetEquipment";
import type { CharacterSheetState } from "../../src/features/characterSheet/model";
import { setStandardSlotBase } from "../../src/features/builder/equipmentBuildUpdates";
import type { CharacterBuild, MagicItem, RulesIndex, Weapon } from "../../src/rules/models";

const longsword: Weapon = {
  id: "w_longsword",
  name: "Longsword",
  slug: "longsword",
  handsRequired: "One-Handed",
  proficiencyBonus: 3,
  damage: "1d8",
  raw: {}
};

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
  weapons: [longsword],
  implements: [],
  abilityScores: [],
  racialTraits: [],
  themes: [],
  paragonPaths: [],
  epicDestinies: [],
  magicItems: [blackIron, cloak]
};

describe("sheetStateFromBuild equipment", () => {
  it("stores characterEquipment without auto-adding inventory until acquired", () => {
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
    expect(sheet.inventory).toHaveLength(0);
    expect(sheet.equipment).toEqual({});

    const acquired = addAcquiredEquipmentToSheet(sheet, index, "armor");
    const armorInv = acquired.inventory.find((i) => i.id === acquired.equipment.armor);
    expect(armorInv?.name).toContain("Plate Armor");
    expect(armorInv?.name).toContain("+2");
    expect(acquired.equipment.armor).toBeTruthy();

    const withNeck = addAcquiredEquipmentToSheet(acquired, index, "neck");
    expect(withNeck.inventory.some((i) => i.notes === "Neck slot")).toBe(true);
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

  it("equipInventoryItemOnBuild assigns gear slots", () => {
    const build: CharacterBuild = {
      name: "Hero",
      level: 1,
      abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 10 },
      trainedSkillIds: [],
      featIds: [],
      powerIds: [],
      equipment: { neck: { enhancement: 0 } },
      inventory: [
        {
          id: "inv-weapon",
          name: "Longsword",
          kind: "weapon",
          quantity: 1,
          sourceId: longsword.id,
          slotHints: ["mainHand", "offHand"]
        }
      ]
    };
    const equipped = equipInventoryItemOnBuild(build, "inv-weapon", "mainHand", index);
    expect(equipped.equippedSlots?.mainHand).toBe("inv-weapon");
    const rows = characterBuildInventoryItems(equipped, index);
    expect(rows[0]?.equippedSlot).toBe("Main hand");
    expect(rows[0]?.equipOptions.some((o) => o.slot === "offHand")).toBe(true);
  });

  it("equipping to a second slot removes the item from the first slot", () => {
    const build: CharacterBuild = {
      name: "Hero",
      level: 1,
      abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 10 },
      trainedSkillIds: [],
      featIds: [],
      powerIds: [],
      equipment: { neck: { enhancement: 0 } },
      inventory: [
        {
          id: "inv-weapon",
          name: "Longsword",
          kind: "weapon",
          quantity: 1,
          sourceId: longsword.id,
          slotHints: ["mainHand", "offHand"]
        }
      ],
      equippedSlots: { mainHand: "inv-weapon" }
    };
    const moved = equipInventoryItemOnBuild(build, "inv-weapon", "offHand", index);
    expect(moved.equippedSlots?.mainHand).toBeUndefined();
    expect(moved.equippedSlots?.offHand).toBe("inv-weapon");
    const rows = characterBuildInventoryItems(moved, index);
    expect(rows[0]?.equippedInSlots).toEqual(["offHand"]);
  });

  it("a ring cannot occupy ring1 and ring2 at once", () => {
    const ring: MagicItem = {
      id: "ID_RING_1",
      name: "Ring of Protection",
      slug: "ring-of-protection",
      magicItemType: "Ring",
      enhancementBonus: 0,
      raw: {}
    };
    const indexWithRing: RulesIndex = { ...index, magicItems: [...index.magicItems, ring] };
    const build: CharacterBuild = {
      name: "Hero",
      level: 5,
      abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 10 },
      trainedSkillIds: [],
      featIds: [],
      powerIds: [],
      equipment: { neck: { enhancement: 0 } },
      inventory: [
        {
          id: "inv-ring",
          name: "Ring of Protection",
          kind: "gear",
          quantity: 1,
          sourceId: ring.id,
          slotHints: ["ring1", "ring2"]
        }
      ],
      equippedSlots: { ring1: "inv-ring" }
    };
    const moved = equipInventoryItemOnBuild(build, "inv-ring", "ring2", indexWithRing);
    expect(moved.equippedSlots?.ring1).toBeUndefined();
    expect(moved.equippedSlots?.ring2).toBe("inv-ring");
  });

  it("unequipInventoryItemOnBuild clears gear slots", () => {
    const build: CharacterBuild = {
      name: "Hero",
      level: 1,
      abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 10 },
      trainedSkillIds: [],
      featIds: [],
      powerIds: [],
      equipment: { neck: { enhancement: 0 } },
      inventory: [
        {
          id: "inv-weapon",
          name: "Longsword",
          kind: "weapon",
          quantity: 1,
          sourceId: longsword.id,
          slotHints: ["mainHand", "offHand"]
        }
      ],
      equippedSlots: { mainHand: "inv-weapon" }
    };
    const unequipped = unequipInventoryItemOnBuild(build, "inv-weapon", "mainHand");
    expect(unequipped.equippedSlots?.mainHand).toBeUndefined();
    expect(characterBuildInventoryItems(unequipped, index)[0]?.equippedSlot).toBeUndefined();
  });

  it("addAcquiredEquipment does not equip when the gear slot is already filled", () => {
    const build: CharacterBuild = {
      name: "Hero",
      level: 5,
      abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 10 },
      trainedSkillIds: [],
      featIds: [],
      powerIds: [],
      equipment: {
        armor: { baseId: plate.id, enhancement: 0 },
        neck: { enhancement: 0 }
      },
      inventory: [
        {
          id: "old-armor",
          name: "Chainmail",
          kind: "armor",
          quantity: 1,
          sourceId: plate.id,
          slotHints: ["armor"]
        }
      ],
      equippedSlots: { armor: "old-armor" }
    };
    const acquired = addAcquiredEquipmentToBuild(build, index, "armor");
    expect(acquired.equippedSlots?.armor).toBe("old-armor");
    expect(acquired.inventory).toHaveLength(2);
    expect(acquired.inventory.filter((i) => i.sourceId === plate.id)).toHaveLength(2);
  });

  it("each add/buy creates a separate inventory row even for the same gear", () => {
    const build: CharacterBuild = {
      name: "Hero",
      level: 5,
      abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 10 },
      trainedSkillIds: [],
      featIds: [],
      powerIds: [],
      equipment: {
        armor: { baseId: plate.id, enhancement: 0 },
        neck: { enhancement: 0 }
      }
    };
    const first = addAcquiredEquipmentToBuild(build, index, "armor");
    const second = addAcquiredEquipmentToBuild(first, index, "armor");
    expect(second.inventory).toHaveLength(2);
    expect(new Set(second.inventory.map((i) => i.id)).size).toBe(2);
    expect(second.equippedSlots?.armor).toBe(first.inventory[0]?.id);
  });

  it("characterBuildInventoryItems lists acquired builder inventory", () => {
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
    expect(characterBuildInventoryItems(build, index)).toHaveLength(0);
    const acquired = addAcquiredEquipmentToBuild(build, index, "armor");
    const items = characterBuildInventoryItems(acquired, index);
    expect(items).toHaveLength(1);
    expect(items[0]?.equippedSlot).toBe("Armor");
    expect(items[0]?.equipOptions).toEqual([]);
    expect(items[0]?.name).toContain("Plate Armor");
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
    const withArmor = addAcquiredEquipmentToSheet(sheetStateFromBuild(build, index), index, "armor");
    const sheet: CharacterSheetState = {
      ...withArmor,
      inventory: [
        ...withArmor.inventory,
        { id: "manual-potion", name: "Potion", kind: "gear", quantity: 2, slotHints: [] }
      ]
    };
    const rows = characterSheetInventoryItems(sheet, index);
    expect(rows.some((r) => r.id === "manual-potion" && r.name === "Potion")).toBe(true);
    expect(rows.find((r) => r.equippedSlot === "Armor")).toBeDefined();
  });
});

describe("inventory item list ordering", () => {
  it("sorts items by kind then name", () => {
    const build: CharacterBuild = {
      name: "Hero",
      level: 1,
      abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 10 },
      trainedSkillIds: [],
      featIds: [],
      powerIds: [],
      equipment: { neck: { enhancement: 0 } },
      inventory: [
        {
          id: "potion",
          name: "Potion",
          kind: "gear",
          quantity: 1,
          slotHints: []
        },
        {
          id: "sword",
          name: "Longsword",
          kind: "weapon",
          quantity: 1,
          sourceId: longsword.id,
          slotHints: ["mainHand", "offHand"]
        },
        {
          id: "armor",
          name: "Plate Armor",
          kind: "armor",
          quantity: 1,
          sourceId: plate.id,
          slotHints: ["armor"]
        }
      ]
    };
    const names = characterBuildInventoryItems(build, index).map((row) => row.name);
    expect(names).toEqual(["Plate Armor", "Longsword", "Potion"]);
  });
});

describe("selectedEquipSlotItemId", () => {
  it("returns empty when the slot is not equipped even if inventory has a matching item", () => {
    const inventory = [
      {
        id: "armor-1",
        name: "Plate Armor",
        kind: "armor" as const,
        quantity: 1,
        sourceId: plate.id,
        slotHints: ["armor" as const]
      }
    ];
    expect(selectedEquipSlotItemId("armor", inventory, {}, undefined, index)).toBe("");
  });

  it("returns the equipped inventory id when the slot is filled", () => {
    const inventory = [
      {
        id: "armor-1",
        name: "Plate Armor",
        kind: "armor" as const,
        quantity: 1,
        sourceId: plate.id,
        slotHints: ["armor" as const]
      }
    ];
    expect(selectedEquipSlotItemId("armor", inventory, { armor: "armor-1" }, undefined, index)).toBe("armor-1");
  });
});

describe("equipSlotShouldDisplay", () => {
  it("hides slots with no inventory or configuration", () => {
    expect(equipSlotShouldDisplay([], {}, "mainHand", index)).toBe(false);
    expect(equipSlotShouldDisplay([], {}, "neck", index)).toBe(false);
  });

  it("hides slots that are only configured on the equipment tab", () => {
    const equipment = {
      armor: { baseId: plate.id, enhancement: 0 },
      neck: { enchantmentId: cloak.id, enhancement: 1 }
    };
    expect(equipSlotShouldDisplay([], {}, "armor", index, equipment)).toBe(false);
    expect(equipSlotShouldDisplay([], {}, "neck", index, equipment)).toBe(false);
    expect(equipSlotShouldDisplay([], {}, "implement", index, equipment)).toBe(false);
  });

  it("shows slots that are currently equipped even without other choices", () => {
    const inventory = [
      {
        id: "armor-1",
        name: "Plate Armor",
        kind: "armor" as const,
        quantity: 1,
        sourceId: plate.id,
        slotHints: ["armor" as const]
      }
    ];
    expect(equipSlotShouldDisplay(inventory, { armor: "armor-1" }, "armor", index)).toBe(true);
  });
});

describe("equipSlotDropdownChoices", () => {
  it("does not include configured equipment-tab items until they are in inventory", () => {
    const build: CharacterBuild = {
      name: "Hero",
      level: 1,
      abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 10 },
      trainedSkillIds: [],
      featIds: [],
      powerIds: [],
      equipment: {
        armor: { baseId: plate.id, enhancement: 0 },
        neck: { enchantmentId: cloak.id, enhancement: 1 }
      }
    };
    expect(equipSlotDropdownChoices([], {}, "armor", index, build.equipment)).toHaveLength(0);
    expect(equipSlotDropdownChoices([], {}, "neck", index, build.equipment)).toHaveLength(0);
    expect(equipSlotShouldDisplay([], {}, "armor", index, build.equipment)).toBe(false);
    expect(equipSlotShouldDisplay([], {}, "neck", index, build.equipment)).toBe(false);
  });

  it("lists inventory items that fit each gear slot", () => {
    const inventory = [
      {
        id: "armor-1",
        name: "Plate Armor",
        kind: "armor" as const,
        quantity: 1,
        sourceId: plate.id,
        slotHints: ["armor" as const]
      },
      {
        id: "weapon-1",
        name: "Longsword",
        kind: "weapon" as const,
        quantity: 1,
        sourceId: longsword.id,
        slotHints: ["mainHand" as const, "offHand" as const]
      }
    ];
    const armorChoices = equipSlotDropdownChoices(inventory, {}, "armor", index);
    expect(armorChoices.map((c) => c.itemId)).toEqual(["armor-1"]);
    const mainChoices = equipSlotDropdownChoices(inventory, {}, "mainHand", index);
    expect(mainChoices.map((c) => c.itemId)).toEqual(["weapon-1"]);
  });
});

describe("sheet equipment editing", () => {
  it("updateSheetEquipmentFromBuild preserves manual inventory and does not auto-equip", () => {
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
      inventory: [{ id: "manual-potion", name: "Potion", kind: "gear" as const, quantity: 2, slotHints: [] }]
    };
    const next = updateSheetEquipmentFromBuild(sheet, index, (b) =>
      setStandardSlotBase(b, "armor", plate.id)
    );
    expect(next.characterEquipment?.armor?.baseId).toBe(plate.id);
    expect(next.inventory.some((i) => i.id === "manual-potion")).toBe(true);
    expect(next.equipment.armor).toBeUndefined();
    expect(next.inventory.some((i) => isEquipmentDerivedInventoryItem(i))).toBe(false);
  });
});
