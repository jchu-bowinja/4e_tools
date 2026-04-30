import { describe, expect, it } from "vitest";
import { applyMonsterTemplateToEntry, computeTemplateApplicationDelta } from "./applyMonsterTemplate";
import type { MonsterEntryFile, MonsterTemplateRecord } from "./storage";

const baseMonster = (): MonsterEntryFile =>
  ({
    id: "m1",
    fileName: "x.monster",
    relativePath: "x.monster",
    sourceRoot: "MonsterFiles",
    parseError: "",
    name: "Goblin",
    level: "1",
    role: "Skirmisher",
    size: "Small",
    origin: "Natural",
    type: "Humanoid",
    xp: "25",
    stats: {
      abilityScores: {},
      defenses: {},
      attackBonuses: {},
      skills: {},
      otherNumbers: {}
    },
    powers: [{ name: "Short Sword", usage: "At-Will", action: "Standard", keywords: "", description: "" }],
    traits: [{ name: "Cowardly", details: "Shifts when bloodied", range: 0, type: "Trait" }],
    auras: []
  }) as MonsterEntryFile;

const sampleTemplate = (): MonsterTemplateRecord =>
  ({
    templateName: "Death Knight",
    sourceBook: "DMG",
    powers: [
      { name: "Soul Rend", usage: "Encounter", action: "Standard", keywords: "", description: "Big hit." },
      { name: "Short Sword", usage: "At-Will", action: "Standard", keywords: "", description: "Dup." }
    ],
    traits: [{ name: "Undead", details: "Immune", range: 0, type: "Trait" }],
    auras: [{ name: "Despair", details: "−2 saves", range: 5, type: "Aura" }]
  }) as MonsterTemplateRecord;

describe("applyMonsterTemplateToEntry", () => {
  it("appends non-duplicate powers, traits, and auras", () => {
    const merged = applyMonsterTemplateToEntry(baseMonster(), sampleTemplate());
    expect(merged.powers?.map((p) => p.name)).toEqual(["Short Sword", "Soul Rend"]);
    expect(merged.traits?.map((t) => t.name)).toEqual(["Cowardly", "Undead"]);
    expect(merged.auras?.map((a) => a.name)).toEqual(["Despair"]);
    expect((merged.sections as { monsterTemplatePreview?: { templateName: string } }).monsterTemplatePreview?.templateName).toBe(
      "Death Knight"
    );
  });

  it("reports delta counts", () => {
    const delta = computeTemplateApplicationDelta(baseMonster(), sampleTemplate());
    expect(delta.addedPowerNames).toEqual(["Soul Rend"]);
    expect(delta.skippedDuplicatePowers).toBe(1);
    expect(delta.addedTraitNames).toEqual(["Undead"]);
    expect(delta.addedAuraNames).toEqual(["Despair"]);
  });

  it("merges template monster keywords onto the base entry", () => {
    const base = baseMonster();
    base.keywords = ["Humanoid"];
    const tpl = { ...sampleTemplate(), keywords: ["Undead", "humanoid"] } as MonsterTemplateRecord;
    const merged = applyMonsterTemplateToEntry(base, tpl);
    expect(merged.keywords?.map((k) => k.toLowerCase()).sort()).toEqual(["humanoid", "undead"]);
  });

  it("calculates template power attack bonuses as monster level + bonus", () => {
    const base = baseMonster();
    base.level = "11";
    const tpl = {
      templateName: "Spawn of Kyuss",
      sourceBook: "Test",
      powers: [
        {
          name: "Touch of Kyuss",
          usage: "Recharge",
          action: "Standard",
          keywords: "Necrotic",
          description: "Template attack.",
          attacks: [
            {
              kind: "MonsterAttack",
              name: "Hit",
              attackBonuses: [{ defense: "Fortitude", bonus: 3 }],
              hit: { description: "2d6 necrotic damage." }
            }
          ]
        }
      ]
    } as MonsterTemplateRecord;

    const merged = applyMonsterTemplateToEntry(base, tpl);
    const power = merged.powers?.find((p) => p.name === "Touch of Kyuss");
    expect(power?.attacks?.[0]?.attackBonuses?.[0]?.bonus).toBe(14);
  });

  it("merges template stat adjustments onto base creature stats", () => {
    const base = baseMonster();
    base.level = "5";
    base.stats.abilityScores = { Constitution: 14 };
    base.stats.defenses = { AC: 14, Fortitude: 12, Reflex: 13, Will: 11 };
    base.stats.otherNumbers = { ...base.stats.otherNumbers, hitPoints: 40, initiative: 2 };
    base.stats.skills = { Perception: 5 };
    const tpl = {
      ...sampleTemplate(),
      stats: {
        hitPoints: { default: { perLevel: 4, addConstitution: true } },
        defenses: { AC: 2, Fortitude: 1 },
        skills: { entries: [{ skill: "Stealth", value: 3, trained: false }] },
        initiative: { value: 1 },
        savingThrows: { value: 2 }
      }
    } as MonsterTemplateRecord;

    const merged = applyMonsterTemplateToEntry(base, tpl);
    expect(merged.stats?.defenses?.AC).toBe(16);
    expect(merged.stats?.defenses?.Fortitude).toBe(13);
    expect(merged.stats?.otherNumbers?.hitPoints).toBe(74);
    expect(merged.stats?.otherNumbers?.initiative).toBe(3);
    expect(merged.stats?.otherNumbers?.savingThrows).toBe(2);
    expect(merged.stats?.skills?.Stealth).toBe(3);
    expect(merged.stats?.skills?.Perception).toBe(5);
  });

  it("merges situational 'to all defenses against …' as its own defenses row, not spread across AC/NADs", () => {
    const base = baseMonster();
    base.stats.defenses = { AC: 15, Fortitude: 14, Reflex: 13, Will: 12 };
    const tpl = {
      templateName: "Demagogue",
      sourceBook: "Test",
      powers: [],
      stats: {
        defenses: {
          FORTITUDE: 2,
          WILL: 4,
          "to all defenses against charm and fear effects": 4
        }
      }
    } as MonsterTemplateRecord;

    const merged = applyMonsterTemplateToEntry(base, tpl);
    const d = merged.stats?.defenses as Record<string, unknown>;
    expect(d?.Fortitude).toBe(16);
    expect(d?.Will).toBe(16);
    expect(d?.AC).toBe(15);
    expect(d?.Reflex).toBe(13);
    const situational =
      d?.["to all defenses against charm and fear effects"] ??
      Object.entries(d ?? {}).find(([k]) => k.toLowerCase().includes("charm and fear"))?.[1];
    expect(situational).toBe(4);
  });

  it("promotes rank one step and adjusts xp when a template is applied", () => {
    const base = baseMonster();
    base.level = "5";
    base.groupRole = "Minion";
    base.xp = 50;

    const merged = applyMonsterTemplateToEntry(base, sampleTemplate());
    expect(merged.groupRole).toBe("Standard");
    expect(merged.xp).toBe(200);
  });

  it("caps rank at solo and scales xp across chained template applications", () => {
    const base = baseMonster();
    base.level = "5";
    base.groupRole = "Minion";
    base.xp = 50;

    const once = applyMonsterTemplateToEntry(base, sampleTemplate());
    const twice = applyMonsterTemplateToEntry(once, sampleTemplate());
    const thrice = applyMonsterTemplateToEntry(twice, sampleTemplate());
    const fourth = applyMonsterTemplateToEntry(thrice, sampleTemplate());

    expect(once.groupRole).toBe("Standard");
    expect(twice.groupRole).toBe("Elite");
    expect(thrice.groupRole).toBe("Solo");
    expect(fourth.groupRole).toBe("Solo");
    expect(once.xp).toBe(200);
    expect(twice.xp).toBe(400);
    expect(thrice.xp).toBe(1000);
    expect(fourth.xp).toBe(1000);
  });

  it("does not stack class-template defense bonuses across two templates; keeps higher bonus per defense", () => {
    const base = baseMonster();
    base.groupRole = "Standard";
    base.stats.defenses = { AC: 18, Fortitude: 16 };

    const fighterClass = {
      ...sampleTemplate(),
      roleLine: "Fighter Class Standard Soldier",
      stats: { defenses: { AC: 2, Fortitude: 1 } }
    } as MonsterTemplateRecord;
    const wizardClass = {
      ...sampleTemplate(),
      roleLine: "Wizard Class Standard Controller",
      stats: { defenses: { AC: 4, Fortitude: 1 } }
    } as MonsterTemplateRecord;

    const once = applyMonsterTemplateToEntry(base, fighterClass);
    const twice = applyMonsterTemplateToEntry(once, wizardClass);
    expect(once.stats?.defenses?.AC).toBe(20);
    expect(twice.stats?.defenses?.AC).toBe(22);
    expect(twice.stats?.defenses?.Fortitude).toBe(17);
  });

  it("elite to solo multiplies HP instead of adding template HP", () => {
    const base = baseMonster();
    base.level = "10";
    base.groupRole = "Elite";
    base.stats.otherNumbers = { hitPoints: 100, bloodied: 50 };
    const tpl = {
      ...sampleTemplate(),
      stats: { hitPoints: { default: { perLevel: 10, addConstitution: true } } }
    } as MonsterTemplateRecord;
    const merged = applyMonsterTemplateToEntry(base, tpl);
    expect(merged.groupRole).toBe("Solo");
    expect(merged.stats?.otherNumbers?.hitPoints).toBe(200);
    expect(merged.stats?.otherNumbers?.bloodied).toBe(100);
  });

  it("level 11+ elite to solo multiplies HP by 2.5", () => {
    const base = baseMonster();
    base.level = "11";
    base.groupRole = "Elite";
    base.stats.otherNumbers = { hitPoints: 120 };
    const merged = applyMonsterTemplateToEntry(base, sampleTemplate());
    expect(merged.groupRole).toBe("Solo");
    expect(merged.stats?.otherNumbers?.hitPoints).toBe(300);
  });

  it("solo does not gain template HP and uses fixed solo save/action values", () => {
    const base = baseMonster();
    base.groupRole = "Solo";
    base.stats.otherNumbers = { hitPoints: 120, savingThrows: 1, actionPoints: 9 };
    const tpl = {
      ...sampleTemplate(),
      stats: {
        hitPoints: { default: { perLevel: 20, addConstitution: true } },
        savingThrows: { value: 99 },
        actionPoints: { value: 99 }
      }
    } as MonsterTemplateRecord;
    const merged = applyMonsterTemplateToEntry(base, tpl);
    expect(merged.groupRole).toBe("Solo");
    expect(merged.stats?.otherNumbers?.hitPoints).toBe(120);
    expect(merged.stats?.otherNumbers?.savingThrows).toBe(5);
    expect(merged.stats?.otherNumbers?.actionPoints).toBe(2);
  });

  it("standard creatures end with no save bonus and no action points", () => {
    const base = baseMonster();
    base.groupRole = "Minion";
    base.stats.otherNumbers = { savingThrows: 4, actionPoints: 3 };
    const merged = applyMonsterTemplateToEntry(base, sampleTemplate());
    expect(merged.groupRole).toBe("Standard");
    expect(merged.stats?.otherNumbers?.savingThrows).toBe(0);
    expect(merged.stats?.otherNumbers?.actionPoints).toBe(0);
  });
});
