import { describe, expect, it } from "vitest";
import {
  canChooseParagonMulticlassing,
  collectParagonMulticlassPowerIds,
  disableParagonAtWillSwap,
  hasFullMulticlassPowerChain,
  multiclassEntryClassId,
  pruneParagonMulticlassing,
  setParagonAtWillSwap,
  validateParagonMulticlassing
} from "../../src/rules/paragonMulticlassing";
import type { CharacterBuild, RulesIndex } from "../../src/rules/models";

const index = {
  classes: [{ id: "c_rogue", name: "Rogue", slug: "rogue", raw: {} }],
  feats: [
    {
      id: "mc",
      name: "Sneak of Shadows",
      slug: "sos",
      hasMulticlassGrant: true,
      countsAsClassNames: ["Rogue"],
      countsAsClassIds: ["c_rogue"],
      prereqTokens: [],
      raw: {}
    },
    { id: "n", name: "Novice Power", slug: "n", prereqTokens: [], raw: {} },
    { id: "a", name: "Acolyte Power", slug: "a", prereqTokens: [], raw: {} },
    { id: "d", name: "Adept Power", slug: "d", prereqTokens: [], raw: {} }
  ],
  powers: [],
  skills: [],
  races: [],
  languages: [],
  racialTraits: [],
  classFeatures: [],
  armors: [],
  weapons: [],
  implements: [],
  abilityScores: [],
  themes: [],
  paragonPaths: [],
  epicDestinies: []
} as unknown as RulesIndex;

const build: CharacterBuild = {
  name: "T",
  level: 11,
  raceId: "r1",
  classId: "c_fighter",
  abilityScores: { STR: 16, CON: 12, DEX: 14, INT: 10, WIS: 10, CHA: 10 },
  trainedSkillIds: [],
  featIds: ["mc", "n", "a", "d"],
  powerIds: []
};

describe("paragonMulticlassing", () => {
  it("detects full power chain", () => {
    expect(hasFullMulticlassPowerChain(index, build)).toBe(true);
    expect(canChooseParagonMulticlassing(index, build)).toBe(true);
    expect(multiclassEntryClassId(index, build)).toBe("c_rogue");
  });

  it("rejects paragon path and paragon multiclassing together", () => {
    const errors = validateParagonMulticlassing(index, {
      ...build,
      paragonMulticlassing: true,
      paragonPathId: "pp1"
    });
    expect(errors.some((e) => e.includes("Clear paragon path"))).toBe(true);
  });

  it("collects paragon multiclass power ids by level", () => {
    const withPicks = {
      ...build,
      level: 20,
      paragonMulticlassing: true,
      paragonMulticlassPowers: {
        atWillSwapPowerId: "aw1",
        encounterPowerId: "enc1",
        utilityPowerId: "util1",
        dailyPowerId: "daily1"
      }
    };
    expect(collectParagonMulticlassPowerIds(withPicks).sort()).toEqual(["aw1", "daily1", "enc1", "util1"].sort());
    expect(
      collectParagonMulticlassPowerIds({
        ...withPicks,
        level: 11,
        paragonMulticlassPowers: { atWillSwapPowerId: "aw1", encounterPowerId: "enc1", utilityPowerId: "util1" }
      })
    ).toEqual(["aw1", "enc1"]);
  });

  it("applies paragon at-will swap to a class slot and restores on clear", () => {
    const next = setParagonAtWillSwap(
      { ...build, classPowerSlots: { "atWill:0": "fighter_aw" }, powerIds: ["fighter_aw"] },
      "atWill:0",
      "rogue_aw"
    );
    expect(next.classPowerSlots?.["atWill:0"]).toBe("rogue_aw");
    expect(next.paragonMulticlassPowers?.atWillSwapOriginalPowerId).toBe("fighter_aw");
    const cleared = disableParagonAtWillSwap(next);
    expect(cleared.classPowerSlots?.["atWill:0"]).toBe("fighter_aw");
    expect(cleared.paragonMulticlassPowers?.atWillSwapPowerId).toBeUndefined();
  });

  it("prunes paragon multiclass when chain is lost", () => {
    const next = pruneParagonMulticlassing(index, {
      ...build,
      paragonMulticlassing: true,
      paragonMulticlassPowers: { encounterPowerId: "enc1" },
      featIds: ["mc"]
    });
    expect(next.paragonMulticlassing).toBeUndefined();
    expect(next.paragonMulticlassPowers).toBeUndefined();
  });
});
