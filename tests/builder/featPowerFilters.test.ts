import { describe, expect, it } from "vitest";
import {
  filterFeatOptions,
  ensureSelectedFeatInList,
  ensureSelectedFeatsInList,
  filterFeatOptionsByQuery,
  filterLegalFeatOptions,
  filterPowersByQuery,
  formatFeatFacetMultiSelectSummary,
  formatFeatSourceFilterSummary,
  getFeatFacetCategory,
  matchesFeatCategoryFilter,
  matchesFeatSearch,
  matchesFeatSourceFilter,
  matchesFeatTierFilter,
  sortFeatOptions
} from "../../src/features/builder/featPowerFilters";
import rulesIndex from "../../generated/rules_index.json";
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
  it("matches name substring by default", () => {
    expect(matchesFeatSearch(feat("1", "Toughness"), "tough")).toBe(true);
    expect(matchesFeatSearch(feat("1", "Toughness"), "xyz")).toBe(false);
  });

  it("matches slug when not using filterAllText", () => {
    expect(matchesFeatSearch(feat("1", "Combat Reflexes", "PHB", { slug: "combat-reflexes" }), "reflexes")).toBe(true);
  });

  it("does not match source unless filterAllText is enabled", () => {
    expect(matchesFeatSearch(feat("1", "Foo", "Player's Handbook"), "handbook")).toBe(false);
    expect(matchesFeatSearch(feat("1", "Foo", "Player's Handbook"), "handbook", true)).toBe(true);
  });

  it("matches tags and prerequisite summary when filterAllText is enabled", () => {
    const row = feat("1", "Reactive Blade", "Martial Power", {
      tags: ["Weapon", "Combat"],
      prereqSummary: "Level 11+; Class: Fighter"
    });
    expect(matchesFeatSearch(row, "weapon")).toBe(false);
    expect(matchesFeatSearch(row, "fighter")).toBe(false);
    expect(matchesFeatSearch(row, "weapon", true)).toBe(true);
    expect(matchesFeatSearch(row, "fighter", true)).toBe(true);
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

describe("ensureSelectedFeatsInList", () => {
  it("prepends selected feats hidden by facet filters", () => {
    const tough = resolved(feat("t1", "Toughness"));
    const other = resolved(feat("o1", "Combat Reflexes"));
    const pool = [tough, other];
    const filtered = [tough];
    expect(ensureSelectedFeatsInList(filtered, ["o1"], pool).map((x) => x.item.id)).toEqual(["o1", "t1"]);
  });

  it("would pollute a name-only text filter if applied while query is active", () => {
    const tough = resolved(feat("t1", "Toughness"));
    const other = resolved(feat("o1", "Combat Reflexes"));
    const pool = [tough, other];
    const nameFiltered = filterFeatOptionsByQuery(pool, "tough");
    const polluted = ensureSelectedFeatsInList(nameFiltered, ["o1"], pool);
    expect(polluted.map((x) => x.item.id)).toEqual(["o1", "t1"]);
    expect(polluted.some((x) => !x.item.name.toLowerCase().includes("tough"))).toBe(true);
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

  it("filters by tier/category/source include and name query", () => {
    const out = filterFeatOptions(rows, {
      query: "paragon",
      tiers: ["PARAGON"],
      categories: ["Defense"],
      source: { mode: "include", sources: ["PHB2"] }
    });
    expect(out.map((x) => x.item.id)).toEqual(["p1"]);
  });

  it("filters by full feat text when filterAllText is enabled", () => {
    const out = filterFeatOptions(rows, {
      query: "defense",
      filterAllText: true,
      tiers: ["PARAGON"],
      categories: ["Defense"],
      source: { mode: "include", sources: ["PHB2"] }
    });
    expect(out.map((x) => x.item.id)).toEqual(["p1"]);
  });

  it("supports all filters as pass-through", () => {
    const out = filterFeatOptions(rows, {
      query: "",
      tiers: [],
      categories: [],
      source: { mode: "all", sources: [] }
    });
    expect(out.map((x) => x.item.id)).toEqual(["h1", "p1", "e1"]);
  });

  it("matches any selected tier (OR within tier)", () => {
    const out = filterFeatOptions(rows, {
      query: "",
      tiers: ["HEROIC", "EPIC"],
      categories: [],
      source: { mode: "all", sources: [] }
    });
    expect(out.map((x) => x.item.id)).toEqual(["h1", "e1"]);
  });

  it("matches any selected category (OR within category)", () => {
    const out = filterFeatOptions(rows, {
      query: "",
      tiers: [],
      categories: ["Class", "Weapon"],
      source: { mode: "all", sources: [] }
    });
    expect(out.map((x) => x.item.id)).toEqual(["h1", "e1"]);
  });

  it("ANDs tier and category dimensions", () => {
    const out = filterFeatOptions(rows, {
      query: "",
      tiers: ["HEROIC", "PARAGON"],
      categories: ["Defense"],
      source: { mode: "all", sources: [] }
    });
    expect(out.map((x) => x.item.id)).toEqual(["p1"]);
  });
});

describe("matchesFeatTierFilter", () => {
  it("passes when no tiers selected", () => {
    expect(matchesFeatTierFilter(feat("1", "A", "PHB", { tier: "Heroic" }), [])).toBe(true);
  });

  it("matches when feat tier is in selected set", () => {
    expect(matchesFeatTierFilter(feat("1", "A", "PHB", { tier: "Paragon" }), ["PARAGON", "EPIC"])).toBe(true);
    expect(matchesFeatTierFilter(feat("1", "A", "PHB", { tier: "Heroic" }), ["PARAGON"])).toBe(false);
  });
});

describe("matchesFeatCategoryFilter", () => {
  it("passes when no categories selected", () => {
    expect(matchesFeatCategoryFilter(feat("1", "A", "PHB", { category: "Defense" }), [])).toBe(true);
  });

  it("matches when facet category is in selected set (case-insensitive)", () => {
    expect(matchesFeatCategoryFilter(feat("1", "A", "PHB", { category: "Defense" }), ["defense", "class"])).toBe(true);
    expect(matchesFeatCategoryFilter(feat("1", "A", "PHB", { category: "Weapon" }), ["Class"])).toBe(false);
  });
});

describe("formatFeatFacetMultiSelectSummary", () => {
  it("shows all label when nothing selected", () => {
    expect(formatFeatFacetMultiSelectSummary("Tier", [], "All tiers")).toBe("All tiers");
  });

  it("lists selected labels with prefix", () => {
    expect(formatFeatFacetMultiSelectSummary("Tier", ["Heroic", "Paragon"], "All tiers")).toBe("Tier: Heroic, Paragon");
  });
});

describe("formatFeatSourceFilterSummary", () => {
  it("shows all label when mode is all or no sources selected", () => {
    expect(formatFeatSourceFilterSummary({ mode: "all", sources: [] })).toBe("All sources");
    expect(formatFeatSourceFilterSummary({ mode: "include", sources: [] })).toBe("All sources");
    expect(formatFeatSourceFilterSummary({ mode: "exclude", sources: [] })).toBe("All sources");
  });

  it("lists selected sources with include or exclude prefix", () => {
    expect(formatFeatSourceFilterSummary({ mode: "include", sources: ["PHB", "PHB2"] })).toBe(
      "Include: PHB, PHB2"
    );
    expect(formatFeatSourceFilterSummary({ mode: "exclude", sources: ["Dragon"] })).toBe("Exclude: Dragon");
  });
});

describe("matchesFeatSourceFilter", () => {
  it("includes only selected sources", () => {
    expect(matchesFeatSourceFilter(feat("1", "A", "PHB"), { mode: "include", sources: ["PHB"] })).toBe(true);
    expect(matchesFeatSourceFilter(feat("1", "A", "PHB2"), { mode: "include", sources: ["PHB"] })).toBe(false);
  });

  it("excludes selected sources", () => {
    expect(matchesFeatSourceFilter(feat("1", "A", "PHB"), { mode: "exclude", sources: ["PHB2"] })).toBe(true);
    expect(matchesFeatSourceFilter(feat("1", "A", "PHB2"), { mode: "exclude", sources: ["PHB2"] })).toBe(false);
  });

  it("passes through when mode is all or no sources selected", () => {
    expect(matchesFeatSourceFilter(feat("1", "A", "PHB"), { mode: "all", sources: [] })).toBe(true);
    expect(matchesFeatSourceFilter(feat("1", "A", "PHB"), { mode: "include", sources: [] })).toBe(true);
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

describe("feat filter with rules index", () => {
  it("keeps only feats whose names or slugs match the text filter", () => {
    const options = rulesIndex.feats.map((item) => ({ item, legal: true, reasons: [] }));
    const filtered = filterFeatOptionsByQuery(options, "tough");
    expect(filtered.some((o) => o.item.name === "Toughness")).toBe(true);
    expect(
      filtered.every(
        (o) => o.item.name.toLowerCase().includes("tough") || o.item.slug.toLowerCase().includes("tough")
      )
    ).toBe(true);
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
