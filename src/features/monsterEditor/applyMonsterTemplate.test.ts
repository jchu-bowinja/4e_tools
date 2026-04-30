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
});
