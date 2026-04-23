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
}

/** Half-level + ability + trained (+5). Trained characters ignore armor check penalty on skills. */
export function computeSkillSheetRows(
  index: RulesIndex,
  level: number,
  effectiveAbilityScores: Record<Ability, number>,
  trainedSkillIdSet: Set<string>,
  armorCheckPenalty = 0
): SkillSheetRow[] {
  const halfLevel = Math.floor(level / 2);
  const rows: SkillSheetRow[] = [];
  for (const skill of index.skills) {
    const trained = trainedSkillIdSet.has(skill.id);
    const code = skillAbilityCode(skill);
    const score = code ? effectiveAbilityScores[code] ?? 10 : 10;
    const base = halfLevel + abilityMod(score);
    rows.push({
      skillId: skill.id,
      name: skill.name,
      modifier: base + (trained ? 5 : 0) + armorCheckSkillDelta(skill, armorCheckPenalty, trained),
      trained
    });
  }

  return rows.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}
