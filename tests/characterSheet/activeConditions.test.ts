import { describe, expect, it } from "vitest";
import { areActiveConditionsDuplicate, createActiveCondition, normalizeActiveConditions } from "../../src/features/characterSheet/activeConditions";
import { buildDurationFromPreset } from "../../src/features/characterSheet/conditionDurationPresets";
import { createDefaultCharacterSheetState } from "../../src/features/characterSheet/defaultState";
import { normalizeState } from "../../src/features/characterSheet/storage";

describe("normalizeActiveConditions", () => {
  it("migrates legacy string conditions", () => {
    const conditions = normalizeActiveConditions(["Slowed", "  "]);
    expect(conditions).toHaveLength(1);
    expect(conditions[0].name).toBe("Slowed");
    expect(conditions[0].duration.kind).toBe("none");
    expect(conditions[0].id).toBeTruthy();
  });

  it("preserves structured conditions", () => {
    const duration = buildDurationFromPreset("save_ends");
    const conditions = normalizeActiveConditions([{ id: "c1", name: "Dazed", duration }]);
    expect(conditions).toHaveLength(1);
    expect(conditions[0].duration.kind).toBe("save_ends");
    expect(conditions[0].duration.phrase).toBe("save ends");
  });
});

describe("areActiveConditionsDuplicate", () => {
  it("treats same name and duration as duplicate", () => {
    const a = createActiveCondition("Slowed", buildDurationFromPreset("save_ends"));
    const b = createActiveCondition("slowed", buildDurationFromPreset("save_ends"));
    expect(areActiveConditionsDuplicate(a, b)).toBe(true);
  });

  it("allows same name with different durations", () => {
    const a = createActiveCondition("Slowed", buildDurationFromPreset("save_ends"));
    const b = createActiveCondition("Slowed", buildDurationFromPreset("end_encounter"));
    expect(areActiveConditionsDuplicate(a, b)).toBe(false);
  });

  it("distinguishes round counts", () => {
    const a = createActiveCondition("Slowed", buildDurationFromPreset("rounds", 2));
    const b = createActiveCondition("Slowed", buildDurationFromPreset("rounds", 3));
    expect(areActiveConditionsDuplicate(a, b)).toBe(false);
  });
});

describe("storage condition migration", () => {
  it("loads legacy string conditions from saved state shape", () => {
    const fallback = createDefaultCharacterSheetState();
    const loaded = normalizeState({
      ...fallback,
      resources: {
        ...fallback.resources,
        conditions: ["Immobilized", "Custom effect"]
      }
    });
    expect(loaded.resources.conditions).toHaveLength(2);
    expect(loaded.resources.conditions[0].name).toBe("Immobilized");
    expect(loaded.resources.conditions[1].name).toBe("Custom effect");
  });
});

describe("buildDurationFromPreset", () => {
  it("builds round phrases with correct pluralization", () => {
    expect(buildDurationFromPreset("rounds", 1).phrase).toBe("1 round");
    expect(buildDurationFromPreset("rounds", 2).phrase).toBe("2 rounds");
  });
});
