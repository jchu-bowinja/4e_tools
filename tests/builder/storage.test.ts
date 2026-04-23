import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteSavedCharacterById,
  importSavedCharacters,
  loadSavedCharacters,
  saveBuildToSavedCharacters
} from "../../src/features/builder/storage";
import type { CharacterBuild } from "../../src/rules/models";

function mockLocalStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return [...store.keys()][index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    }
  };
}

const baseBuild: CharacterBuild = {
  name: "Test Hero",
  level: 1,
  abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 10 },
  trainedSkillIds: [],
  featIds: [],
  powerIds: []
};

describe("saved character storage overwrite behavior", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", mockLocalStorage());
  });

  it("adds a new saved character when name is unique", () => {
    const result = saveBuildToSavedCharacters(baseBuild, { overwriteExistingByName: false });
    expect(result.overwritten).toBe(false);
    const all = loadSavedCharacters();
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe("Test Hero");
  });

  it("overwrites existing entry by same normalized name when requested", () => {
    const first = saveBuildToSavedCharacters({ ...baseBuild, name: "Test Hero" }, { overwriteExistingByName: false });
    const second = saveBuildToSavedCharacters(
      { ...baseBuild, name: " test hero ", level: 2 },
      { overwriteExistingByName: true }
    );
    expect(second.overwritten).toBe(true);
    expect(second.entry.id).toBe(first.entry.id);
    const all = loadSavedCharacters();
    expect(all).toHaveLength(1);
    expect(all[0].build.level).toBe(2);
  });

  it("deletes a saved character by id", () => {
    const first = saveBuildToSavedCharacters({ ...baseBuild, name: "One" }, { overwriteExistingByName: false });
    saveBuildToSavedCharacters({ ...baseBuild, name: "Two" }, { overwriteExistingByName: false });
    const removed = deleteSavedCharacterById(first.entry.id);
    expect(removed).toBe(true);
    const all = loadSavedCharacters();
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe("Two");
  });

  it("imports entries and skips duplicate when requested", () => {
    const existing = saveBuildToSavedCharacters({ ...baseBuild, name: "Existing Hero" }, { overwriteExistingByName: false });
    const imported = importSavedCharacters(
      [
        {
          id: existing.entry.id,
          name: "Incoming Hero",
          updatedAt: new Date().toISOString(),
          build: { ...baseBuild, name: "Incoming Hero", level: 3 }
        }
      ],
      () => "skip"
    );
    expect(imported.imported).toBe(0);
    expect(imported.skipped).toBe(1);
    const all = loadSavedCharacters();
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe("Existing Hero");
  });

  it("imports entries and overwrites duplicate when requested", () => {
    const existing = saveBuildToSavedCharacters({ ...baseBuild, name: "Existing Hero" }, { overwriteExistingByName: false });
    const imported = importSavedCharacters(
      [
        {
          id: existing.entry.id,
          name: "Existing Hero",
          updatedAt: new Date().toISOString(),
          build: { ...baseBuild, name: "Existing Hero", level: 6 }
        }
      ],
      () => "overwrite"
    );
    expect(imported.imported).toBe(1);
    expect(imported.overwritten).toBe(1);
    const all = loadSavedCharacters();
    expect(all).toHaveLength(1);
    expect(all[0].build.level).toBe(6);
  });
});
