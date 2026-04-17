import { describe, expect, it } from "vitest";
import { parseRacialTraitIdsFromRace, resolveRacialTraitsForRace } from "../../src/rules/racialTraits";
import { Race, RacialTrait } from "../../src/rules/models";

describe("parseRacialTraitIdsFromRace", () => {
  it("splits comma-separated ids", () => {
    const race: Race = {
      id: "r1",
      name: "X",
      slug: "x",
      raw: { specific: { "Racial Traits": " ID_A , ID_B " } }
    };
    expect(parseRacialTraitIdsFromRace(race)).toEqual(["ID_A", "ID_B"]);
  });

  it("returns empty when missing", () => {
    expect(parseRacialTraitIdsFromRace(undefined)).toEqual([]);
    expect(parseRacialTraitIdsFromRace({ id: "r", name: "n", slug: "s", raw: {} })).toEqual([]);
  });
});

describe("resolveRacialTraitsForRace", () => {
  it("preserves order and resolves ids", () => {
    const race: Race = {
      id: "r1",
      name: "X",
      slug: "x",
      raw: { specific: { "Racial Traits": "T2, T1" } }
    };
    const t1: RacialTrait = { id: "T1", name: "One", slug: "one", raw: {} };
    const t2: RacialTrait = { id: "T2", name: "Two", slug: "two", raw: {} };
    const m = new Map<string, RacialTrait>([
      ["T1", t1],
      ["T2", t2]
    ]);
    const rows = resolveRacialTraitsForRace(race, m);
    expect(rows.map((r) => r.id)).toEqual(["T2", "T1"]);
    expect(rows[0].trait).toBe(t2);
    expect(rows[1].trait).toBe(t1);
  });
});
