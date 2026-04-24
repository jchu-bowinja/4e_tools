import { afterEach, describe, expect, it, vi } from "vitest";
import { loadTooltipGlossary, resolveTooltipText, sanitizeGlossaryRows } from "../../src/data/tooltipGlossary";
import type { RulesIndex } from "../../src/rules/models";

function emptyIndex(): RulesIndex {
  return {
    races: [],
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
    epicDestinies: [],
    hybridClasses: [],
    weapons: [],
    implements: [],
    autoGrantedPowerIdsByClassId: {},
    autoGrantedSkillTrainingNamesBySupportId: {},
    classBuildOptionsByClassId: {}
  };
}

describe("resolveTooltipText range normalization", () => {
  it("resolves Melee X and Ranged X to base glossary keys", () => {
    const glossaryByName = {
      melee: "Melee glossary",
      ranged: "Ranged glossary"
    };
    expect(resolveTooltipText({ terms: ["Melee 1"], glossaryByName, index: emptyIndex() })).toBe("Melee glossary");
    expect(resolveTooltipText({ terms: ["Ranged 10"], glossaryByName, index: emptyIndex() })).toBe("Ranged glossary");
  });

  it("resolves Close burst/blast X to base glossary keys", () => {
    const glossaryByName = {
      "close burst": "Close burst glossary",
      "close blast": "Close blast glossary"
    };
    expect(resolveTooltipText({ terms: ["Close burst 2"], glossaryByName, index: emptyIndex() })).toBe("Close burst glossary");
    expect(resolveTooltipText({ terms: ["Close blast 5"], glossaryByName, index: emptyIndex() })).toBe("Close blast glossary");
  });

  it("resolves Reach X to the Reach glossary key", () => {
    const glossaryByName = {
      reach: "Reach glossary"
    };
    expect(resolveTooltipText({ terms: ["Reach 3"], glossaryByName, index: emptyIndex() })).toBe("Reach glossary");
  });
});

describe("loadTooltipGlossary aliases", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("indexes both name and aliases to the same glossary text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => [
          {
            name: "Melee",
            aliases: ["melee", "Melee weapon", "Melee touch"],
            definition: "Melee glossary text",
            html: null
          }
        ]
      }))
    );
    const glossary = await loadTooltipGlossary();
    expect(glossary["melee"]).toBe("Melee glossary text");
    expect(glossary["melee weapon"]).toBe("Melee glossary text");
    expect(glossary["melee touch"]).toBe("Melee glossary text");
  });

  it("keeps canonical entry precedence when a later row reuses an alias", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => [
          { name: "Standard Action", aliases: ["standard"], definition: "Canonical standard text", html: null },
          { name: "standard", definition: "Later duplicate text", html: null }
        ]
      }))
    );
    const glossary = await loadTooltipGlossary();
    expect(glossary["standard"]).toBe("Canonical standard text");
    expect(glossary["standard action"]).toBe("Canonical standard text");
  });
});

describe("close blast / close burst with generated glossary aliases", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resolves Close blast 5 and Close burst 3 using the real Close entry shape", async () => {
    const definitionText = "Close area-of-effect text";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => [
          {
            name: "Close",
            aliases: ["close", "close blast", "close burst", "close blast 5", "close burst 3"],
            definition: definitionText,
            html: null
          }
        ]
      }))
    );

    const glossary = await loadTooltipGlossary();
    expect(resolveTooltipText({ terms: ["Close blast 5"], glossaryByName: glossary, index: emptyIndex() })).toBe(
      definitionText
    );
    expect(resolveTooltipText({ terms: ["Close burst 3"], glossaryByName: glossary, index: emptyIndex() })).toBe(
      definitionText
    );
  });
});

describe("sanitizeGlossaryRows", () => {
  it("removes numbered range aliases", () => {
    const rows = sanitizeGlossaryRows([
      {
        name: "Melee",
        aliases: ["melee", "melee weapon", "melee 1", "reach 10", "close burst 3"],
        definition: "text"
      }
    ]);
    expect(rows[0]?.aliases).toEqual(["melee", "melee weapon"]);
  });
});
