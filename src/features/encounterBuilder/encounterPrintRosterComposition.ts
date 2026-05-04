import type { EncounterRosterRow } from "./encounterStorage";
import { detectMonsterRank } from "../monsterEditor/monsterIndexFilters";
import { clampMonsterLevelDelta, parseMonsterLevel } from "../monsterEditor/monsterLevelDelta";
import type { MonsterEntryFile } from "../monsterEditor/storage";
import { titleCaseWords } from "../monsterEditor/monsterTextUtils";

/** Effective level for roster summary (base stat-block level + clamped quick adjustment). */
export function effectiveEncounterRowLevel(row: EncounterRosterRow): number | undefined {
  const base = parseMonsterLevel(row.snapshot.level);
  if (base === undefined || !Number.isFinite(base)) return undefined;
  const requested =
    typeof row.levelAdjustment === "number" && Number.isFinite(row.levelAdjustment) ? Math.trunc(row.levelAdjustment) : 0;
  const delta = clampMonsterLevelDelta(base, requested);
  return base + delta;
}

function leaderTagIfNeeded(isLeader: boolean | undefined, role: string | undefined | null): string {
  if (isLeader !== true) return "";
  if (/\(leader\)/i.test(String(role ?? "").trim())) return "";
  return " (Leader)";
}

/** Combat role for print lines: strip “(Leader)” and a duplicate leading tier word (Elite/Solo/…). */
export function combatRoleForPrint(snapshot: MonsterEntryFile): string {
  let r = String(snapshot.role ?? "").replace(/\s*\(leader\)\s*$/i, "").trim();
  if (!r) return "—";
  const stripped = r.replace(/^(elite|solo|minion|standard)\s+/i, "").trim();
  const use = stripped.length > 0 ? stripped : r;
  return titleCaseWords(use) || "—";
}

function rankWordForPrint(rank: ReturnType<typeof detectMonsterRank>): string {
  switch (rank) {
    case "solo":
      return "Solo";
    case "elite":
      return "Elite";
    case "minion":
      return "Minion";
    default:
      return "Standard";
  }
}

type GroupKey = string;

/** Same grouping as creature summary lines — identical cards for print preview / printed sheet. */
export function encounterPrintCreatureGroupKey(row: EncounterRosterRow): GroupKey {
  const s = row.snapshot;
  const eff = effectiveEncounterRowLevel(row);
  const rank = detectMonsterRank(s);
  const roleClean = combatRoleForPrint(s);
  const leader = s.isLeader === true ? "L" : "n";
  const name = String(s.name ?? "").trim();
  return [name, eff === undefined ? "?" : String(eff), rank, roleClean, leader].join("\0");
}

/** Map page/column break flags onto the first roster row per creature group so margins match deduped DOM. */
export function mergeEncounterPrintBreakIdsForDedupedCards(rows: EncounterRosterRow[], ids: Set<string>): Set<string> {
  const next = new Set<string>();
  const keyToCanonicalId = new Map<GroupKey, string>();
  for (const row of rows) {
    const k = encounterPrintCreatureGroupKey(row);
    if (!keyToCanonicalId.has(k)) keyToCanonicalId.set(k, row.rosterInstanceId);
  }
  for (const id of ids) {
    const row = rows.find((r) => r.rosterInstanceId === id);
    if (!row) continue;
    const k = encounterPrintCreatureGroupKey(row);
    const canon = keyToCanonicalId.get(k);
    if (canon) next.add(canon);
  }
  return next;
}

/**
 * One line per distinct creature grouping (name, level, rank, role, leader), with counts merged.
 * Format: `{n} x {Name} Level {L} {Rank} {Role}{(Leader)}`
 */
export function buildEncounterPrintCreatureListLines(rows: EncounterRosterRow[]): string[] {
  if (rows.length === 0) return [];

  const order: GroupKey[] = [];
  const agg = new Map<GroupKey, { count: number; row: EncounterRosterRow }>();

  for (const row of rows) {
    const key = encounterPrintCreatureGroupKey(row);
    const prev = agg.get(key);
    if (prev) {
      prev.count += 1;
    } else {
      order.push(key);
      agg.set(key, { count: 1, row });
    }
  }

  return order.map((key) => {
    const entry = agg.get(key);
    if (!entry) return "";
    const { count, row } = entry;
    const s = row.snapshot;
    const eff = effectiveEncounterRowLevel(row);
    const lv = eff === undefined ? "—" : String(eff);
    const rankW = rankWordForPrint(detectMonsterRank(s));
    const roleW = combatRoleForPrint(s);
    const leader = leaderTagIfNeeded(s.isLeader, s.role);
    const name = String(s.name ?? "").trim() || "—";
    return `${count} x ${name} Level ${lv} ${rankW} ${roleW}${leader}`;
  });
}
