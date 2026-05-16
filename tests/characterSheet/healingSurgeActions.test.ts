import { describe, expect, it } from "vitest";
import {
  canUseSecondWind,
  refreshSecondWindOnRest,
  SECOND_WIND_CONDITION,
  spendHealingSurgeResources,
  useSecondWindResources
} from "../../src/features/characterSheet/healingSurgeActions";
import type { CharacterSheetResources } from "../../src/features/characterSheet/model";

const baseResources: CharacterSheetResources = {
  currentHp: 5,
  tempHp: 0,
  actionPoints: 1,
  surgesRemaining: 2,
  secondWindUsed: false,
  deathSaves: 0,
  conditions: []
};

const params = { perSurge: 7, capHp: 30, capSurges: 6 };

describe("spendHealingSurgeResources", () => {
  it("spends a surge and heals up to cap", () => {
    const next = spendHealingSurgeResources(baseResources, params);
    expect(next.surgesRemaining).toBe(1);
    expect(next.currentHp).toBe(12);
  });

  it("does nothing when no surges remain", () => {
    const next = spendHealingSurgeResources({ ...baseResources, surgesRemaining: 0 }, params);
    expect(next).toEqual({ ...baseResources, surgesRemaining: 0 });
  });
});

describe("useSecondWindResources", () => {
  it("spends a surge, heals, marks used, and adds defense condition", () => {
    const next = useSecondWindResources(baseResources, params);
    expect(next.surgesRemaining).toBe(1);
    expect(next.currentHp).toBe(12);
    expect(next.secondWindUsed).toBe(true);
    expect(next.conditions).toContain(SECOND_WIND_CONDITION);
  });

  it("is blocked after second wind was used", () => {
    const next = useSecondWindResources({ ...baseResources, secondWindUsed: true }, params);
    expect(next).toEqual({ ...baseResources, secondWindUsed: true });
  });

  it("is blocked with no surges remaining", () => {
    const next = useSecondWindResources({ ...baseResources, surgesRemaining: 0 }, params);
    expect(next).toEqual({ ...baseResources, surgesRemaining: 0 });
  });
});

describe("canUseSecondWind", () => {
  it("requires an unused second wind and at least one surge", () => {
    expect(canUseSecondWind(baseResources)).toBe(true);
    expect(canUseSecondWind({ ...baseResources, secondWindUsed: true })).toBe(false);
    expect(canUseSecondWind({ ...baseResources, surgesRemaining: 0 })).toBe(false);
  });
});

describe("refreshSecondWindOnRest", () => {
  it("clears second wind usage and defense condition", () => {
    const used = useSecondWindResources(baseResources, params);
    const refreshed = refreshSecondWindOnRest(used);
    expect(refreshed.secondWindUsed).toBe(false);
    expect(refreshed.conditions).not.toContain(SECOND_WIND_CONDITION);
    expect(refreshed.surgesRemaining).toBe(used.surgesRemaining);
  });
});
