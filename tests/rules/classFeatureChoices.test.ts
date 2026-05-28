import { describe, expect, it } from "vitest";
import type { ClassDef, RulesIndex } from "../../src/rules/models";
import {
  classFeaturePowerIdsForClass,
  classFeatureSelectablePowerIds,
  classFeaturePowerSelectPoolsForClass,
  collectClassFeaturePowerChoiceIds,
  effectiveClassSelectionsForChoiceGroups,
  filterClassFeatureChoiceGroupsRequiringSelection,
  filterVisibleClassFeatureChoiceGroups,
  formatClassPowerChoiceSelection,
  getClassFeatureChoiceGroups,
  isClassFeatureChoiceGroupVisible,
  isFixedClassPowerChoiceGroup,
  migrateLegacyClassPowerSelections,
  parseClassPowerChoiceSelection,
  pruneHiddenClassFeatureSelections
} from "../../src/rules/classFeatureChoices";

const rogueClass: ClassDef = {
  id: "ID_FMP_CLASS_6",
  name: "Rogue",
  slug: "rogue",
  raw: {}
};

const index: RulesIndex = {
  races: [],
  classes: [rogueClass],
  feats: [],
  powers: [],
  skills: [],
  languages: [],
  armors: [],
  abilityScores: [],
  racialTraits: [],
  classFeatures: [],
  paragonPaths: [],
  classFeatureChoiceGroupsByClassId: {
    ID_FMP_CLASS_6: [
      {
        key: "classFeature:parent",
        kind: "classFeature",
        parentFeatureId: "parent",
        parentFeatureName: "Rogue Tactics",
        pickCount: 1,
        options: [
          {
            id: "opt_a",
            name: "Artful Dodger",
            parentFeatureId: "parent",
            parentFeatureName: "Rogue Tactics"
          }
        ]
      },
      {
        key: "classPower:cantrips",
        kind: "power",
        parentFeatureId: "cantrips",
        parentFeatureName: "Arcanist Cantrips",
        pickCount: 2,
        powerIds: ["P1", "P2", "P3"]
      }
    ]
  }
};

describe("classFeatureChoices", () => {
  it("loads choice groups from index", () => {
    const groups = getClassFeatureChoiceGroups(index, rogueClass);
    expect(groups).toHaveLength(2);
    expect(groups[0]?.parentFeatureName).toBe("Rogue Tactics");
  });

  it("round-trips cantrip power selections", () => {
    const raw = formatClassPowerChoiceSelection(["P1", "P2"]);
    expect(parseClassPowerChoiceSelection(raw)).toEqual(["P1", "P2"]);
  });

  it("hides and prunes dependent groups when parent pick changes", () => {
    const pairKey = "classFeaturePair:weapon:sharp";
    const sharpKey = "classFeature:sharp";
    const groups = getClassFeatureChoiceGroups({
      ...index,
      classFeatureChoiceGroupsByClassId: {
        ID_FMP_CLASS_6: [
          {
            key: pairKey,
            kind: "classFeature",
            parentFeatureId: "",
            parentFeatureName: "Class feature",
            pickCount: 1,
            options: [
              { id: "weapon", name: "Rogue Weapon Talent", parentFeatureId: "", parentFeatureName: "Class feature" },
              { id: "sharp", name: "Sharpshooter Talent", parentFeatureId: "", parentFeatureName: "Class feature" }
            ]
          },
          {
            key: sharpKey,
            kind: "classFeature",
            parentFeatureId: "sharp",
            parentFeatureName: "Sharpshooter Talent",
            pickCount: 1,
            visibleWhen: { groupKey: pairKey, optionId: "sharp" },
            options: [
              { id: "crossbow", name: "Crossbow", parentFeatureId: "sharp", parentFeatureName: "Sharpshooter Talent" }
            ]
          }
        ]
      }
    }, rogueClass);
    const sharpGroup = groups.find((g) => g.key === sharpKey)!;
    expect(isClassFeatureChoiceGroupVisible(sharpGroup, { [pairKey]: "weapon" })).toBe(false);
    expect(isClassFeatureChoiceGroupVisible(sharpGroup, { [pairKey]: "sharp" })).toBe(true);
    expect(
      filterVisibleClassFeatureChoiceGroups(groups, { [pairKey]: "weapon" }).map((g) => g.key)
    ).toEqual([pairKey]);
    const pruned = pruneHiddenClassFeatureSelections(
      { [pairKey]: "weapon", [sharpKey]: "crossbow" },
      groups
    );
    expect(pruned).toEqual({ [pairKey]: "weapon" });
  });

  it("filters class power choices to the selected class owner", () => {
    const cleric: ClassDef = { id: "ID_FMP_CLASS_CLERIC", name: "Cleric", slug: "cleric", raw: {} };
    const groups = getClassFeatureChoiceGroups(index, rogueClass);
    const powerGroup = groups.find((g) => g.key === "classPower:cantrips");
    expect(powerGroup).toBeTruthy();
    const idx: RulesIndex = {
      ...index,
      classes: [rogueClass, cleric],
      powers: [
        { id: "P1", name: "Rogue Power", slug: "rogue-power", classId: rogueClass.id, raw: {} },
        { id: "P2", name: "Cleric Power", slug: "cleric-power", classId: cleric.id, raw: {} },
        { id: "P3", name: "Generic Power", slug: "generic-power", classId: null, raw: {} }
      ]
    };
    const filtered = classFeaturePowerIdsForClass(idx, powerGroup!, rogueClass.id);
    expect(filtered).toEqual(["P1", "P3"]);
  });

  it("excludes paragon-path class feature powers from class power picks", () => {
    const cleric: ClassDef = { id: "ID_FMP_CLASS_CLERIC", name: "Cleric", slug: "cleric", raw: {} };
    const idx: RulesIndex = {
      ...index,
      classes: [cleric],
      paragonPaths: [
        {
          id: "ID_FMP_PARAGON_PATH_229",
          name: "Scourge of Io",
          slug: "scourge-of-io",
          raw: { specific: { "Class Features": "ID_FMP_CLASS_FEATURE_1104" } }
        }
      ],
      classFeatures: [
        {
          id: "ID_FMP_CLASS_FEATURE_1104",
          name: "Draconic Anathema",
          slug: "draconic-anathema",
          raw: { specific: { Level: "11", Powers: "ID_FMP_POWER_5981" } }
        }
      ],
      powers: [
        { id: "ID_FMP_POWER_5981", name: "Draconic Anathema", slug: "da", classId: cleric.id, raw: {} },
        { id: "ID_FMP_POWER_146", name: "Turn Undead", slug: "tu", classId: cleric.id, raw: {} }
      ],
      classFeatureChoiceGroupsByClassId: {
        ID_FMP_CLASS_CLERIC: [
          {
            key: "classPower:channel",
            kind: "power",
            parentFeatureId: "channel",
            parentFeatureName: "Channel Divinity",
            pickCount: 2,
            powerIds: ["ID_FMP_POWER_5981", "ID_FMP_POWER_146"]
          }
        ]
      }
    };
    const groups = getClassFeatureChoiceGroups(idx, cleric);
    const cd = groups[0]!;
    expect(classFeaturePowerIdsForClass(idx, cd, cleric.id)).toEqual(["ID_FMP_POWER_146"]);
  });

  it("splits cleric Channel Divinity into two compendium select pools", () => {
    const cleric: ClassDef = { id: "ID_FMP_CLASS_2", name: "Cleric", slug: "cleric", raw: {} };
    const channelFeature = {
      id: "ID_FMP_CLASS_FEATURE_324",
      name: "Channel Divinity",
      slug: "channel-divinity",
      raw: {
        rules: {
          select: [
            {
              attrs: {
                type: "Power",
                number: "1",
                Category: "ID_FMP_POWER_1589|ID_FMP_POWER_14292",
                requires: "ID_FMP_CLASS_2"
              }
            },
            {
              attrs: {
                type: "Power",
                number: "1",
                Category: "ID_FMP_POWER_146|ID_FMP_POWER_14293|ID_FMP_POWER_7885",
                requires: "ID_FMP_CLASS_2"
              }
            }
          ]
        }
      }
    };
    const idx: RulesIndex = {
      ...index,
      classes: [cleric],
      paragonPaths: [],
      classFeatures: [channelFeature],
      powers: [
        { id: "ID_FMP_POWER_1589", name: "Divine Fortune", slug: "df", classId: cleric.id, raw: {} },
        { id: "ID_FMP_POWER_14292", name: "Favor of the Gods", slug: "fotg", classId: cleric.id, raw: {} },
        { id: "ID_FMP_POWER_146", name: "Turn Undead", slug: "tu", classId: cleric.id, raw: {} },
        { id: "ID_FMP_POWER_14293", name: "Punish the Profane", slug: "ptp", classId: cleric.id, raw: {} },
        { id: "ID_FMP_POWER_7885", name: "Healer's Mercy", slug: "hm", classId: cleric.id, raw: {} }
      ],
      classFeatureChoiceGroupsByClassId: {
        ID_FMP_CLASS_2: [
          {
            key: "classPower:ID_FMP_CLASS_FEATURE_324",
            kind: "power",
            parentFeatureId: "ID_FMP_CLASS_FEATURE_324",
            parentFeatureName: "Channel Divinity",
            pickCount: 2,
            powerIds: [
              "ID_FMP_POWER_1589",
              "ID_FMP_POWER_14292",
              "ID_FMP_POWER_146",
              "ID_FMP_POWER_14293",
              "ID_FMP_POWER_7885"
            ]
          }
        ]
      }
    };
    const pools = classFeaturePowerSelectPoolsForClass(
      idx,
      "ID_FMP_CLASS_FEATURE_324",
      cleric.id
    );
    expect(pools).toHaveLength(2);
    expect(pools[0]).toEqual(["ID_FMP_POWER_1589", "ID_FMP_POWER_14292"]);
    expect(pools[1]).toEqual(["ID_FMP_POWER_146", "ID_FMP_POWER_14293", "ID_FMP_POWER_7885"]);

    const groups = getClassFeatureChoiceGroups(idx, cleric);
    expect(groups).toHaveLength(2);
    expect(groups[0]?.key).toBe("classPower:ID_FMP_CLASS_FEATURE_324:0");
    expect(groups[1]?.key).toBe("classPower:ID_FMP_CLASS_FEATURE_324:1");
    expect(classFeaturePowerIdsForClass(idx, groups[0]!, cleric.id)).toEqual([
      "ID_FMP_POWER_1589",
      "ID_FMP_POWER_14292"
    ]);
    expect(classFeaturePowerIdsForClass(idx, groups[1]!, cleric.id)).toEqual([
      "ID_FMP_POWER_146",
      "ID_FMP_POWER_14293",
      "ID_FMP_POWER_7885"
    ]);

    const migrated = migrateLegacyClassPowerSelections(
      idx,
      cleric.id,
      {
        "classPower:ID_FMP_CLASS_FEATURE_324": "ID_FMP_POWER_1589,ID_FMP_POWER_146"
      },
      groups
    );
    expect(migrated).toEqual({
      "classPower:ID_FMP_CLASS_FEATURE_324:0": "ID_FMP_POWER_1589",
      "classPower:ID_FMP_CLASS_FEATURE_324:1": "ID_FMP_POWER_146"
    });
    expect(
      effectiveClassSelectionsForChoiceGroups(
        idx,
        cleric.id,
        { "classPower:ID_FMP_CLASS_FEATURE_324": "ID_FMP_POWER_14292,ID_FMP_POWER_7885" },
        groups
      )
    ).toEqual({
      "classPower:ID_FMP_CLASS_FEATURE_324:0": "ID_FMP_POWER_14292",
      "classPower:ID_FMP_CLASS_FEATURE_324:1": "ID_FMP_POWER_7885"
    });
  });

  it("excludes feat-granted Divine Fate from Channel Divinity picks", () => {
    const paladin: ClassDef = { id: "ID_FMP_CLASS_4", name: "Paladin", slug: "paladin", raw: {} };
    const idx: RulesIndex = {
      ...index,
      classes: [paladin],
      paragonPaths: [],
      feats: [
        {
          id: "ID_FMP_FEAT_1644",
          name: "Divine Fate",
          slug: "divine-fate",
          grantedPowerIds: ["ID_FMP_POWER_8273"],
          raw: {
            rules: {
              grant: [{ attrs: { name: "ID_FMP_POWER_8273", type: "Power" } }]
            }
          }
        },
        {
          id: "ID_FMP_FEAT_1624",
          name: "Channel of Valor",
          slug: "channel-of-valor",
          grantedPowerIds: ["ID_FMP_POWER_1746", "ID_FMP_POWER_1747"],
          raw: {
            rules: {
              grant: [
                { attrs: { name: "ID_FMP_POWER_1746", type: "Power" } },
                { attrs: { name: "ID_FMP_POWER_1747", type: "Power" } },
                {
                  attrs: {
                    name: "ID_INTERNAL_COUNTSASFEATURE_CHANNEL_DIVINITY",
                    type: "CountsAsFeature"
                  }
                }
              ]
            }
          }
        }
      ],
      powers: [
        { id: "ID_FMP_POWER_8273", name: "Divine Fate", slug: "divine-fate", classId: null, raw: {} },
        { id: "ID_FMP_POWER_1746", name: "Divine Mettle", slug: "dm", classId: paladin.id, raw: {} },
        { id: "ID_FMP_POWER_1747", name: "Divine Strength", slug: "ds", classId: paladin.id, raw: {} }
      ],
      classFeatureChoiceGroupsByClassId: {
        ID_FMP_CLASS_4: [
          {
            key: "classPower:ID_FMP_CLASS_FEATURE_324",
            kind: "power",
            parentFeatureId: "ID_FMP_CLASS_FEATURE_324",
            parentFeatureName: "Channel Divinity",
            pickCount: 2,
            powerIds: ["ID_FMP_POWER_8273", "ID_FMP_POWER_1746", "ID_FMP_POWER_1747"]
          }
        ]
      }
    };
    const groups = getClassFeatureChoiceGroups(idx, paladin);
    const cd = groups[0]!;
    expect(classFeaturePowerIdsForClass(idx, cd, paladin.id)).toEqual([
      "ID_FMP_POWER_1746",
      "ID_FMP_POWER_1747"
    ]);
  });

  it("auto-grants fixed Channel Divinity sets without player selection", () => {
    const paladin: ClassDef = { id: "ID_FMP_CLASS_4", name: "Paladin", slug: "paladin", raw: {} };
    const idx: RulesIndex = {
      ...index,
      classes: [paladin],
      paragonPaths: [],
      feats: [],
      powers: [
        { id: "ID_FMP_POWER_1746", name: "Divine Mettle", slug: "dm", classId: paladin.id, raw: {} },
        { id: "ID_FMP_POWER_1747", name: "Divine Strength", slug: "ds", classId: paladin.id, raw: {} }
      ],
      classFeatureChoiceGroupsByClassId: {
        ID_FMP_CLASS_4: [
          {
            key: "classPower:ID_FMP_CLASS_FEATURE_324",
            kind: "power",
            parentFeatureId: "ID_FMP_CLASS_FEATURE_324",
            parentFeatureName: "Channel Divinity",
            pickCount: 2,
            powerIds: ["ID_FMP_POWER_1746", "ID_FMP_POWER_1747"]
          }
        ]
      }
    };
    const groups = getClassFeatureChoiceGroups(idx, paladin);
    const cd = groups[0]!;
    expect(isFixedClassPowerChoiceGroup(idx, cd, paladin.id)).toBe(true);
    expect(
      filterClassFeatureChoiceGroupsRequiringSelection(groups, idx, paladin.id)
    ).toHaveLength(0);
    expect(
      collectClassFeaturePowerChoiceIds(idx, {
        classId: paladin.id,
        characterStyle: "single",
        classSelections: undefined
      })
    ).toEqual(["ID_FMP_POWER_1746", "ID_FMP_POWER_1747"]);
  });

  it("includes Lay on Hands in its own pick list even when also on a paragon path feature", () => {
    const paladin: ClassDef = { id: "ID_FMP_CLASS_4", name: "Paladin", slug: "paladin", raw: {} };
    const idx: RulesIndex = {
      ...index,
      classes: [paladin],
      paragonPaths: [
        {
          id: "ID_FMP_PARAGON_PATH_HOSP",
          name: "Hospitaler",
          slug: "hospitaler",
          raw: { specific: { "Class Features": "ID_FMP_CLASS_FEATURE_468" } }
        }
      ],
      classFeatures: [
        {
          id: "ID_FMP_CLASS_FEATURE_434",
          name: "Lay on Hands",
          slug: "lay-on-hands",
          raw: {
            specific: { Powers: "ID_FMP_POWER_1566" },
            rules: {
              select: [
                {
                  attrs: {
                    type: "Power",
                    number: "1",
                    Category: "ID_FMP_POWER_1566|ID_FMP_POWER_8097|ID_FMP_POWER_7240"
                  }
                }
              ]
            }
          }
        },
        {
          id: "ID_FMP_CLASS_FEATURE_468",
          name: "Hospitalers' Care",
          slug: "hospitalers-care",
          raw: { specific: { Powers: "ID_FMP_POWER_1566" } }
        }
      ],
      powers: [
        { id: "ID_FMP_POWER_1566", name: "Lay on Hands", slug: "loh", classId: paladin.id, raw: {} },
        { id: "ID_FMP_POWER_8097", name: "Ardent Vow", slug: "av", classId: paladin.id, raw: {} },
        { id: "ID_FMP_POWER_7240", name: "Virtue's Touch", slug: "vt", classId: paladin.id, raw: {} }
      ],
      classFeatureChoiceGroupsByClassId: {
        ID_FMP_CLASS_4: [
          {
            key: "classPower:ID_FMP_CLASS_FEATURE_434",
            kind: "power",
            parentFeatureId: "ID_FMP_CLASS_FEATURE_434",
            parentFeatureName: "Lay on Hands",
            pickCount: 1,
            powerIds: ["ID_FMP_POWER_8097", "ID_FMP_POWER_7240"]
          }
        ]
      }
    };
    const groups = getClassFeatureChoiceGroups(idx, paladin);
    const loh = groups.find((g) => g.parentFeatureId === "ID_FMP_CLASS_FEATURE_434")!;
    expect(classFeaturePowerIdsForClass(idx, loh, paladin.id).sort()).toEqual(
      ["ID_FMP_POWER_1566", "ID_FMP_POWER_7240", "ID_FMP_POWER_8097"].sort()
    );
  });

  it("includes full wizard cantrip list and keeps feat-granted cantrips selectable", () => {
    const wizard: ClassDef = { id: "ID_FMP_CLASS_9", name: "Wizard", slug: "wizard", raw: {} };
    const cantripNames = [
      "Chameleon's Mask",
      "Disrupt Undead",
      "Ghost Sound",
      "Light",
      "Mage Hand",
      "Prestidigitation",
      "Spook",
      "Suggestion",
      "Water Stride",
      "Whispering Wind"
    ];
    const powers = cantripNames.map((name, i) => ({
      id: `ID_FMP_POWER_W${i}`,
      name,
      slug: name.toLowerCase().replace(/\s+/g, "-"),
      classId: wizard.id,
      raw: {}
    }));
    const idx: RulesIndex = {
      ...index,
      classes: [wizard],
      paragonPaths: [],
      feats: [
        {
          id: "ID_FMP_FEAT_FOO",
          name: "Fey Trickster",
          slug: "fey",
          grantedPowerIds: ["ID_FMP_POWER_W5", "ID_FMP_POWER_W2"],
          raw: { rules: { grant: [{ attrs: { name: "ID_FMP_POWER_W5", type: "Power" } }] } }
        }
      ],
      classFeatures: [
        {
          id: "ID_FMP_CLASS_FEATURE_130",
          name: "Arcanist Cantrips",
          slug: "arcanist-cantrips",
          raw: {
            rules: {
              select: [{ attrs: { type: "Power", number: "4", Category: "ID_FMP_CLASS_FEATURE_2870" } }]
            }
          }
        },
        {
          id: "ID_FMP_CLASS_FEATURE_2870",
          name: "Mage Cantrips",
          slug: "mage-cantrips",
          raw: {
            specific: { Powers: "ID_FMP_POWER_W0,ID_FMP_POWER_W3" },
            rules: {
              select: [
                { attrs: { type: "Power", number: "3", Category: "ID_FMP_CLASS_FEATURE_2870" } }
              ]
            }
          }
        }
      ],
      powers,
      classFeatureChoiceGroupsByClassId: {
        ID_FMP_CLASS_9: [
          {
            key: "classPower:ID_FMP_CLASS_FEATURE_130",
            kind: "power",
            parentFeatureId: "ID_FMP_CLASS_FEATURE_130",
            parentFeatureName: "Arcanist Cantrips",
            pickCount: 4,
            powerIds: ["ID_FMP_POWER_W0", "ID_FMP_POWER_W3"]
          }
        ]
      }
    };
    expect(() => classFeatureSelectablePowerIds(idx, "ID_FMP_CLASS_FEATURE_2870")).not.toThrow();
    const selectable = classFeatureSelectablePowerIds(idx, "ID_FMP_CLASS_FEATURE_130");
    expect(selectable.size).toBe(10);
    const groups = getClassFeatureChoiceGroups(idx, wizard);
    const cantrips = groups.find((g) => g.parentFeatureId === "ID_FMP_CLASS_FEATURE_130")!;
    expect(cantrips.pickCount).toBe(4);
    const legal = classFeaturePowerIdsForClass(idx, cantrips, wizard.id);
    expect(legal).toHaveLength(10);
    expect(legal).toContain("ID_FMP_POWER_W2");
    expect(legal).toContain("ID_FMP_POWER_W5");
  });
});
