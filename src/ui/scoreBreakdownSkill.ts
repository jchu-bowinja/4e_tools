import type { SkillSheetRow } from "../rules/skillCalculator";
import {
  formatSkillArmorCell,
  formatSkillComponentCell,
  formatSkillMiscCell,
  formatSkillTotalCell
} from "../rules/skillCalculator";
import type { ScoreBreakdownRowDef } from "./ScoreBreakdownTable";

export function skillRowsToBreakdown(rows: SkillSheetRow[]): ScoreBreakdownRowDef[] {
  return rows.map((row) => ({
    rowKey: row.skillId,
    label: row.name,
    total: row.modifier,
    values: {
      abilityMod: row.abilityMod,
      halfLevel: row.halfLevel,
      trainedBonus: row.trainedBonus,
      armor: row.armorCheckDelta,
      misc: row.flatBonus
    }
  }));
}

export function formatSkillBreakdownTotal(row: SkillSheetRow): string {
  return formatSkillTotalCell(row.modifier);
}

export function formatSkillBreakdownComponent(row: SkillSheetRow, columnKey: string): string {
  switch (columnKey) {
    case "abilityMod":
      return formatSkillComponentCell(row.abilityMod);
    case "halfLevel":
      return formatSkillComponentCell(row.halfLevel);
    case "trainedBonus":
      return formatSkillComponentCell(row.trainedBonus);
    case "armor":
      return formatSkillArmorCell(row);
    case "misc":
      return formatSkillMiscCell(row.flatBonus);
    default:
      return "—";
  }
}

export function skillRowMap(rows: SkillSheetRow[]): Map<string, SkillSheetRow> {
  return new Map(rows.map((row) => [row.skillId, row]));
}
