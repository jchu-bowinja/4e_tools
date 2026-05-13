import { describe, expect, it } from "vitest";
import {
  mergePassiveDefenseBonuses,
  nadSpecificToDefensePartial,
  passiveDefenseBonusesFromStatAdds
} from "../../src/rules/supportStatAdds";
import type { StatAddEntry } from "../../src/rules/models";

const ironWillLike: StatAddEntry[] = [
  { name: "Iron Will", value: "+2" },
  { name: "Will Defense", value: "+Iron Will", type: "Feat" },
  { name: "Iron Will", value: "+1", requires: "Paragon Tier" },
  { name: "Iron Will", value: "+1", requires: "Epic Tier" }
];

describe("passiveDefenseBonusesFromStatAdds", () => {
  it("resolves tiered named bonuses at heroic", () => {
    const b = passiveDefenseBonusesFromStatAdds(ironWillLike, 1);
    expect(b.will).toBe(2);
    expect(b.ac).toBe(0);
  });

  it("includes paragon and epic tiers at high level", () => {
    expect(passiveDefenseBonusesFromStatAdds(ironWillLike, 10).will).toBe(2);
    expect(passiveDefenseBonusesFromStatAdds(ironWillLike, 11).will).toBe(3);
    expect(passiveDefenseBonusesFromStatAdds(ironWillLike, 21).will).toBe(4);
  });

  it("ignores conditional statadd rows", () => {
    const entries: StatAddEntry[] = [
      { name: "AC", value: "+1", condition: "when adjacent to a wall" },
      { name: "AC", value: "+5" }
    ];
    expect(passiveDefenseBonusesFromStatAdds(entries, 10).ac).toBe(5);
  });

  it("ignores wearing-gated bonuses", () => {
    const entries: StatAddEntry[] = [
      { name: "Reflex", value: "+1", wearing: "DUAL-WIELDING:" },
      { name: "Fortitude Defense", value: "+1" }
    ];
    expect(passiveDefenseBonusesFromStatAdds(entries, 10).reflex).toBe(0);
    expect(passiveDefenseBonusesFromStatAdds(entries, 10).fortitude).toBe(1);
  });
});

describe("nadSpecificToDefensePartial", () => {
  it("maps lowercase NAD keys to PascalCase", () => {
    expect(nadSpecificToDefensePartial({ fortitude: 1, will: 2 })).toEqual({
      Fortitude: 1,
      Will: 2
    });
  });
});

describe("mergePassiveDefenseBonuses", () => {
  it("sums components", () => {
    expect(
      mergePassiveDefenseBonuses(
        { ac: 1, fortitude: 0, reflex: 2, will: 0 },
        { ac: 0, fortitude: 1, reflex: 0, will: 3 }
      )
    ).toEqual({ ac: 1, fortitude: 1, reflex: 2, will: 3 });
  });
});
