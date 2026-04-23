import { describe, expect, it } from "vitest";
import {
  computeHybridDerivedStats,
  hybridHpAtFirstLevel,
  hybridHpPerLevelGain,
  parseHybridDefenseBonuses
} from "../../src/rules/hybridDerivedStats";
import { expectedHybridTrainedSkillCount, hybridCombinedClassSkillNames } from "../../src/rules/hybridSkills";
import {
  buildHybridPowerSlotDefinitions,
  powerAllowedForHybridSlot
} from "../../src/rules/hybridPowerSlots";
import type { HybridClassDef, Power } from "../../src/rules/models";

const hStub = (partial: Partial<HybridClassDef>): HybridClassDef =>
  ({
    id: "x",
    name: "X",
    slug: "x",
    raw: {},
    ...partial
  }) as HybridClassDef;

describe("hybrid derived stats helpers", () => {
  it("averages hybrid HP components at first level", () => {
    const a = hStub({ hitPointsAt1: 12 });
    const b = hStub({ hitPointsAt1: 16 });
    expect(hybridHpAtFirstLevel(a, b, 14)).toBe(Math.floor((12 + 16) / 2) + 14);
  });

  it("averages per-level HP gain", () => {
    const a = hStub({ hitPointsPerLevel: 5 });
    const b = hStub({ hitPointsPerLevel: 6 });
    expect(hybridHpPerLevelGain(a, b)).toBe(5.5);
  });

  it("sums defense tokens from two hybrids", () => {
    const a = hStub({ bonusToDefense: "+1 Will" });
    const b = hStub({ bonusToDefense: "+1 Reflex" });
    expect(parseHybridDefenseBonuses(a, b)).toEqual({ Will: 1, Reflex: 1 });
  });

  it("uses CON score (not CON modifier) for hybrid surge calculation", () => {
    const a = hStub({ hitPointsAt1: 12, hitPointsPerLevel: 5, healingSurgesBase: 7 });
    const b = hStub({ hitPointsAt1: 14, hitPointsPerLevel: 5, healingSurgesBase: 7 });
    const build = {
      level: 1,
      abilityScores: { STR: 10, CON: 18, DEX: 10, INT: 10, WIS: 10, CHA: 10 }
    } as never;
    const derived = computeHybridDerivedStats(build, undefined, a, b, undefined, undefined);
    expect(derived.healingSurgesPerDay).toBe(11);
  });
});

describe("hybrid skills", () => {
  it("unions class skill names and strips ability parens", () => {
    const a = hStub({ classSkillsRaw: "Athletics (Str), Stealth (Dex)" });
    const b = hStub({ classSkillsRaw: "Heal (Wis), Athletics (Str)" });
    expect(hybridCombinedClassSkillNames(a, b)).toEqual(["Athletics", "Heal", "Stealth"]);
  });

  it("trained skill count uses 4 + INT mod (min 1)", () => {
    expect(expectedHybridTrainedSkillCount(10)).toBe(4);
    expect(expectedHybridTrainedSkillCount(8)).toBe(3);
    expect(expectedHybridTrainedSkillCount(2)).toBe(1);
  });
});

describe("hybrid power slots", () => {
  it("locks first two at-wills to each base class pool", () => {
    const pA = { classId: "cA" } as Power;
    const pB = { classId: "cB" } as Power;
    expect(powerAllowedForHybridSlot("hybrid:awA:0", pA, "cA", "cB")).toBe(true);
    expect(powerAllowedForHybridSlot("hybrid:awA:0", pB, "cA", "cB")).toBe(false);
    expect(powerAllowedForHybridSlot("hybrid:awB:0", pB, "cA", "cB")).toBe(true);
    expect(powerAllowedForHybridSlot("hybrid:awFlex:0", pB, "cA", "cB")).toBe(true);
    expect(powerAllowedForHybridSlot("hybrid:encounter:1", pA, "cA", "cB")).toBe(true);
  });

  it("buildHybridPowerSlotDefinitions includes hybrid-prefixed keys", () => {
    const defs = buildHybridPowerSlotDefinitions(1, false);
    expect(defs.some((d) => d.key === "hybrid:awA:0")).toBe(true);
    expect(defs.some((d) => d.key === "hybrid:awB:0")).toBe(true);
  });
});
