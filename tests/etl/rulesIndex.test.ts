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
      weapons?: unknown[];
      implements?: unknown[];
      abilityScores: unknown[];
      themes: unknown[];
      paragonPaths: unknown[];
      epicDestinies: unknown[];
      hybridClasses?: unknown[];
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
    expect((data.weapons ?? []).length).toBeGreaterThan(10);
    expect((data.implements ?? []).length).toBeGreaterThan(5);
    expect(data.abilityScores.length).toBe(6);
    expect(data.themes.length).toBeGreaterThan(10);
    expect(data.paragonPaths.length).toBeGreaterThan(50);
    expect(data.epicDestinies.length).toBeGreaterThan(10);
    expect((data.hybridClasses ?? []).length).toBeGreaterThan(0);
    expect(data.autoGrantedPowerIdsByClassId?.["ID_FMP_CLASS_2"]).toContain("ID_FMP_POWER_1455");
    expect(data.autoGrantedSkillTrainingNamesBySupportId?.["ID_FMP_CLASS_9"]).toContain("Arcana");
  });

  it("has non-empty ids/names for entities relied on by runtime rules", () => {
    const raw = readFileSync(rulesIndexPath, "utf-8");
    const data = JSON.parse(raw) as {
      races: Array<{ id?: string; name?: string }>;
      classes: Array<{ id?: string; name?: string }>;
      powers: Array<{ id?: string; name?: string }>;
      skills: Array<{ id?: string; name?: string }>;
      racialTraits: Array<{ id?: string; name?: string }>;
      hybridClasses?: Array<{ id?: string; name?: string; baseClassId?: string | null }>;
    };
    expect(data.races.every((r) => !!r.id && !!r.name)).toBe(true);
    expect(data.classes.every((c) => !!c.id && !!c.name)).toBe(true);
    expect(data.powers.every((p) => !!p.id && !!p.name)).toBe(true);
    expect(data.skills.every((s) => !!s.id && !!s.name)).toBe(true);
    expect(data.racialTraits.every((t) => !!t.id && !!t.name)).toBe(true);
    expect((data.hybridClasses ?? []).every((h) => !!h.id && !!h.name && !!h.baseClassId)).toBe(true);
  });
});

