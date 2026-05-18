import { describe, expect, it } from "vitest";
import { autoGrantedTrainedSkillIds } from "../../src/rules/grantedSkillsQuery";
import type { CharacterBuild, RulesIndex } from "../../src/rules/models";

describe("feat-granted skill training", () => {
  it("includes skills from feat Skill Training grants", () => {
    const index = {
      skills: [{ id: "sk_thief", name: "Thievery", slug: "thievery", raw: {} }],
      autoGrantedSkillTrainingNamesBySupportId: {},
      feats: [
        {
          id: "mc1",
          name: "Sneak of Shadows",
          slug: "sneak",
          grantedSkillTrainingIds: ["sk_thief"],
          prereqTokens: [],
          raw: {}
        }
      ]
    } as unknown as RulesIndex;
    const build = {
      featIds: ["mc1"],
      trainedSkillIds: [],
      level: 4
    } as CharacterBuild;
    expect(autoGrantedTrainedSkillIds(index, build)).toEqual(["sk_thief"]);
  });
});
