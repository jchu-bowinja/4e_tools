import { describe, expect, it } from "vitest";
import {
  describeArmor,
  describeMagicItem,
  describeWeapon,
  hasMagicItemDescription
} from "../../src/rules/equipmentDescriptions";
import type { Armor, MagicItem, Weapon } from "../../src/rules/models";

describe("equipmentDescriptions", () => {
  it("uses compendium body for armor when present", () => {
    const armor: Armor = {
      id: "a1",
      name: "Leather Armor",
      slug: "leather",
      armorBonus: 2,
      raw: { body: "Light armor worn by scouts." }
    };
    expect(describeArmor(armor)).toBe("Light armor worn by scouts.");
  });

  it("falls back to armor stats when body is missing", () => {
    const armor: Armor = {
      id: "a1",
      name: "Plate Armor",
      slug: "plate",
      armorType: "Heavy",
      armorCategory: "Plate",
      armorBonus: 8,
      raw: {}
    };
    expect(describeArmor(armor)).toContain("Armor bonus +8");
  });

  it("describes magic item property and power", () => {
    const item: MagicItem = {
      id: "m1",
      name: "Flaming Weapon +1",
      slug: "flaming-1",
      property: "Each hit deals extra fire damage.",
      power: "Daily: burst 1 fire 2.",
      raw: {}
    };
    const desc = describeMagicItem(item);
    expect(hasMagicItemDescription(desc)).toBe(true);
    expect(desc.property).toContain("fire");
    expect(desc.power).toContain("Daily");
  });

  it("describes weapon from stats when body is missing", () => {
    const weapon: Weapon = {
      id: "w1",
      name: "Longsword",
      slug: "longsword",
      damage: "1d8",
      weaponGroup: "Heavy Blade",
      raw: {}
    };
    expect(describeWeapon(weapon)).toContain("Damage 1d8");
  });
});
