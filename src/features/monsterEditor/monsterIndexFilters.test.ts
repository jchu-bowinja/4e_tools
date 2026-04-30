import { describe, expect, it } from "vitest";
import type { MonsterIndexEntry } from "./storage";
import { filterAndSortMonsterIndexRows, parseLevelFilter } from "./monsterIndexFilters";

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
    row({ id: "a", name: "Alpha Wolf", level: 5, role: "Brute Controller" }),
    row({ id: "b", name: "Beta Sprite", level: 3, role: "Lurker" }),
    row({ id: "c", name: "Gamma Knight", level: 5, role: "Soldier", isLeader: true })
  ];

  it("filters by name substring", () => {
    const out = filterAndSortMonsterIndexRows(rows, {
      nameQuery: "beta",
      levelQuery: "",
      roleQuery: "",
      rankFilter: "all",
      leaderFilter: "both",
      sortBy: "name",
      sortDir: "asc"
    });
    expect(out.map((r) => r.id)).toEqual(["b"]);
  });

  it("filters by exact level", () => {
    const out = filterAndSortMonsterIndexRows(rows, {
      nameQuery: "",
      levelQuery: "5",
      roleQuery: "",
      rankFilter: "all",
      leaderFilter: "both",
      sortBy: "name",
      sortDir: "asc"
    });
    expect(out.map((r) => r.id).sort()).toEqual(["a", "c"]);
  });

  it("filters leaders only", () => {
    const out = filterAndSortMonsterIndexRows(rows, {
      nameQuery: "",
      levelQuery: "",
      roleQuery: "",
      rankFilter: "all",
      leaderFilter: "leader",
      sortBy: "name",
      sortDir: "asc"
    });
    expect(out.map((r) => r.id)).toEqual(["c"]);
  });

  it("sorts by level ascending", () => {
    const out = filterAndSortMonsterIndexRows(rows, {
      nameQuery: "",
      levelQuery: "",
      roleQuery: "",
      rankFilter: "all",
      leaderFilter: "both",
      sortBy: "level",
      sortDir: "asc"
    });
    expect(out.map((r) => r.id)).toEqual(["b", "a", "c"]);
  });
});
