import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const rulesIndexPath = "generated/rules_index.json";

describe.skipIf(!existsSync(rulesIndexPath))("generated rules index", () => {
  it("contains core datasets", () => {
    const raw = readFileSync(rulesIndexPath, "utf-8");
    const data = JSON.parse(raw) as {
      races: unknown[];
      classes: unknown[];
      feats: unknown[];
      powers: unknown[];
      skills: unknown[];
      languages: unknown[];
      racialTraits: unknown[];
      armors: unknown[];
      abilityScores: unknown[];
      themes: unknown[];
      paragonPaths: unknown[];
      epicDestinies: unknown[];
      autoGrantedPowerIdsByClassId?: Record<string, string[]>;
      autoGrantedSkillTrainingNamesBySupportId?: Record<string, string[]>;
    };

    expect(data.races.length).toBeGreaterThan(0);
    expect(data.languages.length).toBeGreaterThan(0);
    expect(data.racialTraits.length).toBeGreaterThan(0);
    expect(data.classes.length).toBeGreaterThan(0);
    expect(data.feats.length).toBeGreaterThan(100);
    expect(data.powers.length).toBeGreaterThan(100);
    expect(data.skills.length).toBeGreaterThan(5);
    expect(data.armors.length).toBeGreaterThan(5);
    expect(data.abilityScores.length).toBe(6);
    expect(data.themes.length).toBeGreaterThan(10);
    expect(data.paragonPaths.length).toBeGreaterThan(50);
    expect(data.epicDestinies.length).toBeGreaterThan(10);
    expect(data.autoGrantedPowerIdsByClassId?.["ID_FMP_CLASS_2"]).toContain("ID_FMP_POWER_1455");
    expect(data.autoGrantedSkillTrainingNamesBySupportId?.["ID_FMP_CLASS_9"]).toContain("Arcana");
  });
});

