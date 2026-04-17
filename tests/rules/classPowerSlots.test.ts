import { describe, expect, it } from "vitest";
import {
  buildClassPowerSlotDefinitions,
  orderedPowerIdsFromSlots,
  powerPrintedLevelEligibleForSlot
} from "../../src/rules/classPowerSlots";
import { Power } from "../../src/rules/models";

describe("buildClassPowerSlotDefinitions", () => {
  it("gives two at-will slots at level 1 for non-human", () => {
    const defs = buildClassPowerSlotDefinitions(1, false);
    const keys = defs.map((d) => d.key);
    expect(keys.filter((k) => k.startsWith("atWill:"))).toEqual(["atWill:0", "atWill:1"]);
    expect(keys).toContain("encounter:1");
    expect(keys).toContain("daily:1");
    expect(keys.some((k) => k.startsWith("utility:"))).toBe(false);
  });

  it("adds a third at-will slot at level 1 for human", () => {
    const defs = buildClassPowerSlotDefinitions(1, true);
    expect(defs.filter((d) => d.bucket === "atWill")).toHaveLength(3);
  });

  it("adds encounter slot at 3rd level when level reaches 3", () => {
    const d2 = buildClassPowerSlotDefinitions(2, false);
    const d3 = buildClassPowerSlotDefinitions(3, false);
    expect(d2.filter((d) => d.bucket === "encounter")).toHaveLength(1);
    expect(d3.filter((d) => d.bucket === "encounter")).toHaveLength(2);
    expect(d3.map((d) => d.key)).toContain("encounter:3");
  });
});

describe("powerPrintedLevelEligibleForSlot", () => {
  it("allows printed level up to slot gain level", () => {
    const def = { key: "encounter:3", bucket: "encounter" as const, gainLevel: 3, label: "test" };
    const ok: Power = {
      id: "x",
      name: "Low",
      slug: "low",
      level: 3,
      raw: { specific: { "Power Type": "Attack" } }
    };
    const tooHigh: Power = { ...ok, id: "y", name: "High", level: 7 };
    expect(powerPrintedLevelEligibleForSlot(ok, def)).toBe(true);
    expect(powerPrintedLevelEligibleForSlot(tooHigh, def)).toBe(false);
  });
});

describe("orderedPowerIdsFromSlots", () => {
  it("outputs ids in slot definition order", () => {
    const defs = buildClassPowerSlotDefinitions(1, false);
    const slots = { "atWill:0": "a", "atWill:1": "b", "encounter:1": "c", "daily:1": "d" };
    expect(orderedPowerIdsFromSlots(defs, slots)).toEqual(["a", "b", "c", "d"]);
  });
});
