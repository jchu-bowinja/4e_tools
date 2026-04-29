import type { MonsterTemplateRecord, MonsterTemplatePrerequisite } from "./storage";
import {
  flattenLegacyPrerequisiteAst,
  isLegacyPrerequisiteAst,
  legacyPrerequisiteCriteriaToFlat,
  migrateKindFieldsToType,
  parseMonsterTemplatePrerequisite
} from "./templatePrerequisiteCriteria";

/**
 * Top-level shape of `generated/monster_templates.json` — `loadMonsterTemplates()` reads `templates` only;
 * `meta` documents the bundle (ETL adds more keys; custom export keeps a compatible subset).
 */
export type MonsterTemplatesJsonFile = {
  meta: Record<string, unknown>;
  templates: MonsterTemplateRecord[];
};

/** Build `{ meta, templates }` for file/clipboard export (local custom + generated index when loaded). */
export function buildMonsterTemplatesExportFile(
  templates: MonsterTemplateRecord[]
): MonsterTemplatesJsonFile {
  return {
    meta: {
      templateCount: templates.length,
      source: "4e-builder.monsterEditor.exportTemplates",
      exportedAt: new Date().toISOString(),
      dedupeKey: "normalizedTemplateName"
    },
    templates
  };
}

export function stringifyMonsterTemplatesJsonFile(file: MonsterTemplatesJsonFile): string {
  return `${JSON.stringify(file, null, 2)}\n`;
}

export type ParseMonsterTemplatesImportResult =
  | { ok: true; templates: MonsterTemplateRecord[] }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function isTemplateNamePresent(obj: unknown): boolean {
  return isRecord(obj) && String(obj.templateName ?? "").trim().length > 0;
}

/**
 * Accepts:
 * - Full export / ETL file: `{ meta?, templates: MonsterTemplateRecord[] }`
 * - A single `MonsterTemplateRecord` object
 * - A JSON array of template objects
 */
export function parseMonsterTemplatesImportJson(text: string): ParseMonsterTemplatesImportResult {
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
    const invalidIdx = raw.findIndex((item) => !isTemplateNamePresent(item));
    if (invalidIdx >= 0) {
      return {
        ok: false,
        error: `Array index ${invalidIdx} is missing a templateName (non-empty string).`
      };
    }
    return { ok: true, templates: raw as MonsterTemplateRecord[] };
  }

  if (!isRecord(raw)) {
    return { ok: false, error: "JSON root must be an object or array." };
  }

  const templatesField = raw.templates;
  if (templatesField !== undefined) {
    if (!Array.isArray(templatesField)) {
      return { ok: false, error: "Property \"templates\" must be an array when present." };
    }
    if (templatesField.length === 0) {
      return { ok: false, error: "The templates array is empty." };
    }
    const invalidIdx = templatesField.findIndex((item) => !isTemplateNamePresent(item));
    if (invalidIdx >= 0) {
      return {
        ok: false,
        error: `templates[${invalidIdx}] is missing a templateName (non-empty string).`
      };
    }
    return { ok: true, templates: templatesField as MonsterTemplateRecord[] };
  }

  if (isTemplateNamePresent(raw)) {
    return { ok: true, templates: [raw as MonsterTemplateRecord] };
  }

  return {
    ok: false,
    error:
      "Expected a template object with templateName, an array of such objects, or { templates: [...] } (e.g. exported custom JSON or monster_templates.json)."
  };
}

/** Same defaults as manual save in the monster editor. */
export function normalizeImportedTemplateRecord(record: MonsterTemplateRecord): MonsterTemplateRecord {
  const sourceBook = String(record.sourceBook ?? "").trim() || "manual import";
  const powers = Array.isArray(record.powers) ? record.powers : [];
  const prerequisite = record.prerequisite?.trim();
  const legacyCrit = (record as MonsterTemplateRecord & { prerequisiteCriteria?: unknown }).prerequisiteCriteria;

  let prerequisiteExpr: MonsterTemplatePrerequisite | undefined = migrateKindFieldsToType(
    record.prerequisiteExpr as unknown
  ) as MonsterTemplatePrerequisite | undefined;
  if (prerequisiteExpr != null && isLegacyPrerequisiteAst(prerequisiteExpr)) {
    prerequisiteExpr = flattenLegacyPrerequisiteAst(prerequisiteExpr) ?? undefined;
  }
  if (prerequisiteExpr === undefined) {
    prerequisiteExpr = legacyPrerequisiteCriteriaToFlat(legacyCrit);
  }
  if (prerequisiteExpr === undefined && prerequisite) {
    prerequisiteExpr = parseMonsterTemplatePrerequisite(prerequisite).data;
  }
  const { prerequisiteCriteria: _dropLegacy, ...rest } = record as MonsterTemplateRecord & {
    prerequisiteCriteria?: unknown;
  };
  return {
    ...rest,
    sourceBook,
    powers,
    prerequisiteExpr
  };
}
