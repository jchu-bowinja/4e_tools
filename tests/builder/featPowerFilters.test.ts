import { describe, expect, it } from "vitest";
import {
  filterFeatOptions,
  ensureSelectedFeatInList,
  filterFeatOptionsByQuery,
  filterLegalFeatOptions,
  filterPowersByQuery,
  getFeatFacetCategory,
  matchesFeatSearch,
  sortFeatOptions
} from "../../src/features/builder/featPowerFilters";
import type { Feat, Power } from "../../src/rules/models";
import type { ResolvedOption } from "../../src/rules/optionResolver";

function feat(id: string, name: string, source?: string, extra?: Partial<Feat>): Feat {
  return {
    id,
    name,
    slug: name.toLowerCase().replace(/\s+/g, "-"),
    source: source ?? null,
    tier: null,
    category: null,
    tags: [],
    prereqSummary: null,
    prereqTokens: [],
    raw: {},
    ...extra
  };
}

function resolved(f: Feat, legal = true): ResolvedOption<Feat> {
  return { item: f, legal, reasons: legal ? [] : ["x"] };
}

describe("matchesFeatSearch", () => {
  it("matches name substring", () => {
    expect(matchesFeatSearch(feat("1", "Toughness"), "tough")).toBe(true);
    expect(matchesFeatSearch(feat("1", "Toughness"), "xyz")).toBe(false);
  });

  it("matches source", () => {
    expect(matchesFeatSearch(feat("1", "Foo", "Player's Handbook"), "handbook")).toBe(true);
  });

  it("matches tags and prerequisite summary text", () => {
    const row = feat("1", "Reactive Blade", "Martial Power", {
      tags: ["Weapon", "Combat"],
      prereqSummary: "Level 11+; Class: Fighter"
    });
    expect(matchesFeatSearch(row, "weapon")).toBe(true);
    expect(matchesFeatSearch(row, "fighter")).toBe(true);
  });
});

describe("filterFeatOptionsByQuery", () => {
  it("returns all when query empty", () => {
    const list = [resolved(feat("a", "A")), resolved(feat("b", "B"))];
    expect(filterFeatOptionsByQuery(list, "  ")).toEqual(list);
  });

  it("filters by name", () => {
    const list = [resolved(feat("a", "Alpha")), resolved(feat("b", "Beta"))];
    expect(filterFeatOptionsByQuery(list, "alp").map((x) => x.item.id)).toEqual(["a"]);
  });

  it("alias filterLegalFeatOptions matches filterFeatOptionsByQuery", () => {
    const list = [resolved(feat("a", "A"))];
    expect(filterLegalFeatOptions(list, "a")).toEqual(filterFeatOptionsByQuery(list, "a"));
  });
});

describe("ensureSelectedFeatInList", () => {
  it("prepends selected when hidden by filter", () => {
    const a = resolved(feat("a", "Alpha"));
    const b = resolved(feat("b", "Beta"));
    const pool = [a, b];
    const filtered = [b];
    const out = ensureSelectedFeatInList(filtered, "a", pool);
    expect(out.map((x) => x.item.id)).toEqual(["a", "b"]);
  });

  it("prepends illegal selected when only legal rows are displayed", () => {
    const legal = resolved(feat("a", "Alpha"), true);
    const illegal = resolved(feat("b", "Bad"), false);
    const full = [legal, illegal];
    const displayedLegalOnly = [legal];
    const out = ensureSelectedFeatInList(displayedLegalOnly, "b", full);
    expect(out.map((x) => x.item.id)).toEqual(["b", "a"]);
  });

  it("does not duplicate when selected already in list", () => {
    const a = resolved(feat("a", "Alpha"));
    const pool = [a];
    expect(ensureSelectedFeatInList([a], "a", pool)).toEqual([a]);
  });
});

describe("getFeatFacetCategory", () => {
  it("uses normalized feat category when present", () => {
    expect(getFeatFacetCategory(feat("1", "A", "PHB", { category: "Defense", tags: ["Mobility"] }))).toBe("Defense");
  });

  it("falls back to first non-tier tag", () => {
    expect(getFeatFacetCategory(feat("1", "A", "PHB", { tags: ["Tier: Heroic", "Weapon"] }))).toBe("Weapon");
  });

  it("defaults to General when no metadata exists", () => {
    expect(getFeatFacetCategory(feat("1", "A", "PHB", { category: null, tags: [] }))).toBe("General");
  });
});

describe("filterFeatOptions", () => {
  const rows = [
    resolved(feat("h1", "Adept Dilettante", "PHB", { tier: "Heroic", category: "Class", tags: ["Class"] })),
    resolved(feat("p1", "Paragon Defense", "PHB2", { tier: "Paragon", category: "Defense", tags: ["Defense"] })),
    resolved(feat("e1", "Epic Accuracy", "Dragon", { tier: "Epic", category: "Weapon", tags: ["Weapon"] }))
  ];

  it("filters by tier/category/source and text query", () => {
    const out = filterFeatOptions(rows, {
      query: "defense",
      tier: "PARAGON",
      category: "Defense",
      source: "PHB2"
    });
    expect(out.map((x) => x.item.id)).toEqual(["p1"]);
  });

  it("supports all filters as pass-through", () => {
    const out = filterFeatOptions(rows, { query: "", tier: "all", category: "all", source: "all" });
    expect(out.map((x) => x.item.id)).toEqual(["h1", "p1", "e1"]);
  });
});

describe("sortFeatOptions", () => {
  const rows = [
    resolved(feat("p2", "Paragon B", "X", { tier: "Paragon" })),
    resolved(feat("h2", "Heroic A", "Y", { tier: "Heroic" })),
    resolved(feat("e2", "Epic C", "A", { tier: "Epic" })),
    resolved(feat("h3", "Heroic Z", "A", { tier: "Heroic" }))
  ];

  it("sorts by tier then alpha", () => {
    expect(sortFeatOptions(rows, "tier-alpha").map((x) => x.item.id)).toEqual(["h2", "h3", "p2", "e2"]);
  });

  it("sorts by source then alpha", () => {
    expect(sortFeatOptions(rows, "source-alpha").map((x) => x.item.id)).toEqual(["e2", "h3", "p2", "h2"]);
  });
});

describe("filterPowersByQuery", () => {
  it("filters by name and keywords", () => {
    const p1: Power = {
      id: "p1",
      name: "Cleave",
      slug: "cleave",
      usage: "At-Will",
      raw: { specific: { Keywords: "Weapon" } }
    } as Power;
    const p2: Power = {
      id: "p2",
      name: "Second Wind",
      slug: "second-wind",
      usage: "Encounter",
      raw: {}
    } as Power;
    expect(filterPowersByQuery([p1, p2], "cleave").map((p) => p.id)).toEqual(["p1"]);
    expect(filterPowersByQuery([p1, p2], "weapon").map((p) => p.id)).toEqual(["p1"]);
    expect(filterPowersByQuery([p1, p2], "").length).toBe(2);
  });
});
