import { describe, expect, it } from "vitest";
import { validateMulticlassFeats } from "../../src/rules/multiclassValidation";
import type { CharacterBuild, RulesIndex } from "../../src/rules/models";

const index = {
  classes: [
    { id: "c_rogue", name: "Rogue", slug: "rogue", raw: {} },
    { id: "c_fighter", name: "Fighter", slug: "fighter", raw: {} }
  ],
  feats: [
    {
      id: "mc_rogue",
      name: "Sneak of Shadows",
      slug: "sneak-of-shadows",
      hasMulticlassGrant: true,
      countsAsClassNames: ["Rogue"],
      prereqTokens: [],
      raw: {}
    },
    {
      id: "mc_fighter",
      name: "Soldier of the Faith",
      slug: "soldier",
      hasMulticlassGrant: true,
      countsAsClassNames: ["Fighter"],
      prereqTokens: [],
      raw: {}
    },
    { id: "novice", name: "Novice Power", slug: "novice", prereqTokens: [], raw: {} },
    { id: "acolyte", name: "Acolyte Power", slug: "acolyte", prereqTokens: [], raw: {} }
  ],
  hybridClasses: [],
  skills: [],
  powers: [],
  races: [],
  languages: [],
  racialTraits: [],
  classFeatures: [],
  armors: [],
  weapons: [],
  implements: [],
  abilityScores: [],
  themes: [],
  paragonPaths: [],
  epicDestinies: []
} as unknown as RulesIndex;

const baseBuild: CharacterBuild = {
  name: "Test",
  level: 8,
  raceId: "r1",
  classId: "c_rogue",
  abilityScores: { STR: 10, CON: 10, DEX: 16, INT: 10, WIS: 10, CHA: 10 },
  trainedSkillIds: [],
  featIds: [],
  powerIds: []
};

describe("validateMulticlassFeats", () => {
  it("flags multiclass training for your own class", () => {
    const errors = validateMulticlassFeats(index, { ...baseBuild, featIds: ["mc_rogue"] });
    expect(errors.some((e) => e.includes("already your class"))).toBe(true);
  });

  it("allows training in a different class", () => {
    const errors = validateMulticlassFeats(index, { ...baseBuild, featIds: ["mc_fighter"] });
    expect(errors).toEqual([]);
  });

  it("rejects two entry multiclass feats", () => {
    const errors = validateMulticlassFeats(index, {
      ...baseBuild,
      classId: "c_fighter",
      featIds: ["mc_rogue", "mc_fighter"]
    });
    expect(errors.some((e) => e.includes("Only one multiclass training"))).toBe(true);
  });

  it("requires entry feat before Novice Power", () => {
    const errors = validateMulticlassFeats(index, { ...baseBuild, featIds: ["novice"] });
    expect(errors.some((e) => e.includes("multiclass training"))).toBe(true);
  });

  it("requires Novice before Acolyte", () => {
    const errors = validateMulticlassFeats(index, {
      ...baseBuild,
      classId: "c_fighter",
      featIds: ["mc_rogue", "acolyte"]
    });
    expect(errors.some((e) => e.includes("Novice Power"))).toBe(true);
  });
});
