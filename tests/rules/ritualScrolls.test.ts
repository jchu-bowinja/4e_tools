import { describe, expect, it } from "vitest";
import {
  addConsumableQuantity,
  martialPracticeScrollEntries,
  ritualScrollEntries,
  setMartialPracticeScrollEntries,
  setRitualScrollEntries
} from "../../src/rules/consumablesModel";
import type { CharacterBuild } from "../../src/rules/models";

function emptyBuild(): CharacterBuild {
  return {
    name: "Test",
    level: 5,
    abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 10 },
    trainedSkillIds: [],
    featIds: [],
    powerIds: []
  };
}

describe("ritualScrolls", () => {
  it("stores ritual scroll quantities separately from the ritual book", () => {
    const build = setRitualScrollEntries(
      { ...emptyBuild(), rituals: [{ id: "knock", quantity: 1 }] },
      addConsumableQuantity([], "knock", 2)
    );
    expect(ritualScrollEntries(build)).toEqual([{ id: "knock", quantity: 2 }]);
    expect(build.rituals).toEqual([{ id: "knock", quantity: 1 }]);
  });

  it("stores martial practice scrolls separately from mastered practices", () => {
    const build = setMartialPracticeScrollEntries(
      { ...emptyBuild(), martialPractices: [{ id: "p1", quantity: 1 }] },
      addConsumableQuantity([], "p1", 2)
    );
    expect(martialPracticeScrollEntries(build)).toEqual([{ id: "p1", quantity: 2 }]);
    expect(build.martialPractices).toEqual([{ id: "p1", quantity: 1 }]);
  });
});
