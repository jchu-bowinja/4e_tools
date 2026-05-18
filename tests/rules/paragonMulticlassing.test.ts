import { describe, expect, it } from "vitest";
import {
  canChooseParagonMulticlassing,
  hasFullMulticlassPowerChain,
  multiclassEntryClassId,
  validateParagonMulticlassing
} from "../../src/rules/paragonMulticlassing";
import type { CharacterBuild, RulesIndex } from "../../src/rules/models";

const index = {
  classes: [{ id: "c_rogue", name: "Rogue", slug: "rogue", raw: {} }],
  feats: [
    {
      id: "mc",
      name: "Sneak of Shadows",
      slug: "sos",
      hasMulticlassGrant: true,
      countsAsClassNames: ["Rogue"],
      countsAsClassIds: ["c_rogue"],
      prereqTokens: [],
      raw: {}
    },
    { id: "n", name: "Novice Power", slug: "n", prereqTokens: [], raw: {} },
    { id: "a", name: "Acolyte Power", slug: "a", prereqTokens: [], raw: {} },
    { id: "d", name: "Adept Power", slug: "d", prereqTokens: [], raw: {} }
  ],
  powers: [],
  skills: [],
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

const build: CharacterBuild = {
  name: "T",
  level: 11,
  raceId: "r1",
  classId: "c_fighter",
  abilityScores: { STR: 16, CON: 12, DEX: 14, INT: 10, WIS: 10, CHA: 10 },
  trainedSkillIds: [],
  featIds: ["mc", "n", "a", "d"],
  powerIds: []
};

describe("paragonMulticlassing", () => {
  it("detects full power chain", () => {
    expect(hasFullMulticlassPowerChain(index, build)).toBe(true);
    expect(canChooseParagonMulticlassing(index, build)).toBe(true);
    expect(multiclassEntryClassId(index, build)).toBe("c_rogue");
  });

  it("rejects paragon path and paragon multiclassing together", () => {
    const errors = validateParagonMulticlassing(index, {
      ...build,
      paragonMulticlassing: true,
      paragonPathId: "pp1"
    });
    expect(errors.some((e) => e.includes("Clear paragon path"))).toBe(true);
  });
});
