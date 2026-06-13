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
  return value
    .trim()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .toLowerCase()
    .replace(/\s+/g, " ");
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
    "Determined when used in a stat block; see this creature's powers or the encounter setup for how this applies.",
  "all damage":
    "This creature resists or is vulnerable to all damage types unless the stat block lists exceptions.",
  "all damage from outside the tower":
    "Damage dealt from outside the named structure is reduced or negated; see the creature's encounter text for the tower boundary.",
  "by current shape":
    "Resistance value depends on the creature's current form; see its powers or stat block notes for the active shape.",
  "chromatic pillar":
    "Chromatic pillar is a Tiamat-themed defensive effect; see this creature's powers for how the pillar interacts with damage.",
  "copper defense":
    "Copper Defense is a named defensive trait on copper-themed creatures; see its powers for how damage is reduced.",
  "effects targeting ac":
    "Effects that target AC against this creature are reduced or ignored; see its powers for the exact interaction.",
  "necrotic damage":
    "Necrotic damage is a damage type that often weakens or withers the target; many undead resist or are immune to it.",
  opportunity:
    "Opportunity refers to opportunity-attack interactions in this stat block; see the creature's traits for when it can make or ignore opportunity attacks.",
  "planephase form":
    "While in planephase form the creature has altered defenses and resistances; see its powers for entering, leaving, and current values.",
  "podspawn shares any resistances that its pod demon progenitor has":
    "This podspawn inherits resistances from its pod demon progenitor; use the progenitor's current resistances.",
  "poison only":
    "Only poison damage is resisted or affected; other damage types are handled normally unless noted elsewhere.",
  "target of that attack takes an extra 5 cold damage":
    "A rider on a specific attack: the target takes additional cold damage beyond the attack's normal hit line.",
  "terrible slaughter":
    "Terrible Slaughter is a named defensive or damage-reduction trait; see this creature's powers for when it applies.",
  "arrow of fate":
    "Arrow of Fate is a named vulnerability on this creature; see encounter text or powers for what triggers extra damage.",
  "attacks by characters below 20th level":
    "Characters below 20th level cannot affect this creature with attacks; higher-level characters interact normally.",
  "attacks by characters below level 15":
    "Characters below 15th level cannot affect this creature with attacks; higher-level characters interact normally.",
  "attacks by characters below level 20":
    "Characters below 20th level cannot affect this creature with attacks; higher-level characters interact normally.",
  "attacks by creatures of lower than 20th level":
    "Creatures below 20th level cannot affect this creature with attacks; higher-level creatures interact normally.",
  "attacks and damage while in dedrick beynar's space and while dedrick has 1 or more hit points":
    "This creature is protected while sharing Dedrick Beynar's space and Dedrick remains alive; see the encounter for details.",
  "can't be teleported against its will; resist see also planar warp":
    "This creature cannot be teleported unwillingly; see planar warp and related traits for resistance details.",
  "filth fever":
    "Filth fever is a disease often spread by filth or vermin; see the Disease rules and this creature's attack for the effect.",
  "greater moon fever":
    "Greater moon fever is an advanced lycanthropy-related disease; see the Disease rules and this creature's attacks.",
  "greater moon frenzy":
    "Greater moon frenzy is a severe lycanthropy-related disease; see the Disease rules and this creature's attacks.",
  lockjaw:
    "Lockjaw is a disease that stiffens the victim; see the Disease rules and this creature's attack for the effect.",
  "meenlock corruption":
    "Meenlock corruption is a disease spread by meenlocks; see the Disease rules and this creature's powers.",
  "moon frenzy":
    "Moon frenzy is a lycanthropy-related disease; see the Disease rules and this creature's attacks.",
  "moon rage":
    "Moon rage is a lycanthropy-related disease; see the Disease rules and this creature's attacks.",
  "moontusk fever":
    "Moontusk fever is a disease associated with wereboar and similar creatures; see the Disease rules.",
  "noxious breath":
    "Noxious breath is a disease or affliction delivered by this creature's breath weapon or aura; see its powers.",
  "rot grub infestation":
    "Rot grub infestation is a disease caused by rot grubs; see the Disease rules and this creature's attacks.",
  "sewer fever":
    "Sewer fever is a disease common to wererats and sewer denizens; see the Disease rules.",
  "chaos phage":
    "Chaos phage is a plaguechanged disease; see the Disease rules and this creature's powers.",
  "bluefire burst":
    "Bluefire burst is a plaguechanged disease; see the Disease rules and this creature's powers.",
  "poison (and push, pull, slide when chained)":
    "Immune to poison and to forced movement (push, pull, slide) while chained; see the creature's traits for when the chain applies.",
  "all damage dealt to the spawn during its turn":
    "The spawn is immune to all damage dealt to it during its own turn; damage on other turns applies normally."
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

function splitCommaImmunitySegments(raw: string): string[] {
  return String(raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function mergeImmunityCommaFragments(segments: string[]): string[] {
  const merged: string[] = [];
  for (const seg of segments) {
    const st = String(seg ?? "").trim();
    if (!st) continue;
    if (!merged.length) {
      merged.push(st);
      continue;
    }
    const prev = merged[merged.length - 1] ?? "";
    const openParens = (prev.match(/\(/g) ?? []).length - (prev.match(/\)/g) ?? []).length;
    if (
      openParens > 0 ||
      ["pull", "push"].includes(st.toLowerCase()) ||
      (st.endsWith(")") && !st.includes("("))
    ) {
      merged[merged.length - 1] = `${prev}, ${st}`;
      continue;
    }
    merged.push(st);
  }
  return merged;
}

/** Display segments for monster immunity lines; keeps parenthetical comma lists intact. */
export function expandImmunityDisplaySegments(immunities: string[] | null | undefined): string[] {
  const segments: string[] = [];
  for (const imm of immunities ?? []) {
    segments.push(...splitCommaImmunitySegments(String(imm ?? "")));
  }
  return mergeImmunityCommaFragments(segments);
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
 * Keep `tools/audit-monster-tooltip-terms.mjs` aligned with this module when changing candidate expansion.
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
