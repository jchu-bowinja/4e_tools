import { describe, expect, it } from "vitest";
import {
  buildMonsterEntriesExportFile,
  parseMonsterEntriesImportJson,
  stringifyMonsterEntriesJsonFile,
  validateMonsterEntryImport
} from "./monsterEntriesJsonFile";
import type { MonsterEntryFile } from "./storage";

const minimalMonster = (id: string, name: string): MonsterEntryFile => ({
  id,
  fileName: `${id}.json`,
  relativePath: `generated/monsters/entries/${id}.json`,
  name,
  level: 1,
  role: "Brute",
  parseError: "",
  sourceRoot: "generated",
  size: "Medium",
  origin: "natural",
  type: "humanoid",
  xp: 100,
  stats: {
    abilityScores: {},
    defenses: {},
    attackBonuses: {},
    skills: {},
    otherNumbers: {}
  },
  powers: [{ name: "Slam", usage: "At-Will", action: "Standard", keywords: "", description: "" }]
});

describe("buildMonsterEntriesExportFile", () => {
  it("matches bundle shape with meta + monsters", () => {
    const monsters: MonsterEntryFile[] = [minimalMonster("m1", "Test")];
    const file = buildMonsterEntriesExportFile(monsters);
    expect(Array.isArray(file.monsters)).toBe(true);
    expect(file.monsters).toHaveLength(1);
    expect(file.meta.monsterCount).toBe(1);
    expect(file.meta.source).toBe("4e-builder.monsterEditor.exportMonsters");
    expect(file.meta.dedupeKey).toBe("id");
    expect(typeof file.meta.exportedAt).toBe("string");
    const text = stringifyMonsterEntriesJsonFile(file);
    expect(text.trimStart().startsWith("{")).toBe(true);
    const roundTrip = JSON.parse(text) as { meta: unknown; monsters: unknown };
    expect(roundTrip.meta).toEqual(file.meta);
    expect(roundTrip.monsters).toEqual(file.monsters);
  });
});

describe("parseMonsterEntriesImportJson", () => {
  it("parses exported bundle", () => {
    const text = stringifyMonsterEntriesJsonFile(buildMonsterEntriesExportFile([minimalMonster("a", "A")]));
    const r = parseMonsterEntriesImportJson(text);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.monsters.map((m) => m.id)).toEqual(["a"]);
  });

  it("parses a single monster object", () => {
    const r = parseMonsterEntriesImportJson(JSON.stringify(minimalMonster("solo", "Solo")));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.monsters).toHaveLength(1);
  });

  it("parses an array of monsters", () => {
    const r = parseMonsterEntriesImportJson(
      JSON.stringify([minimalMonster("one", "One"), minimalMonster("two", "Two")])
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.monsters.map((m) => m.name)).toEqual(["One", "Two"]);
  });

  it("rejects empty monsters array in bundle", () => {
    const r = parseMonsterEntriesImportJson(JSON.stringify({ meta: {}, monsters: [] }));
    expect(r.ok).toBe(false);
  });
});

describe("validateMonsterEntryImport", () => {
  it("accepts minimal valid entry", () => {
    expect(validateMonsterEntryImport(minimalMonster("x", "X"))).toHaveLength(0);
  });

  it("rejects missing name", () => {
    const m = minimalMonster("x", "");
    expect(validateMonsterEntryImport(m).some((e) => e.includes("name"))).toBe(true);
  });

  it("rejects bad stats", () => {
    const m = { ...minimalMonster("x", "X"), stats: undefined as unknown as MonsterEntryFile["stats"] };
    expect(validateMonsterEntryImport(m)).not.toHaveLength(0);
  });
});
