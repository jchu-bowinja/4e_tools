import type {
  MonsterEntryFile,
  MonsterPower,
  MonsterTemplateRecord,
  MonsterTrait,
  MonsterStats
} from "./storage";

const NO_POWERS_STUB: MonsterPower = {
  name: "(No powers in source JSON)",
  usage: "—",
  action: "No action",
  keywords: "",
  description:
    "This monster entry had no powers. Remove this stub or add real powers before publishing a template."
};

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function sourceBookFromEntry(entry: MonsterEntryFile): string {
  const books = entry.sourceBooks;
  if (Array.isArray(books) && books.length > 0) {
    const joined = books
      .map((b) => String(b).trim())
      .filter((s) => s.length > 0)
      .join("; ");
    if (joined) return joined;
  }
  const origin = String(entry.origin ?? "").trim();
  return origin || "monster export";
}

function roleLineFromEntry(entry: MonsterEntryFile): string {
  const level = entry.level;
  const role = String(entry.role ?? "").trim();
  const leader = entry.isLeader === true ? " (Leader)" : "";
  const bits: string[] = [];
  if (level !== undefined && level !== null && String(level).trim() !== "") {
    bits.push(`Level ${level}`);
  }
  if (role) bits.push(role);
  const base = bits.join(" ").trim();
  if (base) return base + leader;
  const gr = String(entry.groupRole ?? "").trim();
  if (gr) return gr + leader;
  if (leader.trim()) return leader.trim();
  return "Imported monster";
}

function descriptionFromEntry(entry: MonsterEntryFile): string | undefined {
  const d = String(entry.description ?? "").trim();
  const t = String(entry.tactics ?? "").trim();
  if (d && t) return `${d}\n\nTactics: ${t}`;
  return d || t || undefined;
}

function formatNumberMapLine(title: string, rec: Record<string, number | string> | undefined): string | null {
  if (!rec) return null;
  const parts = Object.entries(rec)
    .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== "")
    .map(([k, v]) => `${k} ${v}`);
  if (parts.length === 0) return null;
  return `${title} ${parts.join(", ")}`;
}

function formatOtherNumbers(stats: MonsterStats | undefined): string[] {
  const raw = stats?.otherNumbers;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const [k, v] of Object.entries(raw)) {
    if (v === undefined || v === null) continue;
    if (typeof v === "object") continue;
    const s = String(v).trim();
    if (!s) continue;
    out.push(`${k} ${s}`);
  }
  return out;
}

function buildStatLines(entry: MonsterEntryFile): string[] {
  const stats = entry.stats;
  const lines: string[] = [];

  const abs = formatNumberMapLine("Ability scores", stats?.abilityScores);
  if (abs) lines.push(abs);

  const def = formatNumberMapLine("Defenses", stats?.defenses);
  if (def) lines.push(def);

  const atk = formatNumberMapLine("Attack bonuses", stats?.attackBonuses);
  if (atk) lines.push(atk);

  const sk = formatNumberMapLine("Skills", stats?.skills);
  if (sk) lines.push(sk);

  lines.push(...formatOtherNumbers(stats));

  return lines;
}

/**
 * Converts a loaded monster compendium entry into the shape used by monster templates
 * (create-template JSON, custom templates, `generated/monster_templates.json`).
 */
export function monsterEntryToTemplateRecord(entry: MonsterEntryFile): MonsterTemplateRecord {
  const auras = cloneTraits(entry.auras);
  const traits = cloneTraits(entry.traits);
  const powers = clonePowers(entry.powers);

  const statLines = buildStatLines(entry);
  const stats: Record<string, unknown> = {
    monsterExport: {
      monsterId: entry.id,
      relativePath: entry.relativePath,
      level: entry.level,
      xp: entry.xp,
      role: entry.role,
      isLeader: entry.isLeader === true,
      groupRole: entry.groupRole,
      alignment: entry.alignment,
      keywords: entry.keywords,
      languages: entry.languages,
      senses: entry.senses,
      resistances: entry.resistances,
      weaknesses: entry.weaknesses,
      immunities: entry.immunities,
      regeneration: entry.regeneration,
      items: entry.items,
      phasing: entry.phasing,
      compendiumUrl: entry.compendiumUrl,
      monsterStats: entry.stats != null ? deepClone(entry.stats) : undefined
    }
  };

  return {
    templateName: String(entry.name ?? "").trim() || "Unnamed monster",
    sourceBook: sourceBookFromEntry(entry),
    ...(Array.isArray(entry.keywords) && entry.keywords.length > 0 ? { keywords: [...entry.keywords] } : {}),
    description: descriptionFromEntry(entry),
    roleLine: roleLineFromEntry(entry),
    statLines: statLines.length > 0 ? statLines : undefined,
    stats,
    auras,
    traits,
    powers,
    extractionMethod: "monster-export"
  };
}

function cloneTraits(traits: MonsterTrait[] | undefined): MonsterTrait[] | undefined {
  if (!traits?.length) return undefined;
  return deepClone(traits);
}

function clonePowers(powers: MonsterPower[] | undefined): MonsterPower[] {
  if (!powers?.length) return [NO_POWERS_STUB];
  return deepClone(powers);
}
