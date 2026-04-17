import { describe, expect, it } from "vitest";
import { evaluatePrereqs } from "../../src/rules/prereqEvaluator";
import { CharacterBuild, PrereqToken } from "../../src/rules/models";

const raceMap = new Map([["r1", "Dragonborn"]]);
const classMap = new Map([["c1", "Fighter"]]);
const skillMap = new Map([["s1", "Athletics"]]);

const build: CharacterBuild = {
  name: "Test",
  level: 1,
  raceId: "r1",
  classId: "c1",
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

describe("evaluatePrereqs", () => {
  it("accepts valid prereqs", () => {
    const tokens: PrereqToken[] = [
      { kind: "abilityAtLeast", ability: "STR", value: 13 },
      { kind: "race", value: "Dragonborn" }
    ];
    const result = evaluatePrereqs(tokens, build, raceMap, classMap, skillMap);
    expect(result.ok).toBe(true);
  });

  it("rejects invalid prereqs", () => {
    const tokens: PrereqToken[] = [{ kind: "class", value: "Wizard" }];
    const result = evaluatePrereqs(tokens, build, raceMap, classMap, skillMap);
    expect(result.ok).toBe(false);
    expect(result.reasons[0]).toContain("Requires class");
  });
});

