import { describe, expect, it } from "vitest";
import { classifyBodyArmor, computeAcBreakdown } from "../../src/rules/defenseCalculator";

describe("defenseCalculator", () => {
  it("computes heavy armor AC without dexterity", () => {
    const armor = {
      armorBonus: 6,
      armorCategory: "Chain",
      armorType: "Heavy"
    } as never;
    const bd = computeAcBreakdown(4, 3, armor, undefined, 1);
    expect(bd.halfLevel).toBe(0);
    expect(bd.abilityBonus).toBe(0);
    expect(bd.total).toBe(16);
    expect(classifyBodyArmor(armor)).toBe("heavy");
  });

  it("includes half level in AC total", () => {
    const armor = {
      armorBonus: 6,
      armorCategory: "Chain",
      armorType: "Heavy"
    } as never;
    const bd = computeAcBreakdown(4, 3, armor, undefined, 10);
    expect(bd.halfLevel).toBe(5);
    expect(bd.total).toBe(21);
  });

  it("uses Intelligence for cloth armor AC", () => {
    const armor = {
      armorBonus: 2,
      armorCategory: "Cloth",
      armorType: "Light"
    } as never;
    const bd = computeAcBreakdown(4, 3, armor, undefined, 1);
    expect(bd.abilityLabel).toBe("INT");
    expect(bd.abilityBonus).toBe(3);
    expect(bd.total).toBe(15);
  });
});
