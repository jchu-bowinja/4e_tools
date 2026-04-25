import { describe, expect, it } from "vitest";
import type { RulesIndex } from "../../../src/rules/models";
import { resolveTooltipText } from "../../../src/data/tooltipGlossary";
import { splitTooltipTerms } from "../../../src/features/monsterEditor/MonsterEditorApp";

function emptyIndex(): RulesIndex {
  return {
    races: [],
    classes: [],
    feats: [],
    powers: [],
    skills: [],
    languages: [],
    armors: [],
    abilityScores: [],
    racialTraits: [],
    themes: [],
    paragonPaths: [],
    epicDestinies: [],
    hybridClasses: [],
    weapons: [],
    implements: [],
    autoGrantedPowerIdsByClassId: {},
    autoGrantedSkillTrainingNamesBySupportId: {},
    classBuildOptionsByClassId: {}
  };
}

describe("monster editor tooltip term resolution", () => {
  it("resolves split 'vs' terms through rules_index fallback", () => {
    const index = emptyIndex();
    index.skills = [
      {
        id: "skill-acrobatics",
        name: "Acrobatics",
        keyAbility: "Dex",
        body: "Balance and tumbling skill text.",
        raw: {}
      }
    ];

    const terms = splitTooltipTerms("Acrobatics (Dex) vs Reflex");
    expect(terms).toEqual(["Acrobatics (Dex)", "Reflex"]);

    const resolved = resolveTooltipText({
      terms,
      glossaryByName: {},
      index
    });
    expect(resolved).toBe("Balance and tumbling skill text.");
  });
});
