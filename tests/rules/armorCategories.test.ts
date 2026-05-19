import { describe, expect, it } from "vitest";
import {
  armorsInCategory,
  formatArmorMaterialLabel,
  sortedArmorCategories,
  BODY_ARMOR_CATEGORY_ORDER
} from "../../src/rules/armorCategories";
import type { Armor } from "../../src/rules/models";

const leather: Armor = {
  id: "leather",
  name: "Leather Armor",
  slug: "leather-armor",
  armorType: "Light",
  armorCategory: "Leather",
  armorBonus: 2,
  raw: {}
};

const starleather: Armor = {
  id: "star",
  name: "Starleather Armor",
  slug: "starleather",
  armorType: "Light",
  armorCategory: "Leather",
  armorBonus: 3,
  raw: {}
};

const hide: Armor = {
  id: "hide",
  name: "Hide Armor",
  slug: "hide",
  armorType: "Light",
  armorCategory: "Hide",
  armorBonus: 3,
  raw: {}
};

describe("armorCategories", () => {
  it("sorts categories in equipment-picker order", () => {
    const cats = sortedArmorCategories([hide, starleather, leather], BODY_ARMOR_CATEGORY_ORDER);
    expect(cats).toEqual(["Leather", "Hide"]);
  });

  it("lists materials within a category sorted by name", () => {
    const list = armorsInCategory([starleather, leather, hide], "Leather");
    expect(list.map((a) => a.id)).toEqual(["leather", "star"]);
  });

  it("formats material labels with AC bonus", () => {
    expect(formatArmorMaterialLabel(starleather)).toBe("Starleather Armor (+3 AC)");
  });
});
