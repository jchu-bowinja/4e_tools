import { describe, expect, it } from "vitest";
import index from "../../generated/rules_index.json";
import type { RulesIndex } from "../../src/rules/models";
import { getClassFeatureChoiceGroups } from "../../src/rules/classFeatureChoices";
import {
  characterHasMageSpellbook,
  isClassSpellbookPowerGroup,
  isMageSpellbookPowerGroup,
  mageSpellbookGroupsForSlot,
  resolveSpellbookSlotBinding,
  spellbookPicksForBinding
} from "../../src/rules/wizardSpellbook";
import { buildClassPowerSlotDefinitions } from "../../src/rules/classPowerSlots";

const rules = index as RulesIndex;
const mage = rules.classes.find((c) => c.slug === "mage")!;

const mageBuild = {
  name: "T",
  level: 1,
  raceId: rules.races[0]!.id,
  classId: mage.id,
  abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 18, WIS: 10, CHA: 10 },
  trainedSkillIds: [],
  featIds: [],
  powerIds: []
};

describe("mageSpellbook", () => {
  it("maps level-1 encounter slot to split spellbook pools", () => {
    const groups = getClassFeatureChoiceGroups(rules, mage);
    const spellbook = groups.filter((g) => isMageSpellbookPowerGroup(g));
    expect(spellbook.length).toBeGreaterThan(0);
    expect(spellbook.some((g) => g.parentFeatureName === "Level 1 Mage Encounter Powers")).toBe(true);

    const defs = buildClassPowerSlotDefinitions(1, false, 0);
    const enc = defs.find((d) => d.bucket === "encounter")!;
    const split = mageSpellbookGroupsForSlot(enc, groups);
    expect(split.length).toBe(2);
    expect(split.every((g) => g.pickCount === 1)).toBe(true);

    const binding = resolveSpellbookSlotBinding(enc, groups, rules, mageBuild);
    expect(binding?.kind).toBe("mage-split");
    if (binding?.kind === "mage-split") {
      expect(binding.groups.length).toBe(2);
    }
  });

  it("maps level-3 encounter slot to combined two-pick pool", () => {
    const groups = getClassFeatureChoiceGroups(rules, mage);
    const defs = buildClassPowerSlotDefinitions(3, false, 0);
    const enc = defs.find((d) => d.bucket === "encounter" && d.gainLevel === 3)!;
    const binding = resolveSpellbookSlotBinding(
      enc,
      groups,
      rules,
      { ...mageBuild, level: 3 }
    );
    expect(binding?.kind).toBe("mage-combined");
    if (binding?.kind === "mage-combined") {
      expect(binding.group.pickCount).toBe(2);
      expect(binding.group.parentFeatureName).toBe("Level 3 Mage Encounter Powers");
    }
  });

  it("excludes mage spellbook groups from class-feature power section filter", () => {
    const groups = getClassFeatureChoiceGroups(rules, mage);
    const onTab = groups.filter((g) => g.kind === "power" && !isClassSpellbookPowerGroup(g));
    expect(onTab.some((g) => g.parentFeatureName === "Mage Cantrips")).toBe(true);
    expect(onTab.some((g) => isMageSpellbookPowerGroup(g))).toBe(false);
  });

  it("reads split-pool selections for spellbook picks", () => {
    const groups = getClassFeatureChoiceGroups(rules, mage);
    const defs = buildClassPowerSlotDefinitions(1, false, 0);
    const enc = defs.find((d) => d.bucket === "encounter")!;
    const binding = resolveSpellbookSlotBinding(enc, groups, rules, mageBuild)!;
    const splitGroups = mageSpellbookGroupsForSlot(enc, groups);
    const selections: Record<string, string> = {
      [splitGroups[0]!.key]: "ID_A",
      [splitGroups[1]!.key]: "ID_B"
    };
    const picks = spellbookPicksForBinding(binding, selections);
    expect(picks[0]).toBe("ID_A");
    expect(picks[1]).toBe("ID_B");
  });

  it("detects mage spellbook from granted feature", () => {
    expect(characterHasMageSpellbook(rules, mageBuild)).toBe(true);
  });
});
