import { describe, expect, it } from "vitest";
import { buildClassPowerSlotDefinitions } from "../../src/rules/classPowerSlots";
import {
  collectMulticlassSlotSwapRows,
  eligibleSlotsForMulticlassSwap,
  isAugmentableAtWillPower,
  multiclassPowersForSlotSwap,
  pruneMulticlassSlotSwaps,
  toggleMulticlassSlotSwap
} from "../../src/rules/featMulticlassSlotSwap";
import { activeFeatReplacementPowerIds } from "../../src/rules/featPowerReplace";
import type { CharacterBuild, Feat, Power, RulesIndex } from "../../src/rules/models";

const novicePower: Feat = {
  id: "ID_FMP_FEAT_339",
  name: "Novice Power",
  slug: "novice-power",
  prereqTokens: [],
  multiclassSlotSwapOffers: [{ usageBucket: "encounter", maxSlotGainLevel: 30, optional: true }],
  raw: {}
};

const sneakOfShadows: Feat = {
  id: "ID_MC_ROGUE",
  name: "Sneak of Shadows",
  slug: "sneak-of-shadows",
  prereqTokens: [],
  hasMulticlassGrant: true,
  countsAsClassIds: ["ID_FMP_CLASS_7"],
  countsAsClassNames: ["Rogue"],
  raw: {}
};

const rogueCleave: Power = {
  id: "ID_ROGUE_ENC",
  name: "Positioning Strike",
  slug: "positioning-strike",
  usage: "Encounter",
  level: 1,
  classId: "ID_FMP_CLASS_7",
  raw: { specific: { "Power Type": "Attack", Level: "1", "Power Usage": "Encounter" } }
};

const fighterPower: Power = {
  id: "ID_FIGHTER_ENC",
  name: "Commander's Strike",
  slug: "commanders-strike",
  usage: "Encounter",
  level: 1,
  classId: "ID_FMP_CLASS_1",
  raw: { specific: { "Power Type": "Attack", Level: "1", "Power Usage": "Encounter" } }
};

const index: RulesIndex = {
  feats: [novicePower, sneakOfShadows],
  powers: [rogueCleave, fighterPower],
  classes: [
    { id: "ID_FMP_CLASS_1", name: "Fighter", slug: "fighter", raw: {} },
    { id: "ID_FMP_CLASS_7", name: "Rogue", slug: "rogue", raw: {} }
  ],
  races: [],
  skills: [],
  themes: [],
  paragonPaths: [],
  epicDestinies: [],
  backgrounds: [],
  rituals: [],
  items: [],
  hybridClasses: []
};

describe("featMulticlassSlotSwap", () => {
  const slotDefs = buildClassPowerSlotDefinitions(4, false);

  it("collects rows when multiclass entry and novice are present", () => {
    const build: CharacterBuild = {
      level: 4,
      classId: "ID_FMP_CLASS_1",
      featIds: ["ID_MC_ROGUE", "ID_FMP_FEAT_339"],
      powerIds: [],
      abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 10 },
      trainedSkillIds: []
    };
    const rows = collectMulticlassSlotSwapRows(index, build, slotDefs);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.multiclassClassId).toBe("ID_FMP_CLASS_7");
    expect(rows[0]!.eligibleSlots.some((d) => d.bucket === "encounter")).toBe(true);
  });

  it("omits novice below level 4", () => {
    const build: CharacterBuild = {
      level: 3,
      classId: "ID_FMP_CLASS_1",
      featIds: ["ID_MC_ROGUE", "ID_FMP_FEAT_339"],
      powerIds: [],
      abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 10 },
      trainedSkillIds: []
    };
    expect(collectMulticlassSlotSwapRows(index, build, slotDefs)).toHaveLength(0);
  });

  it("enables swap and allows multiclass power in slot validation set", () => {
    const encSlot = slotDefs.find((d) => d.bucket === "encounter")!;
    const build: CharacterBuild = {
      level: 4,
      classId: "ID_FMP_CLASS_1",
      featIds: ["ID_MC_ROGUE", "ID_FMP_FEAT_339"],
      classPowerSlots: { [encSlot.key]: "ID_FIGHTER_ENC" },
      powerIds: ["ID_FIGHTER_ENC"],
      abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 10 },
      trainedSkillIds: []
    };
    const next = toggleMulticlassSlotSwap(build, "ID_FMP_FEAT_339", encSlot.key, "ID_ROGUE_ENC", true);
    expect(next.classPowerSlots?.[encSlot.key]).toBe("ID_ROGUE_ENC");
    expect(next.featPowerReplacements?.["ID_FMP_FEAT_339"]).toMatchObject({
      slotKey: encSlot.key,
      originalPowerId: "ID_FIGHTER_ENC",
      replacementPowerId: "ID_ROGUE_ENC"
    });
    const allowed = activeFeatReplacementPowerIds(index, next);
    expect(allowed.has("ID_ROGUE_ENC")).toBe(true);
  });

  it("lists rogue encounter powers for multiclass slot", () => {
    const encSlot = eligibleSlotsForMulticlassSwap(slotDefs, novicePower.multiclassSlotSwapOffers![0]!, 4).find(
      (d) => d.bucket === "encounter"
    )!;
    const pool = multiclassPowersForSlotSwap(index, "ID_FMP_CLASS_7", encSlot, novicePower.multiclassSlotSwapOffers![0]!);
    expect(pool.some((p) => p.id === "ID_ROGUE_ENC")).toBe(true);
  });

  it("filters augmentable at-will replacement for psionic complement-style offer", () => {
    const psionicAtWill: Power = {
      id: "ID_PSION_AW",
      name: "Mind Thrust",
      slug: "mind-thrust",
      usage: "At-Will",
      level: 1,
      classId: "ID_FMP_CLASS_7",
      raw: { specific: { "Power Type": "Attack", Level: "1", "Power Usage": "At-Will", Keywords: "Augmentable, Psionic" } }
    };
    const plainAtWill: Power = {
      id: "ID_PLAIN_AW",
      name: "Melee Basic",
      slug: "melee-basic",
      usage: "At-Will",
      level: 1,
      classId: "ID_FMP_CLASS_7",
      raw: { specific: { "Power Type": "Attack", Level: "1", "Power Usage": "At-Will", Keywords: "Weapon" } }
    };
    const idx: RulesIndex = {
      ...index,
      powers: [...index.powers, psionicAtWill, plainAtWill]
    };
    const offer = {
      usageBucket: "atWill" as const,
      maxSlotGainLevel: 30,
      optional: true,
      requireAugmentableReplacement: true
    };
    const awSlot = buildClassPowerSlotDefinitions(4, false).find((d) => d.bucket === "atWill")!;
    const pool = multiclassPowersForSlotSwap(idx, "ID_FMP_CLASS_7", awSlot, offer);
    expect(pool.some((p) => p.id === "ID_PSION_AW")).toBe(true);
    expect(pool.some((p) => p.id === "ID_PLAIN_AW")).toBe(false);
    expect(isAugmentableAtWillPower(psionicAtWill)).toBe(true);
    expect(isAugmentableAtWillPower(plainAtWill)).toBe(false);
  });

  it("prunes invalid multiclass replacement", () => {
    const encSlot = slotDefs.find((d) => d.bucket === "encounter")!;
    const build: CharacterBuild = {
      level: 4,
      classId: "ID_FMP_CLASS_1",
      featIds: ["ID_MC_ROGUE", "ID_FMP_FEAT_339"],
      classPowerSlots: { [encSlot.key]: "ID_BAD" },
      featPowerReplacements: {
        "ID_FMP_FEAT_339": { slotKey: encSlot.key, replacementPowerId: "ID_BAD" }
      },
      powerIds: [],
      abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 10 },
      trainedSkillIds: []
    };
    const next = pruneMulticlassSlotSwaps(build, index, slotDefs);
    expect(next.featPowerReplacements?.["ID_FMP_FEAT_339"]).toBeUndefined();
  });
});
