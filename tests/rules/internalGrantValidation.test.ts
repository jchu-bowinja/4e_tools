import { describe, expect, it } from "vitest";
import { validateInternalGrantFeats } from "../../src/rules/internalGrantValidation";
import type { CharacterBuild, RulesIndex } from "../../src/rules/models";

const index = {
  feats: [
    {
      id: "p1",
      name: "Demanding Talent",
      internalGrantKeys: ["PSIONIC_SECOND_CLASS"],
      prereqTokens: [],
      raw: {}
    },
    {
      id: "p2",
      name: "Fervent Talent",
      internalGrantKeys: ["PSIONIC_SECOND_CLASS"],
      prereqTokens: [],
      raw: {}
    },
    {
      id: "h1",
      name: "Vampiric Heritage",
      internalGrantKeys: ["HERITAGE", "BLOODLINE", "VAMPIRE_BLOODLINE"],
      prereqTokens: [],
      raw: {}
    },
    {
      id: "h2",
      name: "Elan Heritage",
      internalGrantKeys: ["HERITAGE", "BLOODLINE", "ELAN_BLOODLINE"],
      prereqTokens: [],
      raw: {}
    }
  ]
} as unknown as RulesIndex;

describe("validateInternalGrantFeats", () => {
  it("allows one psionic second-class talent", () => {
    const build = { featIds: ["p1"] } as CharacterBuild;
    expect(validateInternalGrantFeats(index, build)).toEqual([]);
  });

  it("rejects two psionic second-class talents", () => {
    const build = { featIds: ["p1", "p2"] } as CharacterBuild;
    expect(validateInternalGrantFeats(index, build).some((e) => e.includes("psionic"))).toBe(true);
  });

  it("rejects two heritage feats", () => {
    const build = { featIds: ["h1", "h2"] } as CharacterBuild;
    expect(validateInternalGrantFeats(index, build).some((e) => e.includes("heritage"))).toBe(true);
  });
});
