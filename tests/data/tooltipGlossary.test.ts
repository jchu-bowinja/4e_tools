import { afterEach, describe, expect, it, vi } from "vitest";
import {
  abilityTooltipResolveTerms,
  displayTextForGlossaryRow,
  loadTooltipGlossary,
  resolveTooltipText,
  sanitizeGlossaryRows
} from "../../src/data/tooltipGlossary";

describe("abilityTooltipResolveTerms", () => {
  it("orders full name and code before generic Ability Score", () => {
    expect(abilityTooltipResolveTerms("STR", "Strength")).toEqual(["Strength", "STR", "Ability Score"]);
  });

  it("dedupes when rules name matches full name", () => {
    expect(abilityTooltipResolveTerms("DEX", "Dexterity")).toEqual(["Dexterity", "DEX", "Ability Score"]);
  });

  it("lets resolveTooltipText match a specific ability before generic ability scores", () => {
    const glossaryByName = {
      strength: "STR-specific body",
      "ability scores": "Generic ability scores body",
      "ability score": "Generic singular body"
    };
    const terms = abilityTooltipResolveTerms("STR", "Strength");
    expect(resolveTooltipText({ terms, glossaryByName })).toBe("STR-specific body");
  });
});

describe("resolveTooltipText range normalization", () => {
  it("resolves Melee X and Ranged X to base glossary keys", () => {
    const glossaryByName = {
      melee: "Melee glossary",
      ranged: "Ranged glossary"
    };
    expect(resolveTooltipText({ terms: ["Melee 1"], glossaryByName })).toBe("Melee glossary");
    expect(resolveTooltipText({ terms: ["Ranged 10"], glossaryByName })).toBe("Ranged glossary");
  });

  it("resolves Close burst/blast X to base glossary keys", () => {
    const glossaryByName = {
      "close burst": "Close burst glossary",
      "close blast": "Close blast glossary"
    };
    expect(resolveTooltipText({ terms: ["Close burst 2"], glossaryByName })).toBe("Close burst glossary");
    expect(resolveTooltipText({ terms: ["Close blast 5"], glossaryByName })).toBe("Close blast glossary");
  });

  it("resolves Reach X to the Reach glossary key", () => {
    const glossaryByName = {
      reach: "Reach glossary"
    };
    expect(resolveTooltipText({ terms: ["Reach 3"], glossaryByName })).toBe("Reach glossary");
  });

  it("resolves skill phrase variants via glossary lookup keys", () => {
    const glossaryByName = {
      acrobatics: "Balance and tumbling skill text."
    };
    expect(resolveTooltipText({ terms: ["Acrobatics (Dex)"], glossaryByName })).toBe(
      "Balance and tumbling skill text."
    );
    expect(resolveTooltipText({ terms: ["Acrobatics check"], glossaryByName })).toBe(
      "Balance and tumbling skill text."
    );
    expect(resolveTooltipText({ terms: ["Acrobatics skill check"], glossaryByName })).toBe(
      "Balance and tumbling skill text."
    );
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
    expect(resolveTooltipText({ terms: ["Close blast 5"], glossaryByName: glossary })).toBe(
      definitionText
    );
    expect(resolveTooltipText({ terms: ["Close burst 3"], glossaryByName: glossary })).toBe(
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

describe("displayTextForGlossaryRow", () => {
  it("preserves readable structure for glossary HTML tables", () => {
    const text = displayTextForGlossaryRow({
      name: "Skills",
      definition: null,
      html:
        "<h1 class=player>Skills</h1><table><tr><th>Skill</th><th>Key Ability</th></tr><tr><td>Acrobatics</td><td>Dexterity</td></tr><tr><td>Arcana</td><td>Intelligence</td></tr></table><p class=publishedIn>Published in Rules Compendium, page(s) 125.</p>"
    });
    expect(text).toContain("Skills");
    expect(text).toContain("Skill | Key Ability");
    expect(text).toContain("Acrobatics | Dexterity");
    expect(text).toContain("Arcana | Intelligence");
    expect(text).toContain("Published in Rules Compendium, page(s) 125.");
  });
});
