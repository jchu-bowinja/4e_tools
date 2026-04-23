import { describe, expect, it } from "vitest";
import { computeSkillSheetRows } from "../../src/rules/skillCalculator";
import { computeDerivedStats } from "../../src/rules/statCalculator";
import { summarizeImplementAttack, summarizeMainWeaponAttack } from "../../src/rules/weaponAttack";
import type { CharacterBuild, RulesIndex } from "../../src/rules/models";

describe("combat preview integration", () => {
  it("computes derived, attack preview, and skill sheet values together", () => {
    const build: CharacterBuild = {
      name: "Preview",
      level: 6,
      abilityScores: { STR: 18, CON: 14, DEX: 12, INT: 16, WIS: 10, CHA: 10 },
      trainedSkillIds: ["skill_arcana"],
      featIds: [],
      powerIds: []
    };
    const chainmail = { id: "armor_chain", name: "Chainmail", armorType: "Heavy", armorBonus: 6, checkPenalty: 1, speedPenalty: 1, raw: {} } as never;
    const heavyShield = { id: "shield_heavy", name: "Heavy Shield", armorType: "Shield", armorBonus: 2, checkPenalty: 2, raw: {} } as never;
    const sword = { id: "w_longsword", name: "Longsword", weaponCategory: "Military Melee", proficiencyBonus: 3, damage: "1d8", raw: {} } as never;
    const orb = { id: "i_orb", name: "Orb", implementGroup: "Orb", raw: {} } as never;
    const cls = { keyAbilities: "Intelligence, Strength", hitPointsAt1: 12, hitPointsPerLevel: 5, healingSurgesBase: 7 } as never;
    const race = { speed: 6 } as never;

    const derived = computeDerivedStats(build, race, cls, chainmail, heavyShield, undefined);
    const weapon = summarizeMainWeaponAttack(build.level, build.abilityScores, sword, "Military Melee");
    const implement = summarizeImplementAttack(build.level, build.abilityScores, cls, orb, "Orb");
    const index = {
      skills: [
        { id: "skill_arcana", name: "Arcana", keyAbility: "Intelligence", slug: "arcana", raw: {} },
        { id: "skill_athletics", name: "Athletics", keyAbility: "Strength", slug: "athletics", raw: {} }
      ]
    } as never as RulesIndex;
    const rows = computeSkillSheetRows(index, build.level, build.abilityScores, new Set(build.trainedSkillIds), derived.armorCheckPenalty);

    expect(derived.armorCheckPenalty).toBe(3);
    expect(weapon?.attackBonus).toBe(3 + 4 + 3);
    expect(implement?.attackBonus).toBe(3 + 4 + 2);
    expect(rows.find((r) => r.skillId === "skill_arcana")?.modifier).toBe(3 + 3 + 5);
    expect(rows.find((r) => r.skillId === "skill_athletics")?.modifier).toBe(3 + 4 - 3);
  });
});
