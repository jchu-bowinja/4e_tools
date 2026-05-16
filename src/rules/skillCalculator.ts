import type { Ability, CharacterBuild, RulesIndex, Skill } from "./models";

function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2);
}

function skillAbilityCode(skill: Skill): keyof CharacterBuild["abilityScores"] | undefined {
  const k = String(skill.keyAbility || "").trim().toLowerCase();
  const map: Record<string, keyof CharacterBuild["abilityScores"]> = {
    strength: "STR",
    dexterity: "DEX",
    constitution: "CON",
    intelligence: "INT",
    wisdom: "WIS",
    charisma: "CHA"
  };
  return map[k];
}

/**
 * Armor check penalty applies only to Strength- and Dexterity-based skills, and only if the skill is not trained.
 */
export function armorCheckSkillDelta(skill: Skill, armorCheckPenalty: number, trained: boolean): number {
  if (armorCheckPenalty <= 0 || trained) return 0;
  const code = skillAbilityCode(skill);
  if (code === "STR" || code === "DEX") return -armorCheckPenalty;
  return 0;
}

export interface SkillSheetRow {
  skillId: string;
  name: string;
  modifier: number;
  trained: boolean;
  abilityCode?: Ability;
  halfLevel: number;
  abilityMod: number;
  trainedBonus: number;
  armorCheckDelta: number;
  flatBonus: number;
}

export function formatSkillTotalCell(n: number): string {
  return n >= 0 ? `+${n}` : String(n);
}

/** Component column: plain integer (0, 5, -2). */
export function formatSkillComponentCell(n: number): string {
  return String(n);
}

export function skillArmorPenaltyApplies(row: Pick<SkillSheetRow, "abilityCode" | "trained">): boolean {
  if (row.trained) return false;
  return row.abilityCode === "STR" || row.abilityCode === "DEX";
}

export function formatSkillArmorCell(row: Pick<SkillSheetRow, "armorCheckDelta" | "abilityCode" | "trained">): string {
  if (!skillArmorPenaltyApplies(row)) return "—";
  return formatSkillComponentCell(row.armorCheckDelta);
}

export function formatSkillMiscCell(flatBonus: number): string {
  return flatBonus === 0 ? "—" : formatSkillComponentCell(flatBonus);
}

/** Half-level + ability + trained (+5). Trained characters ignore armor check penalty on skills. */
export function computeSkillSheetRows(
  index: RulesIndex,
  level: number,
  effectiveAbilityScores: Record<Ability, number>,
  trainedSkillIdSet: Set<string>,
  armorCheckPenalty = 0,
  skillFlatBonuses?: Record<string, number>
): SkillSheetRow[] {
  const halfLevel = Math.floor(level / 2);
  const rows: SkillSheetRow[] = [];
  for (const skill of index.skills) {
    const trained = trainedSkillIdSet.has(skill.id);
    const code = skillAbilityCode(skill);
    const score = code ? effectiveAbilityScores[code] ?? 10 : 10;
    const abil = abilityMod(score);
    const trainedBonus = trained ? 5 : 0;
    const armorCheckDelta = armorCheckSkillDelta(skill, armorCheckPenalty, trained);
    const flatBonus = skillFlatBonuses?.[skill.id] ?? 0;
    const base = halfLevel + abil;
    rows.push({
      skillId: skill.id,
      name: skill.name,
      modifier: base + trainedBonus + armorCheckDelta + flatBonus,
      trained,
      abilityCode: code,
      halfLevel,
      abilityMod: abil,
      trainedBonus,
      armorCheckDelta,
      flatBonus
    });
  }

  return rows.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}
