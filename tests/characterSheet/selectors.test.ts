import { describe, expect, it } from "vitest";
import { computeSheetDerivedData, findWeaponEquippedInSlot, groupCombatPowers } from "../../src/features/characterSheet/selectors";
import type { CharacterSheetState } from "../../src/features/characterSheet/model";
import type { RulesIndex } from "../../src/rules/models";

const index: RulesIndex = {
  meta: { version: 1, counts: {} },
  races: [
    {
      id: "race_human",
      name: "Human",
      slug: "human",
      raw: { specific: { "Racial Traits": "trait_racial_power" } }
    }
  ],
  classes: [{ id: "class_fighter", name: "Fighter", slug: "fighter", raw: {} }],
  feats: [],
  powers: [
    {
      id: "power_selected",
      name: "Selected At-Will",
      slug: "selected-at-will",
      classId: "class_fighter",
      usage: "At-Will",
      level: 1,
      raw: { specific: { "Power Type": "Attack" } }
    },
    {
      id: "power_class_auto",
      name: "Class Granted Encounter",
      slug: "class-granted-encounter",
      classId: "class_fighter",
      usage: "Encounter",
      level: 1,
      raw: { specific: { "Power Type": "Attack" } }
    },
    {
      id: "ID_FMP_POWER_3",
      name: "Racial Granted Daily",
      slug: "racial-granted-daily",
      usage: "Daily",
      level: 1,
      raw: { specific: { "Power Type": "Attack" } }
    },
    {
      id: "power_theme",
      name: "Theme Utility",
      slug: "theme-utility",
      classId: "theme_guardian",
      usage: "Daily",
      level: 2,
      raw: { specific: { "Power Type": "Utility" } }
    },
    {
      id: "power_paragon",
      name: "Path Encounter",
      slug: "path-encounter",
      classId: "path_ironvanguard",
      usage: "Encounter",
      level: 11,
      raw: { specific: { "Power Type": "Attack" } }
    },
    {
      id: "power_epic",
      name: "Destiny Daily",
      slug: "destiny-daily",
      classId: "destiny_demigod",
      usage: "Daily",
      level: 21,
      raw: { specific: { "Power Type": "Attack" } }
    }
  ],
  skills: [],
  languages: [],
  armors: [],
  weapons: [],
  implements: [],
  abilityScores: [],
  racialTraits: [
    {
      id: "trait_racial_power",
      name: "Racial Power Trait",
      slug: "racial-power-trait",
      raw: {
        specific: { Powers: "ID_FMP_POWER_3" },
        rules: {}
      }
    }
  ],
  themes: [{ id: "theme_guardian", name: "Guardian", slug: "guardian", prereqTokens: [], raw: {} }],
  paragonPaths: [{ id: "path_ironvanguard", name: "Iron Vanguard", slug: "iron-vanguard", prereqTokens: [], raw: {} }],
  epicDestinies: [{ id: "destiny_demigod", name: "Demigod", slug: "demigod", prereqTokens: [], raw: {} }],
  autoGrantedPowerIdsByClassId: {
    class_fighter: ["power_class_auto"]
  }
};

const state: CharacterSheetState = {
  name: "Hero",
  level: 21,
  raceId: "race_human",
  classId: "class_fighter",
  themeId: "theme_guardian",
  paragonPathId: "path_ironvanguard",
  epicDestinyId: "destiny_demigod",
  abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 10 },
  trainedSkillIds: [],
  resources: {
    currentHp: 10,
    tempHp: 0,
    surgesRemaining: 5,
    deathSaves: 0,
    conditions: []
  },
  inventory: [],
  equipment: {},
  powers: {
    selectedPowerIds: ["power_selected"],
    expendedPowerIds: [],
    manualOrderIds: []
  }
};

describe("groupCombatPowers", () => {
  it("includes selected, auto-class, and race-granted powers in correct buckets", () => {
    const grouped = groupCombatPowers(state, index);
    expect(grouped.atWill.map((power) => power.id)).toContain("power_selected");
    expect(grouped.encounter.map((power) => power.id)).toContain("power_class_auto");
    expect(grouped.encounter.map((power) => power.id)).toContain("power_paragon");
    expect(grouped.daily.map((power) => power.id)).toContain("ID_FMP_POWER_3");
    expect(grouped.daily.map((power) => power.id)).toContain("power_epic");
    expect(grouped.daily.map((power) => power.id)).toContain("power_theme");
  });
});

describe("computeSheetDerivedData", () => {
  it("includes class Bonus to Defense on NADs like the builder", () => {
    const fighterClass = {
      id: "class_fighter",
      name: "Fighter",
      slug: "fighter",
      hitPointsAt1: 15,
      hitPointsPerLevel: 6,
      healingSurgesBase: 9,
      raw: { specific: { "Bonus to Defense": "+2 Fortitude" } }
    };
    const idx: RulesIndex = {
      ...index,
      classes: [fighterClass as never]
    };
    const st: CharacterSheetState = {
      ...state,
      level: 1,
      classId: "class_fighter",
      abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 10 },
      powers: { selectedPowerIds: [], expendedPowerIds: [], manualOrderIds: [] }
    };
    const derived = computeSheetDerivedData(st, idx);
    expect(derived.defenses.fortitude).toBe(10 + 2);
    expect(derived.acBreakdown.total).toBe(derived.defenses.ac);
  });

  it("uses hybrid defense bonuses when characterStyle is hybrid", () => {
    const fighterBase = {
      id: "class_fighter",
      name: "Fighter",
      slug: "fighter",
      hitPointsAt1: 15,
      hitPointsPerLevel: 6,
      healingSurgesBase: 9,
      raw: {}
    };
    const clericBase = {
      id: "class_cleric",
      name: "Cleric",
      slug: "cleric",
      hitPointsAt1: 12,
      hitPointsPerLevel: 5,
      healingSurgesBase: 7,
      raw: {}
    };
    const hyA = {
      id: "hy_ftr",
      name: "Hybrid Fighter",
      slug: "hy-ftr",
      baseClassId: "class_fighter",
      hitPointsAt1: 15,
      hitPointsPerLevel: 6,
      healingSurgesBase: 9,
      bonusToDefense: "+1 Reflex",
      raw: {}
    };
    const hyB = {
      id: "hy_clr",
      name: "Hybrid Cleric",
      slug: "hy-clr",
      baseClassId: "class_cleric",
      hitPointsAt1: 12,
      hitPointsPerLevel: 5,
      healingSurgesBase: 7,
      bonusToDefense: "+1 Reflex",
      raw: {}
    };
    const idx: RulesIndex = {
      ...index,
      classes: [fighterBase as never, clericBase as never],
      hybridClasses: [hyA as never, hyB as never]
    };
    const st: CharacterSheetState = {
      name: "Hybrid",
      level: 1,
      raceId: "race_human",
      characterStyle: "hybrid",
      hybridClassIdA: "hy_ftr",
      hybridClassIdB: "hy_clr",
      abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 10 },
      trainedSkillIds: [],
      resources: {
        currentHp: 1,
        tempHp: 0,
        surgesRemaining: 1,
        deathSaves: 0,
        conditions: []
      },
      inventory: [],
      equipment: {},
      powers: { selectedPowerIds: [], expendedPowerIds: [], manualOrderIds: [] }
    };
    const derived = computeSheetDerivedData(st, idx);
    expect(derived.defenses.reflex).toBe(10 + 2);
  });
});

describe("findWeaponEquippedInSlot", () => {
  it("returns rules weapon from equipped inventory main hand", () => {
    const idx: RulesIndex = {
      ...index,
      weapons: [
        {
          id: "w_longsword",
          name: "Longsword",
          slug: "longsword",
          weaponCategory: "Military Melee",
          proficiencyBonus: 3,
          damage: "1d8",
          raw: {}
        } as never
      ]
    };
    const st: CharacterSheetState = {
      ...state,
      inventory: [
        {
          id: "inv-w1",
          name: "Longsword",
          kind: "weapon",
          quantity: 1,
          sourceId: "w_longsword",
          slotHints: ["mainHand", "offHand"]
        }
      ],
      equipment: { mainHand: "inv-w1" }
    };
    const w = findWeaponEquippedInSlot(st, idx, "mainHand");
    expect(w?.id).toBe("w_longsword");
  });
});
