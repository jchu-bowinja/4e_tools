import { describe, expect, it } from "vitest";
import { buildClassPowerSlotDefinitions } from "../../src/rules/classPowerSlots";
import {
  classesForNonClassSlotSwap,
  collectNonClassSlotSwapRows,
  enableNonClassSlotSwap,
  getNonClassSlotSwapOffer,
  nonClassPowersForSlotSwap,
  pruneNonClassSlotSwaps
} from "../../src/rules/featNonClassSlotSwap";
import type { CharacterBuild, Feat, RulesIndex } from "../../src/rules/models";

const secretsOfBelial: Feat = {
  id: "ID_FMP_FEAT_2311",
  name: "Secrets of Belial",
  slug: "secrets-of-belial",
  prereqTokens: [],
  powerReplaceOffers: [
    {
      replacementPowerName: "Non-class power",
      usageBucket: "utility",
      minSlotGainLevel: 1,
      optional: true,
      requireNonClassReplacement: true
    }
  ],
  raw: {}
};

const fighterUtility = {
  id: "ID_FMP_POWER_FIGHTER_UTIL",
  name: "Fighter Utility",
  slug: "fighter-utility",
  classId: "ID_FMP_CLASS_1",
  usage: "Utility",
  level: 6,
  raw: { specific: { "Power Usage": "Utility", "Power Type": "Utility", Level: "6", Class: "ID_FMP_CLASS_1" } }
};

const index = {
  feats: [secretsOfBelial],
  powers: [fighterUtility],
  classes: [
    { id: "ID_FMP_CLASS_1", name: "Fighter", slug: "fighter", raw: {} },
    { id: "ID_FMP_CLASS_2", name: "Warlock", slug: "warlock", raw: {} }
  ],
  races: [],
  skills: [],
  armors: [],
  themes: [],
  languages: [],
  paragonPaths: [],
  epicDestinies: [],
  abilityScores: []
} as unknown as RulesIndex;

describe("featNonClassSlotSwap", () => {
  it("detects non-class swap offer", () => {
    expect(getNonClassSlotSwapOffer(secretsOfBelial)?.requireNonClassReplacement).toBe(true);
  });

  it("lists classes the character does not belong to", () => {
    const build: CharacterBuild = {
      name: "Test",
      level: 11,
      classId: "ID_FMP_CLASS_2",
      abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 16 },
      trainedSkillIds: [],
      featIds: ["ID_FMP_FEAT_2311"],
      powerIds: []
    };
    const names = classesForNonClassSlotSwap(index, build).map((c) => c.name);
    expect(names).toContain("Fighter");
    expect(names).not.toContain("Warlock");
  });

  it("collects utility slot rows at level 11", () => {
    const build: CharacterBuild = {
      name: "Test",
      level: 11,
      classId: "ID_FMP_CLASS_2",
      abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 16 },
      trainedSkillIds: [],
      featIds: ["ID_FMP_FEAT_2311"],
      powerIds: [],
      classPowerSlots: { "utility:6": "ID_WARLOCK_UTIL" }
    };
    const defs = buildClassPowerSlotDefinitions(11, false);
    const rows = collectNonClassSlotSwapRows(index, build, defs);
    expect(rows).toHaveLength(1);
    expect(rows[0].eligibleSlots.some((d) => d.key === "utility:6")).toBe(true);
    expect(rows[0].sourceClasses.some((c) => c.id === "ID_FMP_CLASS_1")).toBe(true);
  });

  it("enables swap with source class and replacement power", () => {
    const build: CharacterBuild = {
      name: "Test",
      level: 11,
      classId: "ID_FMP_CLASS_2",
      abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 16 },
      trainedSkillIds: [],
      featIds: ["ID_FMP_FEAT_2311"],
      powerIds: [],
      classPowerSlots: { "utility:6": "ID_WARLOCK_UTIL" }
    };
    const next = enableNonClassSlotSwap(
      build,
      "ID_FMP_FEAT_2311",
      "utility:6",
      "ID_FMP_CLASS_1",
      "ID_FMP_POWER_FIGHTER_UTIL"
    );
    expect(next.classPowerSlots?.["utility:6"]).toBe("ID_FMP_POWER_FIGHTER_UTIL");
    expect(next.featPowerReplacements?.["ID_FMP_FEAT_2311"]).toMatchObject({
      slotKey: "utility:6",
      replacementClassId: "ID_FMP_CLASS_1",
      replacementPowerId: "ID_FMP_POWER_FIGHTER_UTIL",
      originalPowerId: "ID_WARLOCK_UTIL"
    });
  });

  it("filters fighter utility powers for utility:6 slot", () => {
    const defs = buildClassPowerSlotDefinitions(11, false);
    const slot = defs.find((d) => d.key === "utility:6");
    expect(slot).toBeDefined();
    const powers = nonClassPowersForSlotSwap(index, "ID_FMP_CLASS_1", slot!, secretsOfBelial.powerReplaceOffers![0]);
    expect(powers.map((p) => p.id)).toEqual(["ID_FMP_POWER_FIGHTER_UTIL"]);
  });

  it("prunes swap when source class becomes owned", () => {
    const build: CharacterBuild = {
      name: "Test",
      level: 11,
      classId: "ID_FMP_CLASS_2",
      abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 16 },
      trainedSkillIds: [],
      featIds: ["ID_FMP_FEAT_2311"],
      powerIds: [],
      classPowerSlots: { "utility:6": "ID_FMP_POWER_FIGHTER_UTIL" },
      featPowerReplacements: {
        "ID_FMP_FEAT_2311": {
          slotKey: "utility:6",
          replacementClassId: "ID_FMP_CLASS_1",
          replacementPowerId: "ID_FMP_POWER_FIGHTER_UTIL",
          originalPowerId: "ID_WARLOCK_UTIL"
        }
      }
    };
    const defs = buildClassPowerSlotDefinitions(11, false);
    const next = pruneNonClassSlotSwaps(
      { ...build, classId: "ID_FMP_CLASS_1" },
      { ...index, feats: [secretsOfBelial] },
      defs
    );
    expect(next.featPowerReplacements).toBeUndefined();
    expect(next.classPowerSlots?.["utility:6"]).toBe("ID_WARLOCK_UTIL");
  });
});
