import { describe, expect, it } from "vitest";
import { computeSkillSheetRows } from "../../src/rules/skillCalculator";

describe("skillCalculator", () => {
  it("computes trained and untrained skill modifiers", () => {
    const index = {
      skills: [
        {
          id: "s_ath",
          name: "Athletics",
          keyAbility: "Strength",
          slug: "athletics",
          raw: {}
        },
        {
          id: "s_arc",
          name: "Arcana",
          keyAbility: "Intelligence",
          slug: "arcana",
          raw: {}
        }
      ]
    } as never;
    const rows = computeSkillSheetRows(
      index,
      4,
      { STR: 18, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 10 },
      new Set(["s_ath"])
    );
    expect(rows).toHaveLength(2);
    const ath = rows.find((r) => r.skillId === "s_ath");
    const arc = rows.find((r) => r.skillId === "s_arc");
    expect(ath?.trained).toBe(true);
    expect(ath?.modifier).toBe(2 + 4 + 5);
    expect(arc?.trained).toBe(false);
    expect(arc?.modifier).toBe(2 + 0);
  });

  it("applies armor check penalty to untrained STR/DEX skills only", () => {
    const index = {
      skills: [
        { id: "s_ath", name: "Athletics", keyAbility: "Strength", slug: "athletics", raw: {} },
        { id: "s_ste", name: "Stealth", keyAbility: "Dexterity", slug: "stealth", raw: {} },
        { id: "s_arc", name: "Arcana", keyAbility: "Intelligence", slug: "arcana", raw: {} }
      ]
    } as never;
    const rows = computeSkillSheetRows(
      index,
      2,
      { STR: 12, CON: 10, DEX: 12, INT: 14, WIS: 10, CHA: 10 },
      new Set(["s_ste"]),
      2
    );
    expect(rows.find((r) => r.skillId === "s_ath")?.modifier).toBe(1 + 1 - 2);
    expect(rows.find((r) => r.skillId === "s_ste")?.modifier).toBe(1 + 1 + 5);
    expect(rows.find((r) => r.skillId === "s_arc")?.modifier).toBe(1 + 2);
  });
});
