import { describe, expect, it } from "vitest";
import { characterHasRitualCasting, ritualCasterStatusMessage } from "../../src/rules/ritualCasting";
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
    classFeatures: [],
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

describe("ritualCasting", () => {
  it("detects Ritual Caster feat", () => {
    const index = minimalIndex({
      feats: [{ id: "f1", name: "Ritual Caster", slug: "ritual-caster", raw: {} }]
    });
    const build = emptyBuild({ featIds: ["f1"] });
    expect(characterHasRitualCasting(index, build)).toBe(true);
    expect(ritualCasterStatusMessage(index, build)).toBeNull();
  });

  it("warns when rituals owned without casting", () => {
    const index = minimalIndex();
    const build = emptyBuild({ rituals: [{ id: "r1", quantity: 1 }] });
    expect(characterHasRitualCasting(index, build)).toBe(false);
    expect(ritualCasterStatusMessage(index, build)).toMatch(/Ritual Casting/i);
  });
});
