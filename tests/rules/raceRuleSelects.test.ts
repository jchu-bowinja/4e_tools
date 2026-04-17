import { describe, expect, it } from "vitest";
import {
  abilitiesFromRaceAbilitySelects,
  getRaceSecondarySelectSlots,
  selectableStartingLanguages
} from "../../src/rules/raceRuleSelects";
import { LanguageDef, Race } from "../../src/rules/models";

describe("getRaceSecondarySelectSlots", () => {
  it("lists language and skill-bonus slots from rules.select", () => {
    const race: Race = {
      id: "r1",
      name: "Test",
      slug: "test",
      raw: {
        rules: {
          select: [
            { attrs: { type: "Language", number: "1", Category: "Starting" } },
            { attrs: { type: "Racial Trait", number: "1", Category: "Skill Bonus" } },
            { attrs: { type: "Racial Trait", number: "0", Category: "Skill Bonus" } }
          ]
        }
      }
    };
    const slots = getRaceSecondarySelectSlots(race);
    expect(slots.map((s) => s.kind)).toEqual(["language", "skillBonus"]);
    expect(slots.map((s) => s.key)).toEqual(["language-0", "skillBonus-0"]);
  });
});

describe("abilitiesFromRaceAbilitySelects", () => {
  it("parses Category pipe list", () => {
    const race: Race = {
      id: "r1",
      name: "Test",
      slug: "test",
      raw: {
        rules: {
          select: [{ attrs: { type: "Race Ability Bonus", number: "1", Category: "Strength|Wisdom" } }]
        }
      }
    };
    expect(abilitiesFromRaceAbilitySelects(race).sort()).toEqual(["STR", "WIS"].sort());
  });
});

describe("selectableStartingLanguages", () => {
  it("drops unselectable and All", () => {
    const langs: LanguageDef[] = [
      { id: "a", name: "Common", slug: "common", prereqsRaw: null, raw: {} },
      { id: "b", name: "All", slug: "all", prereqsRaw: null, raw: {} },
      { id: "c", name: "X", slug: "x", prereqsRaw: "Unselectable", raw: {} }
    ];
    const names = selectableStartingLanguages(langs).map((l) => l.name);
    expect(names).toEqual(["Common"]);
  });
});
