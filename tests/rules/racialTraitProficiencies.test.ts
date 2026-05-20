import { describe, expect, it } from "vitest";
import {
  collectCharacterProficiencyGrants,
  collectRacialProficiencyDisplayRows,
  isProficientWithWeaponIncludingFeats
} from "../../src/rules/featProficiencies";
import {
  collectRacialProficiencyGrantsFromBuild,
  parseProficiencyGrantInternalId,
  proficiencyGrantsFromRacialTrait
} from "../../src/rules/racialTraitProficiencies";
import type { CharacterBuild, Race, RacialTrait, RulesIndex, Weapon } from "../../src/rules/models";

describe("parseProficiencyGrantInternalId", () => {
  it("parses weapon proficiency internal ids", () => {
    expect(
      parseProficiencyGrantInternalId("ID_INTERNAL_PROFICIENCY_WEAPON_PROFICIENCY_(LONGSWORD)")
    ).toEqual({ kind: "weaponName", value: "longsword", label: "Longsword" });
    expect(parseProficiencyGrantInternalId("ID_INTERNAL_PROFICIENCY_WEAPON_GROUP_(AXE)")).toEqual({
      kind: "weaponGroup",
      value: "axe",
      label: "Axe"
    });
    expect(parseProficiencyGrantInternalId("ID_INTERNAL_PROFICIENCY_SHIELD_PROFICIENCY_(LIGHT)")).toEqual({
      kind: "shield",
      value: "light",
      label: "Light"
    });
  });
});

describe("collectRacialProficiencyGrantsFromBuild", () => {
  const dwarfWeaponProf: RacialTrait = {
    id: "TR_DWARF_WP",
    name: "Dwarven Weapon Proficiency",
    slug: "dwarf-wp",
    raw: {
      rules: {
        grant: [
          {
            attrs: {
              type: "Proficiency",
              name: "ID_INTERNAL_PROFICIENCY_WEAPON_PROFICIENCY_(WARHAMMER)"
            }
          }
        ]
      }
    }
  };

  const race: Race = {
    id: "R_DWARF",
    name: "Dwarf",
    slug: "dwarf",
    raw: { specific: { "Racial Traits": "TR_DWARF_WP" } }
  };

  const warhammer: Weapon = {
    id: "w_war",
    name: "Warhammer",
    slug: "warhammer",
    weaponCategory: "Military Melee",
    weaponGroup: "Hammer",
    raw: {}
  };

  const index: RulesIndex = {
    races: [race],
    racialTraits: [dwarfWeaponProf],
    feats: [],
    skills: [],
    classes: []
  };

  const build: CharacterBuild = {
    name: "Dwarf",
    level: 1,
    raceId: "R_DWARF",
    abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 10 },
    trainedSkillIds: [],
    featIds: [],
    powerIds: []
  };

  it("collects grants from active racial traits", () => {
    const grants = collectRacialProficiencyGrantsFromBuild(index, build);
    expect(grants).toEqual([{ kind: "weaponName", value: "warhammer", label: "Warhammer" }]);
  });

  it("makes fighter proficient with warhammer via racial grant", () => {
    const grants = collectCharacterProficiencyGrants(index, build);
    expect(isProficientWithWeaponIncludingFeats(warhammer, "Simple melee", grants)).toBe(true);
  });

  it("lists racial traits in display rows", () => {
    expect(collectRacialProficiencyDisplayRows(index, build)).toEqual([
      {
        sourceId: "TR_DWARF_WP",
        sourceName: "Dwarven Weapon Proficiency",
        grants: ["Weapon: Warhammer"]
      }
    ]);
    expect(proficiencyGrantsFromRacialTrait(dwarfWeaponProf)).toHaveLength(1);
  });
});
