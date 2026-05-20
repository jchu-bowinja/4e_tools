import { describe, expect, it } from "vitest";
import { passiveDefenseBonusesFromStatAdds } from "../../src/rules/supportStatAdds";
import { racialTraitStatAddRowApplies } from "../../src/rules/statAddApply";
import type { StatAddEntry } from "../../src/rules/models";

describe("racialTraitStatAddRowApplies", () => {
  const ctx = { traitId: "TR_FIRE", traitSlug: "firesoul", traitName: "Firesoul" };

  it("applies manifestation condition on the active soul trait", () => {
    const entry: StatAddEntry = {
      name: "Reflex Defense",
      value: "+1",
      condition: "while manifesting firesoul",
      requires: "watersoul|earthsoul|firesoul"
    };
    expect(racialTraitStatAddRowApplies(entry, 1, ctx)).toBe(true);
  });

  it("skips manifestation condition on a different trait context", () => {
    const entry: StatAddEntry = {
      name: "Reflex Defense",
      value: "+1",
      condition: "while manifesting firesoul"
    };
    expect(
      racialTraitStatAddRowApplies(entry, 1, {
        traitId: "TR_WATER",
        traitSlug: "watersoul",
        traitName: "Watersoul"
      })
    ).toBe(false);
  });

  it("feeds passiveDefenseBonusesFromStatAdds when row applies", () => {
    const adds: StatAddEntry[] = [
      {
        name: "Reflex Defense",
        value: "+1",
        condition: "while manifesting firesoul"
      }
    ];
    const unconditional = passiveDefenseBonusesFromStatAdds(adds, 1);
    expect(unconditional.reflex).toBe(0);
    const withSoul = passiveDefenseBonusesFromStatAdds(adds, 1, (e) => racialTraitStatAddRowApplies(e, 1, ctx));
    expect(withSoul.reflex).toBe(1);
  });
});
