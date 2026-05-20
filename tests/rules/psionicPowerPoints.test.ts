import { describe, expect, it } from "vitest";
import {
  basePsionicPowerPointsForBuild,
  basePsionicPowerPointsFromLevel,
  buildHasPsionicAugmentationClass,
  heroicPsionicSwapPowerPointAdjustments,
  paragonMulticlassPowerPointBonus,
  paragonMulticlassPrimaryAtWillSlotPenalty,
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

describe("basePsionicPowerPointsFromLevel", () => {
  it("matches Psionic Augmentation table breakpoints", () => {
    expect(basePsionicPowerPointsFromLevel(1)).toBe(2);
    expect(basePsionicPowerPointsFromLevel(7)).toBe(6);
    expect(basePsionicPowerPointsFromLevel(13)).toBe(7);
    expect(basePsionicPowerPointsFromLevel(21)).toBe(11);
    expect(basePsionicPowerPointsFromLevel(27)).toBe(15);
  });
});

describe("basePsionicPowerPointsForBuild", () => {
  const index: RulesIndex = {
    classes: [
      { id: "c_psion", name: "Psion", slug: "psion", powerSource: "Psionic", raw: {} },
      { id: "c_fighter", name: "Fighter", slug: "fighter", powerSource: "Martial", raw: {} }
    ],
    feats: [],
    powers: [],
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

  it("returns class pool for psionic primary", () => {
    const build: CharacterBuild = {
      level: 11,
      classId: "c_psion",
      featIds: [],
      powerIds: [],
      abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 10 },
      trainedSkillIds: []
    };
    expect(buildHasPsionicAugmentationClass(index, build)).toBe(true);
    expect(basePsionicPowerPointsForBuild(index, build)).toBe(6);
  });

  it("returns 0 for martial primary", () => {
    const martial: CharacterBuild = {
      level: 11,
      classId: "c_fighter",
      featIds: [],
      powerIds: [],
      abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 10 },
      trainedSkillIds: []
    };
    expect(basePsionicPowerPointsForBuild(index, martial)).toBe(0);
  });
});

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

  it("returns 0 below 11", () => {
    expect(paragonMulticlassPowerPointBonus(indexWithMc, { ...mcChain, level: 10 })).toBe(0);
  });

  it("grants +2 for hybrid paragon MC into psionic", () => {
    const indexHybrid: RulesIndex = {
      ...indexWithMc,
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
          id: "h_psion",
          name: "Hybrid Psion",
          slug: "hybrid-psion",
          baseClassId: "c_psion",
          powerSource: "Psionic",
          raw: {}
        }
      ]
    };
    expect(
      paragonMulticlassPowerPointBonus(indexHybrid, {
        ...mcChain,
        characterStyle: "hybrid",
        hybridClassIdA: "h_fighter",
        hybridClassIdB: "h_psion"
      })
    ).toBe(2);
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
    expect(summary.baseFromClass).toBe(0);
    expect(summary.totalAdjustments).toBe(4);
    expect(summary.poolTotal).toBe(4);
    expect(summary.lines.map((l) => l.label)).toContain("Psionic Dabbler");
    expect(summary.lines.map((l) => l.label)).toContain("Paragon multiclassing");
  });
});

describe("paragonMulticlassPrimaryAtWillSlotPenalty", () => {
  const psionicClass = { id: "c_psion", name: "Psion", slug: "psion", powerSource: "Psionic", raw: {} };
  const martialClass = { id: "c_fighter", name: "Fighter", slug: "fighter", powerSource: "Martial", raw: {} };
  const mcFeat = {
    id: "mc",
    name: "Disciple of the Mind",
    slug: "dotm",
    hasMulticlassGrant: true,
    countsAsClassIds: ["c_psion"],
    countsAsClassNames: ["Psion"],
    prereqTokens: [],
    raw: {}
  };
  const indexWithMc: RulesIndex = {
    classes: [psionicClass, martialClass],
    feats: [mcFeat],
    powers: [],
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

  it("applies when non-psionic primary paragon MC into psionic", () => {
    const build: CharacterBuild = {
      level: 11,
      classId: "c_fighter",
      featIds: ["mc"],
      paragonMulticlassing: true,
      powerIds: [],
      abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 10 },
      trainedSkillIds: []
    };
    expect(paragonMulticlassPrimaryAtWillSlotPenalty(indexWithMc, build)).toBe(1);
    expect(summarizePsionicPowerPointAdjustments(indexWithMc, build).paragonPrimaryAtWillSlotPenalty).toBe(1);
  });

  it("does not apply for psionic primary or below 11", () => {
    const build: CharacterBuild = {
      level: 11,
      classId: "c_psion",
      featIds: ["mc"],
      paragonMulticlassing: true,
      powerIds: [],
      abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 10 },
      trainedSkillIds: []
    };
    expect(paragonMulticlassPrimaryAtWillSlotPenalty(indexWithMc, build)).toBe(0);
    expect(paragonMulticlassPrimaryAtWillSlotPenalty(indexWithMc, { ...build, level: 10 })).toBe(0);
  });

  it("applies for non-psionic hybrid paragon MC into psionic", () => {
    const indexHybrid: RulesIndex = {
      ...indexWithMc,
      classes: [
        ...indexWithMc.classes,
        { id: "c_rogue", name: "Rogue", slug: "rogue", powerSource: "Martial", raw: {} }
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
      ]
    };
    expect(
      paragonMulticlassPrimaryAtWillSlotPenalty(indexHybrid, {
        level: 11,
        characterStyle: "hybrid",
        hybridClassIdA: "h_fighter",
        hybridClassIdB: "h_rogue",
        featIds: ["mc"],
        paragonMulticlassing: true,
        powerIds: [],
        abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 10 },
        trainedSkillIds: []
      })
    ).toBe(1);
  });
});

describe("summarizePsionicPowerPointAdjustments pool total", () => {
  const psionicClass = { id: "c_psion", name: "Psion", slug: "psion", powerSource: "Psionic", raw: {} };
  const index: RulesIndex = {
    classes: [psionicClass],
    feats: [],
    powers: [],
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

  it("combines class pool and adjustments", () => {
    const build: CharacterBuild = {
      level: 7,
      classId: "c_psion",
      featIds: [],
      powerIds: [],
      abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 10 },
      trainedSkillIds: []
    };
    const summary = summarizePsionicPowerPointAdjustments(index, build);
    expect(summary.baseFromClass).toBe(6);
    expect(summary.poolTotal).toBe(6);
  });
});
