import { describe, expect, it } from "vitest";
import { computeDerivedStats } from "./statCalculator";
import type { CharacterBuild, ClassDef, Race } from "./models";

const race: Race = {
  id: "r1",
  name: "Human",
  speed: 6,
  raw: {}
} as Race;

const cls: ClassDef = {
  id: "c1",
  name: "Fighter",
  hitPointsAt1: 15,
  hitPointsPerLevel: 6,
  healingSurgesBase: 9,
  raw: {}
} as ClassDef;

describe("computeDerivedStats magic item defense bonuses", () => {
  it("adds optional enhancement bonuses to NADs and AC", () => {
    const baseBuild: CharacterBuild = {
      name: "Hero",
      level: 1,
      abilityScores: { STR: 16, CON: 14, DEX: 12, INT: 10, WIS: 10, CHA: 8 },
      trainedSkillIds: [],
      featIds: [],
      powerIds: []
    };
    const withItems: CharacterBuild = {
      ...baseBuild,
      magicItemBonuses: { ac: 2, fortitude: 1, reflex: 0, will: 3 }
    };
    const baseline = computeDerivedStats(baseBuild, race, cls, undefined, undefined);
    const merged = computeDerivedStats(withItems, race, cls, undefined, undefined);
    expect(merged.defenses.ac).toBe(baseline.defenses.ac + 2);
    expect(merged.defenses.fortitude).toBe(baseline.defenses.fortitude + 1);
    expect(merged.defenses.reflex).toBe(baseline.defenses.reflex);
    expect(merged.defenses.will).toBe(baseline.defenses.will + 3);
  });

  it("ignores invalid or missing bonus fields", () => {
    const build: CharacterBuild = {
      name: "Hero",
      level: 1,
      abilityScores: { STR: 16, CON: 14, DEX: 12, INT: 10, WIS: 10, CHA: 8 },
      trainedSkillIds: [],
      featIds: [],
      powerIds: [],
      magicItemBonuses: { ac: NaN, fortitude: undefined, reflex: 1, will: Number.NaN, attack: 2 }
    };
    const base = computeDerivedStats({ ...build, magicItemBonuses: undefined }, race, cls, undefined, undefined);
    const merged = computeDerivedStats(build, race, cls, undefined, undefined);
    expect(merged.defenses.ac).toBe(base.defenses.ac);
    expect(merged.defenses.reflex).toBe(base.defenses.reflex + 1);
    expect(merged.defenses.will).toBe(base.defenses.will);
  });
});
