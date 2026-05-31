import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { validateRulesIndexShape } from "../../src/data/loadRules";

const INDEX_PATH = resolve(process.cwd(), "generated/rules_index.json");

describe("rules_index precomputed fields (SC-001–004, P1)", () => {
  it.skipIf(!existsSync(INDEX_PATH))("exports exclusion lists and feat power aliases from ETL", () => {
    const data = JSON.parse(readFileSync(INDEX_PATH, "utf-8"));
    const index = validateRulesIndexShape(data);

    expect(index.paragonPathClassFeaturePowerIds?.length).toBeGreaterThan(0);
    expect(index.featGrantedPowerIdsExcludedFromClassFeaturePicks?.length).toBeGreaterThan(0);
    expect(index.featPowerNameAliases?.["hand of fury"]).toBe("hand of radiance");
    expect(index.classFeatureChoiceGroupsByClassId?.["ID_FMP_CLASS_104"]?.some((g) => g.optional)).toBe(
      true
    );

    const archer = index.classFeatures?.find((f) => f.id === "ID_FMP_CLASS_FEATURE_2286");
    expect(archer?.mechanicalEffects?.length).toBeGreaterThan(0);

    const humanParent = index.racialTraits?.find((t) => t.id === "ID_FMP_RACIAL_TRAIT_2966");
    expect(humanParent?.grantsBonusClassAtWillByDefault).toBe(true);

    const dilettante = index.racialTraits?.find((t) => t.id === "ID_FMP_RACIAL_TRAIT_643");
    expect(dilettante?.powerSelectCategory?.toLowerCase()).toContain("not_class");

    const heritageFeat = index.feats?.find((f) => f.name === "Vampiric Heritage");
    expect(heritageFeat?.internalGrantKeys).toContain("HERITAGE");

    expect(index.psionicPowerPointsByLevel?.["7"]).toBe(6);
    expect(index.hybridPsionicAugmentationBreakpoints).toEqual([7, 13, 17, 23, 27]);
    expect(index.paragonMulticlassNonPsionicToPsionicAtWillPenalty).toBe(1);
  });
});
