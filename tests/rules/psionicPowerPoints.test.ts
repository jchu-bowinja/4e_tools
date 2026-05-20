import { describe, expect, it } from "vitest";
import {
  heroicPsionicSwapPowerPointAdjustments,
  paragonMulticlassPowerPointBonus,
  powerPointsForPrintedLevel,
  summarizePsionicPowerPointAdjustments
} from "../../src/rules/psionicPowerPoints";
import type { CharacterBuild, Feat, Power, RulesIndex } from "../../src/rules/models";

const psionicClass = { id: "c_psion", name: "Psion", slug: "psion", powerSource: "Psionic", raw: {} };
const martialClass = { id: "c_fighter", name: "Fighter", slug: "fighter", powerSource: "Martial", raw: {} };

const dabblerFeat: Feat = {
  id: "dabbler",
  name: "Psionic Dabbler",
  slug: "psionic-dabbler",
  prereqTokens: [],
  multiclassSlotSwapOffers: [
    {
      usageBucket: "encounter",
      replacementUsageBucket: "atWill",
      maxSlotGainLevel: 30,
      optional: true,
      powerPointSwapChange: "gain"
    }
  ],
  raw: {}
};

const conventionalistFeat: Feat = {
  id: "conv",
  name: "Psionic Conventionalist",
  slug: "psionic-conventionalist",
  prereqTokens: [],
  multiclassSlotSwapOffers: [
    {
      usageBucket: "atWill",
      replacementUsageBucket: "encounter",
      maxSlotGainLevel: 30,
      optional: true,
      powerPointSwapChange: "lose"
    }
  ],
  raw: {}
};

const augmentableAtWillLv5: Power = {
  id: "aw5",
  name: "Mind Spike",
  slug: "mind-spike",
  usage: "At-Will",
  level: 5,
  classId: "c_psion",
  raw: { specific: { Keywords: "Augmentable, Psionic", "Power Usage": "At-Will" } }
};

const augmentableAtWillLv15: Power = {
  id: "aw15",
  name: "Far Thought",
  slug: "far-thought",
  usage: "At-Will",
  level: 15,
  classId: "c_psion",
  raw: { specific: { Keywords: "Augmentable, Psionic", "Power Usage": "At-Will" } }
};

const index: RulesIndex = {
  classes: [psionicClass, martialClass],
  feats: [dabblerFeat, conventionalistFeat],
  powers: [augmentableAtWillLv5, augmentableAtWillLv15],
  skills: [],
  races: [],
  themes: [],
  paragonPaths: [],
  epicDestinies: [],
  backgrounds: [],
  rituals: [],
  items: [],
  hybridClasses: []
};

describe("powerPointsForPrintedLevel", () => {
  it("maps heroic, paragon, and epic tiers", () => {
    expect(powerPointsForPrintedLevel(1)).toBe(2);
    expect(powerPointsForPrintedLevel(10)).toBe(2);
    expect(powerPointsForPrintedLevel(11)).toBe(4);
    expect(powerPointsForPrintedLevel(20)).toBe(4);
    expect(powerPointsForPrintedLevel(21)).toBe(6);
  });
});

describe("heroicPsionicSwapPowerPointAdjustments", () => {
  it("gains power points from replacement level (Dabbler)", () => {
    const build: CharacterBuild = {
      level: 6,
      classId: "c_fighter",
      featIds: ["dabbler"],
      featPowerReplacements: {
        dabbler: { slotKey: "encounter:0", originalPowerId: "x", replacementPowerId: "aw5" }
      },
      powerIds: [],
      abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 10 },
      trainedSkillIds: []
    };
    const lines = heroicPsionicSwapPowerPointAdjustments(index, build);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.delta).toBe(2);
    expect(lines[0]!.detail).toContain("Gain 2");
  });

  it("loses power points from swapped-out augmentable at-will level (Conventionalist)", () => {
    const build: CharacterBuild = {
      level: 8,
      classId: "c_psion",
      featIds: ["conv"],
      featPowerReplacements: {
        conv: { slotKey: "atWill:0", originalPowerId: "aw15", replacementPowerId: "enc1" }
      },
      powerIds: [],
      abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 10 },
      trainedSkillIds: []
    };
    const lines = heroicPsionicSwapPowerPointAdjustments(index, build);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.delta).toBe(-4);
  });

  it("ignores inactive swaps", () => {
    const build: CharacterBuild = {
      level: 6,
      classId: "c_fighter",
      featIds: ["dabbler"],
      featPowerReplacements: { dabbler: { slotKey: "encounter:0" } },
      powerIds: [],
      abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 10 },
      trainedSkillIds: []
    };
    expect(heroicPsionicSwapPowerPointAdjustments(index, build)).toHaveLength(0);
  });
});

describe("paragonMulticlassPowerPointBonus", () => {
  const mcChain: CharacterBuild = {
    level: 11,
    classId: "c_fighter",
    featIds: ["mc"],
    paragonMulticlassing: true,
    powerIds: [],
    abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 10 },
    trainedSkillIds: []
  };

  const indexWithMc: RulesIndex = {
    ...index,
    feats: [
      ...index.feats,
      {
        id: "mc",
        name: "Disciple of the Mind",
        slug: "dotm",
        hasMulticlassGrant: true,
        countsAsClassIds: ["c_psion"],
        countsAsClassNames: ["Psion"],
        prereqTokens: [],
        raw: {}
      }
    ]
  };

  it("grants +2 when multiclassing into psionic at 11", () => {
    expect(paragonMulticlassPowerPointBonus(indexWithMc, mcChain)).toBe(2);
  });

  it("grants +2 when both classes are psionic", () => {
    expect(paragonMulticlassPowerPointBonus(indexWithMc, { ...mcChain, classId: "c_psion" })).toBe(2);
  });

  it("returns 0 below 11 or for hybrid", () => {
    expect(paragonMulticlassPowerPointBonus(indexWithMc, { ...mcChain, level: 10 })).toBe(0);
    expect(paragonMulticlassPowerPointBonus(indexWithMc, { ...mcChain, characterStyle: "hybrid" })).toBe(0);
  });
});

describe("summarizePsionicPowerPointAdjustments", () => {
  it("totals heroic and paragon lines", () => {
    const build: CharacterBuild = {
      level: 11,
      classId: "c_fighter",
      featIds: ["dabbler", "mc"],
      paragonMulticlassing: true,
      featPowerReplacements: {
        dabbler: { slotKey: "encounter:0", originalPowerId: "x", replacementPowerId: "aw5" }
      },
      powerIds: [],
      abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 10 },
      trainedSkillIds: []
    };
    const indexWithMc: RulesIndex = {
      ...index,
      feats: [
        ...index.feats,
        {
          id: "mc",
          name: "Disciple of the Mind",
          slug: "dotm",
          hasMulticlassGrant: true,
          countsAsClassIds: ["c_psion"],
          countsAsClassNames: ["Psion"],
          prereqTokens: [],
          raw: {}
        }
      ]
    };
    const summary = summarizePsionicPowerPointAdjustments(indexWithMc, build);
    expect(summary.total).toBe(4);
    expect(summary.lines.map((l) => l.label)).toContain("Psionic Dabbler");
    expect(summary.lines.map((l) => l.label)).toContain("Paragon multiclassing");
  });
});
