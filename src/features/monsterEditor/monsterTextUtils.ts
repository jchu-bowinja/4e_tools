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
