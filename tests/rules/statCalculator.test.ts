import { describe, expect, it } from "vitest";
import { computeDerivedStats } from "../../src/rules/statCalculator";

describe("computeDerivedStats", () => {
  it("calculates baseline HP and defenses", () => {
    const build = {
      name: "Hero",
      level: 1,
      abilityScores: {
        STR: 16,
        CON: 14,
        DEX: 12,
        INT: 10,
        WIS: 11,
        CHA: 8
      },
      trainedSkillIds: [],
      featIds: [],
      powerIds: [],
      raceId: "r",
      classId: "c"
    };
    const race = { speed: 6 } as never;
    const cls = { hitPointsAt1: 15, hitPointsPerLevel: 6, healingSurgesBase: 9 } as never;
    const armor = { armorBonus: 2 } as never;
    const shield = { armorBonus: 1 } as never;
    const stats = computeDerivedStats(build, race, cls, armor, shield, { Fortitude: 2 });

    expect(stats.maxHp).toBe(29);
    expect(stats.healingSurgesPerDay).toBe(11);
    expect(stats.speed).toBe(6);
    expect(stats.defenses.ac).toBeGreaterThanOrEqual(14);
    expect(stats.defenses.fortitude).toBeGreaterThanOrEqual(15);
  });
});

