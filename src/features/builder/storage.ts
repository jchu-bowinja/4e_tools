import { CharacterBuild } from "../../rules/models";

const STORAGE_KEY = "dnd4e_builder_character_v1";
const SAVED_CHARACTERS_KEY = "dnd4e_saved_characters_v1";

export interface SavedCharacterEntry {
  id: string;
  name: string;
  updatedAt: string;
  build: CharacterBuild;
}

export interface SaveSavedCharacterResult {
  entry: SavedCharacterEntry;
  overwritten: boolean;
}

export type DuplicateResolution = "skip" | "overwrite";

export interface DuplicateEntryContext {
  incoming: SavedCharacterEntry;
  existing: SavedCharacterEntry;
  reason: "id" | "name";
}

export interface ImportSavedCharactersResult {
  imported: number;
  overwritten: number;
  skipped: number;
  total: number;
}

export function saveBuild(build: CharacterBuild): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(build));
}

export function loadBuild(): CharacterBuild | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as CharacterBuild;
  } catch {
    return null;
  }
}

function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `char-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

export function loadSavedCharacters(): SavedCharacterEntry[] {
  const raw = localStorage.getItem(SAVED_CHARACTERS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is SavedCharacterEntry => {
      if (!entry || typeof entry !== "object") return false;
      const candidate = entry as Partial<SavedCharacterEntry>;
      return (
        typeof candidate.id === "string" &&
        typeof candidate.name === "string" &&
        typeof candidate.updatedAt === "string" &&
        typeof candidate.build === "object" &&
        candidate.build !== null
      );
    });
  } catch {
    return [];
  }
}

function saveSavedCharacters(entries: SavedCharacterEntry[]): void {
  localStorage.setItem(SAVED_CHARACTERS_KEY, JSON.stringify(entries));
}

function normalizedName(name: string): string {
  return name.trim().toLowerCase();
}

export function saveBuildToSavedCharacters(
  build: CharacterBuild,
  options?: { overwriteExistingByName?: boolean }
): SaveSavedCharacterResult {
  const entries = loadSavedCharacters();
  const name = (build.name || "Unnamed Character").trim() || "Unnamed Character";
  const overwriteExistingByName = options?.overwriteExistingByName ?? false;
  const existingIndex = entries.findIndex((entry) => normalizedName(entry.name) === normalizedName(name));
  const existing = existingIndex >= 0 ? entries[existingIndex] : null;
  const entry: SavedCharacterEntry = {
    id: overwriteExistingByName && existing ? existing.id : createId(),
    name,
    updatedAt: new Date().toISOString(),
    build: { ...build }
  };
  let overwritten = false;
  if (overwriteExistingByName && existing && existingIndex >= 0) {
    entries.splice(existingIndex, 1);
    overwritten = true;
  }
  entries.unshift(entry);
  saveSavedCharacters(entries);
  return { entry, overwritten };
}

export function deleteSavedCharacterById(id: string): boolean {
  const entries = loadSavedCharacters();
  const next = entries.filter((entry) => entry.id !== id);
  if (next.length === entries.length) {
    return false;
  }
  saveSavedCharacters(next);
  return true;
}

export function importSavedCharacters(
  incomingEntries: SavedCharacterEntry[],
  resolveDuplicate: (context: DuplicateEntryContext) => DuplicateResolution
): ImportSavedCharactersResult {
  const existingEntries = loadSavedCharacters();
  const byId = new Map(existingEntries.map((entry) => [entry.id, entry]));
  const byName = new Map(existingEntries.map((entry) => [normalizedName(entry.name), entry]));
  const nextEntries = [...existingEntries];
  let imported = 0;
  let overwritten = 0;
  let skipped = 0;

  for (const incoming of incomingEntries) {
    const duplicateById = byId.get(incoming.id);
    const duplicateByName = byName.get(normalizedName(incoming.name));
    const duplicate = duplicateById ?? duplicateByName;
    const reason: "id" | "name" | null = duplicateById ? "id" : duplicateByName ? "name" : null;

    if (duplicate && reason) {
      const decision = resolveDuplicate({ incoming, existing: duplicate, reason });
      if (decision === "skip") {
        skipped += 1;
        continue;
      }
      overwritten += 1;
      const blockedIds = new Set<string>([duplicate.id]);
      const blockedNames = new Set<string>([normalizedName(duplicate.name)]);
      if (duplicateById) {
        blockedNames.add(normalizedName(duplicateById.name));
      }
      if (duplicateByName) {
        blockedIds.add(duplicateByName.id);
      }
      const filtered = nextEntries.filter(
        (entry) => !blockedIds.has(entry.id) && !blockedNames.has(normalizedName(entry.name))
      );
      nextEntries.length = 0;
      nextEntries.push(...filtered);
      for (const blockedId of blockedIds) {
        byId.delete(blockedId);
      }
      for (const blockedName of blockedNames) {
        byName.delete(blockedName);
      }
    }

    const nextEntry: SavedCharacterEntry = {
      ...incoming,
      name: incoming.name.trim() || "Unnamed Character",
      updatedAt: incoming.updatedAt || new Date().toISOString(),
      build: { ...incoming.build }
    };
    nextEntries.unshift(nextEntry);
    byId.set(nextEntry.id, nextEntry);
    byName.set(normalizedName(nextEntry.name), nextEntry);
    imported += 1;
  }

  saveSavedCharacters(nextEntries);
  return { imported, overwritten, skipped, total: incomingEntries.length };
}

