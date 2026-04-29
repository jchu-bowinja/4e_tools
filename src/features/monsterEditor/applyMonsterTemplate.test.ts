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
});
