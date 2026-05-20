import { describe, expect, it } from "vitest";
import {
  applyRacialBonuses,
  parseAbilityBonusFromRacialTrait,
  parseRaceAbilityBonusInfo,
  resolveRaceAbilityBonusInfo
} from "../../src/rules/abilityScores";
import { Race, RacialTrait } from "../../src/rules/models";

function raceWithAbilityScores(text: string): Race {
  return {
    id: "r1",
    name: "Test",
    slug: "test",
    raw: { specific: { "Ability Scores": text } }
  };
}

describe("parseRaceAbilityBonusInfo", () => {
  it("parses fixed + comma + or-choice (Drow-style)", () => {
    const info = parseRaceAbilityBonusInfo(raceWithAbilityScores("+2 Dexterity, +2 Charisma or +2 Wisdom"));
    expect(info.fixed).toEqual(["DEX"]);
    expect(info.chooseOne.sort()).toEqual(["CHA", "WIS"].sort());
  });

  it("parses fixed + semicolon + or-choice", () => {
    const info = parseRaceAbilityBonusInfo(raceWithAbilityScores("+2 Charisma; +2 Dexterity or +2 Intelligence"));
    expect(info.fixed).toEqual(["CHA"]);
    expect(info.chooseOne.sort()).toEqual(["DEX", "INT"].sort());
  });

  it("parses two fixed bonuses with comma only", () => {
    const info = parseRaceAbilityBonusInfo(raceWithAbilityScores("+2 Dexterity, +2 Strength"));
    expect(info.fixed.sort()).toEqual(["DEX", "STR"].sort());
    expect(info.chooseOne).toEqual([]);
  });

  it("parses only an or-choice (no fixed)", () => {
    const info = parseRaceAbilityBonusInfo(raceWithAbilityScores("+2 Strength or +2 Wisdom"));
    expect(info.fixed).toEqual([]);
    expect(info.chooseOne.sort()).toEqual(["STR", "WIS"].sort());
  });

  it("parses Half-Elf style", () => {
    const info = parseRaceAbilityBonusInfo(raceWithAbilityScores("+2 Constitution, +2 Wisdom or +2 Charisma"));
    expect(info.fixed).toEqual(["CON"]);
    expect(info.chooseOne.sort()).toEqual(["CHA", "WIS"].sort());
  });

  it("parses second or branch without +2 prefix", () => {
    const info = parseRaceAbilityBonusInfo(raceWithAbilityScores("+2 Wisdom; +2 Strength or Dexterity"));
    expect(info.fixed).toEqual(["WIS"]);
    expect(info.chooseOne.sort()).toEqual(["DEX", "STR"].sort());
  });

  it("treats Human as pick any one ability", () => {
    const info = parseRaceAbilityBonusInfo(raceWithAbilityScores("+2 to one ability score of your choice"));
    expect(info.fixed).toEqual([]);
    expect(info.chooseOne).toHaveLength(6);
  });

  it("returns empty for See the Race Chosen", () => {
    expect(parseRaceAbilityBonusInfo(raceWithAbilityScores("See the Race Chosen"))).toEqual({ fixed: [], chooseOne: [] });
  });

  it("fills chooseOne from rules.select when ability text has no choice", () => {
    const race: Race = {
      id: "r1",
      name: "Synth",
      slug: "synth",
      raw: {
        specific: { "Ability Scores": "+2 Strength, +2 Constitution" },
        rules: {
          select: [{ attrs: { type: "Race Ability Bonus", number: "1", Category: "Intelligence|Wisdom" } }]
        }
      }
    };
    const info = parseRaceAbilityBonusInfo(race);
    expect(info.fixed.sort()).toEqual(["CON", "STR"].sort());
    expect(info.chooseOne.sort()).toEqual(["INT", "WIS"].sort());
  });

  it("does not put choice abilities into fixed (regression)", () => {
    const info = parseRaceAbilityBonusInfo(raceWithAbilityScores("+2 Dexterity, +2 Charisma or +2 Constitution"));
    expect(info.fixed).not.toContain("CHA");
    expect(info.fixed).not.toContain("CON");
  });
});

describe("parseAbilityBonusFromRacialTrait", () => {
  it("reads fixed Charisma grant and Strength|Constitution select (standard Dragonborn)", () => {
    const trait: RacialTrait = {
      id: "TR_STD",
      name: "Standard Dragonborn Racial Traits",
      slug: "std",
      raw: {
        rules: {
          grant: [{ attrs: { name: "ID_INTERNAL_RACE_ABILITY_BONUS_CHARISMA", type: "Race Ability Bonus" } }],
          select: [{ attrs: { type: "Race Ability Bonus", number: "1", Category: "Strength|Constitution" } }]
        }
      }
    };
    expect(parseAbilityBonusFromRacialTrait(trait)).toEqual({
      fixed: ["CHA"],
      chooseOne: ["STR", "CON"]
    });
  });

  it("reads Dexterity and Charisma grants from a child trait (Kapak Sinuous Agility)", () => {
    const trait: RacialTrait = {
      id: "TR_SIN",
      name: "Sinuous Agility",
      slug: "sin",
      raw: {
        rules: {
          grant: [
            { attrs: { name: "ID_INTERNAL_RACE_ABILITY_BONUS_CHARISMA", type: "Race Ability Bonus" } },
            { attrs: { name: "ID_INTERNAL_RACE_ABILITY_BONUS_DEXTERITY", type: "Race Ability Bonus" } }
          ]
        }
      }
    };
    expect(parseAbilityBonusFromRacialTrait(trait)).toEqual({
      fixed: ["CHA", "DEX"],
      chooseOne: []
    });
  });
});

describe("resolveRaceAbilityBonusInfo", () => {
  const dragonborn: Race = {
    id: "R_DB",
    name: "Dragonborn",
    slug: "dragonborn",
    abilitySummary: "See the Race Chosen",
    raw: { specific: { "Ability Scores": "See the Race Chosen", "Racial Traits": "TR_SUB" } }
  };
  const standard: RacialTrait = {
    id: "TR_STD",
    name: "Standard Dragonborn Racial Traits",
    slug: "std",
    raw: {
      specific: { _PARSED_SUB_FEATURES: "TR_CHILD" },
      rules: {
        grant: [{ attrs: { name: "ID_INTERNAL_RACE_ABILITY_BONUS_CHARISMA", type: "Race Ability Bonus" } }],
        select: [{ attrs: { type: "Race Ability Bonus", number: "1", Category: "Strength|Constitution" } }]
      }
    }
  };
  const parent: RacialTrait = {
    id: "TR_SUB",
    name: "Dragonborn Subrace",
    slug: "dragonborn-subrace",
    raw: { specific: { _PARSED_SUB_FEATURES: "TR_STD" } }
  };
  const byId = new Map<string, RacialTrait>([
    ["TR_SUB", parent],
    ["TR_STD", standard]
  ]);

  it("returns empty until a subrace variant is selected", () => {
    expect(resolveRaceAbilityBonusInfo(dragonborn, byId, {})).toEqual({ fixed: [], chooseOne: [] });
  });

  it("resolves bonuses from the selected subrace variant", () => {
    expect(resolveRaceAbilityBonusInfo(dragonborn, byId, { subrace: "TR_STD" })).toEqual({
      fixed: ["CHA"],
      chooseOne: ["STR", "CON"]
    });
  });
});

describe("applyRacialBonuses", () => {
  it("applies Drow-style parse", () => {
    const info = parseRaceAbilityBonusInfo(raceWithAbilityScores("+2 Dexterity, +2 Charisma or +2 Wisdom"));
    const base = { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 10 };
    const out = applyRacialBonuses(base, info, "CHA");
    expect(out.DEX).toBe(12);
    expect(out.CHA).toBe(12);
    expect(out.WIS).toBe(10);
  });
});
