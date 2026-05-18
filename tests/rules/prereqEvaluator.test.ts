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

  it("accepts Novice Power when a multiclass entry feat is selected", () => {
    const tokens: PrereqToken[] = [
      { kind: "multiclassEntry", value: true },
      { kind: "levelAtLeast", value: 4 }
    ];
    const indexWithMc = {
      ...miniIndex,
      feats: [
        {
          id: "mc1",
          name: "Sneak of Shadows",
          slug: "sneak",
          hasMulticlassGrant: true,
          countsAsClassNames: ["Rogue"],
          prereqTokens: [],
          raw: {}
        }
      ]
    } as unknown as RulesIndex;
    const mcBuild = { ...build, featIds: ["mc1"], level: 4 };
    const result = evaluatePrereqs(tokens, mcBuild, raceMap, classMap, skillMap, {
      index: indexWithMc
    });
    expect(result.ok).toBe(true);
  });

  it("accepts class prereq satisfied by CountsAsClass on a selected feat", () => {
    const tokens: PrereqToken[] = [{ kind: "class", value: "Rogue" }];
    const indexWithMc = {
      ...miniIndex,
      feats: [
        {
          id: "mc1",
          name: "Sneak of Shadows",
          slug: "sneak-of-shadows",
          countsAsClassNames: ["Rogue"],
          prereqTokens: [],
          raw: {}
        }
      ]
    } as unknown as RulesIndex;
    const mcBuild = { ...build, featIds: ["mc1"] };
    const result = evaluatePrereqs(tokens, mcBuild, raceMap, classMap, skillMap, {
      index: indexWithMc
    });
    expect(result.ok).toBe(true);
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

  it("evaluates bloodline anyOf for heritage feats", () => {
    const tokens: PrereqToken[] = [
      {
        kind: "anyOf",
        options: [
          { kind: "negatedTag", value: "bloodline" },
          { kind: "heritage", value: "Vampire" }
        ]
      }
    ];
    const indexVamp = {
      ...miniIndex,
      feats: [
        {
          id: "vh1",
          name: "Vampiric Heritage",
          slug: "vampiric",
          internalGrantKeys: ["BLOODLINE", "VAMPIRE_BLOODLINE"],
          prereqTokens: [],
          raw: {}
        }
      ]
    } as unknown as RulesIndex;
    const vampBuild = { ...build, featIds: ["vh1"] };
    const ok = evaluatePrereqs(tokens, vampBuild, raceMap, classMap, skillMap, { index: indexVamp });
    expect(ok.ok).toBe(true);

    const indexElan = {
      ...miniIndex,
      feats: [
        {
          id: "eh1",
          name: "Elan Heritage",
          slug: "elan",
          internalGrantKeys: ["BLOODLINE", "ELAN_BLOODLINE"],
          prereqTokens: [],
          raw: {}
        }
      ]
    } as unknown as RulesIndex;
    const elanBuild = { ...build, featIds: ["eh1"] };
    const blocked = evaluatePrereqs(tokens, elanBuild, raceMap, classMap, skillMap, { index: indexElan });
    expect(blocked.ok).toBe(false);
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
