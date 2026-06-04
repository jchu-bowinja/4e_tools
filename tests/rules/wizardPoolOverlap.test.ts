import { describe, expect, it } from "vitest";
import index from "../../generated/rules_index.json";
import type { RulesIndex } from "../../src/rules/models";
import { getClassFeatureChoiceGroups, classFeaturePowerIdsForClass } from "../../src/rules/classFeatureChoices";
import {
  findWizardSpellbookPowerGroup,
  spellbookPoolIndexForClassSlotDef
} from "../../src/rules/wizardSpellbook";
import { buildClassPowerSlotDefinitions } from "../../src/rules/classPowerSlots";
import { getClassPowersForLevelRange } from "../../src/rules/characterValidator";
import { powerPrintedLevelEligibleForSlot } from "../../src/rules/classPowerSlots";

const rules = index as RulesIndex;
const wizard = rules.classes.find((c) => c.slug === "wizard")!;

describe("wizard spellbook pool overlap", () => {
  it("daily slot has spellbook powers in class attack pool", () => {
    const groups = getClassFeatureChoiceGroups(rules, wizard);
    const defs = buildClassPowerSlotDefinitions(1, false, 0);
    const dailyDef = defs.find((d) => d.bucket === "daily")!;
    const poolIdx = spellbookPoolIndexForClassSlotDef(dailyDef, rules)!;
    const group = findWizardSpellbookPowerGroup(groups, poolIdx)!;
    const legal = new Set(classFeaturePowerIdsForClass(rules, group, wizard.id));
    const attacks = getClassPowersForLevelRange(rules, wizard.id, 1, "attack");
    const dailyPool = attacks.filter((p) => powerPrintedLevelEligibleForSlot(p, dailyDef));
    const overlap = dailyPool.filter((p) => legal.has(p.id));
    expect(overlap.length).toBeGreaterThan(0);
  });
});
