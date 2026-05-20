import { Ability, LanguageDef, Race } from "./models";

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

function ruleSelectEntries(race: Race | undefined): unknown[] {
  return ruleSelectEntriesFromRules(race?.raw?.rules as Record<string, unknown> | undefined);
}

export function ruleSelectEntriesFromRules(rules: Record<string, unknown> | undefined): unknown[] {
  const sel = rules?.select;
  return Array.isArray(sel) ? sel : [];
}

function selectAttrs(entry: unknown): Record<string, string> {
  if (!entry || typeof entry !== "object") return {};
  const attrs = (entry as { attrs?: unknown }).attrs;
  if (!attrs || typeof attrs !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(attrs as Record<string, unknown>)) {
    if (v !== undefined && v !== null) out[k] = String(v);
  }
  return out;
}

function selectCount(attrs: Record<string, string>): number {
  const n = Number(attrs.number);
  if (!Number.isFinite(n)) return 1;
  return Math.max(0, Math.floor(n));
}

function abilityFromLabelToken(token: string): Ability | undefined {
  const t = token.trim().toLowerCase();
  return LABEL_TO_ABILITY[t];
}

/** Abilities declared on Race Ability Bonus selects (| separated Category). */
export function abilitiesFromRaceAbilitySelectRules(rules: Record<string, unknown> | undefined): Ability[] {
  const out: Ability[] = [];
  for (const entry of ruleSelectEntriesFromRules(rules)) {
    const attrs = selectAttrs(entry);
    if (attrs.type !== "Race Ability Bonus") continue;
    if (selectCount(attrs) <= 0) continue;
    const cat = attrs.Category;
    if (!cat) continue;
    for (const part of cat.split("|")) {
      const ab = abilityFromLabelToken(part);
      if (ab) out.push(ab);
    }
  }
  return [...new Set(out)];
}

/** Abilities declared on Race Ability Bonus selects (| separated Category). */
export function abilitiesFromRaceAbilitySelects(race: Race | undefined): Ability[] {
  return abilitiesFromRaceAbilitySelectRules(race?.raw?.rules as Record<string, unknown> | undefined);
}

/** Fixed +2 abilities from `rules.grant` type Race Ability Bonus (internal compendium ids). */
export function abilitiesFromRaceAbilityGrantRules(rules: Record<string, unknown> | undefined): Ability[] {
  const grants = (rules?.grant as Array<{ attrs?: Record<string, string> }> | undefined) ?? [];
  const out: Ability[] = [];
  for (const g of grants) {
    if (String(g.attrs?.type ?? "") !== "Race Ability Bonus") continue;
    const ab = abilityFromInternalRaceAbilityGrantName(String(g.attrs?.name ?? ""));
    if (ab) out.push(ab);
  }
  return [...new Set(out)];
}

function abilityFromInternalRaceAbilityGrantName(name: string): Ability | undefined {
  const direct: Record<string, Ability> = {
    ID_INTERNAL_RACE_ABILITY_BONUS_CHARISMA: "CHA",
    ID_INTERNAL_RACE_ABILITY_BONUS_DEXTERITY: "DEX",
    ID_INTERNAL_RACE_ABILITY_BONUS_STRENGTH: "STR",
    ID_INTERNAL_RACE_ABILITY_BONUS_CONSTITUTION: "CON",
    ID_INTERNAL_RACE_ABILITY_BONUS_INTELLIGENCE: "INT",
    ID_INTERNAL_RACE_ABILITY_BONUS_WISDOM: "WIS"
  };
  if (direct[name]) return direct[name];
  const m = /ID_INTERNAL_RACE_ABILITY_BONUS_(\w+)/i.exec(name);
  if (m) return abilityFromLabelToken(m[1]);
  return undefined;
}

export type RaceSecondarySelectKind = "language" | "skillBonus";

export interface RaceSecondarySelectSlot {
  kind: RaceSecondarySelectKind;
  /** Stable key within `raceSelections` for this race. */
  key: string;
  label: string;
}

/**
 * Extra choices from `race.raw.rules.select` (languages, skill bonus traits).
 * Racial +2 ability choice stays on `racialAbilityChoice` / `parseRaceAbilityBonusInfo`.
 */
export function getRaceSecondarySelectSlots(race: Race | undefined): RaceSecondarySelectSlot[] {
  const slots: RaceSecondarySelectSlot[] = [];
  let langIdx = 0;
  let skillIdx = 0;
  for (const entry of ruleSelectEntries(race)) {
    const attrs = selectAttrs(entry);
    const n = selectCount(attrs);
    if (n <= 0) continue;
    if (attrs.type === "Language") {
      const key = `language-${langIdx}`;
      langIdx += 1;
      slots.push({
        kind: "language",
        key,
        label: langIdx === 1 ? "Bonus language" : `Bonus language (${langIdx})`
      });
    } else if (attrs.type === "Racial Trait" && attrs.Category === "Skill Bonus") {
      const key = `skillBonus-${skillIdx}`;
      skillIdx += 1;
      slots.push({
        kind: "skillBonus",
        key,
        label: skillIdx === 1 ? "Racial skill bonus (+2)" : `Racial skill bonus (+2) (${skillIdx})`
      });
    }
  }
  return slots;
}

export function raceSecondarySelectionKeys(race: Race | undefined): string[] {
  return getRaceSecondarySelectSlots(race).map((s) => s.key);
}

/** Languages allowed as a typical 1st-level bonus pick (excludes internal/unselectable rows). */
export function selectableStartingLanguages(languages: LanguageDef[]): LanguageDef[] {
  return languages.filter((l) => {
    const p = (l.prereqsRaw || "").toLowerCase();
    if (p.includes("unselectable")) return false;
    if ((l.name || "").trim().toLowerCase() === "all") return false;
    return true;
  });
}
