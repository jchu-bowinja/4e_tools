import { areConditionDurationsEqual, normalizeConditionDuration } from "./conditionDurationPresets";
import type { ActiveCondition, ConditionDuration } from "./model";

function createActiveConditionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `cond_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createActiveCondition(name: string, duration: ConditionDuration): ActiveCondition {
  return {
    id: createActiveConditionId(),
    name: name.trim(),
    duration
  };
}

export function areActiveConditionsDuplicate(a: ActiveCondition, b: ActiveCondition): boolean {
  return a.name.trim().toLowerCase() === b.name.trim().toLowerCase() && areConditionDurationsEqual(a.duration, b.duration);
}

function normalizeAppliedAt(o: Record<string, unknown>): ActiveCondition["appliedAt"] {
  const round = typeof o.round === "number" && Number.isFinite(o.round) ? Math.trunc(o.round) : undefined;
  const turnId = typeof o.turnId === "string" && o.turnId.trim() ? o.turnId.trim() : undefined;
  if (round === undefined && !turnId) return undefined;
  return { ...(round !== undefined ? { round } : {}), ...(turnId ? { turnId } : {}) };
}

function normalizeActiveConditionObject(raw: Record<string, unknown>): ActiveCondition | null {
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!name) return null;
  const id = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : createActiveConditionId();
  const duration =
    raw.duration && typeof raw.duration === "object" && !Array.isArray(raw.duration)
      ? normalizeConditionDuration(raw.duration)
      : { kind: "none" as const, phrase: "" };
  const appliedAt =
    raw.appliedAt && typeof raw.appliedAt === "object" && !Array.isArray(raw.appliedAt)
      ? normalizeAppliedAt(raw.appliedAt as Record<string, unknown>)
      : undefined;
  return { id, name, duration, ...(appliedAt ? { appliedAt } : {}) };
}

export function normalizeActiveConditions(raw: unknown): ActiveCondition[] {
  if (!Array.isArray(raw)) return [];
  const out: ActiveCondition[] = [];
  for (const entry of raw) {
    if (typeof entry === "string") {
      const name = entry.trim();
      if (!name) continue;
      out.push(createActiveCondition(name, { kind: "none", phrase: "" }));
      continue;
    }
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const normalized = normalizeActiveConditionObject(entry as Record<string, unknown>);
    if (normalized) out.push(normalized);
  }
  return out;
}
