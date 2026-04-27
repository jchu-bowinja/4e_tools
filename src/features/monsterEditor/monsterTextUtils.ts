export function isRenderableCardValue(value: string | undefined | null): boolean {
  const normalized = String(value ?? "").trim();
  if (!normalized) return false;
  return normalized.toLowerCase() !== "none";
}

export function normalizeSemicolonWhitespace(value: string): string {
  return value.replace(/\s*;\s*/g, " ").replace(/\s+/g, " ").trim();
}

export function normalizeTextForDupCompare(value: string): string {
  return normalizeSemicolonWhitespace(value)
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Title-case each word for monster stat-block creature type lines (e.g. Huge Immortal Magical Beast). */
export function titleCaseWords(raw: string): string {
  return raw
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/** CamelCase / snake_case → spaced words for stat-block keys (e.g. abilityScores → "ability Scores"). */
export function prettifyMonsterStatKey(label: string): string {
  return label
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const ABILITY_FULL_NAME_TO_DISPLAY: Record<string, string> = {
  strength: "STR",
  str: "STR",
  dexterity: "DEX",
  dex: "DEX",
  constitution: "CON",
  con: "CON",
  intelligence: "INT",
  int: "INT",
  wisdom: "WIS",
  wis: "WIS",
  charisma: "CHA",
  cha: "CHA"
};

/** Glossary lookups still use full PHB-style names where those entries exist. */
const ABILITY_FULL_NAME_TO_GLOSSARY_TERM: Record<string, string> = {
  strength: "Strength",
  str: "Strength",
  dexterity: "Dexterity",
  dex: "Dexterity",
  constitution: "Constitution",
  con: "Constitution",
  intelligence: "Intelligence",
  int: "Intelligence",
  wisdom: "Wisdom",
  wis: "Wisdom",
  charisma: "Charisma",
  cha: "Charisma"
};

/** Short labels on the monster sheet (STR/DEX/…) while preserving non-ability keys. */
export function formatMonsterStatLabelForDisplay(rawKey: string): string {
  const pretty = prettifyMonsterStatKey(rawKey);
  const abbr = ABILITY_FULL_NAME_TO_DISPLAY[pretty.toLowerCase()];
  if (abbr) return abbr;
  return pretty;
}

/** Canonical term for `glossaryTerm:*` hover keys — full ability names when the key is an ability. */
export function monsterStatGlossaryTermForKey(rawKey: string): string {
  const pretty = prettifyMonsterStatKey(rawKey);
  const gloss = ABILITY_FULL_NAME_TO_GLOSSARY_TERM[pretty.toLowerCase()];
  if (gloss) return gloss;
  return pretty;
}

/** STR/DEX/… when `rawKey` names an ability (used for rules-index tooltip fallback). */
export function monsterAbilityAbbrevFromStatKey(rawKey: string): string | null {
  const pretty = prettifyMonsterStatKey(rawKey);
  return ABILITY_FULL_NAME_TO_DISPLAY[pretty.toLowerCase()] ?? null;
}

export function formatMonsterCreatureTypeLine(monster: {
  size?: string;
  origin?: string;
  type?: string;
  keywords?: string[];
}): string {
  const core = [monster.size, monster.origin, monster.type]
    .map((p) => String(p ?? "").trim())
    .filter(Boolean)
    .join(" ");
  const coreFormatted = core ? titleCaseWords(core) : "";
  const kwList = Array.isArray(monster.keywords) ? monster.keywords : [];
  if (kwList.length === 0) return coreFormatted;
  const kw = kwList
    .map((k) => titleCaseWords(String(k).trim()))
    .filter(Boolean)
    .join(", ");
  if (!kw) return coreFormatted;
  return coreFormatted ? `${coreFormatted} (${kw})` : `(${kw})`;
}

/** Split range/area text so glossary hover applies only to wording before the first digit (sizes/distances stay plain). */
export type MonsterAttackRangeLineGlossarySplit =
  | { kind: "prefix"; glossary: string; tail: string }
  | { kind: "full"; text: string };

export function splitMonsterAttackRangeLineForGlossary(part: string): MonsterAttackRangeLineGlossarySplit {
  const raw = String(part ?? "");
  const trimmedStart = raw.trimStart();
  if (!trimmedStart) return { kind: "full", text: raw };

  // Bonus lines (+N vs defense), not attack range/type
  if (!/^[A-Za-z]/.test(trimmedStart)) {
    return { kind: "full", text: raw };
  }
  if (/\bvs\b/i.test(raw)) {
    return { kind: "full", text: raw };
  }

  const firstDigit = raw.search(/\d/);
  if (firstDigit === -1) {
    return { kind: "prefix", glossary: raw.trim(), tail: "" };
  }

  const glossary = raw.slice(0, firstDigit).trim();
  const tail = raw.slice(firstDigit).trimStart();
  if (!glossary) {
    return { kind: "full", text: raw };
  }
  return { kind: "prefix", glossary, tail };
}

/** Segments for attack bonus lines: plain text plus defense term (only the defense gets glossary hover). */
export type AttackLineVsDefenseSegment =
  | { kind: "text"; value: string }
  | { kind: "defenseTerm"; value: string };

/**
 * Parses `29 vs reflex`, `+10 vs AC`, or `29 vs reflex * 29 vs fortitude` into plain / defense pieces.
 * Returns null if the string is not an all-chunks `bonus vs defense` pattern (caller falls back to other rendering).
 */
export function parseAttackLineVsDefenseHighlightSegments(part: string): AttackLineVsDefenseSegment[] | null {
  const trimmed = String(part ?? "").trim();
  if (!trimmed || !/\bvs\b/i.test(trimmed)) return null;

  const chunks = trimmed.split(/\s*\*\s*/).map((c) => c.trim()).filter(Boolean);
  if (chunks.length === 0) return null;

  const segments: AttackLineVsDefenseSegment[] = [];
  const chunkPattern = /^(.+?)\s+vs\.?\s+(.+)$/i;

  for (let i = 0; i < chunks.length; i++) {
    const m = chunks[i].match(chunkPattern);
    if (!m) return null;
    const before = m[1].trim();
    const defense = m[2].trim();
    if (!before || !defense) return null;

    if (i > 0) segments.push({ kind: "text", value: " * " });
    segments.push({ kind: "text", value: `${before} vs ` });
    segments.push({ kind: "defenseTerm", value: defense });
  }

  return segments.length > 0 ? segments : null;
}
