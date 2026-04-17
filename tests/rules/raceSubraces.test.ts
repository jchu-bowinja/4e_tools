import { describe, expect, it } from "vitest";
import type { Race, RacialTrait } from "../../src/rules/models";
import { getChildTraitIdsForSubrace, getRaceSubraceData } from "../../src/rules/raceSubraces";

describe("getRaceSubraceData", () => {
  it("extracts options from a race subrace parent trait", () => {
    const race: Race = {
      id: "R1",
      name: "Elf",
      slug: "elf",
      raw: { specific: { "Racial Traits": "TR_SUB" } }
    };
    const parent: RacialTrait = {
      id: "TR_SUB",
      name: "Elf Subrace",
      slug: "elf-subrace",
      raw: { specific: { _PARSED_SUB_FEATURES: "TR_A,TR_B" } }
    };
    const a: RacialTrait = { id: "TR_A", name: "Sun Elf", slug: "sun-elf", raw: {} };
    const b: RacialTrait = { id: "TR_B", name: "Wood Elf", slug: "wood-elf", raw: {} };
    const byId = new Map<string, RacialTrait>([
      ["TR_SUB", parent],
      ["TR_A", a],
      ["TR_B", b]
    ]);
    const sub = getRaceSubraceData(race, byId);
    expect(sub?.parentTraitName).toBe("Elf Subrace");
    expect(sub?.options.map((o) => o.name)).toEqual(["Sun Elf", "Wood Elf"]);
  });
});

describe("getChildTraitIdsForSubrace", () => {
  it("parses child trait ids from selected subrace", () => {
    const subrace: RacialTrait = {
      id: "TR_A",
      name: "Sun Elf",
      slug: "sun-elf",
      raw: { specific: { _PARSED_CHILD_FEATURES: "TR_C,TR_D" } }
    };
    expect(getChildTraitIdsForSubrace(subrace)).toEqual(["TR_C", "TR_D"]);
  });
});
