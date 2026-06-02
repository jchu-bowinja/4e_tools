import { describe, expect, it } from "vitest";
import {
  addConsumableQuantity,
  consumableEntries,
  migrateCharacterConsumables,
  setConsumableEntries
} from "../../src/rules/consumablesModel";
import type { CharacterBuild } from "../../src/rules/models";

function emptyBuild(overrides: Partial<CharacterBuild> = {}): CharacterBuild {
  return {
    name: "Test",
    level: 5,
    abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 10 },
    trainedSkillIds: [],
    featIds: [],
    powerIds: [],
    ...overrides
  };
}

describe("consumablesModel", () => {
  it("migrates legacy gearIds to gear entries", () => {
    const build = emptyBuild({ gearIds: ["rope", "torch"] });
    const migrated = migrateCharacterConsumables(build);
    expect(migrated.gear).toEqual([
      { id: "rope", quantity: 1 },
      { id: "torch", quantity: 1 }
    ]);
    expect(migrated.gearIds).toBeUndefined();
  });

  it("merges quantity when adding consumables", () => {
    const entries = addConsumableQuantity([{ id: "rope", quantity: 2 }], "rope", 3);
    expect(entries).toEqual([{ id: "rope", quantity: 5 }]);
  });

  it("prefers modern gear over legacy ids", () => {
    const build = emptyBuild({
      gear: [{ id: "rope", quantity: 4 }],
      gearIds: ["legacy"]
    });
    expect(consumableEntries(build, "gear")).toEqual([{ id: "rope", quantity: 4 }]);
  });

  it("setConsumableEntries strips legacy field", () => {
    const build = emptyBuild({ gearIds: ["a"] });
    const next = setConsumableEntries(build, "gear", [{ id: "b", quantity: 2 }]);
    expect(next.gear).toEqual([{ id: "b", quantity: 2 }]);
    expect(next.gearIds).toBeUndefined();
  });
});
