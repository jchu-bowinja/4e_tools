import { describe, expect, it } from "vitest";
import type { ClassDef, ClassFeature, EpicDestiny, ParagonPath, RulesIndex, Theme } from "../../src/rules/models";
import {
  getClassTraitRows,
  getEpicDestinyTraitRows,
  getParagonTraitRows,
  getThemeTraitRows,
  parseTraitIdsFromField,
  parseTraitNamesFromField,
  resolveTraitDisplayRows
} from "../../src/rules/supportTraits";

const combatChallenge: ClassFeature = {
  id: "ID_FMP_CLASS_FEATURE_54",
  name: "Combat Challenge",
  slug: "combat-challenge",
  shortDescription: "Mark foes you attack.",
  raw: {}
};

function miniIndex(features: ClassFeature[] = [combatChallenge]): RulesIndex {
  return {
    meta: { version: 1, counts: {} },
    races: [],
    classes: [],
    feats: [],
    powers: [],
    skills: [],
    languages: [],
    armors: [],
    abilityScores: [],
    racialTraits: [],
    classFeatures: features,
    themes: [],
    paragonPaths: [],
    epicDestinies: [],
    hybridClasses: []
  };
}

describe("supportTraits", () => {
  it("parses comma-separated trait ids and names", () => {
    expect(parseTraitIdsFromField({ "Class Features": "ID_A, ID_B, prose" }, "Class Features")).toEqual([
      "ID_A",
      "ID_B"
    ]);
    expect(parseTraitNamesFromField({ _PARSED_CLASS_FEATURE: "Combat Challenge, Second Wind" }, "_PARSED_CLASS_FEATURE")).toEqual([
      "Combat Challenge",
      "Second Wind"
    ]);
  });

  it("resolves class traits from parsed feature names", () => {
    const fighter: ClassDef = {
      id: "ID_FMP_CLASS_3",
      name: "Fighter",
      slug: "fighter",
      raw: { specific: { _PARSED_CLASS_FEATURE: "Combat Challenge, Missing Feature" } }
    };
    const rows = getClassTraitRows(fighter, miniIndex());
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      id: "ID_FMP_CLASS_FEATURE_54",
      name: "Combat Challenge",
      shortDescription: "Mark foes you attack."
    });
    expect(rows[1]?.name).toBe("Missing Feature");
    expect(rows[1]?.shortDescription).toBeUndefined();
  });

  it("resolves theme and path traits from feature ids", () => {
    const theme: Theme = {
      id: "ID_THEME",
      name: "Sample Theme",
      slug: "sample-theme",
      prereqTokens: [],
      raw: { specific: { _PARSED_SUB_FEATURES: "ID_FMP_CLASS_FEATURE_54" } }
    };
    const path: ParagonPath = {
      id: "ID_PATH",
      name: "Sample Path",
      slug: "sample-path",
      prereqTokens: [],
      raw: { specific: { "Class Features": "ID_FMP_CLASS_FEATURE_54" } }
    };
    const index = miniIndex();
    expect(getThemeTraitRows(theme, index)).toHaveLength(1);
    expect(getParagonTraitRows(path, index)[0]?.name).toBe("Combat Challenge");
  });

  it("dedupes rows when resolving by id and name", () => {
    const index = miniIndex();
    const { byId, byName } = {
      byId: new Map(index.classFeatures.map((f) => [f.id, f])),
      byName: new Map(index.classFeatures.map((f) => [f.name, f]))
    };
    const rows = resolveTraitDisplayRows(
      ["ID_FMP_CLASS_FEATURE_54"],
      ["Combat Challenge"],
      byId,
      byName
    );
    expect(rows).toHaveLength(1);
  });

  it("resolves epic destiny traits from class feature ids", () => {
    const destiny: EpicDestiny = {
      id: "ID_DESTINY",
      name: "Archmage",
      slug: "archmage",
      prereqTokens: [],
      raw: { specific: { "Class Features": "ID_FMP_CLASS_FEATURE_54" } }
    };
    expect(getEpicDestinyTraitRows(destiny, miniIndex())[0]?.name).toBe("Combat Challenge");
  });
});
