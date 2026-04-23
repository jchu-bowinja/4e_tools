import { describe, expect, it } from "vitest";
import { groupCombatPowers } from "../../src/features/characterSheet/selectors";
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
    deathSaves: 0
  },
  inventory: [],
  equipment: {},
  powers: {
    selectedPowerIds: ["power_selected"],
    expendedPowerIds: []
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
