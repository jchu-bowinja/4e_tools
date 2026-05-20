import { describe, expect, it } from "vitest";
import {
  adjustPowerPointsSpent,
  powerPointsRemaining,
  powerPointsSpent,
  refreshPowerPointsOnExtendedRest
} from "../../src/features/characterSheet/psionicPowerPointResources";
import type { CharacterSheetResources } from "../../src/features/characterSheet/model";

const base: CharacterSheetResources = {
  currentHp: 20,
  tempHp: 0,
  actionPoints: 1,
  surgesRemaining: 6,
  deathSaves: 0,
  conditions: []
};

describe("psionicPowerPointResources", () => {
  it("tracks spent and remaining within pool", () => {
    const spent = adjustPowerPointsSpent(base, 2, 8);
    expect(powerPointsSpent(spent)).toBe(2);
    expect(powerPointsRemaining(8, spent)).toBe(6);
  });

  it("clamps spend to pool total", () => {
    const spent = adjustPowerPointsSpent({ ...base, powerPointsSpent: 7 }, 5, 8);
    expect(powerPointsSpent(spent)).toBe(8);
  });

  it("clears spent on extended rest", () => {
    const rested = refreshPowerPointsOnExtendedRest({ ...base, powerPointsSpent: 4 });
    expect(powerPointsSpent(rested)).toBe(0);
  });
});
