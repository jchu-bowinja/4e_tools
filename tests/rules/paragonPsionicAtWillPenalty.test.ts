import { describe, expect, it } from "vitest";
import { buildClassPowerSlotDefinitions, reconcileClassPowerSlotsForBuild } from "../../src/rules/classPowerSlots";
import type { CharacterBuild, RulesIndex } from "../../src/rules/models";

const index = {
  classes: [
    { id: "c_fighter", name: "Fighter", slug: "fighter", powerSource: "Martial", raw: {} },
    { id: "c_psion", name: "Psion", slug: "psion", powerSource: "Psionic", raw: {} }
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
      id: "aw0",
      name: "Crushing Surge",
      slug: "crushing-surge",
      usage: "At-Will",
      level: 1,
      classId: "c_fighter",
      raw: { specific: { "Power Type": "Attack", Level: "1", "Power Usage": "At-Will" } }
    },
    {
      id: "aw1",
      name: "Reaping Strike",
      slug: "reaping-strike",
      usage: "At-Will",
      level: 1,
      classId: "c_fighter",
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
  items: [],
  hybridClasses: []
} as unknown as RulesIndex;

describe("paragon psionic at-will slot penalty", () => {
  const build: CharacterBuild = {
    level: 11,
    classId: "c_fighter",
    featIds: ["mc", "n", "a", "d"],
    paragonMulticlassing: true,
    classPowerSlots: { "atWill:0": "aw0", "atWill:1": "aw1" },
    powerIds: ["aw0", "aw1"],
    abilityScores: { STR: 16, CON: 12, DEX: 14, INT: 10, WIS: 10, CHA: 10 },
    trainedSkillIds: []
  };

  it("builds one fewer at-will slot definition", () => {
    const defs = buildClassPowerSlotDefinitions(11, false, 1);
    expect(defs.filter((d) => d.bucket === "atWill")).toHaveLength(1);
    expect(defs.some((d) => d.key === "atWill:1")).toBe(false);
  });

  it("reconcile drops the second at-will slot", () => {
    const next = reconcileClassPowerSlotsForBuild(build, 11, false, index);
    const awKeys = Object.keys(next.classPowerSlots || {}).filter((k) => k.startsWith("atWill:"));
    expect(awKeys).toEqual(["atWill:0"]);
    expect(next.classPowerSlots?.["atWill:0"]).toBe("aw0");
  });
});
