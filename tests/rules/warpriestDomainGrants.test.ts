import { describe, expect, it } from "vitest";
import index from "../../generated/rules_index.json";
import { collectCharacterClassFeatureIds } from "../../src/rules/characterClassFeatures";
import type { CharacterBuild, RulesIndex } from "../../src/rules/models";

const rules = index as RulesIndex;

const DOMAIN_CHOICE_KEY = "classFeature:ID_FMP_CLASS_FEATURE_2988";
const STORM_DOMAIN_ID = "ID_FMP_CLASS_FEATURE_2822";
const STORM_L3_FEATURE_ID = "ID_FMP_CLASS_FEATURE_2969";
const STORM_L13_FEATURE_ID = "ID_FMP_CLASS_FEATURE_2973";

function warpriestBuild(level: number, domainId: string): CharacterBuild {
  const warpriest = rules.classes.find((c) => c.slug === "warpriest");
  return {
    name: "Test Warpriest",
    level,
    classId: warpriest!.id,
    abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 16, CHA: 10 },
    featIds: [],
    powerIds: [],
    trainedSkillIds: [],
    classSelections: {
      [DOMAIN_CHOICE_KEY]: domainId
    }
  };
}

describe("warpriest domain grant chains", () => {
  it("indexes Storm Domain label for the domain pick feature", () => {
    expect(rules.domainLabelByClassFeatureId?.[STORM_DOMAIN_ID]).toBe("Storm Domain");
  });

  it("unlocks level 3 storm domain encounter feature when Storm Domain is selected", () => {
    const ids = collectCharacterClassFeatureIds(rules, warpriestBuild(3, STORM_DOMAIN_ID));
    expect(ids).toContain(STORM_L3_FEATURE_ID);
  });

  it("does not unlock storm domain progression for Sun Domain", () => {
    const sunDomainId = "ID_FMP_CLASS_FEATURE_2841";
    const ids = collectCharacterClassFeatureIds(rules, warpriestBuild(3, sunDomainId));
    expect(ids).not.toContain(STORM_L3_FEATURE_ID);
    expect(ids).toContain("ID_FMP_CLASS_FEATURE_2983");
  });

  it("unlocks level 13 storm domain encounter feature at level 13", () => {
    const ids = collectCharacterClassFeatureIds(rules, warpriestBuild(13, STORM_DOMAIN_ID));
    expect(ids).toContain(STORM_L13_FEATURE_ID);
  });
});
