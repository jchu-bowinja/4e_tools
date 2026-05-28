import { describe, expect, it } from "vitest";
import { autoGrantedTrainedSkillIds, reconcileTrainedSkillIds } from "../../src/rules/grantedSkillsQuery";
import type { CharacterBuild, RulesIndex } from "../../src/rules/models";

describe("reconcileTrainedSkillIds", () => {
  const index = {
    skills: [
      { id: "SK_ARC", name: "Arcana", slug: "arcana", raw: {} },
      { id: "SK_DIP", name: "Diplomacy", slug: "diplomacy", raw: {} }
    ],
    feats: [],
    races: [{ id: "R1", name: "Human", slug: "human", raw: {} }],
    autoGrantedSkillTrainingNamesBySupportId: {
      C1: ["Arcana"]
    }
  } as unknown as RulesIndex;

  const build = {
    raceId: "R1",
    classId: "C1",
    raceSelections: { "skillTraining:TR:0": "SK_DIP" },
    trainedSkillIds: ["SK_DIP"]
  } as CharacterBuild;

  it("merges manual picks with current auto-grants", () => {
    const prevAuto = new Set<string>();
    const next = reconcileTrainedSkillIds(index, build, build.trainedSkillIds, prevAuto);
    expect(next).toEqual(expect.arrayContaining(["SK_ARC", "SK_DIP"]));
    expect(next).toHaveLength(2);

    const again = reconcileTrainedSkillIds(index, build, next, new Set(autoGrantedTrainedSkillIds(index, build)));
    expect(again).toEqual(next);
  });
});
