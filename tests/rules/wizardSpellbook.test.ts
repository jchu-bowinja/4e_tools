import { describe, expect, it } from "vitest";
import { getClassFeatureChoiceGroups } from "../../src/rules/classFeatureChoices";
import {
  applyWizardFreeRitualBookMinimumsToBuild,
  applyWizardSpellbookPowerGroupRules,
  characterHasWizardSpellbook,
  isWizardSpellbookPowerGroup,
  clampRitualBookEntriesToWizardFreeMinimums,
  mergeWizardFreeRitualsIntoBuild,
  minRitualBookQuantityForWizardFreeRituals,
  validateWizardSpellbookRituals,
  wizardSpellbookRitualIdsUsedOutsideSlot,
  spellbookPoolIndexForClassSlotDef,
  visibleWizardSpellbookRitualMilestones,
  WIZARD_SPELLBOOK_CLASS_FEATURE_ID,
  WIZARD_SPELLBOOK_POWER_PICKS_PER_POOL,
  wizardSpellbookPowerSelectionKey,
  wizardSpellbookRitualSelectionKey
} from "../../src/rules/wizardSpellbook";
import type { ClassDef, RulesIndex } from "../../src/rules/models";
import type { ClassPowerSlotDef } from "../../src/rules/classPowerSlots";

const wizard: ClassDef = {
  id: "ID_FMP_CLASS_9",
  name: "Wizard",
  slug: "wizard",
  raw: {}
};

describe("wizardSpellbook", () => {
  it("exposes ritual milestones by character level", () => {
    expect(visibleWizardSpellbookRitualMilestones(1).map((m) => m.level)).toEqual([1]);
    expect(visibleWizardSpellbookRitualMilestones(5).map((m) => m.level)).toEqual([1, 5]);
    expect(visibleWizardSpellbookRitualMilestones(30).map((m) => m.level)).toEqual([1, 5, 11, 15, 21, 25]);
  });

  it("sets spellbook power pools to two picks with level gates", () => {
    const groups = applyWizardSpellbookPowerGroupRules(
      { classFeatures: [], classes: [wizard] } as unknown as RulesIndex,
      [
        {
          key: `classPower:${WIZARD_SPELLBOOK_CLASS_FEATURE_ID}:0`,
          kind: "power",
          parentFeatureId: WIZARD_SPELLBOOK_CLASS_FEATURE_ID,
          parentFeatureName: "Spellbook",
          pickCount: 1,
          powerIds: ["ID_FMP_POWER_1"],
          powerPoolIndex: 0,
          options: []
        },
        {
          key: `classPower:${WIZARD_SPELLBOOK_CLASS_FEATURE_ID}:7`,
          kind: "power",
          parentFeatureId: WIZARD_SPELLBOOK_CLASS_FEATURE_ID,
          parentFeatureName: "Spellbook",
          pickCount: 1,
          powerIds: ["ID_FMP_POWER_2"],
          powerPoolIndex: 7,
          options: []
        }
      ]
    );
    expect(groups[0]?.pickCount).toBe(WIZARD_SPELLBOOK_POWER_PICKS_PER_POOL);
    expect(groups[0]?.minLevel).toBe(1);
    expect(groups[1]?.pickCount).toBe(2);
    expect(groups[1]?.minLevel).toBe(2);
    expect(isWizardSpellbookPowerGroup(groups[0]!)).toBe(true);
  });

  it("re-applies ritual book minimums on unified inventory edits", () => {
    const index = {
      classes: [wizard],
      classFeatures: [
        { id: WIZARD_SPELLBOOK_CLASS_FEATURE_ID, name: "Spellbook", slug: "spellbook", raw: {} }
      ],
      grantedClassFeatureNamesBySupportId: { [wizard.id]: ["Spellbook"] }
    } as unknown as RulesIndex;
    const build = {
      name: "Test",
      level: 1,
      raceId: "race",
      classId: wizard.id,
      abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 10 },
      trainedSkillIds: [],
      featIds: [],
      powerIds: [],
      classSelections: { [wizardSpellbookRitualSelectionKey(1)]: "ID_RITUAL_A" },
      rituals: [{ id: "ID_RITUAL_A", quantity: 0 }]
    };
    const fixed = applyWizardFreeRitualBookMinimumsToBuild(index, build);
    expect(fixed.rituals).toEqual([{ id: "ID_RITUAL_A", quantity: 1 }]);
  });

  it("requires at least one book copy per spellbook free ritual pick", () => {
    const index = {
      classes: [wizard],
      classFeatures: [
        { id: WIZARD_SPELLBOOK_CLASS_FEATURE_ID, name: "Spellbook", slug: "spellbook", raw: {} }
      ],
      grantedClassFeatureNamesBySupportId: { [wizard.id]: ["Spellbook"] }
    } as unknown as RulesIndex;
    const build = {
      name: "Test",
      level: 1,
      raceId: "race",
      classId: wizard.id,
      abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 10 },
      trainedSkillIds: [],
      featIds: [],
      powerIds: [],
      classSelections: { [wizardSpellbookRitualSelectionKey(1)]: "ID_RITUAL_A" },
      rituals: [{ id: "ID_RITUAL_A", quantity: 2 }]
    };
    const min = minRitualBookQuantityForWizardFreeRituals(index, build);
    expect(min).toEqual({ ID_RITUAL_A: 1 });
    const clamped = clampRitualBookEntriesToWizardFreeMinimums(
      [{ id: "ID_RITUAL_A", quantity: 0 }],
      min
    );
    expect(clamped).toEqual([{ id: "ID_RITUAL_A", quantity: 1 }]);
  });

  it("merges free ritual picks into the ritual book", () => {
    const build = mergeWizardFreeRitualsIntoBuild({
      name: "Test",
      level: 1,
      raceId: "race",
      classId: wizard.id,
      abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 10 },
      trainedSkillIds: [],
      featIds: [],
      powerIds: [],
      classSelections: {
        [wizardSpellbookRitualSelectionKey(1)]: "ID_RITUAL_A,ID_RITUAL_B,ID_RITUAL_C"
      }
    });
    expect(build.rituals?.map((e) => e.id).sort()).toEqual([
      "ID_RITUAL_A",
      "ID_RITUAL_B",
      "ID_RITUAL_C"
    ]);
  });

  it("maps class daily and utility slots to spellbook pool indices", () => {
    const index = { classFeatures: [] } as unknown as RulesIndex;
    const daily1: ClassPowerSlotDef = {
      key: "daily:1",
      bucket: "daily",
      gainLevel: 1,
      label: "1st-level daily attack"
    };
    const util2: ClassPowerSlotDef = {
      key: "utility:2",
      bucket: "utility",
      gainLevel: 2,
      label: "2nd-level utility"
    };
    expect(spellbookPoolIndexForClassSlotDef(daily1, index)).toBe(0);
    expect(spellbookPoolIndexForClassSlotDef(util2, index)).toBe(7);
    expect(wizardSpellbookPowerSelectionKey(0)).toBe(
      "classPower:ID_FMP_CLASS_FEATURE_318:0"
    );
  });

  it("tracks rituals used in other spellbook slots", () => {
    const used = wizardSpellbookRitualIdsUsedOutsideSlot(
      {
        [wizardSpellbookRitualSelectionKey(1)]: "ID_RITUAL_A,ID_RITUAL_B",
        [wizardSpellbookRitualSelectionKey(5)]: "ID_RITUAL_C"
      },
      5,
      1,
      0
    );
    expect(used.has("ID_RITUAL_B")).toBe(true);
    expect(used.has("ID_RITUAL_A")).toBe(false);
    expect(used.has("ID_RITUAL_C")).toBe(true);
  });

  it("validates ritual milestone picks", () => {
    const index = {
      classes: [wizard],
      classFeatures: [
        {
          id: WIZARD_SPELLBOOK_CLASS_FEATURE_ID,
          name: "Spellbook",
          slug: "spellbook",
          raw: {
            rules: {
              select: [{ attrs: { type: "Power", Category: "$$CLASS,daily,1", Level: "1", spellbook: "Power Daily 1" } }]
            }
          }
        }
      ],
      rituals: [
        { id: "ID_RITUAL_A", name: "A", slug: "a", level: 1, raw: {} },
        { id: "ID_RITUAL_HIGH", name: "High", slug: "high", level: 5, raw: {} }
      ],
      grantedClassFeatureNamesBySupportId: {
        [wizard.id]: ["Spellbook"]
      }
    } as unknown as RulesIndex;
    const build = {
      name: "Test",
      level: 5,
      raceId: "race",
      classId: wizard.id,
      abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 10 },
      trainedSkillIds: [],
      featIds: [],
      powerIds: [],
      classSelections: {
        [wizardSpellbookRitualSelectionKey(1)]: "ID_RITUAL_A",
        [wizardSpellbookRitualSelectionKey(5)]: "ID_RITUAL_HIGH"
      }
    };
    expect(characterHasWizardSpellbook(index, build)).toBe(true);
    const errors = validateWizardSpellbookRituals(index, build, new Set(["ID_RITUAL_A", "ID_RITUAL_HIGH"]));
    expect(errors.some((e) => e.includes("level 1"))).toBe(true);
    expect(errors.some((e) => e.includes("level 5"))).toBe(true);
  });

  it("rejects duplicate rituals across milestones", () => {
    const index = {
      classes: [wizard],
      classFeatures: [{ id: WIZARD_SPELLBOOK_CLASS_FEATURE_ID, name: "Spellbook", slug: "spellbook", raw: {} }],
      rituals: [
        { id: "ID_RITUAL_A", name: "A", slug: "a", level: 1, raw: {} },
        { id: "ID_RITUAL_B", name: "B", slug: "b", level: 1, raw: {} }
      ],
      grantedClassFeatureNamesBySupportId: { [wizard.id]: ["Spellbook"] }
    } as unknown as RulesIndex;
    const build = {
      name: "Test",
      level: 5,
      raceId: "race",
      classId: wizard.id,
      abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 10 },
      trainedSkillIds: [],
      featIds: [],
      powerIds: [],
      classSelections: {
        [wizardSpellbookRitualSelectionKey(1)]: "ID_RITUAL_A,ID_RITUAL_B,ID_RITUAL_A",
        [wizardSpellbookRitualSelectionKey(5)]: "ID_RITUAL_A,ID_RITUAL_B"
      }
    };
    const errors = validateWizardSpellbookRituals(index, build, new Set(["ID_RITUAL_A", "ID_RITUAL_B"]));
    expect(errors.some((e) => e.includes("more than once"))).toBe(true);
  });

  it("applies spellbook rules to wizard groups from rules index", () => {
    const index = require("../../generated/rules_index.json") as RulesIndex;
    const groups = getClassFeatureChoiceGroups(index, wizard);
    const spellbook = groups.filter((g) => isWizardSpellbookPowerGroup(g));
    expect(spellbook.length).toBeGreaterThan(0);
    expect(spellbook.every((g) => g.pickCount === 2)).toBe(true);
    const daily1 = spellbook.find((g) => g.powerPoolIndex === 0);
    expect(daily1?.minLevel).toBe(1);
    const util2 = spellbook.find((g) => g.powerPoolIndex === 7);
    expect(util2?.minLevel).toBe(2);
  });
});
