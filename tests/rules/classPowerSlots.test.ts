import { describe, expect, it } from "vitest";
import {
  attackPowerBucketFromUsage,
  attackPowerSlotKindFromUsage,
  buildClassPowerSlotDefinitions,
  classPowerSlotBucketsWithSelectableOptions,
  filterClassPowerSlotDefsWithSelectableOptions,
  maskPowerSlotCountsBySelectableBuckets,
  orderedPowerIdsFromSlots,
  powerPrintedLevelEligibleForSlot,
  upcomingClassPowerSlotMilestones
} from "../../src/rules/classPowerSlots";
import type { Power } from "../../src/rules/models";
describe("attackPowerSlotKindFromUsage", () => {
  it("classifies standard PHB usage strings", () => {
    expect(attackPowerSlotKindFromUsage("At-Will")).toBe("atWill");
    expect(attackPowerSlotKindFromUsage("Encounter")).toBe("encounter");
    expect(attackPowerSlotKindFromUsage("Daily")).toBe("daily");
  });

  it("returns other for blank or nonstandard usage", () => {
    expect(attackPowerSlotKindFromUsage(null)).toBe("other");
    expect(attackPowerSlotKindFromUsage("")).toBe("other");
    expect(attackPowerSlotKindFromUsage("Recharge 5 6")).toBe("other");
  });

  it("maps other to encounter only in attackPowerBucketFromUsage", () => {
    expect(attackPowerBucketFromUsage("Recharge 5 6")).toBe("encounter");
    expect(attackPowerBucketFromUsage(null)).toBe("encounter");
  });
});

describe("buildClassPowerSlotDefinitions", () => {
  it("gives two at-will slots at level 1 for non-human", () => {
    const defs = buildClassPowerSlotDefinitions(1, false);
    const keys = defs.map((d) => d.key);
    expect(keys.filter((k) => k.startsWith("atWill:"))).toEqual(["atWill:0", "atWill:1"]);
    expect(keys).toContain("encounter:1");
    expect(keys).toContain("daily:1");
    expect(keys.some((k) => k.startsWith("utility:"))).toBe(false);
  });

  it("adds a third at-will slot at level 1 when bonusThirdClassAtWill is true", () => {
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

describe("upcomingClassPowerSlotMilestones", () => {
  it("at level 1 lists utility, encounter, then daily unlocks in level order", () => {
    const m = upcomingClassPowerSlotMilestones(1);
    expect(m.map((x) => x.atLevel)).toEqual([2, 3, 5]);
    expect(m[0].label).toContain("utility");
    expect(m[1].label).toContain("Encounter");
    expect(m[2].label).toContain("Daily");
  });

  it("returns empty when all core slots are gained", () => {
    expect(upcomingClassPowerSlotMilestones(30)).toEqual([]);
  });
});

describe("filterClassPowerSlotDefsWithSelectableOptions", () => {
  const mageAttack: Power = {
    id: "enc1",
    name: "Mage Bolt",
    slug: "mage-bolt",
    level: 1,
    usage: "Encounter",
    raw: { specific: { "Power Type": "Attack" } }
  };

  it("drops buckets with no eligible powers", () => {
    const defs = buildClassPowerSlotDefinitions(1, false);
    const visible = filterClassPowerSlotDefsWithSelectableOptions(defs, [], []);
    expect(visible).toEqual([]);
  });

  it("keeps only buckets that have pickable powers", () => {
    const defs = buildClassPowerSlotDefinitions(1, false);
    const visible = filterClassPowerSlotDefsWithSelectableOptions(defs, [mageAttack], []);
    expect(visible.every((d) => d.bucket === "encounter")).toBe(true);
    expect(visible.some((d) => d.bucket === "atWill")).toBe(false);
  });

  it("masks PHB slot counts when buckets are empty", () => {
    const base = { atWill: 2, encounter: 1, daily: 1, utility: 0 };
    const buckets = classPowerSlotBucketsWithSelectableOptions(buildClassPowerSlotDefinitions(1, false), [], []);
    expect(maskPowerSlotCountsBySelectableBuckets(base, buckets)).toEqual({
      atWill: 0,
      encounter: 0,
      daily: 0,
      utility: 0
    });
  });
});
