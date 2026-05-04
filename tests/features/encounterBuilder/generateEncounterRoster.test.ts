import { describe, expect, it } from "vitest";
import type { MonsterIndexEntry } from "../../../src/features/monsterEditor/storage";
import {
  estimateXpForIndexRow,
  generateEncounterRosterPlan,
  nameTokens
} from "../../../src/features/encounterBuilder/generateEncounterRoster";

function stubRow(partial: Partial<MonsterIndexEntry> & Pick<MonsterIndexEntry, "id" | "name" | "level" | "role">): MonsterIndexEntry {
  return {
    fileName: `${partial.id}.json`,
    relativePath: `m/${partial.id}.json`,
    parseError: "",
    ...partial
  };
}

describe("generateEncounterRoster", () => {
  it("estimateXpForIndexRow scales minion / elite / solo", () => {
    const std = stubRow({
      id: "s",
      name: "Standard beast",
      level: 5,
      role: "Medium natural beast (brute)"
    });
    const min = stubRow({
      id: "m",
      name: "Minion",
      level: 5,
      role: "Medium natural humanoid (minion)"
    });
    const elite = stubRow({
      id: "e",
      name: "Elite",
      level: 5,
      role: "Medium elemental magical beast (elite brute)"
    });
    const solo = stubRow({
      id: "o",
      name: "Solo",
      level: 5,
      role: "Huge dragon (solo brute)"
    });
    expect(estimateXpForIndexRow(std)).toBe(200);
    expect(estimateXpForIndexRow(min)).toBe(50);
    expect(estimateXpForIndexRow(elite)).toBe(400);
    expect(estimateXpForIndexRow(solo)).toBe(1000);
  });

  it("returns picks within budget for a synthetic index", () => {
    const rows: MonsterIndexEntry[] = [];
    for (let i = 0; i < 20; i++) {
      rows.push(
        stubRow({
          id: `k${i}`,
          name: `Goblin grunt ${i}`,
          level: 4 + (i % 3),
          role: "Small natural humanoid (soldier)"
        })
      );
    }
    const rng = mulberry32(42);
    const res = generateEncounterRosterPlan({
      indexRows: rows,
      partyLevel: 6,
      pcCount: 5,
      difficulty: "standard",
      template: "balanced",
      thematicClustering: false,
      random: rng
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.picks.length).toBeGreaterThan(0);
    expect(res.actualEstimatedXp).toBeGreaterThan(0);
    expect(res.targetXp).toBeGreaterThan(0);
  });

  it("nameTokens strips stopwords", () => {
    expect(nameTokens("The Ancient Goblin Warrior")).toContain("goblin");
    expect(nameTokens("The Ancient Goblin Warrior")).toContain("warrior");
  });

  it("errors when index empty", () => {
    const res = generateEncounterRosterPlan({
      indexRows: [],
      partyLevel: 5,
      pcCount: 4,
      difficulty: "standard",
      template: "balanced",
      thematicClustering: false
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/index/i);
  });

  it("excludes solos from templates other than solo spotlight", () => {
    const rows = [
      stubRow({ id: "solo1", name: "Ancient Dragon", level: 6, role: "Huge dragon (solo brute)" }),
      stubRow({ id: "std1", name: "Orc Raider", level: 6, role: "Medium natural humanoid (brute)" }),
      stubRow({ id: "std2", name: "Orc Raider 2", level: 6, role: "Medium natural humanoid (brute)" })
    ];
    const res = generateEncounterRosterPlan({
      indexRows: rows,
      partyLevel: 6,
      pcCount: 5,
      difficulty: "standard",
      template: "balanced",
      thematicClustering: false,
      random: mulberry32(1)
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.picks.every((p) => p.id !== "solo1")).toBe(true);
  });

  it("solo spotlight may include a solo", () => {
    const rows = [
      stubRow({ id: "solo1", name: "Ancient Dragon", level: 6, role: "Huge dragon (solo brute)" }),
      stubRow({ id: "std1", name: "Orc Raider", level: 6, role: "Medium natural humanoid (brute)" })
    ];
    const res = generateEncounterRosterPlan({
      indexRows: rows,
      partyLevel: 6,
      pcCount: 5,
      difficulty: "standard",
      template: "dragonsDen",
      thematicClustering: false,
      random: mulberry32(1)
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.picks.some((p) => p.id === "solo1")).toBe(true);
  });
});

/** Deterministic PRNG for tests (same seed → same sequence). */
function mulberry32(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
