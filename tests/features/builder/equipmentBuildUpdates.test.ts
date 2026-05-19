import { describe, expect, it } from "vitest";
import {
  setMagicOnlySlotEnchantmentFamily,
  setNeckEnchantmentFamily,
  setNeckEnhancement,
  setStandardSlotEnchantmentFamily,
  setStandardSlotEnhancement
} from "../../../src/features/builder/equipmentBuildUpdates";
import { magicHeadOptions, magicNeckOptions } from "../../../src/features/builder/magicItemOptions";
import type { CharacterBuild, MagicItem, RulesIndex } from "../../../src/rules/models";

const cloakVariants: MagicItem[] = [1, 2, 3].map((n) => ({
  id: `ID_CLOAK_${n}`,
  name: `Cloak of Resistance +${n}`,
  slug: `cloak-of-resistance-${n}`,
  magicItemType: "Neck Slot Item",
  enhancementBonus: n,
  statAdds: [{ name: "Fortitude Defense", value: `+${n}` }],
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
  magicItems: cloakVariants
};

const base: CharacterBuild = {
  name: "Hero",
  level: 5,
  abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 10 },
  trainedSkillIds: [],
  featIds: [],
  powerIds: []
};

describe("equipmentBuildUpdates", () => {
  it("sets enchantment family with lowest default plus", () => {
    const catalog = magicNeckOptions(index);
    const next = setNeckEnchantmentFamily(base, index, "cloak-of-resistance", catalog);
    expect(next.equipment?.neck?.enchantmentId).toBe("ID_CLOAK_1");
    expect(next.equipment?.neck?.enhancement).toBe(1);
  });

  it("re-resolves compendium row when plus changes", () => {
    const catalog = magicNeckOptions(index);
    let build = setNeckEnchantmentFamily(base, index, "cloak-of-resistance", catalog);
    build = setNeckEnhancement(build, index, 3, catalog);
    expect(build.equipment?.neck?.enchantmentId).toBe("ID_CLOAK_3");
    expect(build.equipment?.neck?.enhancement).toBe(3);
  });

  it("sets head slot enchantment and omits empty slot from equipment", () => {
    const helm: MagicItem = {
      id: "ID_HELM",
      name: "Helm of Eyes",
      slug: "helm-of-eyes",
      magicItemType: "Head Slot Item",
      raw: {}
    };
    const headIndex: RulesIndex = { ...index, magicItems: [helm] };
    const catalog = magicHeadOptions(headIndex);
    const next = setMagicOnlySlotEnchantmentFamily(base, headIndex, "head", "helm-of-eyes", catalog);
    expect(next.equipment?.head?.enchantmentId).toBe("ID_HELM");
    const cleared = setMagicOnlySlotEnchantmentFamily(next, headIndex, "head", undefined, catalog);
    expect(cleared.equipment?.head).toBeUndefined();
  });

  it("sets weapon family on main hand", () => {
    const weapon: MagicItem = {
      id: "W1",
      name: "Flaming Sword +1",
      slug: "flaming-sword-1",
      magicItemType: "Weapon",
      enhancementBonus: 1,
      raw: {}
    };
    const sword2: MagicItem = {
      id: "W2",
      name: "Flaming Sword +2",
      slug: "flaming-sword-2",
      magicItemType: "Weapon",
      enhancementBonus: 2,
      raw: {}
    };
    const weaponIndex: RulesIndex = { ...index, magicItems: [weapon, sword2] };
    const catalog = [weapon, sword2];
    const next = setStandardSlotEnchantmentFamily(base, weaponIndex, "mainHand", "flaming-sword", catalog);
    expect(next.equipment?.mainHand?.enchantmentId).toBe("W1");
    const bumped = setStandardSlotEnhancement(next, weaponIndex, "mainHand", 2, catalog);
    expect(bumped.equipment?.mainHand?.enchantmentId).toBe("W2");
  });
});
