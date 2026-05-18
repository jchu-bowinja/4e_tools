import { describe, expect, it } from "vitest";
import { equipmentEnchantmentEffects } from "../../src/rules/equipmentEnchantmentEffects";
import type { MagicItem, RulesIndex } from "../../src/rules/models";

const flaming: MagicItem = {
  id: "ID_FLAMING",
  name: "Flaming Weapon +1",
  slug: "flaming-weapon-1",
  property: "Each attack deals extra fire damage.",
  power: "Daily: burst 1 fire damage.",
  raw: {}
};

const plain: MagicItem = {
  id: "ID_PLAIN",
  name: "Plain +1",
  slug: "plain-1",
  enhancementBonus: 1,
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
  magicItems: [flaming, plain]
};

describe("equipmentEnchantmentEffects", () => {
  it("returns property and power text for enchanted slots", () => {
    const rows = equipmentEnchantmentEffects(
      {
        mainHand: { baseId: "W1", enchantmentId: flaming.id, enhancement: 1 },
        neck: { enhancement: 0 }
      },
      index
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].slotLabel).toBe("Main hand");
    expect(rows[0].name).toBe("Flaming Weapon");
    expect(rows[0].property).toContain("fire");
    expect(rows[0].power).toContain("Daily");
  });

  it("omits slots with enhancement-only magic rows", () => {
    const rows = equipmentEnchantmentEffects(
      {
        armor: { baseId: "A1", enchantmentId: plain.id, enhancement: 1 },
        neck: { enhancement: 0 }
      },
      index
    );
    expect(rows).toEqual([]);
  });
});
