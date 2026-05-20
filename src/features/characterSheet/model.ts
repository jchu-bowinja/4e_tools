import type {
  Ability,
  CharacterEquipment,
  CharacterStyle,
  EquippedSlotKey,
  EquipmentSlot,
  InventoryItem,
  InventoryItemKind,
  ParagonMulticlassPowers
} from "../../rules/models";

export type AbilityScores = Record<Ability, number>;

export type { EquippedSlotKey, EquipmentSlot, InventoryItem, InventoryItemKind };

export type ConditionDurationKind =
  | "none"
  | "save_ends"
  | "save_ends_both"
  | "save_ends_all"
  | "end_encounter"
  | "end_turn"
  | "start_turn"
  | "rounds";

export type ConditionDurationSubject = "self" | "target" | "source";

export interface ConditionDuration {
  kind: ConditionDurationKind;
  phrase: string;
  rounds?: number;
  subject?: ConditionDurationSubject;
}

export interface ActiveCondition {
  id: string;
  name: string;
  duration: ConditionDuration;
  /** Reserved for turn tracker: encounter round or turn index when added */
  appliedAt?: { round?: number; turnId?: string };
}

export interface CharacterSheetResources {
  currentHp: number;
  tempHp: number;
  actionPoints: number;
  surgesRemaining: number;
  /** True after Second Wind is used; resets on short or long rest. */
  secondWindUsed?: boolean;
  /** Psionic augmentation points spent this day; resets on extended rest. */
  powerPointsSpent?: number;
  deathSaves: number;
  conditions: ActiveCondition[];
}

export type PowerSheetGroupBy = "usage" | "actionType";

export interface CharacterSheetPowerSelection {
  selectedPowerIds: string[];
  expendedPowerIds: string[];
  manualOrderIds: string[];
  /** How combat powers are grouped on the overview sheet. */
  groupBy?: PowerSheetGroupBy;
}

export interface CharacterSheetState {
  name: string;
  level: number;
  raceId?: string;
  /** Race tab picks (subrace, racial powers, bonus language, …) — aligned with builder `raceSelections`. */
  raceSelections?: Record<string, string>;
  racialAbilityChoice?: Ability;
  classId?: string;
  /** When set with hybrid class ids, derived stats use hybrid rules (matches builder). */
  characterStyle?: CharacterStyle;
  hybridClassIdA?: string;
  hybridClassIdB?: string;
  themeId?: string;
  paragonPathId?: string;
  paragonMulticlassing?: boolean;
  paragonMulticlassPowers?: ParagonMulticlassPowers;
  epicDestinyId?: string;
  /** Builder-aligned equipment (base, enchantment, plus per slot). Drives derived combat bonuses. */
  characterEquipment?: CharacterEquipment;
  /** Gold pieces available for equipment purchases. */
  gold?: number;
  abilityScores: AbilityScores;
  trainedSkillIds: string[];
  featIds?: string[];
  resources: CharacterSheetResources;
  inventory: InventoryItem[];
  equipment: Partial<Record<EquippedSlotKey, string>>;
  powers: CharacterSheetPowerSelection;
}
