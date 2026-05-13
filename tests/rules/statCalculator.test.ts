import { describe, expect, it } from "vitest";
import { computeDerivedStats } from "../../src/rules/statCalculator";

describe("computeDerivedStats", () => {
  const baseBuild = {
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
    trainedSkillIds: [] as string[],
    featIds: [] as string[],
    powerIds: [] as string[],
    raceId: "r",
    classId: "c"
  };

  it("calculates baseline HP and defenses", () => {
    const armor = {
      armorBonus: 2,
      armorCategory: "Leather",
      armorType: "Light"
    } as never;
    const shield = { armorBonus: 1, armorCategory: "Light Shields", armorType: "Shield" } as never;
    const stats = computeDerivedStats(baseBuild, { speed: 6 } as never, { hitPointsAt1: 15, hitPointsPerLevel: 6, healingSurgesBase: 9 } as never, armor, shield, {
      Fortitude: 2
    });

    expect(stats.maxHp).toBe(29);
    expect(stats.healingSurgesPerDay).toBe(11);
    expect(stats.speed).toBe(6);
    expect(stats.defenses.ac).toBe(14);
    expect(stats.acBreakdown.armorBonus).toBe(2);
    expect(stats.acBreakdown.shieldBonus).toBe(1);
    expect(stats.acBreakdown.abilityLabel).toBe("DEX");
    expect(stats.defenses.fortitude).toBeGreaterThanOrEqual(15);
  });

  it("heavy armor ignores Dexterity bonus to AC", () => {
    const armor = {
      armorBonus: 6,
      armorCategory: "Chain",
      armorType: "Heavy",
      speedPenalty: 1
    } as never;
    const stats = computeDerivedStats(baseBuild, { speed: 6 } as never, undefined, armor, undefined, undefined);
    expect(stats.defenses.ac).toBe(16);
    expect(stats.acBreakdown.abilityBonus).toBe(0);
    expect(stats.speed).toBe(5);
  });

  it("cloth armor uses Intelligence to AC", () => {
    const build = {
      ...baseBuild,
      abilityScores: { ...baseBuild.abilityScores, DEX: 18, INT: 12 }
    };
    const armor = {
      armorBonus: 1,
      armorCategory: "Cloth",
      armorType: "Light"
    } as never;
    const stats = computeDerivedStats(build, { speed: 6 } as never, undefined, armor, undefined, undefined);
    expect(stats.acBreakdown.abilityLabel).toBe("INT");
    expect(stats.acBreakdown.abilityBonus).toBe(1);
    expect(stats.defenses.ac).toBe(12);
  });

  it("adds half level to AC and NAD defenses", () => {
    const build = { ...baseBuild, level: 6 };
    const armor = {
      armorBonus: 2,
      armorCategory: "Leather",
      armorType: "Light"
    } as never;
    const shield = { armorBonus: 1, armorCategory: "Light Shields", armorType: "Shield" } as never;
    const stats = computeDerivedStats(build, { speed: 6 } as never, { hitPointsAt1: 15, hitPointsPerLevel: 6, healingSurgesBase: 9 } as never, armor, shield, {
      Fortitude: 2
    });
    expect(stats.acBreakdown.halfLevel).toBe(3);
    expect(stats.defenses.ac).toBe(17);
    expect(stats.defenses.fortitude).toBe(10 + 3 + 3 + 2);
    expect(stats.defenses.reflex).toBe(10 + 3 + 1);
    expect(stats.defenses.will).toBe(10 + 3 + 0);
  });

  it("merges support passive defense (feats / theme / path / destiny) into totals", () => {
    const heavyArmor = {
      armorBonus: 6,
      armorCategory: "Chain",
      armorType: "Heavy",
      speedPenalty: 1
    } as never;
    const support = { ac: 1, fortitude: 0, reflex: 0, will: 2 };
    const stats = computeDerivedStats(
      baseBuild,
      { speed: 6 } as never,
      undefined,
      heavyArmor,
      undefined,
      undefined,
      support
    );
    expect(stats.defenses.ac).toBe(17);
    expect(stats.acBreakdown.supportAcBonus).toBe(1);
    expect(stats.defenses.will).toBe(12);
  });
});

