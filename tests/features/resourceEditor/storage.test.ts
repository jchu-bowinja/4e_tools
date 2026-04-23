import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadResourceEditorOverlay,
  resetResourceEditorOverlay,
  saveResourceEditorOverlay
} from "../../../src/features/resourceEditor/storage";

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

describe("resource editor storage", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", mockLocalStorage());
  });

  it("round-trips a saved overlay", () => {
    saveResourceEditorOverlay({
      version: 1,
      collections: {
        races: {
          upserts: { race_test: { id: "race_test", name: "Test", slug: "test", raw: {} } },
          deletes: []
        }
      }
    });
    const loaded = loadResourceEditorOverlay();
    expect(loaded.collections.races?.upserts.race_test).toBeTruthy();
  });

  it("clears overlay on reset", () => {
    saveResourceEditorOverlay({
      version: 1,
      collections: { races: { upserts: {}, deletes: ["race_human"] } }
    });
    const reset = resetResourceEditorOverlay();
    expect(reset.collections).toEqual({});
    expect(loadResourceEditorOverlay().collections).toEqual({});
  });
});
