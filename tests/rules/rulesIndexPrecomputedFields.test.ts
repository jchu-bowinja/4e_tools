import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { validateRulesIndexShape } from "../../src/data/loadRules";

const INDEX_PATH = resolve(process.cwd(), "generated/rules_index.json");

describe("rules_index precomputed fields (SC-001–004)", () => {
  it.skipIf(!existsSync(INDEX_PATH))("exports exclusion lists and feat power aliases from ETL", () => {
    const data = JSON.parse(readFileSync(INDEX_PATH, "utf-8"));
    const index = validateRulesIndexShape(data);

    expect(index.paragonPathClassFeaturePowerIds?.length).toBeGreaterThan(0);
    expect(index.featGrantedPowerIdsExcludedFromClassFeaturePicks?.length).toBeGreaterThan(0);
    expect(index.featPowerNameAliases?.["hand of fury"]).toBe("hand of radiance");
    expect(index.classFeatureChoiceGroupsByClassId?.["ID_FMP_CLASS_104"]?.some((g) => g.optional)).toBe(
      true
    );
  });
});
