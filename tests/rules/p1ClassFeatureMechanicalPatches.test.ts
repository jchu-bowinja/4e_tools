import { describe, expect, it } from "vitest";
import index from "../../generated/rules_index.json";
import { collectClassFeatureModificationsByPowerId } from "../../src/rules/classFeaturePowerModifications";
import { applyFeatModificationsToPowerCardVm } from "../../src/rules/featPowerModifications";
import { weaponDamageFromMechanicalEffects } from "../../src/rules/mechanicalEffects";
import { buildCharacterPowerCardViewModel } from "../../src/ui/powerCard/characterPowerCardViewModel";
import type { CharacterBuild, RulesIndex, Weapon } from "../../src/rules/models";

const rules = index as RulesIndex;

describe("P1 class feature mechanical patches", () => {
  it("indexes Healing Word cleric power modifications", () => {
    const feature = rules.classFeatures?.find((f) => f.id === "ID_FMP_CLASS_FEATURE_64");
    expect(feature?.powerModifications?.length).toBeGreaterThanOrEqual(2);
    expect(feature?.powerModifications?.some((m) => m.field === "Display")).toBe(true);
  });

  it("applies cleric Healing Word display patch from real index", () => {
    const cleric = rules.classes.find((c) => c.slug === "cleric");
    expect(cleric).toBeDefined();
    const healingWord = rules.powers.find((p) => p.id === "ID_FMP_POWER_1455");
    expect(healingWord).toBeDefined();

    const build: CharacterBuild = {
      name: "test",
      level: 1,
      classId: cleric!.id,
      abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 16, CHA: 10 },
      featIds: [],
      powerIds: [],
      trainedSkillIds: []
    };

    const mods = collectClassFeatureModificationsByPowerId(rules, build);
    const patch = mods.get("ID_FMP_POWER_1455");
    expect(patch?.metadata.some((m) => m.field === "Display" && m.value === "Cleric Utility")).toBe(true);

    const vm = buildCharacterPowerCardViewModel(healingWord!, patch, rules);
    const patched = applyFeatModificationsToPowerCardVm(vm, patch, healingWord!.id);
    expect(patched.display).toBe("Cleric Utility");
  });

  it("indexes Rogue Weapon Talent shuriken damage increase", () => {
    const feature = rules.classFeatures?.find((f) => f.name === "Rogue Weapon Talent");
    expect(feature?.mechanicalEffects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "weaponDamageDieIncrease",
          weaponName: "Shuriken",
          steps: 1
        })
      ])
    );
  });

  it("increases shuriken damage die for Rogue Weapon Talent", () => {
    const feature = rules.classFeatures?.find((f) => f.name === "Rogue Weapon Talent");
    expect(feature?.mechanicalEffects).toBeDefined();
    const shuriken: Weapon = {
      id: "ID_FMP_WEAPON_41",
      name: "Shuriken",
      slug: "shuriken",
      damage: "1d4",
      raw: {}
    };
    const damage = weaponDamageFromMechanicalEffects(
      shuriken,
      feature!.mechanicalEffects ?? [],
      shuriken.damage
    );
    expect(damage).toBe("1d6");
  });
});
