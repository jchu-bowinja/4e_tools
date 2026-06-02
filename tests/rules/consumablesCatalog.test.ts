import { describe, expect, it } from "vitest";
import {
  ADVENTURING_GEAR_CATEGORIES,
  adventuringGearFromIndex,
  isMartialPracticeRitual,
  pruneCharacterConsumableIds
} from "../../src/rules/consumablesCatalog";
import type { GearItem, RitualItem, RulesIndex } from "../../src/rules/models";

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
    ...overrides
  };
}

describe("consumablesCatalog", () => {
  it("filters adventuring gear by category", () => {
    const gear: GearItem[] = [
      {
        id: "g1",
        name: "Rope",
        slug: "rope",
        category: "Gear",
        raw: {}
      },
      {
        id: "m1",
        name: "Riding Horse",
        slug: "riding-horse",
        category: "Mount",
        raw: {}
      }
    ];
    const rows = adventuringGearFromIndex(minimalIndex({ gear }));
    expect(rows.map((r) => r.id)).toEqual(["g1"]);
    expect(ADVENTURING_GEAR_CATEGORIES.has("Gear")).toBe(true);
  });

  it("detects martial practice rituals", () => {
    const ritual: RitualItem = {
      id: "r1",
      name: "Long-Distance Runner Martial Practice",
      slug: "long-distance-runner",
      category: "Martial Practice",
      raw: {}
    };
    expect(isMartialPracticeRitual(ritual)).toBe(true);
  });

  it("prunes unknown consumable ids", () => {
    const index = minimalIndex({
      gear: [{ id: "g1", name: "Rope", slug: "rope", category: "Gear", raw: {} }],
      rituals: [{ id: "r1", name: "Knock", slug: "knock", raw: {} }],
      martialPractices: [],
      alchemyItems: []
    });
    const pruned = pruneCharacterConsumableIds(
      { gearIds: ["g1", "gone"], ritualIds: ["r1", "bad"] },
      index
    );
    expect(pruned.gearIds).toEqual(["g1"]);
    expect(pruned.ritualIds).toEqual(["r1"]);
  });
});
