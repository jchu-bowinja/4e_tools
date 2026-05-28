import { describe, expect, it } from "vitest";
import type { RulesIndex } from "../../src/rules/models";
import {
  collectParagonPathClassFeaturePowerIds,
  paragonPathClassFeaturePowerIds,
  resolveParagonPathClassFeaturePowers
} from "../../src/rules/grantedPowersQuery";

const baseIndex: RulesIndex = {
  races: [],
  classes: [],
  feats: [],
  powers: [
    {
      id: "ID_FMP_POWER_5981",
      name: "Draconic Anathema",
      slug: "draconic-anathema",
      classId: "ID_FMP_CLASS_2",
      raw: {}
    }
  ],
  skills: [],
  languages: [],
  armors: [],
  abilityScores: [],
  racialTraits: [],
  classFeatures: [
    {
      id: "ID_FMP_CLASS_FEATURE_1104",
      name: "Draconic Anathema",
      slug: "draconic-anathema-feature",
      raw: { specific: { Level: "11", Powers: "ID_FMP_POWER_5981" } }
    }
  ],
  paragonPaths: [
    {
      id: "ID_FMP_PARAGON_PATH_229",
      name: "Scourge of Io",
      slug: "scourge-of-io",
      raw: { specific: { "Class Features": "ID_FMP_CLASS_FEATURE_1103, ID_FMP_CLASS_FEATURE_1104" } }
    }
  ]
};

describe("paragon path class feature powers", () => {
  it("indexes paragon-path feature powers for exclusion from class picks", () => {
    expect(paragonPathClassFeaturePowerIds(baseIndex).has("ID_FMP_POWER_5981")).toBe(true);
  });

  it("grants path feature powers when the path is selected at level 11+", () => {
    expect(
      collectParagonPathClassFeaturePowerIds(baseIndex, "ID_FMP_PARAGON_PATH_229", 11)
    ).toContain("ID_FMP_POWER_5981");
    expect(
      collectParagonPathClassFeaturePowerIds(baseIndex, "ID_FMP_PARAGON_PATH_229", 10)
    ).not.toContain("ID_FMP_POWER_5981");
  });

  it("resolves granted path feature powers", () => {
    const powers = resolveParagonPathClassFeaturePowers(baseIndex, "ID_FMP_PARAGON_PATH_229", 11);
    expect(powers.map((p) => p.name)).toContain("Draconic Anathema");
  });
});
