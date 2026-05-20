import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const rulesIndexPath = "generated/rules_index.json";

describe.skipIf(!existsSync(rulesIndexPath))("generated rules index", () => {
  it("contains core datasets", () => {
    const raw = readFileSync(rulesIndexPath, "utf-8");
    const data = JSON.parse(raw) as {
      races: unknown[];
      classes: unknown[];
      feats: Array<{ id?: string; statAdds?: unknown[] }>;
      powers: unknown[];
      skills: unknown[];
      languages: unknown[];
      racialTraits: unknown[];
      classFeatures?: unknown[];
      armors: unknown[];
      weapons?: unknown[];
      implements?: unknown[];
      abilityScores: unknown[];
      themes: unknown[];
      paragonPaths: unknown[];
      epicDestinies: unknown[];
      hybridClasses?: unknown[];
      proficiencies?: unknown[];
      backgrounds?: unknown[];
      magicItems?: unknown[];
      autoGrantedPowerIdsByClassId?: Record<string, string[]>;
      autoGrantedSkillTrainingNamesBySupportId?: Record<string, string[]>;
      classBuildOptionsByClassId?: Record<
        string,
        Array<{ id: string; name: string; body?: string | null; powerIds?: string[] }>
      >;
    };

    expect(data.races.length).toBeGreaterThan(0);
    expect(data.languages.length).toBeGreaterThan(0);
    expect(data.racialTraits.length).toBeGreaterThan(0);
    expect((data.classFeatures ?? []).length).toBeGreaterThan(100);
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
    expect((data.proficiencies ?? []).length).toBeGreaterThan(100);
    expect((data.backgrounds ?? []).length).toBeGreaterThan(100);
    expect((data.magicItems ?? []).length).toBeGreaterThan(1000);
    expect(data.autoGrantedPowerIdsByClassId?.["ID_FMP_CLASS_2"]).toContain("ID_FMP_POWER_1455");
    expect(data.autoGrantedSkillTrainingNamesBySupportId?.["ID_FMP_CLASS_9"]).toContain("Arcana");

    const ironWill = data.feats.find((f) => f.id === "ID_FMP_FEAT_148");
    if (ironWill && Array.isArray(ironWill.statAdds)) {
      expect(ironWill.statAdds.length).toBeGreaterThan(0);
    }

    const waterdeep = (data.backgrounds as Array<{ id?: string; associatedSkills?: string[] }>).find(
      (b) => b.id === "ID_FMP_BACKGROUND_1"
    );
    if (waterdeep) {
      expect(waterdeep.associatedSkills?.length).toBeGreaterThanOrEqual(0);
    }

    const blackIron = (data.magicItems as Array<{ id?: string; enhancementBonus?: number }>).find(
      (m) => m.id === "ID_FMP_MAGIC_ITEM_32"
    );
    if (blackIron) {
      expect(blackIron.enhancementBonus).toBe(2);
    }

    const longswordProf = (data.proficiencies as Array<{ id?: string; grant?: { kind?: string } }>).find(
      (p) => p.id === "ID_INTERNAL_PROFICIENCY_WEAPON_PROFICIENCY_(LONGSWORD)"
    );
    if (longswordProf?.grant) {
      expect(longswordProf.grant.kind).toBe("weaponName");
    }
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

  it("includes Essentials Build rows for Cleric, Paladin, and Artificer class build options", () => {
    const raw = readFileSync(rulesIndexPath, "utf-8");
    const data = JSON.parse(raw) as {
      classes: Array<{ id: string; name: string }>;
      classBuildOptionsByClassId?: Record<string, Array<{ id: string; name: string; body?: string | null }>>;
      classFeatureChoiceGroupsByClassId?: Record<
        string,
        Array<{ parentFeatureName: string; options?: Array<{ name: string }> }>
      >;
    };
    const clericId = data.classes.find((c) => c.name === "Cleric")?.id;
    const paladinId = data.classes.find((c) => c.name === "Paladin")?.id;
    const artificerId = data.classes.find((c) => c.name === "Artificer")?.id;
    expect(clericId).toBeTruthy();
    expect(paladinId).toBeTruthy();
    expect(artificerId).toBeTruthy();

    const clericOpts = data.classBuildOptionsByClassId?.[clericId!] ?? [];
    expect(clericOpts.map((o) => o.name).sort()).toEqual(
      ["Battle Cleric", "Devoted Cleric", "Shielding Cleric"].sort()
    );
    const battle = clericOpts.find((o) => o.name === "Battle Cleric");
    expect(battle?.id).toBe("ID_FMP_BUILD_6");
    expect(battle?.body?.length).toBeGreaterThan(20);

    const paladinOpts = data.classBuildOptionsByClassId?.[paladinId!] ?? [];
    expect(paladinOpts.length).toBe(4);
    const artificerOpts = data.classBuildOptionsByClassId?.[artificerId!] ?? [];
    expect(artificerOpts.length).toBe(3);

    const fighterId = data.classes.find((c) => c.name === "Fighter")?.id;
    const rogueId = data.classes.find((c) => c.name === "Rogue")?.id;
    const groups = data.classFeatureChoiceGroupsByClassId as
      | Record<string, Array<{ parentFeatureName: string; options?: Array<{ name: string }> }>>
      | undefined;
    const fighterTalents = (groups?.[fighterId!] ?? []).find((g) => g.parentFeatureName === "Fighter Talents");
    expect(fighterTalents?.options?.some((o) => o.name === "Arena Training")).toBe(true);
    const roguePair = (groups?.[rogueId!] ?? []).find((g) => g.parentFeatureName === "Class feature");
    expect(roguePair?.options?.map((o) => o.name).sort()).toEqual(
      ["Rogue Weapon Talent", "Sharpshooter Talent"].sort()
    );
  });
});

