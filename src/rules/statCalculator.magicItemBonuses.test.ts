import { describe, expect, it } from "vitest";
import { computeDerivedStats } from "./statCalculator";
import type { CharacterBuild, ClassDef, MagicItem, Race, RulesIndex } from "./models";
import { computeMagicItemCombatBonuses } from "./magicItemEquipment";

const race: Race = {
  id: "r1",
  name: "Human",
  speed: 6,
  raw: {}
} as Race;

const cls: ClassDef = {
  id: "c1",
  name: "Fighter",
  hitPointsAt1: 15,
  hitPointsPerLevel: 6,
  healingSurgesBase: 9,
  raw: {}
} as ClassDef;

const cloak: MagicItem = {
  id: "ID_TEST_NECK",
  name: "Cloak of Resistance +1",
  slug: "cloak",
  level: 4,
  magicItemType: "Neck Slot Item",
  statAdds: [
    { name: "Fortitude Defense", value: "+1" },
    { name: "Reflex Defense", value: "+1" },
    { name: "Will Defense", value: "+1" }
  ],
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
  magicItems: [cloak]
};

describe("computeDerivedStats equipped magic items", () => {
  it("adds defense bonuses from equipped magic item statAdds", () => {
    const baseBuild: CharacterBuild = {
      name: "Hero",
      level: 4,
      abilityScores: { STR: 16, CON: 14, DEX: 12, INT: 10, WIS: 10, CHA: 8 },
      trainedSkillIds: [],
      featIds: [],
      powerIds: []
    };
    const withNeck: CharacterBuild = {
      ...baseBuild,
      magicItemIds: { neck: cloak.id }
    };
    const magicDefense = computeMagicItemCombatBonuses(index, withNeck).defenses;
    const baseline = computeDerivedStats(baseBuild, race, cls, undefined, undefined);
    const merged = computeDerivedStats(
      withNeck,
      race,
      cls,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      magicDefense
    );
    expect(merged.defenses.fortitude).toBe(baseline.defenses.fortitude + 1);
    expect(merged.defenses.reflex).toBe(baseline.defenses.reflex + 1);
    expect(merged.defenses.will).toBe(baseline.defenses.will + 1);
  });
});
