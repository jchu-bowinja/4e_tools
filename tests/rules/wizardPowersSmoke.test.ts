import { describe, expect, it } from "vitest";
import index from "../../generated/rules_index.json";
import type { RulesIndex } from "../../src/rules/models";
import {
  getClassFeatureChoiceGroups,
  classFeaturePowerIdsForClass,
  filterVisibleClassFeatureChoiceGroups
} from "../../src/rules/classFeatureChoices";
import {
  findWizardSpellbookPowerGroup,
  isWizardSpellbookPowerGroup,
  spellbookPoolIndexForClassSlotDef,
  wizardSpellbookPowerIdsUsedOutsidePoolPick,
  syncWizardSpellbookPowerSelectionsFromClassSlots,
  wizardSpellbookPowerSelectionKey
} from "../../src/rules/wizardSpellbook";
import { buildClassPowerSlotDefinitions } from "../../src/rules/classPowerSlots";
import { validateCharacterBuild } from "../../src/rules/characterValidator";
import { resolveBaseAugmentablePowerId } from "../../src/rules/psionicPowerAugments";

const rules = index as RulesIndex;
const wizard = rules.classes.find((c) => c.slug === "wizard")!;

describe("wizard powers smoke", () => {
  it("commit path: dual spellbook pick + slot sync", () => {
    const groups = getClassFeatureChoiceGroups(rules, wizard);
    const defs = buildClassPowerSlotDefinitions(1, false, 0);
    const dailyDef = defs.find((d) => d.bucket === "daily")!;
    const poolIdx = spellbookPoolIndexForClassSlotDef(dailyDef, rules)!;
    const group = findWizardSpellbookPowerGroup(groups, poolIdx)!;
    const legal = classFeaturePowerIdsForClass(rules, group, wizard.id);
    expect(legal.length).toBeGreaterThan(1);
    const p0 = legal[0]!;
    const p1 = legal.find((id) => id !== p0)!;
    const sbKey = wizardSpellbookPowerSelectionKey(poolIdx);

    let classSelections: Record<string, string> = {
      [sbKey]: `${p0},${p1}`
    };
    let classPowerSlots: Record<string, string> = { [dailyDef.key]: p0 };

    const build = {
      name: "T",
      level: 1,
      raceId: rules.races[0]!.id,
      classId: wizard.id,
      abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 18, WIS: 10, CHA: 10 },
      trainedSkillIds: [],
      featIds: [],
      powerIds: [p0],
      classSelections,
      classPowerSlots
    };
    classSelections =
      syncWizardSpellbookPowerSelectionsFromClassSlots(
        classSelections,
        classPowerSlots,
        rules,
        defs,
        groups,
        build
      ) ?? classSelections;

    const used = wizardSpellbookPowerIdsUsedOutsidePoolPick(rules, classSelections, poolIdx, 1);
    expect(used.has(p0)).toBe(true);
    expect(used.has(p1)).toBe(false);

    const leg = validateCharacterBuild(rules, build);
    expect(leg.errors.some((e) => e.includes("Cannot read"))).toBe(false);

    const base0 = resolveBaseAugmentablePowerId(rules, p0);
    expect(base0).toBeTruthy();
  });

  it("wizard non-spellbook power groups have valid pickCount", () => {
    const groups = getClassFeatureChoiceGroups(rules, wizard);
    const visible = filterVisibleClassFeatureChoiceGroups(groups, {}, 1).filter(
      (g) => g.kind === "power"
    );
    const nonSpellbook = visible.filter((g) => !isWizardSpellbookPowerGroup(g));
    for (const g of nonSpellbook) {
      expect(Number.isFinite(g.pickCount)).toBe(true);
      expect(g.pickCount).toBeGreaterThan(0);
      expect(g.pickCount).toBeLessThan(20);
    }
  });
});
