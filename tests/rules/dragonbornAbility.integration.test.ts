import { existsSync, readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { applyRacialBonuses, resolveRaceAbilityBonusInfo } from "../../src/rules/abilityScores";
import type { RacialTrait, RulesIndex } from "../../src/rules/models";
import { getRaceSubraceData } from "../../src/rules/raceSubraces";

const rulesIndexPath = "generated/rules_index.json";

describe.skipIf(!existsSync(rulesIndexPath))("Dragonborn subrace ability bonuses (generated index)", () => {
  let index: RulesIndex;
  let dragonbornId: string;
  let traitsById: Map<string, RacialTrait>;

  beforeAll(() => {
    const raw = readFileSync(rulesIndexPath, "utf-8");
    index = JSON.parse(raw) as RulesIndex;
    const race = index.races.find((r) => r.name === "Dragonborn");
    expect(race).toBeDefined();
    dragonbornId = race!.id;
    traitsById = new Map((index.racialTraits ?? []).map((t) => [t.id, t]));
  });

  it("defers to subrace until a variant is chosen", () => {
    const race = index.races.find((r) => r.id === dragonbornId)!;
    expect(resolveRaceAbilityBonusInfo(race, traitsById, {})).toEqual({ fixed: [], chooseOne: [] });
  });

  it("Standard and Bozak grant +2 Charisma and choose Strength or Constitution", () => {
    const race = index.races.find((r) => r.id === dragonbornId)!;
    const sub = getRaceSubraceData(race, traitsById);
    expect(sub).toBeDefined();
    for (const name of ["Standard Dragonborn Racial Traits", "Bozak Draconian"]) {
      const opt = sub!.options.find((o) => o.name === name);
      expect(opt, name).toBeDefined();
      const info = resolveRaceAbilityBonusInfo(race, traitsById, { subrace: opt!.id });
      expect(info.fixed).toContain("CHA");
      expect(info.chooseOne.sort()).toEqual(["CON", "STR"].sort());
      const scores = applyRacialBonuses(
        { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 10 },
        info,
        "STR"
      );
      expect(scores.CHA).toBe(12);
      expect(scores.STR).toBe(12);
      expect(scores.CON).toBe(10);
    }
  });

  it("Kapak grants +2 Charisma and +2 Dexterity with no further choice", () => {
    const race = index.races.find((r) => r.id === dragonbornId)!;
    const sub = getRaceSubraceData(race, traitsById);
    const kapak = sub!.options.find((o) => o.name === "Kapak Draconian");
    expect(kapak).toBeDefined();
    const info = resolveRaceAbilityBonusInfo(race, traitsById, { subrace: kapak!.id });
    expect(info.fixed.sort()).toEqual(["CHA", "DEX"].sort());
    expect(info.chooseOne).toEqual([]);
  });
});
