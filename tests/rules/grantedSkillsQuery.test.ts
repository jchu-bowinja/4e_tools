import { describe, expect, it } from "vitest";
import {
  autoGrantedTrainedSkillIds,
  effectiveTrainedSkillIdsForBuild
} from "../../src/rules/grantedSkillsQuery";
import type { CharacterBuild, RulesIndex } from "../../src/rules/models";

describe("autoGrantedTrainedSkillIds", () => {
  it("maps support ids to trained skill ids", () => {
    const index = {
      skills: [
        { id: "SK_ARC", name: "Arcana", slug: "arcana", raw: {} },
        { id: "SK_REL", name: "Religion", slug: "religion", raw: {} }
      ],
      feats: [],
      autoGrantedSkillTrainingNamesBySupportId: {
        ID_FMP_CLASS_9: ["Arcana"],
        ID_FMP_CLASS_2: ["Religion"]
      }
    } as unknown as RulesIndex;
    const build = { classId: "ID_FMP_CLASS_9" } as CharacterBuild;
    expect(autoGrantedTrainedSkillIds(index, build)).toEqual(["SK_ARC"]);
  });

  it("includes racial bonus skills when trained on the Skills tab (not via raceSelections)", () => {
    const index = {
      skills: [{ id: "SK_DIP", name: "Diplomacy", slug: "diplomacy", raw: {} }],
      feats: [],
      races: [{ id: "R_H", name: "Human", slug: "human", raw: {} }]
    } as unknown as RulesIndex;
    const build = {
      raceId: "R_H",
      raceSelections: { "skillTraining:TR_HUMAN_SKILL:0": "SK_DIP" },
      trainedSkillIds: ["SK_DIP"]
    } as CharacterBuild;
    expect(autoGrantedTrainedSkillIds(index, build)).toEqual([]);
    expect(effectiveTrainedSkillIdsForBuild(index, build)).toEqual(["SK_DIP"]);
  });
});

