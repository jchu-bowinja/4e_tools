import { describe, expect, it } from "vitest";
import {
  encounterLevelForDifficulty,
  targetEncounterXp,
  threatLevelBand
} from "../../../src/features/encounterBuilder/encounterXpBudget";

describe("encounterXpBudget", () => {
  it("matches DMG sample (level 5 encounter, 5 PCs → 1,000 XP)", () => {
    expect(targetEncounterXp(5, 5)).toBe(1000);
  });

  it("maps difficulty to encounter level bands", () => {
    expect(encounterLevelForDifficulty(10, "easy")).toBe(8);
    expect(encounterLevelForDifficulty(10, "standard")).toBe(10);
    expect(encounterLevelForDifficulty(10, "hard")).toBe(13);
  });

  it("does not produce invalid encounter levels", () => {
    expect(encounterLevelForDifficulty(1, "easy")).toBe(1);
    expect(encounterLevelForDifficulty(30, "hard")).toBe(30);
  });

  it("keeps monster level picks within 1 of party (ignores difficulty for the window)", () => {
    expect(threatLevelBand(12, "easy")).toEqual({ min: 11, max: 13 });
    expect(threatLevelBand(12, "hard")).toEqual({ min: 11, max: 13 });
    expect(threatLevelBand(1, "standard")).toEqual({ min: 1, max: 2 });
    expect(threatLevelBand(30, "standard")).toEqual({ min: 29, max: 30 });
  });
});
