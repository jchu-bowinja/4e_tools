import { describe, expect, it } from "vitest";
import { autoGrantedTrainedSkillIds } from "../../src/rules/grantedSkillsQuery";
import type { CharacterBuild, RulesIndex } from "../../src/rules/models";

describe("autoGrantedTrainedSkillIds", () => {
  it("maps support ids to trained skill ids", () => {
    const index = {
      skills: [
        { id: "SK_ARC", name: "Arcana", slug: "arcana", raw: {} },
        { id: "SK_REL", name: "Religion", slug: "religion", raw: {} }
      ],
      autoGrantedSkillTrainingNamesBySupportId: {
        ID_FMP_CLASS_9: ["Arcana"],
        ID_FMP_CLASS_2: ["Religion"]
      }
    } as unknown as RulesIndex;
    const build = { classId: "ID_FMP_CLASS_9" } as CharacterBuild;
    expect(autoGrantedTrainedSkillIds(index, build)).toEqual(["SK_ARC"]);
  });
});

