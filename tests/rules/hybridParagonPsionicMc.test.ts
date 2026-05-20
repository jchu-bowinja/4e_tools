import { describe, expect, it } from "vitest";
import { buildHybridPowerSlotDefinitions, reconcileHybridClassPowerSlotsForBuild } from "../../src/rules/hybridPowerSlots";
import type { CharacterBuild, RulesIndex } from "../../src/rules/models";

const index = {
  classes: [
    { id: "c_fighter", name: "Fighter", slug: "fighter", powerSource: "Martial", raw: {} },
    { id: "c_rogue", name: "Rogue", slug: "rogue", powerSource: "Martial", raw: {} },
    { id: "c_psion", name: "Psion", slug: "psion", powerSource: "Psionic", raw: {} }
  ],
  hybridClasses: [
    {
      id: "h_fighter",
      name: "Hybrid Fighter",
      slug: "hybrid-fighter",
      baseClassId: "c_fighter",
      powerSource: "Martial",
      raw: {}
    },
    {
      id: "h_rogue",
      name: "Hybrid Rogue",
      slug: "hybrid-rogue",
      baseClassId: "c_rogue",
      powerSource: "Martial",
      raw: {}
    }
  ],
  feats: [
    {
      id: "mc",
      name: "Disciple of the Mind",
      slug: "dotm",
      hasMulticlassGrant: true,
      countsAsClassIds: ["c_psion"],
      countsAsClassNames: ["Psion"],
      prereqTokens: [],
      raw: {}
    },
    { id: "n", name: "Novice Power", slug: "n", prereqTokens: [], raw: {} },
    { id: "a", name: "Acolyte Power", slug: "a", prereqTokens: [], raw: {} },
    { id: "d", name: "Adept Power", slug: "d", prereqTokens: [], raw: {} }
  ],
  powers: [
    {
      id: "aw_a",
      name: "Crushing Surge",
      slug: "crushing-surge",
      usage: "At-Will",
      level: 1,
      classId: "c_fighter",
      raw: { specific: { "Power Type": "Attack", Level: "1", "Power Usage": "At-Will" } }
    },
    {
      id: "aw_b",
      name: "Positioning Strike",
      slug: "positioning-strike",
      usage: "At-Will",
      level: 1,
      classId: "c_rogue",
      raw: { specific: { "Power Type": "Attack", Level: "1", "Power Usage": "At-Will" } }
    }
  ],
  skills: [],
  races: [],
  themes: [],
  paragonPaths: [],
  epicDestinies: [],
  backgrounds: [],
  rituals: [],
  items: []
} as unknown as RulesIndex;

describe("hybrid paragon psionic multiclassing", () => {
  const build: CharacterBuild = {
    level: 11,
    characterStyle: "hybrid",
    hybridClassIdA: "h_fighter",
    hybridClassIdB: "h_rogue",
    featIds: ["mc", "n", "a", "d"],
    paragonMulticlassing: true,
    classPowerSlots: { "hybrid:awA:0": "aw_a", "hybrid:awB:0": "aw_b" },
    powerIds: ["aw_a", "aw_b"],
    abilityScores: { STR: 16, CON: 12, DEX: 14, INT: 10, WIS: 10, CHA: 10 },
    trainedSkillIds: []
  };

  it("builds one fewer hybrid at-will slot", () => {
    const defs = buildHybridPowerSlotDefinitions(11, false, 1);
    expect(defs.filter((d) => d.bucket === "atWill")).toHaveLength(1);
    expect(defs[0]?.key).toBe("hybrid:awA:0");
  });

  it("reconcile drops the second hybrid at-will slot", () => {
    const next = reconcileHybridClassPowerSlotsForBuild(build, 11, false, index, "c_fighter", "c_rogue");
    const awKeys = Object.keys(next.classPowerSlots || {}).filter((k) => k.startsWith("hybrid:aw"));
    expect(awKeys).toEqual(["hybrid:awA:0"]);
    expect(next.classPowerSlots?.["hybrid:awA:0"]).toBe("aw_a");
  });
});
