import type { MonsterEntryFile, MonsterIndexEntry, MonsterTemplateRecord } from "./storage";

export const MONSTER_SELECTED_ID_STORAGE_KEY = "monsterEditor.selectedId";

export const MONSTER_CUSTOM_TEMPLATES_STORAGE_KEY = "monsterEditor.customMonsterTemplates";
export const MONSTER_CUSTOM_ENTRIES_STORAGE_KEY = "monsterEditor.customMonsterEntries";

export function normalizeTemplateDedupeKey(t: Pick<MonsterTemplateRecord, "templateName" | "sourceBook">): string {
  const name = String(t.templateName ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  const book = String(t.sourceBook ?? "");
  return `${name}\0${book}`;
}

export function readCustomMonsterTemplates(): MonsterTemplateRecord[] {
  try {
    const raw = window.localStorage.getItem(MONSTER_CUSTOM_TEMPLATES_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as MonsterTemplateRecord[]) : [];
  } catch {
    return [];
  }
}

export function writeCustomMonsterTemplates(rows: MonsterTemplateRecord[]): void {
  try {
    window.localStorage.setItem(MONSTER_CUSTOM_TEMPLATES_STORAGE_KEY, JSON.stringify(rows));
  } catch {
    /* ignore */
  }
}

export function mergeServerAndCustomTemplates(
  custom: MonsterTemplateRecord[],
  server: MonsterTemplateRecord[]
): MonsterTemplateRecord[] {
  const customKeys = new Set(custom.map(normalizeTemplateDedupeKey));
  const out = [...custom];
  for (const s of server) {
    if (!customKeys.has(normalizeTemplateDedupeKey(s))) out.push(s);
  }
  return out;
}

export function readCustomMonsterEntries(): MonsterEntryFile[] {
  try {
    const raw = window.localStorage.getItem(MONSTER_CUSTOM_ENTRIES_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as MonsterEntryFile[]) : [];
  } catch {
    return [];
  }
}

export function writeCustomMonsterEntries(rows: MonsterEntryFile[]): void {
  try {
    window.localStorage.setItem(MONSTER_CUSTOM_ENTRIES_STORAGE_KEY, JSON.stringify(rows));
  } catch {
    /* ignore */
  }
}

export function monsterEntryToIndexRow(entry: MonsterEntryFile): MonsterIndexEntry {
  return {
    id: entry.id,
    fileName: entry.fileName || `${entry.id}.json`,
    relativePath: entry.relativePath || `custom/monsters/${entry.id}.json`,
    name: entry.name,
    level: entry.level,
    role: entry.role,
    groupRole: entry.groupRole,
    isLeader: entry.isLeader,
    parseError: entry.parseError ?? ""
  };
}

export function mergeServerAndCustomMonsterIndex(server: MonsterIndexEntry[], custom: MonsterEntryFile[]): MonsterIndexEntry[] {
  const customIds = new Set(custom.map((c) => c.id));
  const rows = custom.map(monsterEntryToIndexRow);
  for (const row of server) {
    if (!customIds.has(row.id)) rows.push(row);
  }
  return rows;
}

/** Persisted browser-only monsters: stable paths and sourceRoot for the sheet. */
export function normalizeMonsterEntryForSave(parsed: MonsterEntryFile): MonsterEntryFile {
  const id = String(parsed.id ?? "").trim() || `custom-${Date.now().toString(36)}`;
  const name = String(parsed.name ?? "").trim() || "Unnamed monster";
  const powers = Array.isArray(parsed.powers) ? parsed.powers : [];
  return {
    ...parsed,
    id,
    name,
    powers,
    fileName: `${id}.json`,
    relativePath: `custom/monsters/${id}.json`,
    sourceRoot: "custom",
    parseError: ""
  };
}

export function isStoredCustomMonsterId(id: string | null | undefined): boolean {
  if (!id?.trim()) return false;
  return readCustomMonsterEntries().some((m) => m.id === id);
}

/** True when this row matches an entry in local custom storage (deletable); server-only rows are false. */
export function isStoredCustomTemplate(record: MonsterTemplateRecord | null): boolean {
  if (!record?.templateName?.trim()) return false;
  const key = normalizeTemplateDedupeKey(record);
  return readCustomMonsterTemplates().some((c) => normalizeTemplateDedupeKey(c) === key);
}

export function readStoredSelectedMonsterId(): string {
  try {
    return window.localStorage.getItem(MONSTER_SELECTED_ID_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function writeStoredSelectedMonsterId(id: string): void {
  try {
    if (id.trim()) {
      window.localStorage.setItem(MONSTER_SELECTED_ID_STORAGE_KEY, id);
    } else {
      window.localStorage.removeItem(MONSTER_SELECTED_ID_STORAGE_KEY);
    }
  } catch {
    // Ignore storage failures and keep app behavior in-memory.
  }
}
