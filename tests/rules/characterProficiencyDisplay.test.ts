import { describe, expect, it } from "vitest";
import {
  computeCharacterProficiencyDisplayLines,
  computeClassGrantedProficiencyDisplayLines,
  effectiveArmorProficiencyDisplayText
} from "../../src/rules/characterProficiencyDisplay";
import { appendFeatProficiencyPhrasesToArmorLine } from "../../src/rules/featProficiencies";
import type { CharacterBuild, ProficiencyGrant } from "../../src/rules/models";

describe("characterProficiencyDisplay", () => {
  const build = { featIds: [], classSelections: {} } as CharacterBuild;

  it("returns class-only weapon line without feat grants", () => {
    const lines = computeClassGrantedProficiencyDisplayLines(
      { isHybrid: false, classSpecific: { "Weapon Proficiencies": "Simple melee, military ranged" } },
      build
    );
    expect(lines.weaponLine).toBe("Simple melee, military ranged");
    expect(lines.armorLine).toBe("");
  });

  it("merges class weapon line with feat weapon grants", () => {
    const grants: ProficiencyGrant[] = [{ kind: "weaponGroup", value: "axe", label: "Axe" }];
    const lines = computeCharacterProficiencyDisplayLines(
      { isHybrid: false, classSpecific: { "Weapon Proficiencies": "Simple melee" } },
      build,
      grants
    );
    expect(lines.weaponLine).toBe("Simple melee, axe");
  });

  it("applies Archer Warlord armor adjustment before feat armor grants", () => {
    const archerBuild = {
      featIds: [],
      classSelections: { warlord: "ID_FMP_CLASS_FEATURE_2286" }
    } as CharacterBuild;
    const grants: ProficiencyGrant[] = [{ kind: "armor", value: "plate", label: "Plate" }];
    const line = effectiveArmorProficiencyDisplayText(
      "Cloth, leather, hide, chainmail; light shields",
      archerBuild,
      grants
    );
    expect(line).not.toMatch(/chainmail/i);
    expect(line).not.toMatch(/light shield/i);
    expect(line).toMatch(/plate/i);
  });

  it("appends shield grants with shields suffix", () => {
    expect(
      appendFeatProficiencyPhrasesToArmorLine("Cloth, leather", [
        { kind: "shield", value: "heavy", label: "Heavy" }
      ])
    ).toBe("Cloth, leather, Heavy shields");
  });
});
