import type { MonsterPower, MonsterTemplateRecord, MonsterTrait } from "./storage";

export interface CreateTemplateDraft {
  templateName: string;
  sourceBook: string;
  roleLine: string;
  prerequisite: string;
  description: string;
  statLinesText: string;
  auras: MonsterTrait[];
  traits: MonsterTrait[];
  powers: MonsterPower[];
  stats: Record<string, unknown>;
}

export function makeEmptyCreateTemplateDraft(): CreateTemplateDraft {
  return {
    templateName: "",
    sourceBook: "manual import",
    roleLine: "",
    prerequisite: "",
    description: "",
    statLinesText: "",
    auras: [],
    traits: [],
    powers: [],
    stats: {}
  };
}

export function createTemplateDraftFromRecord(record: MonsterTemplateRecord): CreateTemplateDraft {
  return {
    templateName: String(record.templateName ?? ""),
    sourceBook: String(record.sourceBook ?? "manual import"),
    roleLine: String(record.roleLine ?? record.role?.raw ?? ""),
    prerequisite: String(record.prerequisite ?? ""),
    description: String(record.description ?? ""),
    statLinesText: Array.isArray(record.statLines) ? record.statLines.join("\n") : "",
    auras: Array.isArray(record.auras) ? record.auras : [],
    traits: Array.isArray(record.traits) ? record.traits : [],
    powers: Array.isArray(record.powers) ? record.powers : [],
    stats: asObject(record.stats)
  };
}

export function createTemplateDraftToRecord(draft: CreateTemplateDraft): MonsterTemplateRecord {
  const statLines = draft.statLinesText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  return {
    templateName: draft.templateName.trim(),
    sourceBook: draft.sourceBook.trim() || "manual import",
    roleLine: draft.roleLine.trim() || undefined,
    prerequisite: draft.prerequisite.trim() || undefined,
    description: draft.description.trim() || undefined,
    statLines: statLines.length > 0 ? statLines : undefined,
    auras: draft.auras.length > 0 ? draft.auras : undefined,
    traits: draft.traits.length > 0 ? draft.traits : undefined,
    powers: Array.isArray(draft.powers) ? draft.powers : [],
    stats: asObject(draft.stats)
  };
}

export function createTemplateDraftFromJson(rawJson: string): { draft: CreateTemplateDraft | null; error: string | null } {
  const raw = rawJson.trim();
  if (!raw) return { draft: null, error: null };
  try {
    const parsed = JSON.parse(raw) as MonsterTemplateRecord;
    return { draft: createTemplateDraftFromRecord(parsed), error: null };
  } catch {
    return { draft: null, error: "Invalid JSON — fix syntax before syncing form fields." };
  }
}

export function createTemplateDraftToPrettyJson(draft: CreateTemplateDraft): string {
  return JSON.stringify(createTemplateDraftToRecord(draft), null, 2);
}

export function validateCreateTemplateDraft(draft: CreateTemplateDraft): string[] {
  const errors: string[] = [];
  if (!draft.templateName.trim()) errors.push("Template name is required.");
  return errors;
}

function asObject(value: unknown): Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
