import { describe, expect, it } from "vitest";
import type { ClassDef, ClassFeature, EpicDestiny, ParagonPath, RulesIndex, Theme } from "../../src/rules/models";
import {
  getClassTraitRows,
  getEpicDestinyTraitRows,
  getParagonTraitRows,
  getThemeTraitRows,
  parseTraitIdsFromField,
  parseTraitNamesFromField,
  resolveTraitDisplayRows,
  traitDescriptionForDisplay,
  traitNameForDisplay
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
    expect(getThemeTraitRows(theme, index, 30)).toHaveLength(1);
    expect(getParagonTraitRows(path, index, 30)[0]?.name).toBe("Combat Challenge");
  });

  it("prefixes paragon and epic trait names with compendium level", () => {
    const blinkStrike: ClassFeature = {
      id: "ID_BLINK",
      name: "Blink Strike",
      slug: "blink-strike",
      shortDescription: "Teleport on crit.",
      raw: { specific: { Level: "11" } }
    };
    const undaunted: ClassFeature = {
      id: "ID_UNDAUNTED",
      name: "Undaunted Will",
      slug: "undaunted-will",
      raw: { specific: { Level: 21 } }
    };
    const themed: ClassFeature = {
      id: "ID_THEME_FEAT",
      name: "Level 5 Cipher Feature",
      slug: "cipher-5",
      raw: { specific: { Level: 5 } }
    };
    expect(traitNameForDisplay(blinkStrike)).toBe("Level 11 Blink Strike");
    expect(traitNameForDisplay(undaunted)).toBe("Level 21 Undaunted Will");
    expect(traitNameForDisplay(themed)).toBe("Level 5 Cipher Feature");

    const path: ParagonPath = {
      id: "ID_PATH",
      name: "Arcane Wayfarer",
      slug: "arcane-wayfarer",
      prereqTokens: [],
      raw: { specific: { "Class Features": "ID_BLINK" } }
    };
    const destiny: EpicDestiny = {
      id: "ID_DESTINY",
      name: "Avatar of Hope",
      slug: "avatar-of-hope",
      prereqTokens: [],
      raw: { specific: { "Class Features": "ID_UNDAUNTED" } }
    };
    const index = miniIndex([blinkStrike, undaunted]);
    expect(getParagonTraitRows(path, index, 30)[0]?.name).toBe("Level 11 Blink Strike");
    expect(getEpicDestinyTraitRows(destiny, miniIndex([undaunted]), 30)[0]?.name).toBe("Level 21 Undaunted Will");
  });

  it("omits theme, paragon, and epic traits above character level", () => {
    const level5: ClassFeature = {
      id: "ID_THEME_5",
      name: "Level 5 Cipher Feature",
      slug: "cipher-5",
      raw: { specific: { Level: 5 } }
    };
    const level10: ClassFeature = {
      id: "ID_THEME_10",
      name: "Level 10 Cipher Feature",
      slug: "cipher-10",
      raw: { specific: { Level: 10 } }
    };
    const level21: ClassFeature = {
      id: "ID_EPIC_21",
      name: "Undaunted Will",
      slug: "undaunted-will",
      raw: { specific: { Level: 21 } }
    };
    const level24: ClassFeature = {
      id: "ID_EPIC_24",
      name: "Hopeful Revival",
      slug: "hopeful-revival",
      raw: { specific: { Level: 24 } }
    };
    const level30: ClassFeature = {
      id: "ID_EPIC_30",
      name: "Triumph of the Heart",
      slug: "triumph",
      raw: { specific: { Level: 30 } }
    };
    const theme: Theme = {
      id: "ID_THEME",
      name: "Cipher",
      slug: "cipher",
      prereqTokens: [],
      raw: { specific: { _PARSED_SUB_FEATURES: "ID_THEME_5,ID_THEME_10" } }
    };
    const destiny: EpicDestiny = {
      id: "ID_DESTINY",
      name: "Avatar of Hope",
      slug: "avatar-of-hope",
      prereqTokens: [],
      raw: { specific: { "Class Features": "ID_EPIC_21,ID_EPIC_24,ID_EPIC_30" } }
    };
    const index = miniIndex([level5, level10, level21, level24, level30]);
    expect(getThemeTraitRows(theme, index, 7).map((r) => r.name)).toEqual(["Level 5 Cipher Feature"]);
    expect(getEpicDestinyTraitRows(destiny, index, 22).map((r) => r.name)).toEqual(["Level 21 Undaunted Will"]);
    expect(getEpicDestinyTraitRows(destiny, index, 30).map((r) => r.name)).toEqual([
      "Level 21 Undaunted Will",
      "Level 24 Hopeful Revival",
      "Level 30 Triumph of the Heart"
    ]);
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
    expect(getEpicDestinyTraitRows(destiny, miniIndex(), 30)[0]?.name).toBe("Combat Challenge");
  });

  it("falls back to feature body when Short Description is empty", () => {
    const undaunted: ClassFeature = {
      id: "ID_UNDAUNTED",
      name: "Undaunted Will",
      slug: "undaunted-will",
      shortDescription: null,
      body: "Your Wisdom score and your Charisma score both increase by 2.",
      raw: {}
    };
    expect(traitDescriptionForDisplay(undaunted)).toBe(
      "Your Wisdom score and your Charisma score both increase by 2."
    );
    const destiny: EpicDestiny = {
      id: "ID_DESTINY",
      name: "Demigod",
      slug: "demigod",
      prereqTokens: [],
      raw: { specific: { "Class Features": "ID_UNDAUNTED" } }
    };
    expect(getEpicDestinyTraitRows(destiny, miniIndex([undaunted]), 30)[0]?.shortDescription).toBe(
      "Your Wisdom score and your Charisma score both increase by 2."
    );
  });
});
