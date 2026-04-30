import { describe, expect, it } from "vitest";
import type { MonsterEntryFile } from "./storage";
import {
  applyMonsterLevelDelta,
  clampMonsterLevelDelta,
  damageDeltaForLevelDelta,
  hitPointsPerLevelForMonsterRole,
  minMonsterLevelDeltaForBase,
  standardMonsterXpForLevel
} from "./monsterLevelDelta";

function sample(): MonsterEntryFile {
  return {
    id: "x",
    fileName: "x.json",
    relativePath: "",
    name: "Sample",
    level: 5,
    role: "Brute",
    parseError: "",
    sourceRoot: "",
    size: "M",
    origin: "natural",
    type: "humanoid",
    xp: 200,
    stats: {
      abilityScores: { STR: 18 },
      defenses: { AC: 17, Fortitude: 15, Reflex: 13, Will: 13 },
      attackBonuses: { melee: 10 },
      skills: {},
      otherNumbers: { hp: 68, bloodied: 34 }
    },
    powers: [
      {
        name: "Slam",
        usage: "At-Will",
        action: "Standard",
        keywords: "Weapon",
        description: "",
        attacks: [
          {
            attackBonuses: [{ defense: "AC", bonus: 10 }],
            hit: {
              damage: { expressions: ["2d8+4"] },
              description: "Primary 2d8+4."
            }
          }
        ]
      }
    ]
  } as MonsterEntryFile;
}

describe("monsterLevelDelta", () => {
  it("maps role to HP per level (DMG table)", () => {
    expect(hitPointsPerLevelForMonsterRole("Brute")).toBe(10);
    expect(hitPointsPerLevelForMonsterRole("Artillery")).toBe(6);
    expect(hitPointsPerLevelForMonsterRole("Lurker")).toBe(6);
    expect(hitPointsPerLevelForMonsterRole("Soldier")).toBe(8);
    expect(hitPointsPerLevelForMonsterRole("Skirmisher")).toBe(8);
    expect(hitPointsPerLevelForMonsterRole("Controller")).toBe(8);
  });

  it("adjusts defenses, attacks, level, HP, XP, and damage per DMG quick rules", () => {
    const out = applyMonsterLevelDelta(sample(), 2);
    expect(out.level).toBe(7);
    expect(out.stats?.defenses?.AC).toBe(19);
    expect(out.stats?.attackBonuses?.melee).toBe(12);
    expect(out.stats?.otherNumbers?.hp).toBe(88);
    expect(out.stats?.otherNumbers?.bloodied).toBe(44);
    expect(out.xp).toBe(300);
    expect(standardMonsterXpForLevel(5)).toBe(200);
    expect(standardMonsterXpForLevel(7)).toBe(300);
    const atk = out.powers?.[0]?.attacks?.[0];
    expect(atk?.attackBonuses?.[0]?.bonus).toBe(12);
    expect(atk?.hit?.damage?.expressions?.[0]).toBe("2d8+5");
    expect(damageDeltaForLevelDelta(2)).toBe(1);
  });

  it("returns same reference when delta is zero", () => {
    const m = sample();
    expect(applyMonsterLevelDelta(m, 0)).toBe(m);
  });

  it("does not change minion HP", () => {
    const m = sample();
    m.role = "Minion";
    m.stats!.otherNumbers!.hp = 1;
    const out = applyMonsterLevelDelta(m, 3);
    expect(out.stats?.otherNumbers?.hp).toBe(1);
    expect(out.stats?.defenses?.AC).toBe(20);
  });

  it("never lowers effective level below 1 for standard creatures", () => {
    const m = sample();
    m.level = 2;
    const out = applyMonsterLevelDelta(m, -5);
    expect(out.level).toBe(1);
    expect(clampMonsterLevelDelta(2, -5)).toBe(-1);
  });

  it("allows effective level 0 when base creature is level 0", () => {
    expect(minMonsterLevelDeltaForBase(0)).toBe(0);
    expect(clampMonsterLevelDelta(0, -5)).toBe(0);
    const m = sample();
    m.level = 0;
    m.xp = 50;
    const out = applyMonsterLevelDelta(m, -3);
    expect(out.level).toBe(0);
    expect(out).toBe(m);
  });

  it("can raise level 0 creature with positive delta", () => {
    const m = sample();
    m.level = 0;
    m.xp = 50;
    const out = applyMonsterLevelDelta(m, 2);
    expect(out.level).toBe(2);
    expect(out).not.toBe(m);
  });

  it("returns same reference when adjustment clamps to zero change", () => {
    const m = sample();
    m.level = 1;
    expect(applyMonsterLevelDelta(m, -2)).toBe(m);
  });

  it("scales elite XP by standard chart ratio", () => {
    const m = sample();
    m.xp = 400;
    const out = applyMonsterLevelDelta(m, 2);
    expect(out.xp).toBe(600);
  });
});
