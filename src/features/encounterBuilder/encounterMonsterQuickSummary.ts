import type { MonsterEntryFile } from "../monsterEditor/storage";

function pickFromLowerMap(block: Record<string, unknown>, candidates: string[]): string {
  const lower = new Map(Object.entries(block).map(([k, v]) => [k.toLowerCase(), v]));
  for (const c of candidates) {
    const v = lower.get(c.toLowerCase());
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v);
  }
  return "—";
}

export function monsterQuickHp(m: MonsterEntryFile): string {
  const on = (m.stats?.otherNumbers ?? {}) as Record<string, unknown>;
  return pickFromLowerMap(on, ["hp", "hitPoints", "hit points"]);
}

export function monsterQuickAc(m: MonsterEntryFile): string {
  const def = (m.stats?.defenses ?? {}) as Record<string, unknown>;
  return pickFromLowerMap(def, ["ac", "AC"]);
}

export function formatXpInteger(n: number): string {
  return Math.round(n).toLocaleString();
}

/** Numeric XP for summing; null if missing or not a finite number (e.g. variable text). */
export function parseMonsterXpToNumber(m: Pick<MonsterEntryFile, "xp">): number | null {
  const raw = m.xp;
  if (raw === undefined || raw === null) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw === "boolean") return null;
  const s = String(raw).replace(/,/g, "").trim();
  if (!s || s === "-" || s === "—") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** XP for display: comma-separated integer when numeric, otherwise raw text or em dash. */
export function monsterXpDisplay(m: Pick<MonsterEntryFile, "xp">): string {
  const n = parseMonsterXpToNumber(m);
  if (n !== null) return formatXpInteger(n);
  const raw = m.xp;
  if (raw === undefined || raw === null) return "—";
  const s = String(raw).trim();
  return s || "—";
}
