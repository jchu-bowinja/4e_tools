import { describe, expect, it } from "vitest";
import { filterUnifiedInventoryRows, unifiedInventoryRows } from "../../src/features/characterSheet/unifiedInventory";
import type { CharacterBuild, RulesIndex } from "../../src/rules/models";

function minimalIndex(overrides: Partial<RulesIndex> = {}): RulesIndex {
  return {
    meta: { version: 1, counts: {} },
    races: [],
    classes: [],
    feats: [],
    powers: [],
    skills: [],
    languages: [],
    armors: [],
    abilityScores: [],
    racialTraits: [],
    themes: [],
    paragonPaths: [],
    epicDestinies: [],
    gear: [{ id: "g1", name: "Rope", slug: "rope", category: "Gear", raw: {} }],
    rituals: [{ id: "r1", name: "Knock", slug: "knock", marketPriceGp: 50, raw: {} }],
    martialPractices: [],
    alchemyItems: [],
    ...overrides
  };
}

function emptyBuild(overrides: Partial<CharacterBuild> = {}): CharacterBuild {
  return {
    name: "Test",
    level: 1,
    abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 10 },
    trainedSkillIds: [],
    featIds: [],
    powerIds: [],
    ...overrides
  };
}

describe("unifiedInventory", () => {
  it("aggregates gear and rituals with category labels", () => {
    const index = minimalIndex();
    const build = emptyBuild({
      gear: [{ id: "g1", quantity: 2 }],
      rituals: [{ id: "r1", quantity: 1 }],
      ritualScrolls: [{ id: "r1", quantity: 3 }]
    });
    const rows = unifiedInventoryRows(build, index);
    expect(rows.some((r) => r.category === "adventuringGear" && r.kind === "consumable")).toBe(true);
    expect(rows.some((r) => r.category === "ritual")).toBe(true);
    expect(rows.some((r) => r.category === "ritualScroll")).toBe(true);
    expect(
      rows.some((r) => r.category === "martialPracticeScroll" && r.kind === "consumable")
    ).toBe(false);
    const filtered = filterUnifiedInventoryRows(rows, "ritualScroll");
    expect(filtered).toHaveLength(1);
    expect(filtered[0].kind === "consumable" && filtered[0].quantity).toBe(3);
  });
});
