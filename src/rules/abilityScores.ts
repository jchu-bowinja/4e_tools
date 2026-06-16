import { Ability, Race, RacialTrait } from "./models";
import {
  abilitiesFromRaceAbilityGrantRules,
  abilitiesFromRaceAbilitySelectRules,
  abilitiesFromRaceAbilitySelects
} from "./raceRuleSelects";
import { getRaceSubraceData, getStructuralChildTraitIdsForSubrace } from "./raceSubraces";

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

function raceAbilityScoresText(race: Race | undefined): string {
  return String((race?.raw?.specific as Record<string, unknown> | undefined)?.["Ability Scores"] || "").trim();
}

export function raceDefersAbilityBonusToSubrace(race: Race | undefined): boolean {
  if (race?.abilityBonusSource === "subrace") return true;
  return /see\s+the\s+race\s+chosen/i.test(raceAbilityScoresText(race));
}

/** Parses PHB-style ability score lines from `specific["Ability Scores"]` text. */
export function parseAbilityScoresText(text: string): RaceAbilityBonusInfo {
  const trimmed = text.trim();
  if (!trimmed) {
    return { fixed: [], chooseOne: [] };
  }

  if (/see\s+the\s+race\s+chosen/i.test(trimmed)) {
    return { fixed: [], chooseOne: [] };
  }

  if (/\+2\s+to\s+one\s+ability\s+score\s+of\s+your\s+choice/i.test(trimmed)) {
    return { fixed: [], chooseOne: ["STR", "CON", "DEX", "INT", "WIS", "CHA"] };
  }

  const normalized = trimmed.replace(/;/g, ",");
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

  return {
    fixed: fixedUnique,
    chooseOne: [...new Set(chooseFiltered)]
  };
}

export function mergeRaceAbilityBonusInfo(...parts: RaceAbilityBonusInfo[]): RaceAbilityBonusInfo {
  const fixed = [...new Set(parts.flatMap((p) => p.fixed))];
  const fixedSet = new Set(fixed);
  const chooseOne = [...new Set(parts.flatMap((p) => p.chooseOne).filter((a) => !fixedSet.has(a)))];
  return { fixed, chooseOne };
}

/** Ability bonuses encoded on a racial trait row (`rules.grant` / `rules.select` and optional specific text). */
export function parseAbilityBonusFromRacialTrait(trait: RacialTrait | undefined): RaceAbilityBonusInfo {
  if (!trait) return { fixed: [], chooseOne: [] };

  const text = String((trait.raw?.specific as Record<string, unknown> | undefined)?.["Ability Scores"] || "").trim();
  const fromText = text && !/see\s+the\s+race\s+chosen/i.test(text) ? parseAbilityScoresText(text) : { fixed: [], chooseOne: [] };

  const rules = trait.raw?.rules as Record<string, unknown> | undefined;
  const fromGrants = abilitiesFromRaceAbilityGrantRules(rules);
  const fromSelect = abilitiesFromRaceAbilitySelectRules(rules);

  const fixed = [...new Set([...fromText.fixed, ...fromGrants])];
  const fixedSet = new Set(fixed);
  const chooseOne = [...new Set([...fromText.chooseOne, ...fromSelect].filter((a) => !fixedSet.has(a)))];

  return { fixed, chooseOne };
}

/**
 * Parses PHB-style racial ability lines. Data uses comma/semicolon between clauses; "or" marks alternatives
 * for a single +2 choice (e.g. "+2 Dexterity, +2 Charisma or +2 Constitution" → +2 DEX automatic, choose CHA or CON).
 */
export function parseRaceAbilityBonusInfo(race: Race | undefined): RaceAbilityBonusInfo {
  const text = raceAbilityScoresText(race);
  const fromText = parseAbilityScoresText(text);

  const fixedUnique = [...new Set(fromText.fixed)];
  const fixedSet = new Set(fixedUnique);
  let mergedChoose = [...new Set(fromText.chooseOne.filter((a) => !fixedSet.has(a)))];
  const fromSelect = abilitiesFromRaceAbilitySelects(race);
  if (fromSelect.length > 0 && mergedChoose.length === 0) {
    mergedChoose = [...new Set(fromSelect.filter((a) => !fixedSet.has(a)))];
  }

  return {
    fixed: fixedUnique,
    chooseOne: mergedChoose
  };
}

/**
 * Resolves racial +2 bonuses for the build, including Dragonborn-style variants where the race row says
 * "See the Race Chosen" and the selected subrace trait supplies grants/selects.
 */
export function resolveRaceAbilityBonusInfo(
  race: Race | undefined,
  traitsById: Map<string, RacialTrait>,
  raceSelections?: Record<string, string>
): RaceAbilityBonusInfo {
  const base = parseRaceAbilityBonusInfo(race);
  const defers = raceDefersAbilityBonusToSubrace(race);
  if (!defers && (base.fixed.length > 0 || base.chooseOne.length > 0)) {
    return base;
  }
  if (!defers) {
    return base;
  }

  const subraceData = getRaceSubraceData(race, traitsById);
  const subPick = raceSelections?.["subrace"];
  const selectedSubrace =
    subPick && subraceData ? subraceData.options.find((o) => o.id === subPick) : undefined;
  if (!selectedSubrace) {
    return { fixed: [], chooseOne: [] };
  }

  const traitsToParse: RacialTrait[] = [selectedSubrace];
  for (const childId of getStructuralChildTraitIdsForSubrace(selectedSubrace)) {
    const child = traitsById.get(childId);
    if (child) traitsToParse.push(child);
  }

  return mergeRaceAbilityBonusInfo(...traitsToParse.map(parseAbilityBonusFromRacialTrait));
}

export function getAbilityLabel(ability: Ability): string {
  return ABILITY_LABELS[ability];
}

/** Human-readable summary of fixed and optional racial +2 bonuses. */
export function formatRaceAbilityBonusSummary(info: RaceAbilityBonusInfo): string {
  const parts: string[] = info.fixed.map((a) => `+2 ${getAbilityLabel(a)}`);
  if (info.chooseOne.length > 0) {
    const opts = info.chooseOne.map((a) => getAbilityLabel(a)).join(" or ");
    parts.push(`+2 ${opts}`);
  }
  return parts.join(", ");
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

