import type { MonsterEntryFile } from "./storage";

/**
 * Top-level shape for monster entry bundles — mirrors `{ meta, templates }` for templates.
 */
export type MonsterEntriesJsonFile = {
  meta: Record<string, unknown>;
  monsters: MonsterEntryFile[];
};

/** Build `{ meta, monsters }` for file/clipboard export. */
export function buildMonsterEntriesExportFile(monsters: MonsterEntryFile[]): MonsterEntriesJsonFile {
  return {
    meta: {
      monsterCount: monsters.length,
      source: "4e-builder.monsterEditor.exportMonsters",
      exportedAt: new Date().toISOString(),
      dedupeKey: "id"
    },
    monsters
  };
}

export function stringifyMonsterEntriesJsonFile(file: MonsterEntriesJsonFile): string {
  return `${JSON.stringify(file, null, 2)}\n`;
}

export type ParseMonsterEntriesImportResult =
  | { ok: true; monsters: MonsterEntryFile[] }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function isMonsterIdPresent(obj: unknown): boolean {
  return isRecord(obj) && String(obj.id ?? "").trim().length > 0;
}

/**
 * Accepts:
 * - Export / bundle: `{ meta?, monsters: MonsterEntryFile[] }`
 * - A single monster object with non-empty `id`
 * - A JSON array of monster objects
 */
export function parseMonsterEntriesImportJson(text: string): ParseMonsterEntriesImportResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: false, error: "No JSON to import." };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(trimmed);
  } catch {
    return { ok: false, error: "Invalid JSON." };
  }

  if (Array.isArray(raw)) {
    if (raw.length === 0) {
      return { ok: false, error: "JSON array is empty." };
    }
    const invalidIdx = raw.findIndex((item) => !isMonsterIdPresent(item));
    if (invalidIdx >= 0) {
      return {
        ok: false,
        error: `Array index ${invalidIdx} is missing an id (non-empty string).`
      };
    }
    return { ok: true, monsters: raw as MonsterEntryFile[] };
  }

  if (!isRecord(raw)) {
    return { ok: false, error: "JSON root must be an object or array." };
  }

  const monstersField = raw.monsters;
  if (monstersField !== undefined) {
    if (!Array.isArray(monstersField)) {
      return { ok: false, error: 'Property "monsters" must be an array when present.' };
    }
    if (monstersField.length === 0) {
      return { ok: false, error: "The monsters array is empty." };
    }
    const invalidIdx = monstersField.findIndex((item) => !isMonsterIdPresent(item));
    if (invalidIdx >= 0) {
      return {
        ok: false,
        error: `monsters[${invalidIdx}] is missing an id (non-empty string).`
      };
    }
    return { ok: true, monsters: monstersField as MonsterEntryFile[] };
  }

  if (isMonsterIdPresent(raw)) {
    return { ok: true, monsters: [raw as MonsterEntryFile] };
  }

  return {
    ok: false,
    error:
      'Expected a monster object with id, an array of such objects, or { monsters: [...] } (e.g. exported monster JSON).'
  };
}

/** Same validation as “Save to custom monsters” in the monster editor. */
export function validateMonsterEntryImport(entry: MonsterEntryFile): string[] {
  const errors: string[] = [];
  if (!String(entry.name ?? "").trim()) errors.push("missing name");
  if (!entry.stats || typeof entry.stats !== "object" || Array.isArray(entry.stats)) {
    errors.push("stats must be an object");
  }
  if (entry.powers != null && !Array.isArray(entry.powers)) {
    errors.push("powers must be an array when present");
  }
  return errors;
}
