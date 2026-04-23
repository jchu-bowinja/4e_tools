import { describe, expect, it } from "vitest";
import { validateCharacterBuild } from "../../src/rules/characterValidator";
import { racePowerSelectSelectionKey } from "../../src/rules/grantedPowersQuery";
import { RulesIndex } from "../../src/rules/models";

const placeholderFeats = Array.from({ length: 20 }, (_, i) => ({
  id: `feat${i + 1}`,
  name: `Placeholder Feat ${i + 1}`,
  slug: `placeholder-feat-${i + 1}`,
  prereqTokens: [],
  raw: {}
}));

const index: RulesIndex = {
  meta: { version: 1, counts: {} },
  races: [
    { id: "race1", name: "Dwarf", slug: "dwarf", raw: {} },
    {
      id: "race_lang",
      name: "Langlish",
      slug: "langlish",
      raw: {
        specific: { "Ability Scores": "+2 Charisma" },
        rules: { select: [{ attrs: { type: "Language", number: "1", Category: "Starting" } }] }
      }
    }
  ],
  classes: [
    {
      id: "class1",
      name: "Fighter",
      slug: "fighter",
      raw: {
        specific: {
          "Class Skills": "Athletics (Str), Endurance (Con), Heal (Wis)",
          "Trained Skills": "From the class skills list below, choose 3 trained skills at 1st level.",
          "Armor Proficiencies": "Cloth, leather, hide"
        }
      }
    }
  ],
  feats: placeholderFeats,
  powers: [
    {
      id: "p1",
      name: "Cleave",
      slug: "cleave",
      classId: "class1",
      level: 1,
      usage: "At-Will",
      raw: { specific: { "Power Type": "Attack" } }
    },
    {
      id: "p2",
      name: "Reaping Strike",
      slug: "reaping-strike",
      classId: "class1",
      level: 1,
      usage: "At-Will",
      raw: { specific: { "Power Type": "Attack" } }
    },
    {
      id: "p3",
      name: "Steel Serpent Strike",
      slug: "steel-serpent-strike",
      classId: "class1",
      level: 1,
      usage: "Encounter",
      raw: { specific: { "Power Type": "Attack" } }
    },
    {
      id: "p4",
      name: "Brute Strike",
      slug: "brute-strike",
      classId: "class1",
      level: 1,
      usage: "Daily",
      raw: { specific: { "Power Type": "Attack" } }
    }
  ],
  skills: [
    { id: "s1", name: "Athletics", slug: "athletics", raw: {} },
    { id: "s2", name: "Endurance", slug: "endurance", raw: {} },
    { id: "s3", name: "Heal", slug: "heal", raw: {} }
  ],
  languages: [{ id: "lang1", name: "Dwarven", slug: "dwarven", prereqsRaw: null, raw: {} }],
  racialTraits: [],
  armors: [
    { id: "a1", name: "Leather Armor", slug: "leather-armor", armorType: "Light", armorCategory: "Leather", armorBonus: 2, raw: {} },
    { id: "sh1", name: "Light Shield", slug: "light-shield", armorType: "Shield", armorCategory: "Light Shields", armorBonus: 1, raw: {} }
  ],
  abilityScores: [],
  themes: [
    {
      id: "theme_drow",
      name: "Drow Gate",
      slug: "drow-gate",
      prereqTokens: [{ kind: "race", value: "Drow" }],
      raw: {}
    }
  ],
  paragonPaths: [
    {
      id: "pp1",
      name: "Fighter Path",
      slug: "fighter-path",
      prereqTokens: [{ kind: "class", value: "Fighter" }],
      raw: {}
    }
  ],
  epicDestinies: [
    {
      id: "ed1",
      name: "Epic Test",
      slug: "epic-test",
      prereqTokens: [],
      raw: {}
    }
  ]
};

const legalLevel1Base = {
  name: "Hero",
  level: 1,
  raceId: "race1",
  classId: "class1",
  abilityScores: { STR: 16, CON: 14, DEX: 12, INT: 10, WIS: 11, CHA: 8 },
  trainedSkillIds: ["s1", "s2", "s3"],
  armorId: "a1",
  featIds: ["feat1"],
  powerIds: ["p1", "p2", "p3", "p4"],
  classPowerSlots: {
    "atWill:0": "p1",
    "atWill:1": "p2",
    "encounter:1": "p3",
    "daily:1": "p4"
  }
};

describe("validateCharacterBuild", () => {
  it("accepts a legal level-1 selection profile", () => {
    const result = validateCharacterBuild(index, legalLevel1Base);
    expect(result.errors).toEqual([]);
  });

  it("requires and validates racial Power select picks (e.g. Lolthtouched)", () => {
    const traitId = "trait_lolth_test";
    const indexLolth: RulesIndex = {
      ...index,
      races: [
        ...index.races,
        {
          id: "race_drow_pick",
          name: "Drow Pick Test",
          slug: "drow-pick-test",
          raw: { specific: { "Racial Traits": traitId } }
        }
      ],
      racialTraits: [
        ...index.racialTraits,
        {
          id: traitId,
          name: "Lolthtouched Test",
          slug: "lolth-test",
          raw: {
            specific: { Powers: "ID_FMP_POWER_LOLTH_A,ID_FMP_POWER_LOLTH_B" },
            rules: { select: [{ attrs: { type: "Power", number: "1", Category: traitId } }] }
          }
        }
      ],
      powers: [
        ...index.powers,
        {
          id: "ID_FMP_POWER_LOLTH_A",
          name: "Cloud",
          slug: "cloud",
          level: 1,
          usage: "Encounter",
          raw: { specific: { "Power Type": "Utility" } }
        },
        {
          id: "ID_FMP_POWER_LOLTH_B",
          name: "Darkfire",
          slug: "darkfire",
          level: 1,
          usage: "Encounter",
          raw: { specific: { "Power Type": "Utility" } }
        }
      ]
    };
    const base = { ...legalLevel1Base, raceId: "race_drow_pick" };
    const missing = validateCharacterBuild(indexLolth, base);
    expect(missing.errors.some((e) => e.includes("Lolthtouched Test") && e.includes("choose"))).toBe(true);

    const okPick = validateCharacterBuild(indexLolth, {
      ...base,
      raceSelections: { [`racialPower:${traitId}`]: "ID_FMP_POWER_LOLTH_A" }
    });
    expect(okPick.errors.filter((e) => e.includes("Lolthtouched Test") || e.includes("racial power"))).toEqual([]);

    const badPick = validateCharacterBuild(indexLolth, {
      ...base,
      raceSelections: { [`racialPower:${traitId}`]: "not_a_power" }
    });
    expect(badPick.errors.some((e) => e.includes("not a legal option"))).toBe(true);
  });

  it("requires a legal Dilettante power when the race has that trait", () => {
    const traitId = "trait_dil";
    const indexDil: RulesIndex = {
      ...index,
      races: [
        ...index.races,
        {
          id: "race_he",
          name: "Half-Elf Test",
          slug: "half-elf-test",
          raw: { specific: { "Racial Traits": traitId } }
        }
      ],
      racialTraits: [
        ...index.racialTraits,
        {
          id: traitId,
          name: "Dilettante",
          slug: "dilettante",
          raw: {
            rules: {
              select: [{ attrs: { type: "Power", name: "Dilettante", number: "1", Category: "$$NOT_CLASS,at-will,1" } }]
            }
          }
        }
      ],
      powers: [
        ...index.powers,
        {
          id: "dil_other",
          name: "Other At-Will",
          slug: "other-aw",
          classId: "ID_FMP_CLASS_99",
          level: 1,
          usage: "At-Will",
          raw: { specific: { "Power Type": "Attack" } }
        }
      ],
      classes: [
        ...index.classes,
        {
          id: "ID_FMP_CLASS_99",
          name: "Wizard",
          slug: "wizard",
          raw: {
            specific: {
              "Class Skills": "Arcana (Int)",
              "Trained Skills": "From the class skills list below, choose 2 trained skills at 1st level."
            }
          }
        }
      ]
    };
    const base = { ...legalLevel1Base, raceId: "race_he" };
    const missing = validateCharacterBuild(indexDil, base);
    expect(missing.errors.some((e) => e.includes("Dilettante") && e.includes("at-will"))).toBe(true);

    const ok = validateCharacterBuild(indexDil, {
      ...base,
      raceSelections: { [racePowerSelectSelectionKey(traitId)]: "dil_other" }
    });
    expect(ok.errors.filter((e) => e.includes("Dilettante"))).toEqual([]);
  });

  it("requires a bonus language when the race rules include a Language select", () => {
    const result = validateCharacterBuild(index, { ...legalLevel1Base, raceId: "race_lang" });
    expect(result.errors.some((e) => e.includes("Bonus language"))).toBe(true);
  });

  it("accepts bonus language when raceSelections is set", () => {
    const result = validateCharacterBuild(index, {
      ...legalLevel1Base,
      raceId: "race_lang",
      raceSelections: { "language-0": "lang1" }
    });
    expect(result.errors).toEqual([]);
  });

  it("reports slot errors for missing powers", () => {
    const result = validateCharacterBuild(index, {
      ...legalLevel1Base,
      powerIds: ["p1", "p3"],
      classPowerSlots: { "atWill:0": "p1", "encounter:1": "p3" }
    });
    expect(result.errors.join(" ")).toContain("at-will");
    expect(result.errors.join(" ")).toContain("daily");
  });

  it("rejects duplicate class power selections", () => {
    const result = validateCharacterBuild(index, {
      ...legalLevel1Base,
      powerIds: ["p1", "p1", "p3", "p4"],
      classPowerSlots: {
        "atWill:0": "p1",
        "atWill:1": "p1",
        "encounter:1": "p3",
        "daily:1": "p4"
      }
    });
    expect(result.errors.some((e) => e.toLowerCase().includes("duplicate"))).toBe(true);
  });

  it("rejects a theme when parsed prerequisites are not met", () => {
    const result = validateCharacterBuild(index, {
      ...legalLevel1Base,
      themeId: "theme_drow"
    });
    expect(result.errors.some((e) => e.startsWith("Theme:"))).toBe(true);
  });

  it("rejects a paragon path below level 11", () => {
    const result = validateCharacterBuild(index, {
      ...legalLevel1Base,
      paragonPathId: "pp1"
    });
    expect(result.errors.some((e) => e.includes("Paragon path can only be selected"))).toBe(true);
  });

  it("rejects an epic destiny below level 21", () => {
    const result = validateCharacterBuild(index, {
      ...legalLevel1Base,
      epicDestinyId: "ed1"
    });
    expect(result.errors.some((e) => e.includes("Epic destiny can only be selected"))).toBe(true);
  });

  it("requires ASI choices at level 4", () => {
    const result = validateCharacterBuild(index, {
      ...legalLevel1Base,
      level: 4,
      featIds: ["feat1", "feat2", "feat3"],
      asiChoices: undefined
    });
    expect(result.errors.some((e) => e.includes("Ability increases"))).toBe(true);
  });

  it("accepts a minimal legal hybrid level-1 profile", () => {
    const indexHybrid: RulesIndex = {
      ...index,
      classes: [
        ...index.classes,
        {
          id: "class2",
          name: "Cleric",
          slug: "cleric",
          raw: {
            specific: {
              "Class Skills": "Heal (Wis)",
              "Trained Skills": "Pick 3",
              "Armor Proficiencies": "Cloth"
            }
          }
        }
      ],
      skills: [...index.skills, { id: "s4", name: "Stealth", slug: "stealth", raw: {} }],
      powers: [
        ...index.powers,
        {
          id: "pw2_aw",
          name: "Holy Smite",
          slug: "holy-smite",
          classId: "class2",
          level: 1,
          usage: "At-Will",
          raw: { specific: { "Power Type": "Attack" } }
        }
      ],
      hybridClasses: [
        {
          id: "hy_h1",
          name: "Hybrid Fighter Half",
          slug: "hybrid-f1",
          baseClassId: "class1",
          classSkillsRaw: "Athletics (Str), Endurance (Con)",
          armorProficiencies: "Cloth, leather, hide",
          raw: {}
        },
        {
          id: "hy_h2",
          name: "Hybrid Cleric Half",
          slug: "hybrid-c1",
          baseClassId: "class2",
          classSkillsRaw: "Heal (Wis), Stealth (Dex)",
          armorProficiencies: "Cloth",
          raw: {}
        }
      ]
    };

    const hybridLegal = {
      name: "Hybrid Hero",
      level: 1,
      raceId: "race1",
      characterStyle: "hybrid" as const,
      hybridClassIdA: "hy_h1",
      hybridClassIdB: "hy_h2",
      classId: undefined,
      abilityScores: { STR: 16, CON: 14, DEX: 12, INT: 10, WIS: 11, CHA: 8 },
      trainedSkillIds: ["s1", "s2", "s3", "s4"],
      armorId: "a1",
      featIds: ["feat1"],
      powerIds: ["p1", "pw2_aw", "p3", "p4"],
      classPowerSlots: {
        "hybrid:awA:0": "p1",
        "hybrid:awB:0": "pw2_aw",
        "hybrid:encounter:1": "p3",
        "hybrid:daily:1": "p4"
      }
    };

    expect(validateCharacterBuild(indexHybrid, hybridLegal).errors).toEqual([]);
  });

  it("requires hybrid talent selections when options exist on both hybrid entries", () => {
    const indexWithTalent: RulesIndex = {
      ...index,
      classes: [
        ...index.classes,
        {
          id: "class2",
          name: "Cleric",
          slug: "cleric",
          raw: {
            specific: {
              "Class Skills": "Heal (Wis)",
              "Trained Skills": "Pick 3",
              "Armor Proficiencies": "Cloth"
            }
          }
        }
      ],
      skills: [...index.skills, { id: "s4", name: "Stealth", slug: "stealth", raw: {} }],
      powers: [
        ...index.powers,
        {
          id: "pw2_aw",
          name: "Holy Smite",
          slug: "holy-smite",
          classId: "class2",
          level: 1,
          usage: "At-Will",
          raw: { specific: { "Power Type": "Attack" } }
        }
      ],
      hybridClasses: [
        {
          id: "hy_h1",
          name: "Hybrid Fighter Half",
          slug: "hybrid-f1",
          baseClassId: "class1",
          classSkillsRaw: "Athletics (Str), Endurance (Con)",
          armorProficiencies: "Cloth, leather, hide",
          hybridTalentClassFeatures: [{ id: "tal_a", name: "Fighter Talent A" }],
          raw: {}
        },
        {
          id: "hy_h2",
          name: "Hybrid Cleric Half",
          slug: "hybrid-c1",
          baseClassId: "class2",
          classSkillsRaw: "Heal (Wis), Stealth (Dex)",
          armorProficiencies: "Cloth",
          hybridTalentClassFeatures: [{ id: "tal_b", name: "Cleric Talent B" }],
          raw: {}
        }
      ]
    };

    const hybridBody = {
      name: "Hybrid Hero",
      level: 1,
      raceId: "race1",
      characterStyle: "hybrid" as const,
      hybridClassIdA: "hy_h1",
      hybridClassIdB: "hy_h2",
      classId: undefined,
      abilityScores: { STR: 16, CON: 14, DEX: 12, INT: 10, WIS: 11, CHA: 8 },
      trainedSkillIds: ["s1", "s2", "s3", "s4"],
      armorId: "a1",
      featIds: ["feat1"],
      powerIds: ["p1", "pw2_aw", "p3", "p4"],
      classPowerSlots: {
        "hybrid:awA:0": "p1",
        "hybrid:awB:0": "pw2_aw",
        "hybrid:encounter:1": "p3",
        "hybrid:daily:1": "p4"
      }
    };

    const missingTalents = validateCharacterBuild(indexWithTalent, hybridBody);
    expect(missingTalents.errors.filter((e) => e.includes("hybrid talent"))).toHaveLength(2);

    const withTalents = validateCharacterBuild(indexWithTalent, {
      ...hybridBody,
      hybridTalentClassFeatureIdA: "tal_a",
      hybridTalentClassFeatureIdB: "tal_b"
    });
    expect(withTalents.errors.filter((e) => e.includes("hybrid talent"))).toEqual([]);
  });

  it("requires hybrid rule selections (defense, mantle, …) when the index lists groups", () => {
    const indexWithGroups: RulesIndex = {
      ...index,
      classes: [
        ...index.classes,
        {
          id: "class2",
          name: "Cleric",
          slug: "cleric",
          raw: {
            specific: {
              "Class Skills": "Heal (Wis)",
              "Trained Skills": "Pick 3",
              "Armor Proficiencies": "Cloth"
            }
          }
        }
      ],
      skills: [...index.skills, { id: "s4", name: "Stealth", slug: "stealth", raw: {} }],
      powers: [
        ...index.powers,
        {
          id: "pw2_aw",
          name: "Holy Smite",
          slug: "holy-smite",
          classId: "class2",
          level: 1,
          usage: "At-Will",
          raw: { specific: { "Power Type": "Attack" } }
        }
      ],
      hybridClasses: [
        {
          id: "hy_h1",
          name: "Hybrid Fighter Half",
          slug: "hybrid-f1",
          baseClassId: "class1",
          classSkillsRaw: "Athletics (Str), Endurance (Con)",
          armorProficiencies: "Cloth, leather, hide",
          hybridSelectionGroups: [
            {
              key: "defense",
              label: "Defense bonus",
              options: [{ id: "def_fort", name: "Hybrid X Fortitude" }]
            }
          ],
          raw: {}
        },
        {
          id: "hy_h2",
          name: "Hybrid Cleric Half",
          slug: "hybrid-c1",
          baseClassId: "class2",
          classSkillsRaw: "Heal (Wis), Stealth (Dex)",
          armorProficiencies: "Cloth",
          hybridSelectionGroups: [
            {
              key: "cf:parent1",
              label: "Test Mantle (Hybrid)",
              options: [{ id: "mantle_a", name: "Mantle A (Hybrid)" }]
            }
          ],
          raw: {}
        }
      ]
    };

    const hybridBody = {
      name: "Hybrid Hero",
      level: 1,
      raceId: "race1",
      characterStyle: "hybrid" as const,
      hybridClassIdA: "hy_h1",
      hybridClassIdB: "hy_h2",
      classId: undefined,
      abilityScores: { STR: 16, CON: 14, DEX: 12, INT: 10, WIS: 11, CHA: 8 },
      trainedSkillIds: ["s1", "s2", "s3", "s4"],
      armorId: "a1",
      featIds: ["feat1"],
      powerIds: ["p1", "pw2_aw", "p3", "p4"],
      classPowerSlots: {
        "hybrid:awA:0": "p1",
        "hybrid:awB:0": "pw2_aw",
        "hybrid:encounter:1": "p3",
        "hybrid:daily:1": "p4"
      }
    };

    const missing = validateCharacterBuild(indexWithGroups, hybridBody);
    expect(missing.errors.filter((e) => e.includes("first hybrid class"))).toHaveLength(1);
    expect(missing.errors.filter((e) => e.includes("second hybrid class"))).toHaveLength(1);

    const ok = validateCharacterBuild(indexWithGroups, {
      ...hybridBody,
      hybridSideASelections: { defense: "def_fort" },
      hybridSideBSelections: { "cf:parent1": "mantle_a" }
    });
    expect(ok.errors.filter((e) => e.includes("first hybrid class"))).toEqual([]);
    expect(ok.errors.filter((e) => e.includes("second hybrid class"))).toEqual([]);
  });

  it("requires power construction selections when a power lists powerSelectionGroups", () => {
    const idx: RulesIndex = {
      ...index,
      powers: [
        ...index.powers,
        {
          id: "p5",
          name: "Test Construction Power",
          slug: "test-construction",
          classId: "class1",
          level: 1,
          usage: "At-Will",
          powerSelectionGroups: [
            {
              key: "test-group",
              label: "Pick one",
              options: [{ id: "opt_a", name: "Option A" }]
            }
          ],
          raw: { specific: { "Power Type": "Attack" } }
        }
      ]
    };
    const base = {
      ...legalLevel1Base,
      powerIds: ["p5", "p2", "p3", "p4"],
      classPowerSlots: {
        "atWill:0": "p5",
        "atWill:1": "p2",
        "encounter:1": "p3",
        "daily:1": "p4"
      }
    };
    const missing = validateCharacterBuild(idx, base);
    expect(missing.errors.some((e) => e.includes("Test Construction Power") && e.includes("Pick one"))).toBe(true);

    const ok = validateCharacterBuild(idx, {
      ...base,
      powerSelections: { p5: { "test-group": "opt_a" } }
    });
    expect(ok.errors.filter((e) => e.includes("Test Construction Power"))).toEqual([]);
  });

  it("requires two hybrid classes when characterStyle is hybrid", () => {
    const indexHybrid: RulesIndex = {
      ...index,
      hybridClasses: [
        {
          id: "hy_h1",
          name: "H1",
          slug: "h1",
          baseClassId: "class1",
          raw: {}
        }
      ]
    };
    const result = validateCharacterBuild(indexHybrid, {
      ...legalLevel1Base,
      characterStyle: "hybrid",
      classId: undefined,
      hybridClassIdA: "hy_h1",
      hybridClassIdB: undefined,
      classPowerSlots: undefined,
      powerIds: []
    });
    expect(result.errors.some((e) => e.includes("two hybrid"))).toBe(true);
  });
});
