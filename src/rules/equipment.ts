import type {
  CharacterBuild,
  CharacterEquipment,
  EnhancementLevel,
  EquipmentSlotSelection,
  ImplementSlotSelection,
  MagicItem,
  MagicItemSlotIds,
  MagicOnlyEquipmentSlotKey,
  MagicOnlySlotSelection,
  NeckSlotSelection,
  RulesIndex,
  StatAddEntry
} from "./models";
import { pruneCharacterConsumableIds } from "./consumablesCatalog";
import { MAGIC_ONLY_EQUIPMENT_SLOT_KEYS } from "./magicItemEquipment";
import { mergePassiveDefenseBonuses, passiveDefenseBonusesFromStatAdds, type PassiveDefenseBonuses } from "./supportStatAdds";

export { equipmentDuplicateEnchantmentWarnings } from "./enchantmentFamilies";

function findMagicItem(index: RulesIndex, id: string | undefined): MagicItem | undefined {
  if (!id) return undefined;
  return (index.magicItems ?? []).find((m) => m.id === id);
}

/** @deprecated Legacy manual bonuses — stripped on import; not applied at runtime. */
export function stripLegacyMagicItemBonuses<T extends { magicItemBonuses?: unknown }>(build: T): T {
  if (!build.magicItemBonuses) return build;
  const { magicItemBonuses: _removed, ...rest } = build;
  return rest as T;
}

export type {
  CharacterEquipment,
  EnhancementLevel,
  EquipmentSlotSelection,
  ImplementSlotSelection,
  MagicOnlyEquipmentSlotKey,
  MagicOnlySlotSelection,
  NeckSlotSelection
};

const ENHANCEMENT_STATADD_NAMES = new Set([
  "armor class",
  "armor enhancement bonus",
  "weapon enhancement bonus",
  "implement enhancement bonus",
  "damage rolls",
  "attack rolls",
  "fortitude defense",
  "reflex defense",
  "will defense"
]);

export interface EquipmentCombatBonuses {
  defenses: PassiveDefenseBonuses;
  mainWeaponAttack: number;
  offHandWeaponAttack: number;
  implementAttack: number;
}

export function resolveEquipmentForBuild(build: CharacterBuild, index?: RulesIndex): CharacterEquipment {
  if (build.equipment !== undefined) {
    return normalizeCharacterEquipment(build.equipment);
  }
  return migrateLegacyEquipment(build, index);
}

/** Effective ids for rules that still read flat build fields (prefer `equipment`). */
export function resolveEffectiveEquipmentIds(
  build: CharacterBuild,
  index?: RulesIndex
): {
  armorId?: string;
  shieldId?: string;
  mainWeaponId?: string;
  offHandWeaponId?: string;
  implementId?: string;
} {
  const equipment = resolveEquipmentForBuild(build, index);
  return {
    armorId: equipment.armor?.baseId,
    shieldId: equipment.shield?.baseId,
    mainWeaponId: equipment.mainHand?.baseId,
    offHandWeaponId: equipment.offHand?.baseId,
    implementId: equipment.implement?.superiorImplementId
  };
}

/** Legacy flat ids on stored JSON before migration; stripped by `normalizeCharacterBuild`. */
export type LegacyCharacterBuildInput = {
  armorId?: string;
  shieldId?: string;
  mainWeaponId?: string;
  offHandWeaponId?: string;
  implementId?: string;
  magicItemIds?: MagicItemSlotIds;
  magicItemBonuses?: unknown;
};

export function isEnhancementOnlyStatAdd(entry: StatAddEntry): boolean {
  const type = String(entry.type || "").toLowerCase();
  if (type === "enhancement") return true;
  const name = String(entry.name || "").toLowerCase();
  if (ENHANCEMENT_STATADD_NAMES.has(name)) return true;
  if (name.endsWith(" enhancement bonus")) return true;
  return false;
}

/** Magic item property/resist/NAD statAdds — excludes enhancement lines (user plus is authoritative). */
export function enchantmentDefenseBonusesFromItem(item: MagicItem, level: number): PassiveDefenseBonuses {
  const filtered = (item.statAdds ?? []).filter((e) => !isEnhancementOnlyStatAdd(e));
  return passiveDefenseBonusesFromStatAdds(filtered, level);
}

function slotEnhancementLevel(slot: { enhancement?: EnhancementLevel } | undefined): number {
  return parseEnhancementLevel(slot?.enhancement) ?? 0;
}

function addEnchantmentDefense(
  defenses: PassiveDefenseBonuses,
  index: RulesIndex,
  enchantmentId: string | undefined,
  level: number
): PassiveDefenseBonuses {
  if (!enchantmentId) return defenses;
  const item = findMagicItem(index, enchantmentId);
  if (!item) return defenses;
  return mergePassiveDefenseBonuses(defenses, enchantmentDefenseBonusesFromItem(item, level));
}

/**
 * Layer 2 (plus) and layer 3 (enchantment statAdds) from `equipment`.
 * User-selected enhancement on armor/shield adds to AC; on neck adds to NAD; on weapons/implement adds to attack.
 */
export function computeEquipmentCombatBonuses(index: RulesIndex, build: CharacterBuild): EquipmentCombatBonuses {
  const equipment = resolveEquipmentForBuild(build, index);
  const level = build.level;

  let defenses: PassiveDefenseBonuses = { ac: 0, fortitude: 0, reflex: 0, will: 0 };

  defenses.ac += slotEnhancementLevel(equipment.armor) + slotEnhancementLevel(equipment.shield);

  const neckPlus = equipment.neck?.enhancement ?? 0;
  if (neckPlus > 0) {
    defenses.fortitude += neckPlus;
    defenses.reflex += neckPlus;
    defenses.will += neckPlus;
  }

  defenses = addEnchantmentDefense(defenses, index, equipment.armor?.enchantmentId, level);
  defenses = addEnchantmentDefense(defenses, index, equipment.shield?.enchantmentId, level);
  defenses = addEnchantmentDefense(defenses, index, equipment.mainHand?.enchantmentId, level);
  defenses = addEnchantmentDefense(defenses, index, equipment.offHand?.enchantmentId, level);
  defenses = addEnchantmentDefense(defenses, index, equipment.implement?.enchantmentId, level);
  for (const slotKey of MAGIC_ONLY_EQUIPMENT_SLOT_KEYS) {
    defenses = addEnchantmentDefense(defenses, index, equipment[slotKey]?.enchantmentId, level);
  }

  return {
    defenses,
    mainWeaponAttack: slotEnhancementLevel(equipment.mainHand),
    offHandWeaponAttack: slotEnhancementLevel(equipment.offHand),
    implementAttack: slotEnhancementLevel(equipment.implement)
  };
}

export function equipmentDefenseBonusesFromBuild(
  index: RulesIndex | undefined,
  build: CharacterBuild
): PassiveDefenseBonuses {
  if (!index) return { ac: 0, fortitude: 0, reflex: 0, will: 0 };
  return computeEquipmentCombatBonuses(index, build).defenses;
}

export function parseEnhancementLevel(value: unknown): EnhancementLevel | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const n = Math.trunc(value);
  if (n < 0 || n > 6) return undefined;
  return n as EnhancementLevel;
}

/** Lowest +N from enhancement text and enhancement-related statAdds on a magic item row. */
export function defaultEnhancementFromMagicItem(item: MagicItem | undefined): EnhancementLevel {
  if (!item) return 0;
  const candidates: number[] = [];
  const fromField = parseEnhancementLevel(item.enhancementBonus ?? undefined);
  if (fromField !== undefined) candidates.push(fromField);

  const text = String(item.enhancement || "");
  for (const m of text.matchAll(/\+(\d+)/g)) {
    const n = Number(m[1]);
    if (Number.isFinite(n)) candidates.push(n);
  }

  for (const entry of item.statAdds ?? []) {
    const name = String(entry.name || "").toLowerCase();
    if (!ENHANCEMENT_STATADD_NAMES.has(name) && !name.endsWith(" enhancement bonus")) continue;
    const m = String(entry.value || "").match(/\+(\d+)/);
    if (m) candidates.push(Number(m[1]));
  }

  if (candidates.length === 0) return 0;
  return parseEnhancementLevel(Math.min(...candidates)) ?? 0;
}

function normalizeSlotSelection(raw: unknown): EquipmentSlotSelection | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const v = raw as Record<string, unknown>;
  const baseId = typeof v.baseId === "string" && v.baseId.trim() ? v.baseId.trim() : undefined;
  const enchantmentId =
    typeof v.enchantmentId === "string" && v.enchantmentId.trim() ? v.enchantmentId.trim() : undefined;
  const enhancement = parseEnhancementLevel(v.enhancement) ?? 0;
  if (!baseId && !enchantmentId && enhancement === 0) return undefined;
  const out: EquipmentSlotSelection = {};
  if (baseId) out.baseId = baseId;
  if (enchantmentId) out.enchantmentId = enchantmentId;
  if (enhancement > 0 || baseId || enchantmentId) out.enhancement = enhancement;
  return out;
}

function normalizeImplementSelection(raw: unknown): ImplementSlotSelection | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const v = raw as Record<string, unknown>;
  const superiorImplementId =
    typeof v.superiorImplementId === "string" && v.superiorImplementId.trim()
      ? v.superiorImplementId.trim()
      : undefined;
  const enchantmentId =
    typeof v.enchantmentId === "string" && v.enchantmentId.trim() ? v.enchantmentId.trim() : undefined;
  const enhancement = parseEnhancementLevel(v.enhancement) ?? 0;
  if (!superiorImplementId && !enchantmentId && enhancement === 0) return undefined;
  const out: ImplementSlotSelection = {};
  if (superiorImplementId) out.superiorImplementId = superiorImplementId;
  if (enchantmentId) out.enchantmentId = enchantmentId;
  if (enhancement > 0 || superiorImplementId || enchantmentId) out.enhancement = enhancement;
  return out;
}

function normalizeNeckSelection(raw: unknown): NeckSlotSelection {
  if (!raw || typeof raw !== "object") {
    return { enhancement: 0 };
  }
  const v = raw as Record<string, unknown>;
  const enchantmentId =
    typeof v.enchantmentId === "string" && v.enchantmentId.trim() ? v.enchantmentId.trim() : undefined;
  const enhancement = parseEnhancementLevel(v.enhancement) ?? 0;
  const out: NeckSlotSelection = { enhancement };
  if (enchantmentId) out.enchantmentId = enchantmentId;
  return out;
}

function normalizeMagicOnlySelection(raw: unknown): MagicOnlySlotSelection | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const v = raw as Record<string, unknown>;
  const enchantmentId =
    typeof v.enchantmentId === "string" && v.enchantmentId.trim() ? v.enchantmentId.trim() : undefined;
  const enhancement = parseEnhancementLevel(v.enhancement) ?? 0;
  if (!enchantmentId && enhancement === 0) return undefined;
  const out: MagicOnlySlotSelection = { enhancement };
  if (enchantmentId) out.enchantmentId = enchantmentId;
  return out;
}

export function normalizeCharacterEquipment(raw: CharacterEquipment | undefined): CharacterEquipment {
  const armor = normalizeSlotSelection(raw?.armor);
  const shield = normalizeSlotSelection(raw?.shield);
  const mainHand = normalizeSlotSelection(raw?.mainHand);
  const offHand = normalizeSlotSelection(raw?.offHand);
  const implement = normalizeImplementSelection(raw?.implement);
  const neck = normalizeNeckSelection(raw?.neck);
  const out: CharacterEquipment = { neck };
  if (armor) out.armor = armor;
  if (shield) out.shield = shield;
  if (mainHand) out.mainHand = mainHand;
  if (offHand) out.offHand = offHand;
  if (implement) out.implement = implement;
  for (const slotKey of MAGIC_ONLY_EQUIPMENT_SLOT_KEYS) {
    if (slotKey === "neck") continue;
    const slot = normalizeMagicOnlySelection(raw?.[slotKey]);
    if (slot) out[slotKey] = slot;
  }
  return out;
}

function slotFromLegacy(
  baseId: string | undefined,
  enchantmentId: string | undefined,
  index: RulesIndex | undefined
): EquipmentSlotSelection | undefined {
  if (!baseId && !enchantmentId) return undefined;
  const item = index && enchantmentId ? findMagicItem(index, enchantmentId) : undefined;
  const enhancement = enchantmentId ? defaultEnhancementFromMagicItem(item) : 0;
  const out: EquipmentSlotSelection = {};
  if (baseId) out.baseId = baseId;
  if (enchantmentId) out.enchantmentId = enchantmentId;
  if (enhancement > 0 || baseId || enchantmentId) out.enhancement = enhancement;
  return out;
}

export function migrateLegacyEquipment(
  build: CharacterBuild & LegacyCharacterBuildInput,
  index?: RulesIndex
): CharacterEquipment {
  const magic = build.magicItemIds;
  const armor = slotFromLegacy(build.armorId, magic?.armor, index);
  const shield = slotFromLegacy(build.shieldId, undefined, index);
  const mainHand = slotFromLegacy(build.mainWeaponId, magic?.mainWeapon, index);
  const offHand = slotFromLegacy(build.offHandWeaponId, magic?.offHandWeapon, index);

  let implement: ImplementSlotSelection | undefined;
  if (build.implementId || magic?.implement) {
    const item = index && magic?.implement ? findMagicItem(index, magic.implement) : undefined;
    const enhancement = magic?.implement ? defaultEnhancementFromMagicItem(item) : 0;
    implement = {};
    if (build.implementId) implement.superiorImplementId = build.implementId;
    if (magic?.implement) implement.enchantmentId = magic.implement;
    if (enhancement > 0 || implement.superiorImplementId || implement.enchantmentId) {
      implement.enhancement = enhancement;
    }
  }

  let neck: NeckSlotSelection = { enhancement: 0 };
  if (magic?.neck) {
    const item = index ? findMagicItem(index, magic.neck) : undefined;
    neck = {
      enchantmentId: magic.neck,
      enhancement: defaultEnhancementFromMagicItem(item)
    };
  }

  return normalizeCharacterEquipment({
    armor,
    shield,
    mainHand,
    offHand,
    implement,
    neck
  });
}

export function normalizeCharacterBuild(
  build: CharacterBuild & LegacyCharacterBuildInput,
  index?: RulesIndex
): CharacterBuild {
  const stripped = stripLegacyMagicItemBonuses(build);
  const equipment =
    stripped.equipment !== undefined
      ? normalizeCharacterEquipment(stripped.equipment)
      : migrateLegacyEquipment(stripped, index);

  const {
    armorId: _armorId,
    shieldId: _shieldId,
    mainWeaponId: _mainWeaponId,
    offHandWeaponId: _offHandWeaponId,
    implementId: _implementId,
    magicItemIds: _magicItemIds,
    magicItemBonuses: _magicItemBonuses,
    ...rest
  } = stripped;

  let next: CharacterBuild = {
    ...rest,
    equipment
  };
  if (index) {
    const pruned = pruneCharacterConsumableIds(next, index);
    next = { ...next, ...pruned };
  }
  return next;
}
