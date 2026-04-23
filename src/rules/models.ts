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

/** Resolved Hybrid Talent Options → Class Feature compendium rows (from ETL). */
export interface HybridTalentClassFeatureOption {
  id: string;
  name: string;
  shortDescription?: string | null;
}

/** PHB3 hybrid rule picks (defense bonus, mantle, tradition, etc.) — key is stable for saved builds. */
export interface HybridSelectionGroup {
  key: string;
  label: string;
  options: HybridTalentClassFeatureOption[];
}

/** PHB3-style hybrid class entry (pairs with another hybrid class on the character). */
export interface HybridClassDef extends RulesEntity {
  baseClassId?: string | null;
  /** Static HP component at 1st before Con (e.g. 6 from "6+ Constitution Score"). */
  hitPointsAt1?: number | null;
  /** May be fractional (e.g. 2.5). */
  hitPointsPerLevel?: number | null;
  healingSurgesBase?: number | null;
  keyAbilities?: string | null;
  role?: string | null;
  powerSource?: string | null;
  bonusToDefense?: string | null;
  weaponProficiencies?: string | null;
  armorProficiencies?: string | null;
  implementText?: string | null;
  classSkillsRaw?: string | null;
  hybridTalentOptions?: string | null;
  /** Class Feature ids/names matching `Hybrid Talent Options` (comma-separated) in data. */
  hybridTalentClassFeatures?: HybridTalentClassFeatureOption[];
  /** Extra PHB3 selections (defense, mantle type, …); empty when the hybrid has none. */
  hybridSelectionGroups?: HybridSelectionGroup[];
  raw: Record<string, unknown>;
}

/** Key-ability / damage-type (etc.) picks for powers with compendium `rules.select` Racial Trait rows (ETL). */
export interface PowerSelectionGroup {
  key: string;
  label: string;
  options: HybridTalentClassFeatureOption[];
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
  /** Dragon Breath-style construction choices; empty when none. */
  powerSelectionGroups?: PowerSelectionGroup[];
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

export interface Weapon extends RulesEntity {
  proficiencyBonus?: number | null;
  damage?: string | null;
  weaponCategory?: string | null;
  handsRequired?: string | null;
  weaponGroup?: string | null;
  properties?: string | null;
  range?: string | null;
  itemSlot?: string | null;
  raw: Record<string, unknown>;
}

export interface Implement extends RulesEntity {
  implementGroup?: string | null;
  properties?: string | null;
  itemSlot?: string | null;
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
  /** Populated by ETL; `loadRules` defaults to []. */
  weapons?: Weapon[];
  /** Populated by ETL; `loadRules` defaults to []. */
  implements?: Implement[];
  abilityScores: AbilityScoreLore[];
  racialTraits: RacialTrait[];
  themes: Theme[];
  paragonPaths: ParagonPath[];
  epicDestinies: EpicDestiny[];
  /** PHB3 hybrid class entries; `loadRules` defaults to []. */
  hybridClasses?: HybridClassDef[];
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

export type CharacterStyle = "standard" | "hybrid";

export interface CharacterBuild {
  name: string;
  level: number;
  pointBuyBudget?: number;
  raceId?: string;
  /** Single-class PHB character; omit when `characterStyle` is `"hybrid"`. */
  classId?: string;
  /** Two hybrid classes from the index (e.g. Hybrid Cleric + Hybrid Fighter). */
  characterStyle?: CharacterStyle;
  hybridClassIdA?: string;
  hybridClassIdB?: string;
  /** Picked hybrid talent (Class Feature id) for side A; must appear on that hybrid’s `hybridTalentClassFeatures` list. */
  hybridTalentClassFeatureIdA?: string;
  hybridTalentClassFeatureIdB?: string;
  /** Per-group PHB3 picks for hybrid side A (`hybridSelectionGroups[].key` → Class Feature id). */
  hybridSideASelections?: Record<string, string>;
  hybridSideBSelections?: Record<string, string>;
  themeId?: string;
  paragonPathId?: string;
  epicDestinyId?: string;
  armorId?: string;
  shieldId?: string;
  mainWeaponId?: string;
  offHandWeaponId?: string;
  implementId?: string;
  abilityScores: Record<Ability, number>;
  /** Point-buy / starting base only; level bumps live in `asiChoices` and automatic 11/21 bonuses. */
  asiChoices?: AsiChoices;
  racialAbilityChoice?: Ability;
  /**
   * Race-level picks: `subrace`; `humanPowerOption` (Essentials Human: bonus at-will vs heroic effort);
   * keys from `getRaceSecondarySelectSlots` (e.g. language-0); skill ids;
   * `racialPower:${traitId}` for a Power select on that racial trait (see `racePowerSelectSelectionKey`).
   */
  raceSelections?: Record<string, string>;
  /** Class-level selections such as build option picks. */
  classSelections?: Record<string, string>;
  /** Per-power construction picks (`powerId` → group key → chosen racial trait option id). */
  powerSelections?: Record<string, Record<string, string>>;
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

