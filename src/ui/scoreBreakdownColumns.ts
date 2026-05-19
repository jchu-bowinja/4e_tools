import type { ScoreBreakdownColumnDef } from "./ScoreBreakdownTable";

/** Fixed component columns for the skills breakdown table. */
export const SKILL_BREAKDOWN_COLUMNS: ScoreBreakdownColumnDef[] = [
  { key: "abilityMod", header: "Abil", width: "1.85rem" },
  { key: "halfLevel", header: ["½", "Lvl"], width: "1.85rem" },
  { key: "trainedBonus", header: ["Trnd", "(+5)"], width: "2.15rem" },
  { key: "armor", header: ["Armor", "Penalty"], width: "3.15rem" },
  { key: "misc", header: "Misc", width: "1.95rem" }
];

/** Wide-layout grid template (exported for tests or layout tooling). */
export const SKILL_MODIFIER_TABLE_COLUMNS =
  "minmax(2.35rem, max-content) minmax(var(--score-breakdown-label-width, max-content), 1fr) 1.85rem 1.85rem 2.15rem 3.15rem 1.95rem";
