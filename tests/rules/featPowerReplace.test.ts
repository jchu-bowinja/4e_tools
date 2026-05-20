import { describe, expect, it } from "vitest";
import { buildClassPowerSlotDefinitions } from "../../src/rules/classPowerSlots";
import {
  collectFeatPowerReplaceRows,
  disableFeatPowerReplace,
  eligibleSlotsForReplaceOffer,
  enableFeatPowerReplace,
  getFeatPowerReplaceOffer,
  pruneFeatPowerReplacements
} from "../../src/rules/featPowerReplace";
import type { CharacterBuild, Feat, RulesIndex } from "../../src/rules/models";

const gythkaExpert: Feat = {
  id: "ID_FMP_FEAT_3211",
  name: "Gythka Expert",
  slug: "gythka-expert",
  prereqTokens: [],
  powerReplaceOffers: [
    {
      replacementPowerId: "ID_FMP_POWER_12924",
      replacementPowerName: "Gythka Parry",
      usageBucket: "utility",
      minSlotGainLevel: 6,
      optional: true
    }
  ],
  raw: {}
};

const gythkaParry = {
  id: "ID_FMP_POWER_12924",
  name: "Gythka Parry",
  slug: "gythka-parry",
  usage: "Encounter",
  level: 6,
  raw: { specific: { "Power Usage": "Encounter", Level: "6" } }
};

const index = {
  feats: [gythkaExpert],
  powers: [gythkaParry],
  classes: [{ id: "ID_FMP_CLASS_1", name: "Fighter", slug: "fighter", raw: {} }],
  races: [],
  skills: [],
  armors: [],
  themes: [],
  languages: [],
  paragonPaths: [],
  epicDestinies: [],
  abilityScores: []
} as unknown as RulesIndex;

describe("featPowerReplace", () => {
  it("finds eligible utility slots at level 10", () => {
    const defs = buildClassPowerSlotDefinitions(10, false);
    const offer = getFeatPowerReplaceOffer(gythkaExpert)!;
    const eligible = eligibleSlotsForReplaceOffer(defs, offer);
    expect(eligible.every((d) => d.bucket === "utility" && d.gainLevel >= 6)).toBe(true);
    expect(eligible.some((d) => d.key === "utility:6")).toBe(true);
  });

  it("enables swap and stores original power", () => {
    const build: CharacterBuild = {
      name: "Test",
      level: 10,
      classId: "ID_FMP_CLASS_1",
      abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 10 },
      trainedSkillIds: [],
      featIds: ["ID_FMP_FEAT_3211"],
      powerIds: [],
      classPowerSlots: { "utility:6": "ID_CLASS_UTIL" }
    };
    const next = enableFeatPowerReplace(build, "ID_FMP_FEAT_3211", "utility:6", "ID_FMP_POWER_12924");
    expect(next.classPowerSlots?.["utility:6"]).toBe("ID_FMP_POWER_12924");
    expect(next.featPowerReplacements?.["ID_FMP_FEAT_3211"]).toEqual({
      slotKey: "utility:6",
      originalPowerId: "ID_CLASS_UTIL",
      replacementPowerId: "ID_FMP_POWER_12924"
    });
  });

  it("disables swap and restores original", () => {
    const build: CharacterBuild = {
      name: "Test",
      level: 10,
      classId: "ID_FMP_CLASS_1",
      abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 10 },
      trainedSkillIds: [],
      featIds: ["ID_FMP_FEAT_3211"],
      powerIds: [],
      classPowerSlots: { "utility:6": "ID_FMP_POWER_12924" },
      featPowerReplacements: { "ID_FMP_FEAT_3211": { slotKey: "utility:6", originalPowerId: "ID_CLASS_UTIL" } }
    };
    const next = disableFeatPowerReplace(build, "ID_FMP_FEAT_3211");
    expect(next.classPowerSlots?.["utility:6"]).toBe("ID_CLASS_UTIL");
    expect(next.featPowerReplacements).toBeUndefined();
  });

  it("prunes swap when feat is removed", () => {
    const build: CharacterBuild = {
      name: "Test",
      level: 10,
      classId: "ID_FMP_CLASS_1",
      abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 10 },
      trainedSkillIds: [],
      featIds: [],
      powerIds: [],
      classPowerSlots: { "utility:6": "ID_FMP_POWER_12924" },
      featPowerReplacements: { "ID_FMP_FEAT_3211": { slotKey: "utility:6", originalPowerId: "ID_CLASS_UTIL" } }
    };
    const defs = buildClassPowerSlotDefinitions(10, false);
    const next = pruneFeatPowerReplacements(build, index, defs);
    expect(next.featPowerReplacements).toBeUndefined();
    expect(next.classPowerSlots?.["utility:6"]).toBe("ID_CLASS_UTIL");
  });

  it("collectFeatPowerReplaceRows for selected feat", () => {
    const build: CharacterBuild = {
      name: "Test",
      level: 10,
      classId: "ID_FMP_CLASS_1",
      abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 10 },
      trainedSkillIds: [],
      featIds: ["ID_FMP_FEAT_3211"],
      powerIds: []
    };
    const defs = buildClassPowerSlotDefinitions(10, false);
    const rows = collectFeatPowerReplaceRows(index, build, defs);
    expect(rows).toHaveLength(1);
    expect(rows[0].feat.name).toBe("Gythka Expert");
    expect(rows[0].eligibleSlots.length).toBeGreaterThan(0);
  });
});
