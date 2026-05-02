import { describe, expect, it } from "vitest";
import type { MonsterEntryFile } from "../monsterEditor/storage";
import {
  cloneMonsterEntry,
  createInitialEncounterStore,
  ENCOUNTER_STORE_VERSION,
  encounterAddSnapshot,
  encounterMoveRoster,
  encounterReorderRosterRow,
  encounterRemoveRosterAt,
  storeAddEncounter,
  storeAddSnapshotToEncounter,
  storeDeleteEncounter,
  storeMoveRosterAt,
  storeReorderRosterRow,
  storeRemoveRosterAt,
  stringifyEncounterStoreForExport
} from "./encounterStorage";

function stubMonster(id: string, name: string): MonsterEntryFile {
  return {
    id,
    name,
    level: 4,
    role: "Brute",
    fileName: `${id}.json`,
    relativePath: `m/${id}.json`,
    sourceRoot: "test",
    size: "M",
    origin: "natural",
    type: "humanoid",
    xp: 200,
    parseError: "",
    stats: {
      abilityScores: {},
      defenses: {},
      attackBonuses: {},
      skills: {},
      otherNumbers: {}
    },
    powers: []
  };
}

describe("stringifyEncounterStoreForExport", () => {
  it("produces parseable JSON with store version", () => {
    const s = createInitialEncounterStore();
    const parsed: unknown = JSON.parse(stringifyEncounterStoreForExport(s));
    expect(parsed).toMatchObject({ version: ENCOUNTER_STORE_VERSION });
  });
});

describe("encounter roster operations", () => {
  it("adds snapshot rows", () => {
    const enc = createInitialEncounterStore().encounters[0]!;
    const m = stubMonster("g1", "Goblin");
    const next = encounterAddSnapshot(enc, m, "g1");
    expect(next.roster).toHaveLength(1);
    expect(next.roster[0].sourceMonsterId).toBe("g1");
    expect(next.roster[0].snapshot.name).toBe("Goblin");
    expect(next.roster[0].snapshot).not.toBe(m);
    expect(next.roster[0].templateDedupeKeys).toBeUndefined();
  });

  it("stores template dedupe keys when provided", () => {
    const enc = createInitialEncounterStore().encounters[0]!;
    const m = stubMonster("g1", "Goblin");
    const keys = ["demonicacolyte\u0000MM3", "vampirethrall\u0000"];
    const next = encounterAddSnapshot(enc, m, "g1", { templateDedupeKeys: keys });
    expect(next.roster[0].templateDedupeKeys).toEqual(keys);
  });

  it("stores level adjustment when non-zero", () => {
    const enc = createInitialEncounterStore().encounters[0]!;
    const m = stubMonster("g1", "Goblin");
    const withAdj = encounterAddSnapshot(enc, m, "g1", { levelAdjustment: -2 });
    expect(withAdj.roster[0].levelAdjustment).toBe(-2);
    const skipZero = encounterAddSnapshot(withAdj, stubMonster("o1", "Orc"), "o1", { levelAdjustment: 0 });
    expect(skipZero.roster[1].levelAdjustment).toBeUndefined();
  });

  it("cloneMonsterEntry is independent", () => {
    const m = stubMonster("x", "X");
    const c = cloneMonsterEntry(m);
    c.name = "Y";
    expect(m.name).toBe("X");
  });

  it("removes by index", () => {
    let enc = createInitialEncounterStore().encounters[0]!;
    enc = encounterAddSnapshot(enc, stubMonster("a", "A"), "a");
    enc = encounterAddSnapshot(enc, stubMonster("b", "B"), "b");
    enc = encounterRemoveRosterAt(enc, 0);
    expect(enc.roster).toHaveLength(1);
    expect(enc.roster[0].snapshot.name).toBe("B");
  });

  it("moves roster entries", () => {
    let enc = createInitialEncounterStore().encounters[0]!;
    enc = encounterAddSnapshot(enc, stubMonster("a", "A"), "a");
    enc = encounterAddSnapshot(enc, stubMonster("b", "B"), "b");
    enc = encounterMoveRoster(enc, 0, 1);
    expect(enc.roster.map((r) => r.snapshot.name)).toEqual(["B", "A"]);
  });

  it("storeRemoveRosterAt targets active encounter", () => {
    const store = createInitialEncounterStore();
    const id = store.activeEncounterId!;
    let s = storeAddSnapshotToEncounter(store, id, stubMonster("m", "M"), "m");
    s = storeAddSnapshotToEncounter(s, id, stubMonster("n", "N"), "n");
    s = storeRemoveRosterAt(s, id, 0);
    expect(findRosterNames(s, id)).toEqual(["N"]);
  });

  it("storeMoveRosterAt reorders", () => {
    const store = createInitialEncounterStore();
    const id = store.activeEncounterId!;
    let s = storeAddSnapshotToEncounter(store, id, stubMonster("m", "M"), "m");
    s = storeAddSnapshotToEncounter(s, id, stubMonster("n", "N"), "n");
    s = storeMoveRosterAt(s, id, 0, 1);
    expect(findRosterNames(s, id)).toEqual(["N", "M"]);
  });

  it("encounterReorderRosterRow moves to arbitrary index", () => {
    let enc = createInitialEncounterStore().encounters[0]!;
    enc = encounterAddSnapshot(enc, stubMonster("a", "A"), "a");
    enc = encounterAddSnapshot(enc, stubMonster("b", "B"), "b");
    enc = encounterAddSnapshot(enc, stubMonster("c", "C"), "c");
    enc = encounterReorderRosterRow(enc, 0, 2);
    expect(enc.roster.map((r) => r.snapshot.name)).toEqual(["B", "C", "A"]);
    enc = encounterReorderRosterRow(enc, 2, 0);
    expect(enc.roster.map((r) => r.snapshot.name)).toEqual(["A", "B", "C"]);
  });

  it("storeReorderRosterRow reorders via store", () => {
    const store = createInitialEncounterStore();
    const id = store.activeEncounterId!;
    let s = storeAddSnapshotToEncounter(store, id, stubMonster("m", "M"), "m");
    s = storeAddSnapshotToEncounter(s, id, stubMonster("n", "N"), "n");
    s = storeAddSnapshotToEncounter(s, id, stubMonster("p", "P"), "p");
    s = storeReorderRosterRow(s, id, 2, 0);
    expect(findRosterNames(s, id)).toEqual(["P", "M", "N"]);
  });

  it("storeDeleteEncounter removes encounter and reassigns active", () => {
    let s = createInitialEncounterStore();
    const firstId = s.encounters[0]!.id;
    s = storeAddEncounter(s, "Second").store;
    const secondId = s.activeEncounterId!;
    expect(s.encounters).toHaveLength(2);
    s = storeDeleteEncounter(s, secondId);
    expect(s.encounters).toHaveLength(1);
    expect(s.activeEncounterId).toBe(firstId);
  });
});

function findRosterNames(store: ReturnType<typeof createInitialEncounterStore>, encounterId: string): string[] {
  const e = store.encounters.find((x) => x.id === encounterId);
  return (e?.roster ?? []).map((r) => r.snapshot.name);
}
