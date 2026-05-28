import { describe, expect, it } from "vitest";
import {
  appendFeatProficiencyPhrasesToWeaponLine,
  collectFeatProficiencyGrants,
  isProficientWithWeaponIncludingFeats,
  weaponMatchesProficiencyGrant
} from "../../src/rules/featProficiencies";
import type { Feat, RulesIndex, Weapon } from "../../src/rules/models";

describe("featProficiencies", () => {
  const index = {
    feats: [
      {
        id: "F1",
        name: "Dwarven Weapon Training",
        slug: "dwt",
        prereqTokens: [],
        proficiencyGrants: [
          { kind: "weaponGroup", value: "axe", label: "Axe" },
          { kind: "weaponGroup", value: "hammer", label: "Hammer" }
        ],
        raw: {}
      },
      {
        id: "F2",
        name: "Armor Proficiency: Chainmail",
        slug: "ap-chain",
        prereqTokens: [],
        proficiencyGrants: [{ kind: "armor", value: "chainmail", label: "Chainmail" }],
        raw: {}
      }
    ] as Feat[]
  } as unknown as RulesIndex;

  it("collects grants from selected feats", () => {
    const grants = collectFeatProficiencyGrants(index, ["F1", "F2"]);
    expect(grants).toHaveLength(3);
  });

  it("appends named-weapon grants to the weapon proficiency line", () => {
    expect(
      appendFeatProficiencyPhrasesToWeaponLine("Simple melee, military melee", [
        { kind: "weaponName", value: "longsword", label: "Longsword" }
      ])
    ).toBe("Simple melee, military melee, Longsword");
    expect(
      appendFeatProficiencyPhrasesToWeaponLine("Simple melee, longsword", [
        { kind: "weaponName", value: "longsword", label: "Longsword" }
      ])
    ).toBe("Simple melee, longsword");
  });

  it("matches weapon group grants", () => {
    const handaxe = {
      id: "w1",
      name: "Handaxe",
      weaponCategory: "Military Melee",
      weaponGroup: "Axe",
      raw: {}
    } as Weapon;
    expect(weaponMatchesProficiencyGrant(handaxe, { kind: "weaponGroup", value: "axe" })).toBe(true);
    expect(
      isProficientWithWeaponIncludingFeats(handaxe, "Simple melee", [{ kind: "weaponGroup", value: "axe" }])
    ).toBe(true);
  });
});
