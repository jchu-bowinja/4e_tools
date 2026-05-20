import { describe, expect, it } from "vitest";
import { formatSavedCharacterClassLevel } from "../../src/features/builder/savedCharacterDisplay";
import { CharacterBuild, RulesIndex } from "../../src/rules/models";

const index: RulesIndex = {
  classes: [{ id: "fighter", name: "Fighter", slug: "fighter", raw: {} }],
  hybridClasses: [
    { id: "hybrid_cleric", name: "Hybrid Cleric", slug: "hybrid-cleric", baseClassId: "cleric", raw: {} },
    { id: "hybrid_fighter", name: "Hybrid Fighter", slug: "hybrid-fighter", baseClassId: "fighter", raw: {} }
  ]
};

describe("formatSavedCharacterClassLevel", () => {
  it("formats standard class and level", () => {
    const build: CharacterBuild = { name: "Hero", level: 5, classId: "fighter" };
    expect(formatSavedCharacterClassLevel(build, index)).toBe("Fighter, level 5");
  });

  it("formats hybrid classes and level", () => {
    const build: CharacterBuild = {
      name: "Hero",
      level: 3,
      characterStyle: "hybrid",
      hybridClassIdA: "hybrid_cleric",
      hybridClassIdB: "hybrid_fighter"
    };
    expect(formatSavedCharacterClassLevel(build, index)).toBe("Hybrid Cleric / Hybrid Fighter, level 3");
  });

  it("falls back to level only when class is unset", () => {
    const build: CharacterBuild = { name: "Hero", level: 1 };
    expect(formatSavedCharacterClassLevel(build, index)).toBe("Level 1");
  });
});
