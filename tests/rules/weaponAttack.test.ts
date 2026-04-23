import { describe, expect, it } from "vitest";
import {
  isProficientWithImplement,
  isProficientWithWeapon,
  summarizeMainWeaponAttack,
  summarizeImplementAttack
} from "../../src/rules/weaponAttack";

describe("weaponAttack", () => {
  const scores = { STR: 18, CON: 10, DEX: 12, INT: 10, WIS: 14, CHA: 10 };

  it("matches weapon category against class proficiency line", () => {
    const club = {
      id: "w",
      name: "Club",
      weaponCategory: "Simple Melee",
      proficiencyBonus: 2,
      damage: "1d6",
      raw: {}
    } as never;
    expect(isProficientWithWeapon(club, "Simple melee, military melee")).toBe(true);
    expect(isProficientWithWeapon(club, "Military melee only")).toBe(false);
  });

  it("summarizes main weapon attack", () => {
    const longsword = {
      id: "x",
      name: "Longsword",
      weaponCategory: "Military Melee",
      proficiencyBonus: 3,
      damage: "1d10",
      raw: {}
    } as never;
    const s = summarizeMainWeaponAttack(5, scores, longsword, "Military melee");
    expect(s?.attackBonus).toBe(2 + 4 + 3);
    expect(s?.damageNotation).toBe("1d10");
    expect(s?.proficient).toBe(true);
  });

  it("matches implement group to class Implements text", () => {
    const sym = {
      id: "i",
      name: "Accurate symbol",
      implementGroup: "Holy Symbol",
      raw: {}
    } as never;
    expect(isProficientWithImplement(sym, "Holy Symbol")).toBe(true);
    expect(isProficientWithImplement(sym, "Orb")).toBe(false);
  });

  it("summarizes implement attack using key abilities", () => {
    const cls = { keyAbilities: "Strength, Wisdom" } as never;
    const sym = { id: "i", name: "Test", implementGroup: "Holy Symbol", raw: {} } as never;
    const s = summarizeImplementAttack(1, scores, cls, sym, "Holy Symbol");
    expect(s?.attackBonus).toBe(0 + 4 + 2);
    expect(s?.proficient).toBe(true);
  });
});
