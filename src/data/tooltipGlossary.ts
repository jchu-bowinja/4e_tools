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
  return byName;
}

export async function loadTooltipGlossary(): Promise<Record<string, string>> {
  const response = await fetch("/generated/glossary_terms.json");
  if (!response.ok) return {};
  const rows = (await response.json()) as GlossaryTermRow[];
  return glossaryRowsToTooltipMap(rows);
}

function firstText(...values: Array<unknown>): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function extractRulesEntityText(entity: { shortDescription?: string | null; body?: string | null; raw?: Record<string, unknown> }): string | null {
  const raw = entity.raw || {};
  return firstText(
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

function fromRulesIndex(index: RulesIndex, term: string): string | null {
  const normalized = normalizeTerm(term);
  const collections: Array<Array<{ name?: string } & Record<string, unknown>>> = [
    index.abilityScores,
    index.skills,
    index.races,
    index.classes,
    index.feats,
    index.powers,
    index.racialTraits,
    index.themes,
    index.paragonPaths,
    index.epicDestinies,
    index.languages,
    index.armors,
    index.weapons || [],
    index.implements || [],
    index.hybridClasses || []
  ];
  for (const collection of collections) {
    const match = collection.find((item) => normalizeTerm(String(item.name || "")) === normalized);
    if (!match) continue;
    const text = extractRulesEntityText(match as { shortDescription?: string | null; body?: string | null; raw?: Record<string, unknown> });
    if (text) return text;
  }
  return null;
}

function candidateTerms(input: string): string[] {
  const trimmed = input.trim();
  if (!trimmed) return [];
  const candidates = [trimmed];
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
  const typoAliases: Record<string, string> = {
    teleporation: "teleportation",
    marial: "martial",
    arcare: "arcane"
  };
  const normalized = normalizeTerm(trimmed);
  const alias = typoAliases[normalized];
  if (alias) candidates.push(alias);
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
  index: RulesIndex;
}): string | null {
  for (const term of params.terms) {
    for (const candidate of candidateTerms(term)) {
      const glossaryMatch = params.glossaryByName[normalizeTerm(candidate)];
      if (glossaryMatch) return glossaryMatch;
    }
  }
  for (const term of params.terms) {
    for (const candidate of candidateTerms(term)) {
      const indexMatch = fromRulesIndex(params.index, candidate);
      if (indexMatch) return indexMatch;
    }
  }
  return null;
}

/**
 * Lookup order for STR/CON/… tooltips: prefer the rules row name, then full name + code
 * (e.g. Strength, STR), then a generic “Ability Score” fallback — so we do not match the
 * broad “Ability Scores” glossary entry before a specific ability.
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
  out.push("Ability Score");
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
