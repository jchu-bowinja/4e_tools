import { describe, expect, it } from "vitest";
import type { CharacterSheetState } from "../../src/features/characterSheet/model";
import { computeSheetDerivedData, groupCombatPowers } from "../../src/features/characterSheet/selectors";
import { PERF_BUDGET_MS } from "./budgets";
import { expectWithinBudget, hasRulesIndex, loadRulesIndexForPerf, measureMs } from "./harness";

const sheetState: CharacterSheetState = {
  name: "Hero",
  level: 21,
  raceId: "race_human",
  classId: "class_fighter",
  themeId: "theme_guardian",
  paragonPathId: "path_ironvanguard",
  epicDestinyId: "destiny_demigod",
  abilityScores: { STR: 16, CON: 14, DEX: 12, INT: 10, WIS: 10, CHA: 10 },
  trainedSkillIds: [],
  resources: {
    currentHp: 100,
    tempHp: 0,
    actionPoints: 1,
    surgesRemaining: 10,
    deathSaves: 0,
    conditions: []
  },
  inventory: [],
  equipment: {},
  powers: {
    selectedPowerIds: [],
    expendedPowerIds: [],
    manualOrderIds: [],
    groupBy: "usage"
  }
};

describe.skipIf(!hasRulesIndex())("character sheet performance", () => {
  it("groupCombatPowers completes within budget", () => {
    const index = loadRulesIndexForPerf();
    const elapsed = measureMs(() => {
      const grouped = groupCombatPowers(sheetState, index);
      expect(grouped.atWill.length + grouped.encounter.length + grouped.daily.length).toBeGreaterThanOrEqual(0);
    });
    expectWithinBudget(elapsed, PERF_BUDGET_MS.groupCombatPowers, "groupCombatPowers");
  });

  it("computeSheetDerivedData completes within budget", () => {
    const index = loadRulesIndexForPerf();
    const elapsed = measureMs(() => {
      const derived = computeSheetDerivedData(sheetState, index);
      expect(derived.maxHp).toBeGreaterThan(0);
    });
    expectWithinBudget(elapsed, PERF_BUDGET_MS.computeSheetDerivedData, "computeSheetDerivedData");
  });
});
