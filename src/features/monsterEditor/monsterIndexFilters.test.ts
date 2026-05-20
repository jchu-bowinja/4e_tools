import { describe, expect, it } from "vitest";
import type { MonsterIndexEntry } from "./storage";
import {
  collectMonsterIndexFilterOptions,
  entryMatchesKeywordFilter,
  entryMatchesSourceBookFilter,
  filterAndSortMonsterIndexRows,
  monsterIndexHasActiveFilters,
  parseLevelFilter
} from "./monsterIndexFilters";

function row(partial: Partial<MonsterIndexEntry> & Pick<MonsterIndexEntry, "id" | "name" | "level" | "role">): MonsterIndexEntry {
  return {
    fileName: `${partial.id}.json`,
    relativePath: "",
    parseError: "",
    ...partial
  };
}

describe("parseLevelFilter", () => {
  it("parses exact level", () => {
    expect(parseLevelFilter("7")).toEqual({ exact: 7 });
  });

  it("parses range", () => {
    expect(parseLevelFilter("3-5")).toEqual({ range: { min: 3, max: 5 } });
    expect(parseLevelFilter("8-2")).toEqual({ range: { min: 2, max: 8 } });
  });

  it("returns empty for blank", () => {
    expect(parseLevelFilter("")).toEqual({});
    expect(parseLevelFilter("   ")).toEqual({});
  });
});

describe("filterAndSortMonsterIndexRows", () => {
  const rows: MonsterIndexEntry[] = [
    row({ id: "a", name: "Alpha Wolf", level: 5, role: "Brute Controller", keywords: ["Beast"], sourceBooks: ["MM"] }),
    row({ id: "b", name: "Beta Sprite", level: 3, role: "Lurker", keywords: ["Fey"], sourceBooks: ["DMG 2"] }),
    row({ id: "c", name: "Gamma Knight", level: 5, role: "Soldier", isLeader: true, keywords: ["Undead", "Humanoid"] })
  ];

  const baseFilters = {
    nameQuery: "",
    levelQuery: "",
    roleQuery: "",
    rankFilter: "all" as const,
    leaderFilter: "both" as const,
    keywordQuery: "",
    sourceBookQuery: "",
    sortBy: "name" as const,
    sortDir: "asc" as const
  };

  it("filters by name substring", () => {
    const out = filterAndSortMonsterIndexRows(rows, { ...baseFilters, nameQuery: "beta" });
    expect(out.map((r) => r.id)).toEqual(["b"]);
  });

  it("filters by exact level", () => {
    const out = filterAndSortMonsterIndexRows(rows, { ...baseFilters, levelQuery: "5" });
    expect(out.map((r) => r.id).sort()).toEqual(["a", "c"]);
  });

  it("filters leaders only", () => {
    const out = filterAndSortMonsterIndexRows(rows, { ...baseFilters, leaderFilter: "leader" });
    expect(out.map((r) => r.id)).toEqual(["c"]);
  });

  it("filters by keyword substring", () => {
    const out = filterAndSortMonsterIndexRows(rows, { ...baseFilters, keywordQuery: "undead" });
    expect(out.map((r) => r.id)).toEqual(["c"]);
  });

  it("filters by source book substring", () => {
    const out = filterAndSortMonsterIndexRows(rows, { ...baseFilters, sourceBookQuery: "dmg" });
    expect(out.map((r) => r.id)).toEqual(["b"]);
  });

  it("sorts by level ascending", () => {
    const out = filterAndSortMonsterIndexRows(rows, { ...baseFilters, sortBy: "level", sortDir: "asc" });
    expect(out.map((r) => r.id)).toEqual(["b", "a", "c"]);
  });
});

describe("entryMatchesKeywordFilter", () => {
  it("requires metadata when query is set", () => {
    expect(entryMatchesKeywordFilter(row({ id: "x", name: "X", level: 1, role: "Brute" }), "dragon")).toBe(false);
    expect(
      entryMatchesKeywordFilter(row({ id: "x", name: "X", level: 1, role: "Brute", keywords: ["Dragon"] }), "dragon")
    ).toBe(true);
  });
});

describe("collectMonsterIndexFilterOptions", () => {
  it("collects unique roles, keywords, and books", () => {
    const options = collectMonsterIndexFilterOptions([
      row({ id: "a", name: "A", level: 1, role: "Brute", keywords: ["Dragon"], sourceBooks: ["MM"] }),
      row({ id: "b", name: "B", level: 2, role: "Lurker", keywords: ["Dragon", "Undead"], sourceBooks: ["MM", "DMG"] })
    ]);
    expect(options.roles).toEqual(["Brute", "Lurker"]);
    expect(options.keywords).toEqual(["Dragon", "Undead"]);
    expect(options.sourceBooks).toEqual(["DMG", "MM"]);
    expect(options.hasKeywordMetadata).toBe(true);
    expect(options.hasSourceBookMetadata).toBe(true);
  });
});

describe("monsterIndexHasActiveFilters", () => {
  it("detects any active constraint", () => {
    expect(
      monsterIndexHasActiveFilters({
        nameQuery: "",
        levelQuery: "",
        roleQuery: "",
        rankFilter: "all",
        leaderFilter: "both",
        keywordQuery: "dragon",
        sourceBookQuery: "",
        sortBy: "name",
        sortDir: "asc"
      })
    ).toBe(true);
  });
});
