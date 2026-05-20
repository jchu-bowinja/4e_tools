import type { CharacterBuild, RulesIndex } from "./models";
import { getRaceSecondarySelectSlots } from "./raceRuleSelects";

/** Flat +2 from a race `rules.select` Skill Bonus pick (Kalashtar, Shardmind, Thri-Kreen, …). */
export const RACIAL_SKILL_BONUS_PICK_AMOUNT = 2;

const SKILL_TRAINING_KEY_PREFIX = "skillTraining:";

function legalSkillIds(index: Pick<RulesIndex, "skills">): Set<string> {
  return new Set((index.skills ?? []).map((s) => s.id));
}

/**
 * Trained skills chosen on racial traits (`skillTraining:${traitId}:${n}` in `raceSelections`).
 * E.g. Human Bonus Skill, Eladrin Education.
 */
export function collectRacialSkillTrainingIdsFromBuild(
  index: Pick<RulesIndex, "skills">,
  build: Pick<CharacterBuild, "raceSelections">
): string[] {
  const legal = legalSkillIds(index);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const [key, value] of Object.entries(build.raceSelections ?? {})) {
    if (!key.startsWith(SKILL_TRAINING_KEY_PREFIX)) continue;
    const skillId = value?.trim();
    if (!skillId || !legal.has(skillId) || seen.has(skillId)) continue;
    seen.add(skillId);
    out.push(skillId);
  }
  return out;
}

/**
 * Flat skill bonuses from race-level Skill Bonus picks (`skillBonus-0`, … in `raceSelections`).
 * Each pick stores a skill id and grants +2 to that skill (not training).
 */
export function collectRaceSkillBonusFlatBySkillId(
  index: Pick<RulesIndex, "races" | "skills">,
  build: Pick<CharacterBuild, "raceId" | "raceSelections">
): Record<string, number> {
  const race = (index.races ?? []).find((r) => r.id === build.raceId);
  if (!race) return {};
  const legal = legalSkillIds(index);
  const rs = build.raceSelections ?? {};
  const out: Record<string, number> = {};
  for (const slot of getRaceSecondarySelectSlots(race)) {
    if (slot.kind !== "skillBonus") continue;
    const skillId = rs[slot.key]?.trim();
    if (!skillId || !legal.has(skillId)) continue;
    out[skillId] = (out[skillId] ?? 0) + RACIAL_SKILL_BONUS_PICK_AMOUNT;
  }
  return out;
}
