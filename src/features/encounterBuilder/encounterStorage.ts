import type { MonsterEntryFile } from "../monsterEditor/storage";

export const ENCOUNTER_STORE_STORAGE_KEY = "encounterBuilder.store";

export const ENCOUNTER_STORE_VERSION = 1 as const;

export interface EncounterRosterRow {
  rosterInstanceId: string;
  sourceMonsterId: string;
  snapshot: MonsterEntryFile;
  /** Stable keys (see `normalizeTemplateDedupeKey` in monster editor) for templates applied when added; slot order primary → secondary. */
  templateDedupeKeys?: string[];
  /** DMG quick level-adjust slider value when the creature was added (monster editor `monsterLevelDelta`). */
  levelAdjustment?: number;
}

/** Optional metadata stored with a roster snapshot (templates + level tweak at add time). */
export type EncounterSnapshotExtras = {
  templateDedupeKeys?: string[];
  levelAdjustment?: number;
};

export interface EncounterRecord {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  roster: EncounterRosterRow[];
}

export interface EncounterStore {
  version: typeof ENCOUNTER_STORE_VERSION;
  activeEncounterId: string | null;
  encounters: EncounterRecord[];
}

function nowIso(): string {
  return new Date().toISOString();
}

export function newEncounterId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `enc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function newRosterInstanceId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `row-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Deep clone monster JSON for roster snapshots. */
export function cloneMonsterEntry(entry: MonsterEntryFile): MonsterEntryFile {
  return JSON.parse(JSON.stringify(entry)) as MonsterEntryFile;
}

export function createEncounterRecord(name: string): EncounterRecord {
  const t = nowIso();
  return {
    id: newEncounterId(),
    name: name.trim() || "Untitled encounter",
    createdAt: t,
    updatedAt: t,
    roster: []
  };
}

export function createInitialEncounterStore(): EncounterStore {
  const first = createEncounterRecord("My encounter");
  return {
    version: ENCOUNTER_STORE_VERSION,
    activeEncounterId: first.id,
    encounters: [first]
  };
}

function migrateRawStore(raw: unknown): EncounterStore {
  if (!raw || typeof raw !== "object") {
    return createInitialEncounterStore();
  }
  const obj = raw as Record<string, unknown>;
  const version = obj.version;
  if (version !== ENCOUNTER_STORE_VERSION) {
    return createInitialEncounterStore();
  }
  const encounters = obj.encounters;
  if (!Array.isArray(encounters) || encounters.length === 0) {
    return createInitialEncounterStore();
  }
  const normalized: EncounterRecord[] = [];
  for (const e of encounters) {
    if (!e || typeof e !== "object") continue;
    const rec = e as Record<string, unknown>;
    const id = typeof rec.id === "string" && rec.id.trim() ? rec.id : newEncounterId();
    const name = typeof rec.name === "string" && rec.name.trim() ? rec.name : "Encounter";
    const rosterRaw = rec.roster;
    const roster: EncounterRosterRow[] = [];
    if (Array.isArray(rosterRaw)) {
      for (const row of rosterRaw) {
        if (!row || typeof row !== "object") continue;
        const r = row as Record<string, unknown>;
        const snapshot = r.snapshot;
        if (!snapshot || typeof snapshot !== "object") continue;
        const rawDedupeKeys = r.templateDedupeKeys;
        const templateDedupeKeys =
          Array.isArray(rawDedupeKeys) && rawDedupeKeys.length > 0
            ? rawDedupeKeys.filter((x): x is string => typeof x === "string").slice(0, 2)
            : undefined;
        const rawLevelAdj = r.levelAdjustment;
        const levelAdjustment =
          typeof rawLevelAdj === "number" && Number.isFinite(rawLevelAdj) ? Math.trunc(rawLevelAdj) : undefined;
        roster.push({
          rosterInstanceId:
            typeof r.rosterInstanceId === "string" && r.rosterInstanceId.trim()
              ? r.rosterInstanceId
              : newRosterInstanceId(),
          sourceMonsterId: typeof r.sourceMonsterId === "string" ? r.sourceMonsterId : "",
          snapshot: cloneMonsterEntry(snapshot as MonsterEntryFile),
          ...(templateDedupeKeys && templateDedupeKeys.length > 0 ? { templateDedupeKeys } : {}),
          ...(levelAdjustment !== undefined && levelAdjustment !== 0 ? { levelAdjustment } : {})
        });
      }
    }
    normalized.push({
      id,
      name,
      createdAt: typeof rec.createdAt === "string" ? rec.createdAt : nowIso(),
      updatedAt: typeof rec.updatedAt === "string" ? rec.updatedAt : nowIso(),
      roster
    });
  }
  if (normalized.length === 0) {
    return createInitialEncounterStore();
  }
  let activeEncounterId =
    typeof obj.activeEncounterId === "string" && obj.activeEncounterId.trim() ? obj.activeEncounterId : null;
  if (!activeEncounterId || !normalized.some((e) => e.id === activeEncounterId)) {
    activeEncounterId = normalized[0].id;
  }
  return {
    version: ENCOUNTER_STORE_VERSION,
    activeEncounterId,
    encounters: normalized
  };
}

export function loadEncounterStore(): EncounterStore {
  try {
    const raw = window.localStorage.getItem(ENCOUNTER_STORE_STORAGE_KEY);
    if (!raw) return createInitialEncounterStore();
    const parsed: unknown = JSON.parse(raw);
    return migrateRawStore(parsed);
  } catch {
    return createInitialEncounterStore();
  }
}

export function saveEncounterStore(store: EncounterStore): void {
  try {
    window.localStorage.setItem(ENCOUNTER_STORE_STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* ignore */
  }
}

/** Pretty-printed JSON for file export / backup (same shape as {@link saveEncounterStore}). */
export function stringifyEncounterStoreForExport(store: EncounterStore): string {
  return `${JSON.stringify(store, null, 2)}\n`;
}

export function findEncounterById(store: EncounterStore, id: string): EncounterRecord | undefined {
  return store.encounters.find((e) => e.id === id);
}

export function storeSetActiveEncounter(store: EncounterStore, id: string | null): EncounterStore {
  if (id && !store.encounters.some((e) => e.id === id)) {
    return store;
  }
  return { ...store, activeEncounterId: id };
}

export function storeAddEncounter(store: EncounterStore, name: string): { store: EncounterStore; newId: string } {
  const rec = createEncounterRecord(name);
  return {
    store: {
      ...store,
      activeEncounterId: rec.id,
      encounters: [rec, ...store.encounters]
    },
    newId: rec.id
  };
}

export function storeRenameEncounter(store: EncounterStore, id: string, name: string): EncounterStore {
  const label = name.trim() || "Untitled encounter";
  return {
    ...store,
    encounters: store.encounters.map((e) =>
      e.id === id ? { ...e, name: label, updatedAt: nowIso() } : e
    )
  };
}

export function storeDeleteEncounter(store: EncounterStore, id: string): EncounterStore {
  const next = store.encounters.filter((e) => e.id !== id);
  if (next.length === 0) {
    const fresh = createInitialEncounterStore();
    return fresh;
  }
  let activeEncounterId = store.activeEncounterId;
  if (activeEncounterId === id) {
    activeEncounterId = next[0].id;
  } else if (activeEncounterId && !next.some((e) => e.id === activeEncounterId)) {
    activeEncounterId = next[0].id;
  }
  return { ...store, encounters: next, activeEncounterId };
}

export function storeDuplicateEncounter(store: EncounterStore, id: string): { store: EncounterStore; newId: string } | null {
  const src = store.encounters.find((e) => e.id === id);
  if (!src) return null;
  const t = nowIso();
  const copy: EncounterRecord = {
    id: newEncounterId(),
    name: `${src.name} (copy)`,
    createdAt: t,
    updatedAt: t,
    roster: src.roster.map((row) => ({
      rosterInstanceId: newRosterInstanceId(),
      sourceMonsterId: row.sourceMonsterId,
      snapshot: cloneMonsterEntry(row.snapshot),
      ...(row.templateDedupeKeys?.length ? { templateDedupeKeys: [...row.templateDedupeKeys] } : {}),
      ...(row.levelAdjustment !== undefined && row.levelAdjustment !== 0 ? { levelAdjustment: row.levelAdjustment } : {})
    }))
  };
  return {
    store: {
      ...store,
      activeEncounterId: copy.id,
      encounters: [copy, ...store.encounters]
    },
    newId: copy.id
  };
}

export function encounterAddSnapshot(
  encounter: EncounterRecord,
  snapshot: MonsterEntryFile,
  sourceMonsterId: string,
  extras?: EncounterSnapshotExtras
): EncounterRecord {
  const normalizedKeys =
    extras?.templateDedupeKeys?.filter((k) => typeof k === "string" && k.trim()).slice(0, 2) ?? [];
  const rawLa = extras?.levelAdjustment;
  const levelAdjustment =
    typeof rawLa === "number" && Number.isFinite(rawLa) ? Math.trunc(rawLa) : undefined;
  const row: EncounterRosterRow = {
    rosterInstanceId: newRosterInstanceId(),
    sourceMonsterId,
    snapshot: cloneMonsterEntry(snapshot),
    ...(normalizedKeys.length > 0 ? { templateDedupeKeys: normalizedKeys } : {}),
    ...(levelAdjustment !== undefined && levelAdjustment !== 0 ? { levelAdjustment } : {})
  };
  return {
    ...encounter,
    updatedAt: nowIso(),
    roster: [...encounter.roster, row]
  };
}

export function encounterRemoveRosterAt(encounter: EncounterRecord, index: number): EncounterRecord {
  if (index < 0 || index >= encounter.roster.length) return encounter;
  return {
    ...encounter,
    updatedAt: nowIso(),
    roster: encounter.roster.filter((_, i) => i !== index)
  };
}

export function encounterMoveRoster(encounter: EncounterRecord, index: number, delta: -1 | 1): EncounterRecord {
  const j = index + delta;
  if (j < 0 || j >= encounter.roster.length) return encounter;
  const next = [...encounter.roster];
  const tmp = next[index];
  next[index] = next[j]!;
  next[j] = tmp!;
  return { ...encounter, updatedAt: nowIso(), roster: next };
}

/** Move roster row from `fromIndex` to `toIndex` (0-based, inclusive). */
export function encounterReorderRosterRow(encounter: EncounterRecord, fromIndex: number, toIndex: number): EncounterRecord {
  const { roster } = encounter;
  const len = roster.length;
  if (fromIndex === toIndex) return encounter;
  if (fromIndex < 0 || fromIndex >= len || toIndex < 0 || toIndex >= len) return encounter;
  const next = [...roster];
  const [removed] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, removed);
  return { ...encounter, updatedAt: nowIso(), roster: next };
}

export function storeUpdateEncounter(
  store: EncounterStore,
  encounterId: string,
  updater: (e: EncounterRecord) => EncounterRecord
): EncounterStore {
  return {
    ...store,
    encounters: store.encounters.map((e) => (e.id === encounterId ? updater(e) : e))
  };
}

export function storeAddSnapshotToEncounter(
  store: EncounterStore,
  encounterId: string,
  snapshot: MonsterEntryFile,
  sourceMonsterId: string,
  extras?: EncounterSnapshotExtras
): EncounterStore {
  return storeUpdateEncounter(store, encounterId, (e) =>
    encounterAddSnapshot(e, snapshot, sourceMonsterId, extras)
  );
}

export function storeRemoveRosterAt(store: EncounterStore, encounterId: string, index: number): EncounterStore {
  return storeUpdateEncounter(store, encounterId, (e) => encounterRemoveRosterAt(e, index));
}

export function storeMoveRosterAt(
  store: EncounterStore,
  encounterId: string,
  index: number,
  delta: -1 | 1
): EncounterStore {
  return storeUpdateEncounter(store, encounterId, (e) => encounterMoveRoster(e, index, delta));
}

export function storeReorderRosterRow(
  store: EncounterStore,
  encounterId: string,
  fromIndex: number,
  toIndex: number
): EncounterStore {
  return storeUpdateEncounter(store, encounterId, (e) => encounterReorderRosterRow(e, fromIndex, toIndex));
}
