import { describe, expect, it } from "vitest";
import {
  applyAsiBonusesToScores,
  expectedClassAtWillAttackSlots,
  expectedClassUtilityPowerCount,
  totalFeatSlots
} from "../../src/rules/advancement";

describe("advancement", () => {
  it("counts feat slots including 1st-level and human bonus", () => {
    expect(totalFeatSlots(1, false)).toBe(1);
    expect(totalFeatSlots(1, true)).toBe(2);
    expect(totalFeatSlots(2, false)).toBe(2);
    expect(totalFeatSlots(11, false)).toBe(7);
  });

  it("expects human third at-will at level 1", () => {
    expect(expectedClassAtWillAttackSlots(1, false)).toBe(2);
    expect(expectedClassAtWillAttackSlots(1, true)).toBe(3);
  });

  it("tracks utility power count by level", () => {
    expect(expectedClassUtilityPowerCount(1)).toBe(0);
    expect(expectedClassUtilityPowerCount(2)).toBe(1);
    expect(expectedClassUtilityPowerCount(11)).toBe(3);
    expect(expectedClassUtilityPowerCount(12)).toBe(4);
  });

  it("applies ASI pair and tier-wide bumps", () => {
    const base = { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 10 };
    const out = applyAsiBonusesToScores(base, 11, { "4": { first: "STR", second: "DEX" } });
    expect(out.STR).toBe(12);
    expect(out.DEX).toBe(12);
    expect(out.CON).toBe(11);
  });
});
