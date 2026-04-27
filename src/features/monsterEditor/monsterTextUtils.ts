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
