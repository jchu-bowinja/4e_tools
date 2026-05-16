import { describe, expect, it } from "vitest";
import {
  buildInitiativeBreakdown,
  buildNadBreakdown,
  buildSpeedBreakdown,
  formatAcScoreBreakdown,
  formatStatScoreBreakdown
} from "../../src/rules/statScoreBreakdown";
import { computeAcBreakdown } from "../../src/rules/defenseCalculator";

describe("statScoreBreakdown", () => {
  it("formats speed and initiative components", () => {
    expect(formatStatScoreBreakdown(buildSpeedBreakdown(6, 2, 1))).toBe("+6 race · -2 armor · +1 other");
    expect(formatStatScoreBreakdown(buildInitiativeBreakdown(2, 3, 1))).toBe("+2 ½ lvl · +3 DEX · +1 other");
  });

  it("formats NAD breakdown with hidden zero class and magic", () => {
    const fort = buildNadBreakdown({
      halfLevel: 2,
      abilityMod: 3,
      abilityLabel: "STR/CON",
      classBonus: 2,
      supportBonus: 0,
      magicItemBonus: 0
    });
    expect(fort.total).toBe(17);
    expect(formatStatScoreBreakdown(fort)).toBe("+10 base · +2 ½ lvl · +3 STR/CON · +2 class");
  });

  it("formats AC breakdown with magic and second wind", () => {
    const bd = computeAcBreakdown(2, 0, undefined, undefined, 4, 1);
    expect(formatAcScoreBreakdown(bd, { magicItemBonus: 1, secondWindBonus: 2 })).toContain("+10 base");
    expect(formatAcScoreBreakdown(bd, { magicItemBonus: 1, secondWindBonus: 2 })).toContain("+2 ½ lvl");
    expect(formatAcScoreBreakdown(bd, { magicItemBonus: 1, secondWindBonus: 2 })).toContain("+1 magic");
    expect(formatAcScoreBreakdown(bd, { magicItemBonus: 1, secondWindBonus: 2 })).toContain("+2 2nd wind");
  });
});
