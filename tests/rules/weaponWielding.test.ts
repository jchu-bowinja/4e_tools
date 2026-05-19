import { describe, expect, it } from "vitest";
import {
  applyEquipWithHandRules,
  equipOptionsForInventoryItem,
  firstValidWeaponEquipSlot,
  normalizeEquippedSlots,
  offHandWeaponAttackPenalty,
  formatWeaponDamageNotation,
  versatileTwoHandedDamageBonus,
  wieldNoteForWeaponInHand
} from "../../src/rules/weaponWielding";
import { summarizeMainWeaponAttack } from "../../src/rules/weaponAttack";
import type { Armor, InventoryItem, MagicItem, RulesIndex, Weapon } from "../../src/rules/models";

const cloak: MagicItem = {
  id: "ID_CLOAK_1",
  name: "Cloak of Resistance +1",
  slug: "cloak-of-resistance-1",
  magicItemType: "Neck Slot Item",
  enhancementBonus: 1,
  raw: {}
};

const longsword: Weapon = {
  id: "w_longsword",
  name: "Longsword",
  slug: "longsword",
  handsRequired: "One-Handed",
  properties: null,
  proficiencyBonus: 3,
  damage: "1d8",
  raw: {}
};

const greatsword: Weapon = {
  id: "w_greatsword",
  name: "Greatsword",
  slug: "greatsword",
  handsRequired: "Two-Handed",
  properties: null,
  proficiencyBonus: 2,
  damage: "1d10",
  raw: {}
};

const handaxe: Weapon = {
  id: "w_handaxe",
  name: "Handaxe",
  slug: "handaxe",
  handsRequired: "One-Handed",
  properties: "Off-hand",
  proficiencyBonus: 2,
  damage: "1d6",
  raw: {}
};

const warhammer: Weapon = {
  id: "w_warhammer",
  name: "Warhammer",
  slug: "warhammer",
  handsRequired: "One-Handed",
  properties: "Versatile",
  proficiencyBonus: 2,
  damage: "1d10",
  raw: {}
};

const lightShield: Armor = {
  id: "a_shield",
  name: "Light Shield",
  slug: "light-shield",
  armorType: "Light Shield",
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
  armors: [lightShield],
  weapons: [longsword, greatsword, handaxe, warhammer],
  implements: [],
  abilityScores: [],
  racialTraits: [],
  themes: [],
  paragonPaths: [],
  epicDestinies: [],
  magicItems: []
};

function weaponItem(id: string, sourceId: string, name: string): InventoryItem {
  return {
    id,
    name,
    kind: "weapon",
    quantity: 1,
    sourceId,
    slotHints: ["mainHand", "offHand"]
  };
}

function shieldItem(id: string): InventoryItem {
  return {
    id,
    name: "Light Shield",
    kind: "armor",
    quantity: 1,
    sourceId: lightShield.id,
    slotHints: ["offHand"]
  };
}

describe("weaponWielding", () => {
  it("applies −2 off-hand penalty for one-handed weapons without Off-hand property", () => {
    expect(offHandWeaponAttackPenalty(longsword, "offHand")).toBe(-2);
    expect(offHandWeaponAttackPenalty(longsword, "mainHand")).toBe(0);
  });

  it("waives off-hand penalty for Off-hand property weapons", () => {
    expect(offHandWeaponAttackPenalty(handaxe, "offHand")).toBe(0);
  });

  it("blocks two-handed weapons from off hand", () => {
    const item = weaponItem("gs", greatsword.id, "Greatsword");
    const options = equipOptionsForInventoryItem(item, [item], {}, index);
    const off = options.find((o) => o.slot === "offHand");
    expect(off?.disabled).toBe(true);
    expect(off?.hint).toContain("main hand");
  });

  it("clears off hand when equipping two-handed weapon to main hand", () => {
    const gs = weaponItem("gs", greatsword.id, "Greatsword");
    const ls = weaponItem("ls", longsword.id, "Longsword");
    const sh = shieldItem("sh");
    const inventory = [gs, ls, sh];
    const equipped = { mainHand: "ls", offHand: "ls" };
    const next = applyEquipWithHandRules(inventory, equipped, "gs", "mainHand", index);
    expect(next?.mainHand).toBe("gs");
    expect(next?.offHand).toBeUndefined();
  });

  it("does not leave the same weapon in main and off hand", () => {
    const ls = weaponItem("ls", longsword.id, "Longsword");
    const inMain = applyEquipWithHandRules([ls], {}, "ls", "mainHand", index);
    const inOff = applyEquipWithHandRules([ls], inMain ?? {}, "ls", "offHand", index);
    expect(inOff?.mainHand).toBeUndefined();
    expect(inOff?.offHand).toBe("ls");
  });

  it("replaces shield when equipping weapon to off hand", () => {
    const ls = weaponItem("ls", longsword.id, "Longsword");
    const sh = shieldItem("sh");
    const next = applyEquipWithHandRules([ls, sh], { offHand: "sh" }, "ls", "offHand", index);
    expect(next?.offHand).toBe("ls");
  });

  it("replaces off-hand weapon when equipping shield", () => {
    const ls = weaponItem("ls", longsword.id, "Longsword");
    const sh = shieldItem("sh");
    const next = applyEquipWithHandRules([ls, sh], { offHand: "ls" }, "sh", "offHand", index);
    expect(next?.offHand).toBe("sh");
  });

  it("migrates legacy shield slot to off hand", () => {
    const sh = shieldItem("sh");
    expect(normalizeEquippedSlots({ shield: "sh" })).toEqual({ offHand: "sh" });
    const options = equipOptionsForInventoryItem(sh, [sh], {}, index);
    expect(options[0]?.slot).toBe("offHand");
  });

  it("clears two-handed main hand when equipping a shield off hand", () => {
    const gs = weaponItem("gs", greatsword.id, "Greatsword");
    const sh = shieldItem("sh");
    const options = equipOptionsForInventoryItem(sh, [gs, sh], { mainHand: "gs" }, index);
    expect(options[0]?.disabled).toBe(false);
    expect(options[0]?.hint).toContain("Clears two-handed");

    const next = applyEquipWithHandRules([gs, sh], { mainHand: "gs" }, "sh", "offHand", index);
    expect(next?.mainHand).toBeUndefined();
    expect(next?.offHand).toBe("sh");
  });

  it("clears two-handed main hand when equipping an off-hand weapon", () => {
    const gs = weaponItem("gs", greatsword.id, "Greatsword");
    const ls = weaponItem("ls", longsword.id, "Longsword");
    const next = applyEquipWithHandRules([gs, ls], { mainHand: "gs" }, "ls", "offHand", index);
    expect(next?.mainHand).toBeUndefined();
    expect(next?.offHand).toBe("ls");
  });

  it("notes versatile weapons in main hand", () => {
    expect(wieldNoteForWeaponInHand(warhammer, "mainHand")).toContain("+1 damage");
    expect(wieldNoteForWeaponInHand(warhammer, "mainHand", {})).toContain("Wielded two-handed");
  });

  it("applies flat +1 damage when versatile is wielded two-handed", () => {
    expect(versatileTwoHandedDamageBonus(warhammer, "mainHand", {})).toBe(1);
    expect(versatileTwoHandedDamageBonus(warhammer, "mainHand", { offHand: "sh" })).toBe(0);
    expect(formatWeaponDamageNotation("1d10", 1)).toBe("1d10 +1");

    const scores = { STR: 16, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 10 };
    const summary = summarizeMainWeaponAttack(5, scores, warhammer, "Military melee", 0, [], "mainHand", {});
    expect(summary?.damageNotation).toBe("1d10 +1");
  });

  it("offers equip buttons for body armor, implements, and magic gear", () => {
    const plate: Armor = {
      id: "armor_plate",
      name: "Plate Armor",
      slug: "plate",
      armorType: "Heavy",
      armorBonus: 8,
      raw: {}
    };
    const orb = { id: "orb1", name: "Orb", slug: "orb", implementGroup: "Orb", raw: {} };
    const indexWithGear: RulesIndex = {
      ...index,
      armors: [lightShield, plate],
      implements: [orb],
      magicItems: [cloak]
    };
    const armorItem: InventoryItem = {
      id: "armor-1",
      name: "Plate Armor",
      kind: "armor",
      quantity: 1,
      sourceId: plate.id,
      slotHints: ["armor"]
    };
    const implementItem: InventoryItem = {
      id: "impl-1",
      name: "Orb",
      kind: "implement",
      quantity: 1,
      sourceId: orb.id,
      slotHints: ["implement", "mainHand", "offHand"]
    };
    const neckItem: InventoryItem = {
      id: "neck-1",
      name: "Cloak of Resistance +1",
      kind: "gear",
      quantity: 1,
      sourceId: cloak.id,
      slotHints: ["neck"]
    };

    expect(equipOptionsForInventoryItem(armorItem, [armorItem], {}, indexWithGear).map((o) => o.slot)).toEqual([
      "armor"
    ]);
    expect(equipOptionsForInventoryItem(implementItem, [implementItem], {}, indexWithGear).map((o) => o.slot)).toEqual([
      "implement"
    ]);
    expect(equipOptionsForInventoryItem(neckItem, [neckItem], {}, indexWithGear).map((o) => o.slot)).toEqual(["neck"]);
  });

  it("prefers main hand for auto-equip", () => {
    const ls = weaponItem("ls", longsword.id, "Longsword");
    expect(firstValidWeaponEquipSlot(ls, [ls], {}, index)).toBe("mainHand");
  });
});
