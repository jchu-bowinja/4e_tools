import { describe, expect, it } from "vitest";
import { validateRulesIndexShape } from "../../src/data/loadRules";

describe("validateRulesIndexShape", () => {
  it("throws when a required dataset is missing", () => {
    expect(() =>
      validateRulesIndexShape({
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
        epicDestinies: []
      } as never)
    ).toThrow(/races/);
  });

  it("defaults optional datasets used by builder logic", () => {
    const shape = validateRulesIndexShape({
      races: [],
      classes: [],
      feats: [],
      powers: [],
      skills: [],
      languages: [],
      armors: [],
      abilityScores: [],
      racialTraits: []
    } as never);
    expect(shape.hybridClasses).toEqual([]);
    expect(shape.weapons).toEqual([]);
    expect(shape.implements).toEqual([]);
    expect(shape.autoGrantedPowerIdsByClassId).toEqual({});
    expect(shape.classBuildOptionsByClassId).toEqual({});
  });
});
