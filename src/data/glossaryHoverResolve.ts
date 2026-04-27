import type { RulesIndex } from "../rules/models";
import {
  abilityTooltipResolveTerms,
  resolveTooltipText,
  tooltipTextForAbilityByCode,
  tooltipTextForSkillById
} from "./tooltipGlossary";

/** Glossary lookup term lists shared by Builder, Character Sheet, and Monster Editor. */
export const POWER_USAGE_LOOKUP_TERMS: Record<"atWill" | "encounter" | "daily", string[]> = {
  atWill: ["At-Will", "At-Will Power", "At Will"],
  encounter: ["Encounter", "Encounter Power"],
  daily: ["Daily", "Daily Power"]
};

export function powerKeywordLookupTerms(keyword: string): string[] {
  const k = keyword.trim();
  return k ? [k, "Keyword"] : ["Keyword"];
}

export function conditionLookupTerms(condition: string): string[] {
  const c = condition.trim();
  return c ? [c, "Condition"] : ["Condition"];
}

/** Static glossary keys for summary blocks (character sheet). */
export const SHEET_CORE_UI_TERMS: Record<
  | "level"
  | "hp"
  | "tempHp"
  | "surges"
  | "surgeValue"
  | "bloodied"
  | "dying"
  | "dead"
  | "speed"
  | "initiative"
  | "defenses"
  | "ac"
  | "fortitude"
  | "reflex"
  | "will"
  | "deathSaves"
  | "skills"
  | "abilityScores",
  string[]
> = {
  level: ["Level"],
  hp: ["Hit Points", "HP"],
  tempHp: ["Temporary Hit Points", "Temp HP"],
  surges: ["Healing Surges", "Healing Surge"],
  surgeValue: ["Surge Value", "Healing Surge Value"],
  bloodied: ["Bloodied"],
  dying: ["Dying"],
  dead: ["Dead"],
  speed: ["Speed"],
  initiative: ["Initiative"],
  defenses: ["Defense", "Defenses"],
  ac: ["Armor Class", "AC"],
  fortitude: ["Fortitude"],
  reflex: ["Reflex"],
  will: ["Will"],
  deathSaves: ["Death Saving Throw", "Death Save"],
  skills: ["Skills", "Skill"],
  abilityScores: ["Ability Scores", "Ability Score"]
};

/** Static glossary keys for summary blocks (character builder — includes race/class placeholders). */
export function builderCoreUiTerms(params: {
  selectedRaceName?: string | null;
  selectedClassName?: string | null;
}): Record<
  | "race"
  | "class"
  | "level"
  | "hp"
  | "surges"
  | "surgeValue"
  | "skills"
  | "abilityScores"
  | "ac"
  | "fortitude"
  | "reflex"
  | "will"
  | "speed"
  | "initiative",
  string[]
> {
  return {
    race: [params.selectedRaceName || "", "Race"].filter(Boolean),
    class: [params.selectedClassName || "", "Class"].filter(Boolean),
    level: ["Level"],
    hp: ["Hit Points", "HP"],
    surges: ["Healing Surges", "Healing Surge"],
    surgeValue: ["Surge Value", "Healing Surge Value"],
    skills: ["Skill", "Skills"],
    abilityScores: ["Ability Score", "Ability Scores"],
    ac: ["Armor Class", "AC"],
    fortitude: ["Fortitude"],
    reflex: ["Reflex"],
    will: ["Will"],
    speed: ["Speed"],
    initiative: ["Initiative"]
  };
}

export type UiGlossaryHoverContext = {
  glossaryByName: Record<string, string>;
  index: RulesIndex;
  selectedRaceName?: string | null;
  selectedClassName?: string | null;
};

/**
 * Plain-text tooltip body for Builder / Character Sheet hover keys (`powerKeyword:`, `ability:`, …).
 * `surface` selects which static core-term map applies where Builder and Sheet differ (term order).
 */
export function resolveUiGlossaryHoverPlainText(
  key: string,
  ctx: UiGlossaryHoverContext,
  surface: "builder" | "sheet"
): string | null {
  if (key.startsWith("powerKeyword:")) {
    const keyword = key.slice("powerKeyword:".length).trim();
    return resolveTooltipText({
      terms: powerKeywordLookupTerms(keyword),
      glossaryByName: ctx.glossaryByName
    });
  }
  if (key.startsWith("powerUsage:")) {
    const usage = key.slice("powerUsage:".length).trim();
    if (usage === "atWill" || usage === "encounter" || usage === "daily") {
      return resolveTooltipText({
        terms: POWER_USAGE_LOOKUP_TERMS[usage],
        glossaryByName: ctx.glossaryByName
      });
    }
    return null;
  }
  if (key.startsWith("ability:")) {
    const code = key.slice("ability:".length).trim();
    const entry = ctx.index.abilityScores.find((e) => e.abilityCode === code.toUpperCase());
    const terms = abilityTooltipResolveTerms(code, entry?.name);
    let resolved = resolveTooltipText({ terms, glossaryByName: ctx.glossaryByName });
    if (!resolved) resolved = tooltipTextForAbilityByCode(ctx.index, code);
    return resolved;
  }
  if (key.startsWith("skill:")) {
    const skillId = key.slice("skill:".length);
    const skill = ctx.index.skills.find((s) => s.id === skillId);
    let resolved = resolveTooltipText({
      terms: [skill?.name || ""].filter(Boolean),
      glossaryByName: ctx.glossaryByName
    });
    if (!resolved) resolved = tooltipTextForSkillById(ctx.index, skillId);
    return resolved;
  }
  if (key.startsWith("condition:")) {
    const condition = key.slice("condition:".length).trim();
    return resolveTooltipText({
      terms: conditionLookupTerms(condition),
      glossaryByName: ctx.glossaryByName
    });
  }

  if (surface === "builder") {
    const builderMap = builderCoreUiTerms({
      selectedRaceName: ctx.selectedRaceName,
      selectedClassName: ctx.selectedClassName
    });
    if (key in builderMap) {
      const terms = builderMap[key as keyof typeof builderMap];
      return resolveTooltipText({ terms, glossaryByName: ctx.glossaryByName });
    }
  }
  if (surface === "sheet" && key in SHEET_CORE_UI_TERMS) {
    const terms = SHEET_CORE_UI_TERMS[key as keyof typeof SHEET_CORE_UI_TERMS];
    return resolveTooltipText({ terms, glossaryByName: ctx.glossaryByName });
  }
  return null;
}

/** Whether inline power-text token has a glossary (or builtin synonym) hit — matches floating panel resolution. */
export function termHasPowerKeywordTooltipBody(term: string, glossaryByName: Record<string, string>): boolean {
  return Boolean(
    resolveTooltipText({
      terms: powerKeywordLookupTerms(term),
      glossaryByName
    })
  );
}
