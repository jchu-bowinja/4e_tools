import { describe, expect, it } from "vitest";
import {
  collectDilettantePowersForBuild,
  powerAsDilettanteEncounter,
  resolveDilettanteDisplayPower
} from "../../src/rules/dilettantePower";
import { racePowerSelectSelectionKey } from "../../src/rules/grantedPowersQuery";
import type { CharacterBuild, Power, RulesIndex } from "../../src/rules/models";

describe("dilettantePower", () => {
  const wizardAtWill: Power = {
    id: "P_WIZ_ATWILL",
    name: "Magic Missile",
    slug: "magic-missile",
    classId: "ID_FMP_CLASS_WIZ",
    level: 1,
    usage: "At-Will",
    raw: { specific: { "Power Usage": "At-Will", "Power Type": "Attack" } }
  };

  const index = {
    races: [
      {
        id: "R_HE",
        name: "Half-Elf",
        slug: "half-elf",
        raw: { specific: { "Racial Traits": "TR_DIL" } }
      }
    ],
    racialTraits: [
      {
        id: "TR_DIL",
        name: "Dilettante",
        slug: "dilettante",
        raw: {
          rules: {
            select: [{ attrs: { type: "Power", name: "Dilettante", number: "1", Category: "$$NOT_CLASS,at-will,1" } }]
          }
        }
      }
    ],
    classes: [
      { id: "ID_FMP_CLASS_FTR", name: "Fighter", slug: "fighter", raw: {} },
      { id: "ID_FMP_CLASS_WIZ", name: "Wizard", slug: "wizard", raw: {} }
    ],
    powers: [wizardAtWill],
    skills: [],
    feats: []
  } as unknown as RulesIndex;

  const build: CharacterBuild = {
    name: "Test",
    level: 1,
    raceId: "R_HE",
    classId: "ID_FMP_CLASS_FTR",
    raceSelections: { [racePowerSelectSelectionKey("TR_DIL")]: "P_WIZ_ATWILL" },
    abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 10 },
    trainedSkillIds: [],
    featIds: [],
    powerIds: []
  };

  it("rewrites usage to Encounter for display", () => {
    const encounter = powerAsDilettanteEncounter(wizardAtWill);
    expect(encounter.usage).toBe("Encounter");
    expect((encounter.raw?.specific as Record<string, string>)["Power Usage"]).toBe("Encounter");
  });

  it("collects dilettante picks as encounter powers", () => {
    const powers = collectDilettantePowersForBuild(index, build);
    expect(powers).toHaveLength(1);
    expect(powers[0]?.usage).toBe("Encounter");
    expect(powers[0]?.id).toBe("P_WIZ_ATWILL");
  });

  it("resolveDilettanteDisplayPower applies encounter usage only for dilettante picks", () => {
    const displayed = resolveDilettanteDisplayPower(index, build, "P_WIZ_ATWILL");
    expect(displayed?.usage).toBe("Encounter");
    const plain = resolveDilettanteDisplayPower(index, { ...build, raceSelections: {} }, "P_WIZ_ATWILL");
    expect(plain?.usage).toBe("At-Will");
  });
});
