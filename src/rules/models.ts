export type Tier = "HEROIC" | "PARAGON" | "EPIC";
export type Ability = "STR" | "CON" | "DEX" | "INT" | "WIS" | "CHA";

export interface PrereqToken {
  kind: "levelAtLeast" | "tier" | "abilityAtLeast" | "trainedSkill" | "race" | "class" | "tag";
  value?: string | number;
  ability?: Ability;
}

export interface RulesEntity {
  id: string;
  name: string;
  slug: string;
  source?: string;
}

export interface Race extends RulesEntity {
  speed?: number | null;
  size?: string | null;
  abilitySummary?: string | null;
  languages?: string | null;
  raw: Record<string, unknown>;
}

export interface ClassDef extends RulesEntity {
  role?: string | null;
  powerSource?: string | null;
  hitPointsAt1?: number | null;
  hitPointsPerLevel?: number | null;
  healingSurgesBase?: number | null;
  keyAbilities?: string | null;
  raw: Record<string, unknown>;
}

export interface Feat extends RulesEntity {
  tier?: string | null;
  category?: string | null;
  tags?: string[] | null;
  shortDescription?: string | null;
  prereqsRaw?: string | null;
  prereqSummary?: string | null;
  prereqTokens: PrereqToken[];
  raw: Record<string, unknown>;
}

export interface Power extends RulesEntity {
  classId?: string | null;
  usage?: string | null;
  level?: number | null;
  keywords?: string | null;
  display?: string | null;
  raw: Record<string, unknown>;
}

export interface Skill extends RulesEntity {
  keyAbility?: string | null;
  raw: Record<string, unknown>;
}

/** Speakable language (for race bonus language picks, etc.). */
export interface LanguageDef extends RulesEntity {
  prereqsRaw?: string | null;
  raw: Record<string, unknown>;
}

export interface Armor extends RulesEntity {
  armorType?: string | null;
  armorCategory?: string | null;
  armorBonus?: number | null;
  checkPenalty?: number | null;
  speedPenalty?: number | null;
  raw: Record<string, unknown>;
}

/** Core rules text for STR, CON, DEX, INT, WIS, CHA (from Ability Score entries). */
export interface AbilityScoreLore extends RulesEntity {
  abilityCode: Ability | null;
  body?: string | null;
  raw: Record<string, unknown>;
}

/** Racial trait (from Racial Trait compendium; referenced by races). */
export interface RacialTrait extends RulesEntity {
  shortDescription?: string | null;
  body?: string | null;
  raw: Record<string, unknown>;
}

/** Character theme (optional background package with prerequisites). */
export interface Theme extends RulesEntity {
  prereqsRaw?: string | null;
  prereqTokens: PrereqToken[];
  raw: Record<string, unknown>;
}

/** Paragon path (11th level+). */
export interface ParagonPath extends RulesEntity {
  prereqsRaw?: string | null;
  prereqTokens: PrereqToken[];
  raw: Record<string, unknown>;
}

/** Epic destiny (21st level+). */
export interface EpicDestiny extends RulesEntity {
  prereqsRaw?: string | null;
  prereqTokens: PrereqToken[];
  raw: Record<string, unknown>;
}

export interface RulesIndex {
  meta: {
    version: number;
    counts: Record<string, number>;
  };
  races: Race[];
  classes: ClassDef[];
  feats: Feat[];
  powers: Power[];
  skills: Skill[];
  languages: LanguageDef[];
  armors: Armor[];
  abilityScores: AbilityScoreLore[];
  racialTraits: RacialTrait[];
  themes: Theme[];
  paragonPaths: ParagonPath[];
  epicDestinies: EpicDestiny[];
  /**
   * Powers automatically granted by class features (from ETL / Grants + Class Feature data).
   * Omits powers that are only gained via player choice lists on the same feature.
   */
  autoGrantedPowerIdsByClassId?: Record<string, string[]>;
  /** Auto-trained skill names granted by selected race/class/theme/path/destiny supports. */
  autoGrantedSkillTrainingNamesBySupportId?: Record<string, string[]>;
  /** Class build options (choice features) with description/rules/powers, keyed by class id. */
  classBuildOptionsByClassId?: Record<
    string,
    Array<{
      id: string;
      name: string;
      parentFeatureId: string;
      parentFeatureName: string;
      shortDescription?: string | null;
      body?: string | null;
      powerIds?: string[];
    }>
  >;
}

/** +1 to two different abilities at a milestone (4, 8, 14, 18, 24, 28). Keys are level numbers as strings. */
export type AsiChoices = Partial<Record<string, { first: Ability; second: Ability }>>;

export interface CharacterBuild {
  name: string;
  level: number;
  pointBuyBudget?: number;
  raceId?: string;
  classId?: string;
  themeId?: string;
  paragonPathId?: string;
  epicDestinyId?: string;
  armorId?: string;
  shieldId?: string;
  abilityScores: Record<Ability, number>;
  /** Point-buy / starting base only; level bumps live in `asiChoices` and automatic 11/21 bonuses. */
  asiChoices?: AsiChoices;
  racialAbilityChoice?: Ability;
  /** Keys from `getRaceSecondarySelectSlots` (e.g. language-0); values are language id or skill id. */
  raceSelections?: Record<string, string>;
  /** Class-level selections such as build option picks. */
  classSelections?: Record<string, string>;
  trainedSkillIds: string[];
  featIds: string[];
  powerIds: string[];
  /**
   * One entry per class power slot (at-will / encounter / daily / utility).
   * Values are power ids; `powerIds` should stay in sync (see `orderedPowerIdsFromSlots` in rules).
   */
  classPowerSlots?: Record<string, string>;
}

export interface ValidationResult {
  ok: boolean;
  reasons: string[];
}

