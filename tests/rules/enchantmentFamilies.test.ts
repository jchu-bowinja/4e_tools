import { describe, expect, it } from "vitest";
import {
  formatEnchantmentFamilyLabel,
  groupMagicItemsIntoFamilies,
  magicItemFamilyKey,
  resolveEnchantmentIdForFamily,
  resolveMagicItemInFamily
} from "../../src/rules/enchantmentFamilies";
import type { MagicItem, RulesIndex } from "../../src/rules/models";

const blackIronVariants: MagicItem[] = [1, 2, 3, 4, 5, 6].map((n) => ({
  id: `ID_BLACK_IRON_${n}`,
  name: `Black Iron Armor +${n}`,
  slug: `black-iron-armor-${n}`,
  level: 8 + n,
  magicItemType: "Armor",
  enhancementBonus: n,
  statAdds: [{ name: "resist:fire", value: `+${n * 5}`, type: "resist" }],
  raw: {}
}));

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
  magicItems: blackIronVariants
};

describe("enchantmentFamilies", () => {
  it("groups plus variants under one family key", () => {
    const families = groupMagicItemsIntoFamilies(blackIronVariants);
    expect(families).toHaveLength(1);
    expect(families[0].key).toBe("black-iron-armor");
    expect(families[0].allowedEnhancements).toEqual([1, 2, 3, 4, 5, 6]);
    expect(formatEnchantmentFamilyLabel(families[0])).toBe("Black Iron Armor (+1–+6)");
  });

  it("resolves compendium row id for family and plus", () => {
    const key = magicItemFamilyKey(blackIronVariants[0]);
    const id = resolveEnchantmentIdForFamily(index, key, 4, blackIronVariants[0]);
    expect(id).toBe("ID_BLACK_IRON_4");
    const row = resolveMagicItemInFamily(blackIronVariants, 4);
    expect(row?.statAdds?.[0].value).toBe("+20");
  });
});
