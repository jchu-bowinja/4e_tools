import { describe, expect, it } from "vitest";
import { monsterEntryToTemplateRecord } from "./monsterEntryToTemplate";
import type { MonsterEntryFile } from "./storage";
import { validateMonsterTemplateImport } from "./pasteMonsterTemplateEtl";

function minimalMonster(overrides: Partial<MonsterEntryFile> = {}): MonsterEntryFile {
  return {
    id: "m1",
    fileName: "m1.json",
    relativePath: "generated/monsters/entries/m1.json",
    name: "Test Beast",
    level: 5,
    role: "Brute",
    isLeader: false,
    parseError: "",
    sourceRoot: "generated",
    size: "1",
    origin: "test",
    type: "Monster",
    xp: 200,
    stats: {
      abilityScores: { STR: 20, CON: 16 },
      defenses: { AC: 20, Fortitude: 18 },
      attackBonuses: { Melee: 10 },
      skills: { Athletics: 12 },
      otherNumbers: { HP: 60, Initiative: 4 }
    },
    powers: [
      {
        name: "Slam",
        usage: "At-Will",
        action: "Standard",
        keywords: "Weapon",
        description: "Hit: 1d8+5."
      }
    ],
    ...overrides
  } as MonsterEntryFile;
}

describe("monsterEntryToTemplateRecord", () => {
  it("maps identity, role line, and abilities", () => {
    const t = monsterEntryToTemplateRecord(
      minimalMonster({
        name: "Grave Worm",
        sourceBooks: ["MM", "DMG"],
        description: "Undead horror.",
        tactics: "Burrows."
      })
    );
    expect(t.templateName).toBe("Grave Worm");
    expect(t.sourceBook).toBe("MM; DMG");
    expect(t.roleLine).toContain("Level 5");
    expect(t.roleLine).toContain("Brute");
    expect(t.description).toContain("Undead horror.");
    expect(t.description).toContain("Tactics:");
    expect(t.powers).toHaveLength(1);
    expect(t.powers[0].name).toBe("Slam");
    expect(t.extractionMethod).toBe("monster-export");
    expect(t.statLines?.some((l) => l.includes("Ability scores"))).toBe(true);
    expect((t.stats as { monsterExport?: { monsterId?: string } }).monsterExport?.monsterId).toBe("m1");
  });

  it("uses a stub power when the monster has no powers", () => {
    const t = monsterEntryToTemplateRecord(minimalMonster({ powers: [] }));
    expect(t.powers).toHaveLength(1);
    expect(t.powers[0].name).toContain("No powers");
    const v = validateMonsterTemplateImport(t);
    expect(v.errors).toEqual([]);
  });

  it("passes template validation for a typical monster", () => {
    const v = validateMonsterTemplateImport(monsterEntryToTemplateRecord(minimalMonster()));
    expect(v.errors).toEqual([]);
  });

  it("marks leaders on the role line", () => {
    const t = monsterEntryToTemplateRecord(minimalMonster({ isLeader: true }));
    expect(t.roleLine).toContain("Leader");
  });
});
