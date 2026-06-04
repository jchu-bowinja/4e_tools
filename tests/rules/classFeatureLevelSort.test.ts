import { describe, expect, it } from "vitest";
import index from "../../generated/rules_index.json";
import { getClassFeatureChoiceGroups } from "../../src/rules/classFeatureChoices";
import { getClassTraitRows, parseFeatureLevel } from "../../src/rules/supportTraits";
import type { ClassFeature, RulesIndex } from "../../src/rules/models";

const rules = index as RulesIndex;

function levelsNonDecreasing(levels: number[]): boolean {
  for (let i = 1; i < levels.length; i++) {
    if (levels[i]! < levels[i - 1]!) return false;
  }
  return true;
}

describe("class feature level ordering (all classes)", () => {
  it("parseFeatureLevel reads level from Essentials-style feature names", () => {
    const feature: ClassFeature = {
      id: "ID_TEST",
      name: "Level 7 Mage Encounter Powers",
      slug: "test",
      raw: { specific: {} }
    };
    expect(parseFeatureLevel(feature)).toBe(7);
  });

  for (const slug of ["mage", "wizard", "cleric", "fighter", "warlock"] as const) {
    it(`${slug}: choice groups are sorted by minLevel`, () => {
      const cls = rules.classes.find((c) => c.slug === slug);
      expect(cls).toBeDefined();
      const groups = getClassFeatureChoiceGroups(rules, cls);
      const levels = groups.map((g) => g.minLevel ?? 1);
      expect(levelsNonDecreasing(levels)).toBe(true);
    });

    it(`${slug}: granted class feature rows are sorted by level`, () => {
      const cls = rules.classes.find((c) => c.slug === slug);
      expect(cls).toBeDefined();
      const rows = getClassTraitRows(cls, rules, 30);
      const byId = new Map((rules.classFeatures ?? []).map((f) => [f.id, f]));
      const levels = rows
        .map((r) => (r.id.startsWith("ID_") ? byId.get(r.id) : undefined))
        .map((f) => (f ? (parseFeatureLevel(f) ?? 1) : 999));
      expect(levelsNonDecreasing(levels)).toBe(true);
    });
  }
});
