import { describe, expect, it } from "vitest";
import { evaluatePrereqs } from "../../src/rules/prereqEvaluator";
import type { CharacterBuild, PrereqToken, RulesIndex } from "../../src/rules/models";

const raceMap = new Map([["r1", "Dragonborn"]]);
const classMap = new Map([
  ["c1", "Fighter"],
  ["c2", "Cleric"]
]);
const skillMap = new Map([["s1", "Athletics"]]);

const build: CharacterBuild = {
  name: "Test",
  level: 11,
  raceId: "r1",
  classId: "c2",
  abilityScores: {
    STR: 16,
    CON: 12,
    DEX: 10,
    INT: 8,
    WIS: 11,
    CHA: 9
  },
  trainedSkillIds: ["s1"],
  featIds: [],
  powerIds: []
};

const miniIndex = {
  races: [{ id: "r1", name: "Dragonborn", slug: "dragonborn", size: "Medium", raw: {} }],
  classes: [
    {
      id: "c2",
      name: "Cleric",
      slug: "cleric",
      powerSource: "Divine",
      raw: {}
    }
  ],
  feats: [],
  powers: [],
  skills: [],
  languages: [],
  racialTraits: [],
  classFeatures: [],
  armors: [],
  weapons: [],
  implements: [],
  abilityScores: [],
  themes: [],
  paragonPaths: [],
  epicDestinies: [],
  grantedClassFeatureNamesBySupportId: {
    c2: ["Channel Divinity", "Healing Word"]
  }
} as unknown as RulesIndex;

describe("evaluatePrereqs", () => {
  it("accepts valid prereqs", () => {
    const tokens: PrereqToken[] = [
      { kind: "abilityAtLeast", ability: "STR", value: 13 },
      { kind: "race", value: "Dragonborn" }
    ];
    const result = evaluatePrereqs(tokens, build, raceMap, classMap, skillMap, { index: miniIndex });
    expect(result.ok).toBe(true);
  });

  it("rejects invalid class prereq", () => {
    const tokens: PrereqToken[] = [{ kind: "class", value: "Wizard" }];
    const result = evaluatePrereqs(tokens, build, raceMap, classMap, skillMap, { index: miniIndex });
    expect(result.ok).toBe(false);
    expect(result.reasons[0]).toContain("Requires class");
  });

  it("accepts divine power source for cleric", () => {
    const tokens: PrereqToken[] = [{ kind: "powerSourceAny", value: "divine" }];
    const result = evaluatePrereqs(tokens, build, raceMap, classMap, skillMap, { index: miniIndex });
    expect(result.ok).toBe(true);
  });

  it("accepts granted class feature by name", () => {
    const tokens: PrereqToken[] = [{ kind: "classFeature", value: "Channel Divinity" }];
    const result = evaluatePrereqs(tokens, build, raceMap, classMap, skillMap, { index: miniIndex });
    expect(result.ok).toBe(true);
  });

  it("evaluates anyOf as alternative requirements", () => {
    const tokens: PrereqToken[] = [
      {
        kind: "anyOf",
        options: [
          { kind: "class", value: "Wizard" },
          { kind: "race", value: "Dragonborn" }
        ]
      }
    ];
    const result = evaluatePrereqs(tokens, build, raceMap, classMap, skillMap, { index: miniIndex });
    expect(result.ok).toBe(true);
  });
});
