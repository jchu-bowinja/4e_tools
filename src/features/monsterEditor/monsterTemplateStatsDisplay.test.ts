import { describe, expect, it } from "vitest";
import { formatMonsterTemplateStatAdjustmentLines } from "./monsterTemplateStatsDisplay";

describe("formatMonsterTemplateStatAdjustmentLines", () => {
  it("returns null when stats missing or empty", () => {
    expect(formatMonsterTemplateStatAdjustmentLines(undefined)).toBeNull();
    expect(formatMonsterTemplateStatAdjustmentLines({})).toBeNull();
  });

  it("formats half-level resist from mechanical fields", () => {
    const lines = formatMonsterTemplateStatAdjustmentLines({
      resistances: {
        entries: [
          {
            kind: "typed",
            type: "necrotic",
            baseAmount: 5,
            plusHalfLevel: true
          }
        ]
      }
    });
    expect(lines).toEqual(["Resist 5 + 1/2 level necrotic"]);
  });

  it("formats dual-role hit points as separate lines", () => {
    const lines = formatMonsterTemplateStatAdjustmentLines({
      hitPoints: {
        variants: [
          {
            when: { role: "controller" },
            perLevel: 8,
            addConstitution: true
          },
          {
            when: { role: "artillery" },
            perLevel: 6,
            addConstitution: true
          }
        ]
      }
    });
    expect(lines).toEqual([
      "Hit Points +8 per level + Constitution score (controller)",
      "Hit Points +6 per level + Constitution score (artillery)"
    ]);
  });

  it("normalizes legacy Python resist tier list", () => {
    const lines = formatMonsterTemplateStatAdjustmentLines({
      resistances: [{ necrotic: [5, 10, 15] }]
    });
    expect(lines).toEqual(["Resist 5 necrotic at 1st level, 10 necrotic at 11th level, 15 necrotic at 21st level"]);
  });

  it("orders defenses, saving throws, then immunities (among other mechanical rows)", () => {
    const lines = formatMonsterTemplateStatAdjustmentLines({
      defenses: { AC: 2, Fortitude: 1 },
      savingThrows: 2,
      immunities: ["disease", "poison"]
    });
    expect(lines).toEqual([
      "Defenses AC +2; Fortitude +1",
      "Saving Throws +2",
      "Immune disease, poison"
    ]);
  });

  it("formats structured conditional saving throw bonuses", () => {
    const lines = formatMonsterTemplateStatAdjustmentLines({
      savingThrows: {
        value: 2,
        conditionalBonuses: [{ value: 4, when: "fear and charm effects" }]
      }
    });
    expect(lines).toEqual(["Saving Throws +2; +4 against fear and charm effects"]);
  });

  it("formats saving throw references and conditional-only bonuses", () => {
    const refLines = formatMonsterTemplateStatAdjustmentLines({
      savingThrows: {
        references: ["twist free"]
      }
    });
    expect(refLines).toEqual(["Saving Throws see twist free"]);

    const conditionalOnly = formatMonsterTemplateStatAdjustmentLines({
      savingThrows: {
        conditionalBonuses: [{ value: 2, when: "ongoing damage" }]
      }
    });
    expect(conditionalOnly).toEqual(["Saving Throws +2 against ongoing damage"]);
  });
});
