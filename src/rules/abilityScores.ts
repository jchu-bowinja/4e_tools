import { Ability, Race } from "./models";
import { abilitiesFromRaceAbilitySelects } from "./raceRuleSelects";

const ABILITY_LABELS: Record<Ability, string> = {
  STR: "Strength",
  CON: "Constitution",
  DEX: "Dexterity",
  INT: "Intelligence",
  WIS: "Wisdom",
  CHA: "Charisma"
};

const LABEL_TO_ABILITY: Record<string, Ability> = {
  strength: "STR",
  constitution: "CON",
  dexterity: "DEX",
  intelligence: "INT",
  wisdom: "WIS",
  charisma: "CHA"
};

export interface RaceAbilityBonusInfo {
  fixed: Ability[];
  chooseOne: Ability[];
}

const ABILITY_NAME_PATTERN = "(Strength|Constitution|Dexterity|Intelligence|Wisdom|Charisma)";

/** Pull a single ability from a short clause like "+2 Dexterity" or "Dexterity" (data sometimes omits +2 on the second option). */
function abilityFromClause(clause: string): Ability | undefined {
  const trimmed = clause.trim();
  const withBonus = new RegExp(`\\+2\\s+${ABILITY_NAME_PATTERN}\\b`, "i").exec(trimmed);
  if (withBonus) {
    return LABEL_TO_ABILITY[withBonus[1].toLowerCase()];
  }
  const bare = new RegExp(`^${ABILITY_NAME_PATTERN}\\b`, "i").exec(trimmed);
  if (bare) {
    return LABEL_TO_ABILITY[bare[1].toLowerCase()];
  }
  return undefined;
}

/**
 * Parses PHB-style racial ability lines. Data uses comma/semicolon between clauses; "or" marks alternatives
 * for a single +2 choice (e.g. "+2 Dexterity, +2 Charisma or +2 Constitution" → +2 DEX automatic, choose CHA or CON).
 */
export function parseRaceAbilityBonusInfo(race: Race | undefined): RaceAbilityBonusInfo {
  const text = String((race?.raw?.specific as Record<string, unknown> | undefined)?.["Ability Scores"] || "").trim();
  if (!text) {
    return { fixed: [], chooseOne: [] };
  }

  if (/see\s+the\s+race\s+chosen/i.test(text)) {
    return { fixed: [], chooseOne: [] };
  }

  if (/\+2\s+to\s+one\s+ability\s+score\s+of\s+your\s+choice/i.test(text)) {
    return { fixed: [], chooseOne: ["STR", "CON", "DEX", "INT", "WIS", "CHA"] };
  }

  const normalized = text.replace(/;/g, ",");
  const segments = normalized
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const fixed: Ability[] = [];
  const chooseOne: Ability[] = [];

  for (const segment of segments) {
    if (/\s+or\s+/i.test(segment)) {
      const parts = segment.split(/\s+or\s+/i).map((p) => p.trim()).filter(Boolean);
      for (const part of parts) {
        const ab = abilityFromClause(part);
        if (ab && !chooseOne.includes(ab)) {
          chooseOne.push(ab);
        }
      }
    } else {
      const ab = abilityFromClause(segment);
      if (ab) {
        fixed.push(ab);
      }
    }
  }

  const fixedUnique = [...new Set(fixed)];
  const fixedSet = new Set(fixedUnique);
  const chooseFiltered = chooseOne.filter((a) => !fixedSet.has(a));

  let mergedChoose = [...new Set(chooseFiltered)];
  const fromSelect = abilitiesFromRaceAbilitySelects(race);
  if (fromSelect.length > 0 && mergedChoose.length === 0) {
    mergedChoose = [...new Set(fromSelect.filter((a) => !fixedSet.has(a)))];
  }

  return {
    fixed: fixedUnique,
    chooseOne: mergedChoose
  };
}

export function getAbilityLabel(ability: Ability): string {
  return ABILITY_LABELS[ability];
}

export function applyRacialBonuses(
  baseScores: Record<Ability, number>,
  info: RaceAbilityBonusInfo,
  choice: Ability | undefined
): Record<Ability, number> {
  const next = { ...baseScores };
  for (const ability of info.fixed) {
    next[ability] += 2;
  }
  if (choice && info.chooseOne.includes(choice)) {
    next[choice] += 2;
  }
  return next;
}

