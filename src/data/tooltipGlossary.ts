import type { RulesIndex } from "../rules/models";

/** One glossary entry as stored in `generated/glossary_terms.json`. */
export interface GlossaryTermRow {
  id?: string;
  name?: string;
  aliases?: string[] | null;
  definition?: string | null;
  html?: string | null;
  category?: string | null;
  type?: string | null;
  sourceBook?: string | null;
  publishedIn?: string | null;
  [key: string]: unknown;
}

function normalizeTerm(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function isNumberedRangeAlias(value: string): boolean {
  const normalized = normalizeTerm(value);
  return /^(?:melee|ranged|reach)\s+\d+$/.test(normalized) || /^((?:close|area)\s+(?:blast|burst))\s+\d+(?:\s+within\s+\d+)?$/.test(normalized);
}

function sanitizeAliasList(aliases: string[] | null | undefined): string[] {
  if (!Array.isArray(aliases)) return [];
  return aliases
    .filter((alias): alias is string => typeof alias === "string")
    .map((alias) => alias.trim())
    .filter((alias) => alias.length > 0 && !isNumberedRangeAlias(alias));
}

export function sanitizeGlossaryRows(rows: GlossaryTermRow[]): GlossaryTermRow[] {
  return rows.map((row) => ({
    ...row,
    aliases: sanitizeAliasList(row.aliases)
  }));
}

function htmlToPlainText(html: string): string {
  if (typeof DOMParser === "undefined") {
    return html
      .replace(/<\/(th|td)>/gi, " | ")
      .replace(/<\/tr>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\s+\|\s+\n/g, "\n")
      .trim();
  }
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const rows = Array.from(doc.querySelectorAll("tr"));
  if (rows.length > 0) {
    const tableText = rows
      .map((row) =>
        Array.from(row.querySelectorAll("th,td"))
          .map((cell) => cell.textContent?.trim() ?? "")
          .filter((cell) => cell.length > 0)
          .join(" | ")
      )
      .filter((line) => line.length > 0)
      .join("\n");
    const headingText = Array.from(doc.querySelectorAll("h1,h2,h3"))
      .map((heading) => heading.textContent?.trim() ?? "")
      .filter((line) => line.length > 0)
      .join("\n");
    const publishedText = Array.from(doc.querySelectorAll("p.publishedIn"))
      .map((line) => line.textContent?.trim() ?? "")
      .filter((line) => line.length > 0)
      .join("\n");
    return [headingText, tableText, publishedText].filter((part) => part.length > 0).join("\n\n").trim();
  }
  return (doc.body.textContent || "").trim();
}

function pickGlossaryText(row: GlossaryTermRow): string | null {
  if (typeof row.definition === "string" && row.definition.trim()) return row.definition.trim();
  if (typeof row.html === "string" && row.html.trim()) {
    const text = htmlToPlainText(row.html);
    if (text) return text;
  }
  return null;
}

/** Plain-text tooltip body for a row (definition preferred, else HTML converted to text). */
export function displayTextForGlossaryRow(row: GlossaryTermRow): string {
  return pickGlossaryText(row) ?? "";
}

/**
 * Maps normalized lookup keys (name + aliases) to the tooltip plain text.
 * The first row to claim a key wins (matches `loadTooltipGlossary` behavior).
 */
export function glossaryRowsToTooltipMap(rows: GlossaryTermRow[]): Record<string, string> {
  const byName: Record<string, string> = {};
  for (const row of sanitizeGlossaryRows(rows)) {
    if (typeof row.name !== "string" || !row.name.trim()) continue;
    const text = pickGlossaryText(row);
    if (!text) continue;
    const keys = [row.name, ...(Array.isArray(row.aliases) ? row.aliases : [])]
      .filter((value): value is string => typeof value === "string" && value.trim())
      .filter((value) => !isNumberedRangeAlias(value))
      .map((value) => normalizeTerm(value));
    for (const key of keys) {
      if (!byName[key]) byName[key] = text;
    }
  }
  return mergeBuiltinTooltipLookupMap(byName);
}

export async function loadTooltipGlossary(): Promise<Record<string, string>> {
  const response = await fetch("/generated/glossary_terms.json");
  if (!response.ok) return {};
  const rows = (await response.json()) as GlossaryTermRow[];
  return glossaryRowsToTooltipMap(rows);
}

/**
 * Verb-style / typo tokens mapped to canonical glossary **entry names** in `glossary_terms.json`.
 * `mergeBuiltinTooltipLookupMap` copies the resolved definition to the alias key when the canonical
 * name is present (so immunity lines and data typos resolve without expanding `candidateTerms`).
 */
const CONDITION_VERB_TO_CANONICAL_NAME: Record<string, string> = {
  slow: "slowed",
  stun: "stunned",
  dominate: "dominated",
  stunning: "stunned",
  petrification: "petrified"
};

const TYPO_TO_CANONICAL_NAME: Record<string, string> = {
  teleporation: "teleportation",
  marial: "martial",
  arcare: "arcane",
  ilusion: "illusion",
  pertrification: "petrified"
};

/** Same tooltip text as an existing glossary entry (`glossary_terms.json`). */
const DAMAGE_AND_KEYWORD_ALIAS_TO_CANONICAL_NAME: Record<string, string> = {
  electricity: "lightning"
};

/** Shown only when missing from bundled glossary (keys normalized). */
const BUILTIN_FALLBACK_DEFINITIONS: Record<string, string> = {
  silver:
    "Many monsters are vulnerable to damage from silver or silvered weapons. Silvered weapons use the silvered modifier on ammunition or melee weapons.",
  silvered:
    "Silvered weapons (or silver ammunition) satisfy vulnerabilities that mention silver.",
  variable:
    "Variable resistance or immunity changes depending on circumstance; see this creature's powers or encounter text for how to apply it.",
  adaptive:
    "Adaptive resistance changes situationally; see the creature's powers or tactical notes for current values.",
  determined:
    "Determined when used in a stat block; see this creature's powers or the encounter setup for how this applies."
};

/**
 * Augments a glossary map with built-in alias keys (immunity verbs, typos) pointing at the same
 * tooltip text as the canonical entry when present.
 */
export function mergeBuiltinTooltipLookupMap(glossaryByName: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = { ...glossaryByName };
  for (const [alias, canonName] of Object.entries(CONDITION_VERB_TO_CANONICAL_NAME)) {
    const canonKey = normalizeTerm(canonName);
    const text = out[canonKey];
    if (!text) continue;
    const aliasKey = normalizeTerm(alias);
    if (!out[aliasKey]) out[aliasKey] = text;
  }
  for (const [typo, canonName] of Object.entries(TYPO_TO_CANONICAL_NAME)) {
    const canonKey = normalizeTerm(canonName);
    const text = out[canonKey];
    if (!text) continue;
    const typoKey = normalizeTerm(typo);
    if (!out[typoKey]) out[typoKey] = text;
  }
  for (const [alias, canonName] of Object.entries(DAMAGE_AND_KEYWORD_ALIAS_TO_CANONICAL_NAME)) {
    const canonKey = normalizeTerm(canonName);
    const text = out[canonKey];
    if (!text) continue;
    const aliasKey = normalizeTerm(alias);
    if (!out[aliasKey]) out[aliasKey] = text;
  }

  const nonmagicalFireKey = normalizeTerm("nonmagical fire");
  if (!out[nonmagicalFireKey]) {
    const fireText = out[normalizeTerm("fire")];
    if (fireText) {
      out[nonmagicalFireKey] =
        `${fireText}\n\nNonmagical fire is fire damage from a nonmagical source when the stat block distinguishes it from magical fire.`;
    }
  }

  for (const [key, text] of Object.entries(BUILTIN_FALLBACK_DEFINITIONS)) {
    const nk = normalizeTerm(key);
    if (!out[nk]) out[nk] = text;
  }
  return out;
}

/** Splits attack-style lines (`Acrobatics (Dex) vs Reflex`) into separate lookup strings. */
export function expandTooltipLookupTerms(rawTerm: string): string[] {
  const term = rawTerm.trim();
  if (!term) return [];
  const attackVsMatch = term.match(/^(.+?)\s+vs\.?\s+(.+)$/i);
  if (attackVsMatch) {
    const left = attackVsMatch[1]?.trim();
    const right = attackVsMatch[2]?.trim();
    return [left, right].filter((part): part is string => Boolean(part));
  }
  return [term];
}

/**
 * Expands a displayed string into glossary lookup keys (`resolveTooltipText` tries them in order).
 * Keep `tools/audit-monster-tooltip-terms.mjs` and `audit_monster_tooltip_terms.py` in sync.
 */
export function candidateTerms(input: string): string[] {
  const trimmed = input.trim();
  if (!trimmed) return [];
  const candidates = [trimmed];

  const effectsSuffixMatch = trimmed.match(/^(\S+)\s+effects?$/i);
  if (effectsSuffixMatch?.[1]) {
    candidates.push(effectsSuffixMatch[1]);
  }

  if (/^knocked\s+prone$/i.test(trimmed)) {
    candidates.push("prone");
  }

  if (/^nonmagical\s+fire$/i.test(trimmed)) {
    candidates.push("fire");
  }

  const withoutParens = trimmed.replace(/\s*\([^)]*\)\s*/g, " ").trim();
  if (withoutParens && withoutParens !== trimmed) {
    candidates.push(withoutParens);
  }
  const withoutTrailingPunctuation = trimmed.replace(/[.,;:!?]+$/g, "").trim();
  if (withoutTrailingPunctuation && withoutTrailingPunctuation !== trimmed) {
    candidates.push(withoutTrailingPunctuation);
  }
  const skillPhraseMatch = trimmed.match(/^(.+?)\s+skill(?:\s+check)?$/i);
  if (skillPhraseMatch?.[1]) {
    candidates.push(skillPhraseMatch[1].trim());
  }
  const checkPhraseMatch = trimmed.match(/^(.+?)\s+check$/i);
  if (checkPhraseMatch?.[1]) {
    candidates.push(checkPhraseMatch[1].trim());
  }
  const trainedInMatch = trimmed.match(/^trained in\s+(.+)$/i);
  if (trainedInMatch?.[1]) {
    candidates.push(trainedInMatch[1].trim());
  }
  const normalized = normalizeTerm(trimmed);
  const typoCanon = TYPO_TO_CANONICAL_NAME[normalized];
  if (typoCanon) candidates.push(typoCanon);
  if (trimmed.endsWith("s") && trimmed.length > 1) {
    candidates.push(trimmed.slice(0, -1));
  }
  if (!trimmed.endsWith("s")) {
    candidates.push(`${trimmed}s`);
  }
  // Split compound keywords like "Fire or Lightning", "Lightning and Thunder", "Implement/Weapon".
  const compoundParts = trimmed
    .split(/\s*(?:\/|,|;|\band\b|\bor\b)\s*/i)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (compoundParts.length > 1) {
    candidates.push(...compoundParts);
  }
  // Normalize numbered range patterns to their glossary base terms.
  // Examples: "Melee 1" -> "Melee", "Close burst 2" -> "Close burst".
  const simpleRangeMatch = trimmed.match(/^(melee|ranged|reach)\s+\d+$/i);
  if (simpleRangeMatch?.[1]) {
    candidates.push(simpleRangeMatch[1]);
  }
  const closeAreaRangeMatch = trimmed.match(/^((?:close|area)\s+(?:blast|burst))\s+\d+(?:\s+within\s+\d+)?$/i);
  if (closeAreaRangeMatch?.[1]) {
    candidates.push(closeAreaRangeMatch[1]);
  }
  return [...new Set(candidates)];
}

export function resolveTooltipText(params: {
  terms: string[];
  glossaryByName: Record<string, string>;
}): string | null {
  const glossary = mergeBuiltinTooltipLookupMap(params.glossaryByName);
  const expandedTerms = params.terms.flatMap((t) => expandTooltipLookupTerms(t));
  for (const term of expandedTerms) {
    for (const candidate of candidateTerms(term)) {
      const glossaryMatch = glossary[normalizeTerm(candidate)];
      if (glossaryMatch) return glossaryMatch;
    }
  }
  return null;
}

function firstRulesText(...values: Array<unknown>): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

/** Plain rules text from a compendium-style entity (skills, abilities, etc.). */
export function extractRulesEntityTooltipText(entity: {
  shortDescription?: string | null;
  body?: string | null;
  raw?: Record<string, unknown>;
}): string | null {
  const raw = entity.raw || {};
  return firstRulesText(
    entity.shortDescription,
    entity.body,
    raw.body,
    raw.flavor,
    raw["Short Description"],
    raw["Description"],
    raw["Rules Text"],
    raw["Text"]
  );
}

/**
 * Tooltip body for an ability score row when the glossary has no matching entry.
 * Uses `rules_index.json` ability score lore (`abilityScores` entries).
 */
export function tooltipTextForAbilityByCode(index: RulesIndex, abilityCode: string): string | null {
  const upper = abilityCode.trim().toUpperCase();
  const entry = index.abilityScores.find((a) => a.abilityCode === upper);
  if (!entry) return null;
  return extractRulesEntityTooltipText(entry);
}

/**
 * Tooltip body for a skill row when the glossary has no usable entry (many skill rows in
 * `glossary_terms.json` are placeholders without definition/html).
 */
export function tooltipTextForSkillById(index: RulesIndex, skillId: string): string | null {
  const skill = index.skills.find((s) => s.id === skillId);
  if (!skill) return null;
  return extractRulesEntityTooltipText(skill);
}

/**
 * Lookup keys for STR/CON/… tooltips: rules row name (when provided), then full name + code
 * (e.g. Strength, STR).
 *
 * Intentionally **no** trailing “Ability Score” term: `resolveTooltipText` expands variants that
 * match the broad glossary entry “Ability Scores”, which would win before rules-index fallback
 * and made every attribute row show the generic ability-scores blurb instead of Strength/Constitution/etc.
 */
export function abilityTooltipResolveTerms(abilityCode: string, rulesEntryName?: string | null): string[] {
  const byCode: Record<string, readonly [string, string]> = {
    STR: ["Strength", "STR"],
    CON: ["Constitution", "CON"],
    DEX: ["Dexterity", "DEX"],
    INT: ["Intelligence", "INT"],
    WIS: ["Wisdom", "WIS"],
    CHA: ["Charisma", "CHA"]
  };
  const upper = abilityCode.trim().toUpperCase();
  const out: string[] = [];
  const nameTrim = typeof rulesEntryName === "string" ? rulesEntryName.trim() : "";
  if (nameTrim) out.push(nameTrim);
  const pair = byCode[upper];
  if (pair) {
    out.push(pair[0], pair[1]);
  } else if (abilityCode.trim()) {
    out.push(abilityCode.trim());
  }
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const t of out) {
    const n = t.trim();
    if (!n) continue;
    const key = normalizeTerm(n);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(n);
  }
  return deduped;
}

export function normalizeTooltipTerm(value: string): string {
  return normalizeTerm(value);
}
