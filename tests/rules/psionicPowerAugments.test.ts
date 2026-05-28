import { describe, expect, it } from "vitest";
import { getClassPowersForLevelRange } from "../../src/rules/classPowersQuery";
import { buildCharacterPowerCardViewModel } from "../../src/ui/powerCard/characterPowerCardViewModel";
import {
  buildPsionicAugmentLinesForPower,
  collapseAugmentablePowersForPicker,
  isPsionicAugmentVariantPower,
  parseAugmentPointCostFromPowerName,
  resolveBaseAugmentablePowerId
} from "../../src/rules/psionicPowerAugments";
import type { Power, RulesIndex } from "../../src/rules/models";

const base: Power = {
  id: "ID_FMP_POWER_2621",
  name: "Twisted Eye",
  slug: "twisted-eye",
  classId: "ID_FMP_CLASS_PSION",
  level: 1,
  usage: "At-Will",
  keywords: "Augmentable, Psionic, Weapon",
  raw: {
    specific: {
      Keywords: "Augmentable, Psionic, Weapon",
      "Power Usage": "At-Will",
      "Power Type": "Attack",
      Hit: "1[W] + Constitution modifier damage. Base hit."
    }
  }
};

const augment1: Power = {
  id: "ID_INTERNAL_POWER_TWISTED_EYE_(AUGMENT_1)",
  name: "Twisted Eye (Augment 1)",
  slug: "twisted-eye-augment-1",
  classId: "ID_FMP_CLASS_PSION",
  level: 1,
  usage: "At-Will",
  raw: {
    specific: {
      _AugmentParent: "ID_FMP_POWER_2621",
      "Power Type": "Attack",
      Special: "Use on opportunity attacks.",
      Hit: "1[W] + Constitution modifier damage. Augmented hit."
    }
  }
};

const augment0: Power = {
  id: "ID_INTERNAL_POWER_TWISTED_EYE_(AUGMENT_0)",
  name: "Twisted Eye (Augment 0)",
  slug: "twisted-eye-augment-0",
  classId: "ID_FMP_CLASS_PSION",
  level: 1,
  usage: "At-Will",
  raw: { specific: { _AugmentParent: "ID_FMP_POWER_2621", Hit: "1[W] + Constitution modifier damage. Base hit." } }
};

const index = {
  classes: [{ id: "ID_FMP_CLASS_PSION", name: "Psion", slug: "psion", raw: {} }],
  powers: [base, augment0, augment1],
  races: [],
  skills: [],
  feats: []
} as unknown as RulesIndex;

describe("psionicPowerAugments", () => {
  it("detects internal augment variant rows", () => {
    expect(isPsionicAugmentVariantPower(augment1)).toBe(true);
    expect(isPsionicAugmentVariantPower(base)).toBe(false);
  });

  it("parses augment point cost from the variant name", () => {
    expect(parseAugmentPointCostFromPowerName("Twisted Eye (Augment 2)")).toBe(2);
    expect(parseAugmentPointCostFromPowerName("Twisted Eye")).toBeNull();
  });

  it("resolves variant ids to the base power", () => {
    expect(resolveBaseAugmentablePowerId(index, augment1.id)).toBe(base.id);
    expect(resolveBaseAugmentablePowerId(index, base.id)).toBe(base.id);
  });

  it("collapses picker lists to one entry per base power", () => {
    const collapsed = collapseAugmentablePowersForPicker([base, augment0, augment1]);
    expect(collapsed).toHaveLength(1);
    expect(collapsed[0]?.id).toBe(base.id);
  });

  it("builds augment lines with power point costs", () => {
    const lines = buildPsionicAugmentLinesForPower(index, base);
    expect(lines).toHaveLength(1);
    expect(lines[0]?.featName).toContain("Augment 1");
    expect(lines[0]?.featName).toContain("1 power point");
    expect(lines[0]?.text).toContain("opportunity attacks");
  });

  it("filters augment variants from class power queries", () => {
    const list = getClassPowersForLevelRange(index, "ID_FMP_CLASS_PSION", 1, "attack");
    expect(list.map((p) => p.id)).toEqual([base.id]);
  });

  it("adds psionic augment tiers to the power card view model", () => {
    const vm = buildCharacterPowerCardViewModel(base, undefined, index);
    expect(vm.augmentationLines.some((l) => l.featName.includes("Augment 1"))).toBe(true);
  });
});
