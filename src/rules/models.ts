export type Tier = "HEROIC" | "PARAGON" | "EPIC";
export type Ability = "STR" | "CON" | "DEX" | "INT" | "WIS" | "CHA";

export interface PrereqToken {
  kind:
    | "levelAtLeast"
    | "tier"
    | "paragonPath"
    | "epicDestiny"
    | "abilityAtLeast"
    | "trainedSkill"
    | "race"
    | "class"
    | "tag"
    | "powerSourceAny"
    | "classFeature"
    | "power"
    | "racialPower"
    | "feat"
    | "multiclassEntry"
    | "racialTrait"
    | "heritage"
    | "deity"
    | "negatedTag"
    | "negatedClass"
    | "proficiency"
    | "implement"
    | "size"
    | "anyOf"
    | "allOf";
  value?: string | number;
  ability?: Ability;
  options?: PrereqToken[];
  requirements?: PrereqToken[];
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

/** Flattened Character Builder `rules.statadd` entry (ETL + runtime). */
export interface StatAddEntry {
  name: string;
  value: string;
  condition?: string;
  wearing?: string;
  requires?: string;
  type?: string;
}

/** Parsed `specific['Bonus to Defense']` sums (ETL uses lowercase keys). */
export type NadBonusesFromSpecific = Partial<Record<"fortitude" | "reflex" | "will", number>>;

/** Structured proficiency from feat `rules.grant` type Proficiency (ETL). */
export interface ProficiencyGrant {
  kind: "weaponCategory" | "weaponGroup" | "weaponName" | "armor" | "shield" | "implement";
  value: string;
  label?: string | null;
}

/** ETL: a class power augmented by a style / arena fighting feat (not granted). */
export interface FeatPowerModification {
  powerName: string;
  powerId?: string | null;
  /** When the compendium targets a class feature (type Power) with no power row. */
  classFeatureId?: string | null;
  field: string;
  value: string;
}

/** ETL: optional class slot swap from `rules.replace` power-replace (e.g. Gythka Expert). */
export interface FeatPowerReplaceOffer {
  replacementPowerId: string;
  replacementPowerName: string;
  usageBucket: "atWill" | "encounter" | "daily" | "utility";
  minSlotGainLevel: number;
  optional: boolean;
}

/** PHB Novice / Acolyte / Adept (and PHB3 psionic variants): swap one class slot for a user-picked multiclass power. */
export interface FeatMulticlassSlotSwapOffer {
  /** Class power slot bucket being swapped out. */
  usageBucket: "atWill" | "encounter" | "daily" | "utility";
  /** When set, replacement must come from this bucket (psionic Dabbler / Conventionalist). */
  replacementUsageBucket?: "atWill" | "encounter" | "daily" | "utility";
  maxSlotGainLevel: number;
  optional: boolean;
  /** Slot must currently hold an augmentable at-will (Complement / Conventionalist). */
  requireAugmentableSlot?: boolean;
  /** Replacement pick must be augmentable at-will (Complement / Dabbler). */
  requireAugmentableReplacement?: boolean;
  /** Swapped-in power is used once per encounter (paired rules.modify in compendium). */
  replacementUsedAsEncounter?: boolean;
  /** PHB3: gain or lose power points when the swap is active (Dabbler / Conventionalist). */
  powerPointSwapChange?: "gain" | "lose";
}

/** Active power-replace (named or multiclass slot swap). */
export interface FeatPowerReplaceState {
  slotKey: string;
  /** Class power id in the slot before the swap (for restore). */
  originalPowerId?: string;
  /** Multiclass swap: user-picked power from the multiclass class. */
  replacementPowerId?: string;
}

export interface Feat extends RulesEntity {
  tier?: string | null;
  category?: string | null;
  tags?: string[] | null;
  shortDescription?: string | null;
  prereqsRaw?: string | null;
  prereqSummary?: string | null;
  prereqTokens: PrereqToken[];
  /** ETL: flattened `rules.statadd` from the compendium row. */
  statAdds?: StatAddEntry[];
  /** ETL: parsed `Bonus to Defense` in specific, when present. */
  nadBonusesFromSpecific?: NadBonusesFromSpecific;
  /** ETL: `rules.grant` entries with type Power. */
  grantedPowerIds?: string[];
  /** ETL: powers augmented via rules.modify / Associated Powers (not granted). */
  modifiedPowerIds?: string[];
  /** ETL: structured power augmentations (Corellon's Wrath Style, Gulg Hunter Practice, etc.). */
  powerModifications?: FeatPowerModification[];
  /** ETL: named `power-replace` swap offers (weapon mastery, gythka chain, …). */
  powerReplaceOffers?: FeatPowerReplaceOffer[];
  multiclassSlotSwapOffers?: FeatMulticlassSlotSwapOffer[];
  /** ETL: `rules.grant` entries with type Class Feature. */
  grantedClassFeatureIds?: string[];
  /** ETL: `rules.grant` entries with type Racial Trait. */
  grantedRacialTraitIds?: string[];
  /** ETL: `rules.grant` entries with type Proficiency (armor, shield, weapon, implement). */
  proficiencyGrants?: ProficiencyGrant[];
  /** ETL: `rules.grant` type Multiclass (multiclass training / paragon chain feats). */
  hasMulticlassGrant?: boolean;
  /** ETL: class names from CountsAsClass grants (e.g. Rogue from Sneak of Shadows). */
  countsAsClassNames?: string[];
  /** ETL: resolved class ids for CountsAsClass grants when name matches a base class. */
  countsAsClassIds?: string[];
  /** ETL: Internal grant keys (bloodline, ki focus, psionic second class, etc.). */
  internalGrantKeys?: string[];
  /** ETL: trained skill names from Skill Training grants. */
  grantedSkillTrainingNames?: string[];
  /** ETL: resolved skill ids for Skill Training grants. */
  grantedSkillTrainingIds?: string[];
  /** ETL: class feature names from CountsAsFeature grants. */
  countsAsFeatureNames?: string[];
  /** ETL: resolved class feature ids for CountsAsFeature grants. */
  countsAsFeatureIds?: string[];
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

/** Class feature (class / theme / paragon / epic destiny traits on the character sheet). */
export interface ClassFeature extends RulesEntity {
  shortDescription?: string | null;
  body?: string | null;
  raw: Record<string, unknown>;
}

/** Character theme (optional background package with prerequisites). */
export interface Theme extends RulesEntity {
  prereqsRaw?: string | null;
  prereqTokens: PrereqToken[];
  statAdds?: StatAddEntry[];
  nadBonusesFromSpecific?: NadBonusesFromSpecific;
  raw: Record<string, unknown>;
}

/** Paragon path (11th level+). */
export interface ParagonPath extends RulesEntity {
  prereqsRaw?: string | null;
  prereqTokens: PrereqToken[];
  grantedClassFeatureIds?: string[];
  statAdds?: StatAddEntry[];
  nadBonusesFromSpecific?: NadBonusesFromSpecific;
  raw: Record<string, unknown>;
}

/** Epic destiny (21st level+). */
export interface EpicDestiny extends RulesEntity {
  prereqsRaw?: string | null;
  prereqTokens: PrereqToken[];
  statAdds?: StatAddEntry[];
  nadBonusesFromSpecific?: NadBonusesFromSpecific;
  raw: Record<string, unknown>;
}

/** Compendium Proficiency row (internal grant target; weapon rows include category ids). */
export interface ProficiencyDef extends RulesEntity {
  grant?: ProficiencyGrant;
  categoryIds?: string[];
  body?: string | null;
  raw: Record<string, unknown>;
}

/** PHB2-style character background. */
export interface Background extends RulesEntity {
  backgroundType?: string | null;
  shortDescription?: string | null;
  benefit?: string | null;
  commonKnowledge?: string | null;
  campaign?: string | null;
  associatedSkills?: string[];
  associatedLanguages?: string[];
  prereqsRaw?: string | null;
  prereqTokens: PrereqToken[];
  raw: Record<string, unknown>;
}

/** Magic item from the compendium (armor, weapon, implement, wondrous, etc.). */
/** Equipped magic item ids keyed by equipment role. */
export interface MagicItemSlotIds {
  armor?: string;
  neck?: string;
  mainWeapon?: string;
  offHandWeapon?: string;
  implement?: string;
}

/** Enhancement bonus chosen for a slot (+0 = none). */
export type EnhancementLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Mundane base + optional magic enchantment + enhancement plus. */
export interface EquipmentSlotSelection {
  /** Compendium id: Armor or Weapon. */
  baseId?: string;
  /** Magic Item id; omit = mundane only. */
  enchantmentId?: string;
  enhancement?: EnhancementLevel;
}

/** Superior implement + optional magic implement + plus. */
export interface ImplementSlotSelection {
  superiorImplementId?: string;
  enchantmentId?: string;
  enhancement?: EnhancementLevel;
}

/** Equipped gear slot (inventory item id per slot). */
export type EquipmentSlot = "armor" | "shield" | "mainHand" | "offHand" | "implement";

export type InventoryItemKind = "armor" | "weapon" | "implement" | "gear";

export interface InventoryItem {
  id: string;
  name: string;
  kind: InventoryItemKind;
  quantity: number;
  sourceId?: string;
  slotHints: EquippedSlotKey[];
  notes?: string;
}

/** Magic-only slot: enchantment + plus; no mundane base. */
export interface MagicOnlySlotSelection {
  enchantmentId?: string;
  enhancement: EnhancementLevel;
}

/** Neck slot: no mundane base; always includes `enhancement` (0 when empty). */
export type NeckSlotSelection = MagicOnlySlotSelection;

/** Equipment slots that use {@link MagicOnlySlotSelection} (no mundane base). */
export type MagicOnlyEquipmentSlotKey =
  | "neck"
  | "head"
  | "arms"
  | "hands"
  | "feet"
  | "waist"
  | "ring1"
  | "ring2"
  | "companion"
  | "mount"
  | "familiar";

/** Any slot that can appear in the equipped-slots UI (gear + magic-only). */
export type EquippedSlotKey = EquipmentSlot | MagicOnlyEquipmentSlotKey;

export interface CharacterEquipment {
  armor?: EquipmentSlotSelection;
  shield?: EquipmentSlotSelection;
  mainHand?: EquipmentSlotSelection;
  offHand?: EquipmentSlotSelection;
  implement?: ImplementSlotSelection;
  neck?: NeckSlotSelection;
  head?: MagicOnlySlotSelection;
  arms?: MagicOnlySlotSelection;
  hands?: MagicOnlySlotSelection;
  feet?: MagicOnlySlotSelection;
  waist?: MagicOnlySlotSelection;
  ring1?: MagicOnlySlotSelection;
  ring2?: MagicOnlySlotSelection;
  companion?: MagicOnlySlotSelection;
  mount?: MagicOnlySlotSelection;
  familiar?: MagicOnlySlotSelection;
}

export interface MagicItem extends RulesEntity {
  flavor?: string | null;
  level?: number | null;
  gold?: number | null;
  magicItemType?: string | null;
  itemSlot?: string | null;
  tier?: string | null;
  rarity?: string | null;
  armorTypes?: string[] | null;
  weaponTypes?: string[] | null;
  /** Compendium `_IsEnchant` (e.g. `Shield` for shield property enchants). */
  isEnchant?: string | null;
  enhancement?: string | null;
  enhancementBonus?: number | null;
  property?: string | null;
  power?: string | null;
  critical?: string | null;
  requirement?: string | null;
  statAdds?: StatAddEntry[];
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
  /** Populated by ETL; `loadRules` defaults to []. */
  classFeatures?: ClassFeature[];
  themes: Theme[];
  paragonPaths: ParagonPath[];
  epicDestinies: EpicDestiny[];
  /** PHB3 hybrid class entries; `loadRules` defaults to []. */
  hybridClasses?: HybridClassDef[];
  /** Internal proficiency grant targets; `loadRules` defaults to []. */
  proficiencies?: ProficiencyDef[];
  /** Character backgrounds; `loadRules` defaults to []. */
  backgrounds?: Background[];
  /** Magic item catalog; `loadRules` defaults to []. */
  magicItems?: MagicItem[];
  /**
   * Powers automatically granted by class features (from ETL / Grants + Class Feature data).
   * Omits powers that are only gained via player choice lists on the same feature.
   */
  autoGrantedPowerIdsByClassId?: Record<string, string[]>;
  /** Auto-trained skill names granted by selected race/class/theme/path/destiny supports. */
  autoGrantedSkillTrainingNamesBySupportId?: Record<string, string[]>;
  /** Class feature names granted via Grants rows, keyed by supported entity id. */
  grantedClassFeatureNamesBySupportId?: Record<string, string[]>;
  /** Class build options (choice features) with description/rules/powers, keyed by class id. */
  classBuildOptionsByClassId?: Record<
    string,
    Array<{
      id: string;
      name: string;
      displayName?: string | null;
      parentFeatureId: string;
      parentFeatureName: string;
      shortDescription?: string | null;
      body?: string | null;
      powerIds?: string[];
    }>
  >;
  /** Level-1 class feature / power choice groups (Rogue Tactics, Fighter Talents, cantrips, …). */
  classFeatureChoiceGroupsByClassId?: Record<
    string,
    Array<{
      key: string;
      kind: "classFeature" | "power";
      parentFeatureId: string;
      parentFeatureName: string;
      pickCount: number;
      minLevel?: number;
      optional?: boolean;
      powerIds?: string[];
      visibleWhen?: { groupKey: string; optionId: string };
      options?: Array<{
        id: string;
        name: string;
        parentFeatureId: string;
        parentFeatureName: string;
        shortDescription?: string | null;
        body?: string | null;
        powerIds?: string[];
      }>;
    }>
  >;
}

/** +1 to two different abilities at a milestone (4, 8, 14, 18, 24, 28). Keys are level numbers as strings. */
export type AsiChoices = Partial<Record<string, { first: Ability; second: Ability }>>;

export type CharacterStyle = "standard" | "hybrid";

/** PHB3 hybrid psionic augmentation: power points vs encounter use of augmentable at-will. */
export type HybridPsionicAugmentationBreakpoint = 7 | 13 | 17 | 23 | 27;
export type HybridPsionicAugmentationChoice = "powerPoints" | "encounter";

/** Paragon-tier picks from a multiclass class (PHB paragon multiclassing). */
export interface ParagonMulticlassPowers {
  atWillSwapPowerId?: string;
  /** Class at-will slot replaced by `atWillSwapPowerId` (PHB 11+ at-will swap). */
  atWillSwapSlotKey?: string;
  /** Prior class power in the slot before the paragon at-will swap. */
  atWillSwapOriginalPowerId?: string;
  encounterPowerId?: string;
  utilityPowerId?: string;
  dailyPowerId?: string;
}

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
  /**
   * PHB3 hybrid psionic augmentation: at 7th, 13th, 17th, 23rd, and 27th, choose power points or
   * one encounter use of an augmentable at-will per day (default power points when unset).
   */
  hybridPsionicAugmentationChoices?: Partial<
    Record<HybridPsionicAugmentationBreakpoint, HybridPsionicAugmentationChoice>
  >;
  themeId?: string;
  paragonPathId?: string;
  /** Use PHB paragon multiclassing instead of a paragon path (requires Novice/Acolyte/Adept chain). */
  paragonMulticlassing?: boolean;
  /** Paragon-tier power picks from the multiclass class when `paragonMulticlassing` is true. */
  paragonMulticlassPowers?: ParagonMulticlassPowers;
  epicDestinyId?: string;
  /** Unified equipment per slot (base → enchantment → plus). */
  equipment?: CharacterEquipment;
  /** Gold pieces available for equipment purchases. */
  gold?: number;
  /** Acquired gear rows (via Buy / Add on equipment tab). */
  inventory?: InventoryItem[];
  /** Inventory item id equipped per gear slot. */
  equippedSlots?: Partial<Record<EquippedSlotKey, string>>;
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
  /**
   * Class-level picks: `classFeature:${parentId}` (feature bundle);
   * `classPower:${traitId}:${n}` (comma-separated power ids for cantrip slots).
   */
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
  /**
   * Named feat power swaps (`power-replace`): feat id → slot using the replacement power.
   * The slot’s `classPowerSlots` entry holds the replacement power id while active.
   */
  featPowerReplacements?: Record<string, FeatPowerReplaceState>;
}

export interface ValidationResult {
  ok: boolean;
  reasons: string[];
}

