import type { NadBonusesFromSpecific, StatAddEntry } from "./models";

/** Flatten compendium `rules.statadd[].attrs` (mirrors ETL `extract_stat_adds_from_rules`). */
export function normalizeStatAddEntryAttrs(attrs: Record<string, unknown>): StatAddEntry | null {
  const name = String(attrs.name ?? "").trim();
  const value = String(attrs.value ?? "").trim();
  if (!name && !value) return null;
  const out: StatAddEntry = { name, value };
  for (const key of ["condition", "wearing", "requires", "type"] as const) {
    const v = attrs[key];
    if (v !== undefined && v !== null && String(v).trim()) {
      out[key] = String(v).trim();
    }
  }
  return out;
}

/** `rules.statadd` rows from a compendium entity (class feature, racial trait, feat raw, …). */
export function statAddsFromRules(rules: Record<string, unknown> | undefined): StatAddEntry[] {
  const rawList = rules?.statadd;
  if (!Array.isArray(rawList)) return [];
  const out: StatAddEntry[] = [];
  for (const item of rawList) {
    if (!item || typeof item !== "object") continue;
    const attrs = (item as { attrs?: unknown }).attrs;
    if (!attrs || typeof attrs !== "object") continue;
    const normalized = normalizeStatAddEntryAttrs(attrs as Record<string, unknown>);
    if (normalized) out.push(normalized);
  }
  return out;
}

/** Parse `specific['Bonus to Defense']` (e.g. '+1 Fortitude'). */
export function nadBonusesFromBonusToDefenseField(
  specific: Record<string, unknown> | undefined
): NadBonusesFromSpecific | undefined {
  const text = String(specific?.["Bonus to Defense"] ?? "").trim();
  if (!text) return undefined;
  const sums: NadBonusesFromSpecific = {};
  for (const m of text.matchAll(/([+-]\d+)\s*(Fortitude|Reflex|Will)\b/gi)) {
    const key = m[2].toLowerCase() as keyof NadBonusesFromSpecific;
    if (key !== "fortitude" && key !== "reflex" && key !== "will") continue;
    sums[key] = (sums[key] ?? 0) + Number(m[1]);
  }
  return Object.keys(sums).length > 0 ? sums : undefined;
}
