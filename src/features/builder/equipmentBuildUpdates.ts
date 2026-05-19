import { normalizeCharacterEquipment } from "../../rules/equipment";
import {
  clampEnhancementToFamily,
  enchantmentFamilyKeyFromId,
  findEnchantmentFamilyById,
  findEnchantmentFamilyByKey,
  resolveEnchantmentIdForFamily
} from "../../rules/enchantmentFamilies";
import type {
  CharacterBuild,
  CharacterEquipment,
  EnhancementLevel,
  EquipmentSlotSelection,
  ImplementSlotSelection,
  MagicItem,
  MagicOnlyEquipmentSlotKey,
  MagicOnlySlotSelection,
  RulesIndex
} from "../../rules/models";

export type { MagicOnlyEquipmentSlotKey };

export type StandardEquipmentSlotKey = "armor" | "shield" | "mainHand" | "offHand";

function withEquipment(build: CharacterBuild, equipment: CharacterEquipment): CharacterBuild {
  return { ...build, equipment: normalizeCharacterEquipment(equipment) };
}

function baseEquipment(build: CharacterBuild): CharacterEquipment {
  return normalizeCharacterEquipment(build.equipment);
}

function pruneStandardSlot(slot: EquipmentSlotSelection | undefined): EquipmentSlotSelection | undefined {
  if (!slot) return undefined;
  const out: EquipmentSlotSelection = {};
  if (slot.baseId) out.baseId = slot.baseId;
  if (slot.enchantmentId) out.enchantmentId = slot.enchantmentId;
  const enhancement = slot.enhancement ?? 0;
  if (enhancement > 0 || out.baseId || out.enchantmentId) out.enhancement = enhancement;
  if (!out.baseId && !out.enchantmentId && (out.enhancement ?? 0) === 0) return undefined;
  return out;
}

function patchStandardSlot(
  build: CharacterBuild,
  slotKey: StandardEquipmentSlotKey,
  patch: (prev: EquipmentSlotSelection | undefined) => EquipmentSlotSelection | undefined
): CharacterBuild {
  const equipment = baseEquipment(build);
  const nextSlot = pruneStandardSlot(patch(equipment[slotKey]));
  const next: CharacterEquipment = { ...equipment };
  if (nextSlot) next[slotKey] = nextSlot;
  else delete next[slotKey];
  return withEquipment(build, next);
}

export function setStandardSlotBase(
  build: CharacterBuild,
  slotKey: StandardEquipmentSlotKey,
  baseId: string | undefined
): CharacterBuild {
  return patchStandardSlot(build, slotKey, (prev) => {
    if (!baseId) {
      if (!prev?.enchantmentId) return undefined;
      const next = { ...prev };
      delete next.baseId;
      return next;
    }
    return { ...prev, baseId };
  });
}

export function setStandardSlotEnchantmentFamily(
  build: CharacterBuild,
  index: RulesIndex,
  slotKey: StandardEquipmentSlotKey,
  familyKey: string | undefined,
  catalog: MagicItem[]
): CharacterBuild {
  return patchStandardSlot(build, slotKey, (prev) => {
    if (!familyKey) {
      if (!prev?.baseId) return undefined;
      const next = { ...prev };
      delete next.enchantmentId;
      if ((next.enhancement ?? 0) > 0 && !next.baseId) next.enhancement = 0;
      return next;
    }
    const family = findEnchantmentFamilyByKey(index, familyKey, catalog);
    if (!family) return prev;
    const enhancement = clampEnhancementToFamily(family, prev?.enhancement ?? family.allowedEnhancements[0]);
    const enchantmentId = resolveEnchantmentIdForFamily(index, familyKey, enhancement, family.items[0]);
    return { ...prev, enchantmentId, enhancement };
  });
}

export function setStandardSlotEnhancement(
  build: CharacterBuild,
  index: RulesIndex,
  slotKey: StandardEquipmentSlotKey,
  enhancement: EnhancementLevel,
  catalog: MagicItem[]
): CharacterBuild {
  return patchStandardSlot(build, slotKey, (prev) => {
    if (!prev?.baseId && !prev?.enchantmentId && enhancement === 0) return undefined;
    let next: EquipmentSlotSelection = { ...(prev ?? {}), enhancement };
    if (prev?.enchantmentId) {
      const family =
        findEnchantmentFamilyById(index, prev.enchantmentId) ??
        (() => {
          const key = enchantmentFamilyKeyFromId(index, prev.enchantmentId);
          return key ? findEnchantmentFamilyByKey(index, key, catalog) : undefined;
        })();
      if (family) {
        const clamped = clampEnhancementToFamily(family, enhancement);
        next.enhancement = clamped;
        const id = resolveEnchantmentIdForFamily(index, family.key, clamped, family.items[0]);
        if (id) next.enchantmentId = id;
      }
    }
    return next;
  });
}

function pruneImplementSlot(slot: ImplementSlotSelection | undefined): ImplementSlotSelection | undefined {
  if (!slot) return undefined;
  const out: ImplementSlotSelection = {};
  if (slot.superiorImplementId) out.superiorImplementId = slot.superiorImplementId;
  if (slot.enchantmentId) out.enchantmentId = slot.enchantmentId;
  const enhancement = slot.enhancement ?? 0;
  if (enhancement > 0 || out.superiorImplementId || out.enchantmentId) out.enhancement = enhancement;
  if (!out.superiorImplementId && !out.enchantmentId && (out.enhancement ?? 0) === 0) return undefined;
  return out;
}

export function setImplementSuperior(
  build: CharacterBuild,
  superiorImplementId: string | undefined
): CharacterBuild {
  const equipment = baseEquipment(build);
  const prev = equipment.implement;
  let nextImplement: ImplementSlotSelection | undefined;
  if (!superiorImplementId) {
    if (!prev?.enchantmentId) nextImplement = undefined;
    else {
      nextImplement = { ...prev };
      delete nextImplement.superiorImplementId;
    }
  } else {
    nextImplement = { ...prev, superiorImplementId };
  }
  const next: CharacterEquipment = { ...equipment, implement: pruneImplementSlot(nextImplement) };
  if (!next.implement) delete next.implement;
  return withEquipment(build, next);
}

export function setImplementEnchantmentFamily(
  build: CharacterBuild,
  index: RulesIndex,
  familyKey: string | undefined,
  catalog: MagicItem[]
): CharacterBuild {
  const equipment = baseEquipment(build);
  const prev = equipment.implement;
  let nextImplement: ImplementSlotSelection | undefined;
  if (!familyKey) {
    if (!prev?.superiorImplementId) nextImplement = undefined;
    else {
      nextImplement = { ...prev };
      delete nextImplement.enchantmentId;
    }
  } else {
    const family = findEnchantmentFamilyByKey(index, familyKey, catalog);
    if (!family) nextImplement = prev;
    else {
      const enhancement = clampEnhancementToFamily(family, prev?.enhancement ?? family.allowedEnhancements[0]);
      const enchantmentId = resolveEnchantmentIdForFamily(index, familyKey, enhancement, family.items[0]);
      nextImplement = { ...prev, enchantmentId, enhancement };
    }
  }
  const next: CharacterEquipment = { ...equipment, implement: pruneImplementSlot(nextImplement) };
  if (!next.implement) delete next.implement;
  return withEquipment(build, next);
}

export function setImplementEnhancement(
  build: CharacterBuild,
  index: RulesIndex,
  enhancement: EnhancementLevel,
  catalog: MagicItem[]
): CharacterBuild {
  const equipment = baseEquipment(build);
  const prev = equipment.implement;
  if (!prev?.superiorImplementId && !prev?.enchantmentId && enhancement === 0) {
    const next: CharacterEquipment = { ...equipment };
    delete next.implement;
    return withEquipment(build, next);
  }
  let nextImplement: ImplementSlotSelection = { ...(prev ?? {}), enhancement };
  if (prev?.enchantmentId) {
    const family =
      findEnchantmentFamilyById(index, prev.enchantmentId) ??
      (() => {
        const key = enchantmentFamilyKeyFromId(index, prev.enchantmentId);
        return key ? findEnchantmentFamilyByKey(index, key, catalog) : undefined;
      })();
    if (family) {
      const clamped = clampEnhancementToFamily(family, enhancement);
      nextImplement.enhancement = clamped;
      const id = resolveEnchantmentIdForFamily(index, family.key, clamped, family.items[0]);
      if (id) nextImplement.enchantmentId = id;
    }
  }
  return withEquipment(build, {
    ...equipment,
    implement: pruneImplementSlot(nextImplement)
  });
}

function pruneMagicOnlySlot(slot: MagicOnlySlotSelection | undefined): MagicOnlySlotSelection | undefined {
  if (!slot) return undefined;
  if (!slot.enchantmentId && (slot.enhancement ?? 0) === 0) return undefined;
  const out: MagicOnlySlotSelection = { enhancement: slot.enhancement ?? 0 };
  if (slot.enchantmentId) out.enchantmentId = slot.enchantmentId;
  return out;
}

function assignMagicOnlySlot(
  equipment: CharacterEquipment,
  slotKey: MagicOnlyEquipmentSlotKey,
  slot: MagicOnlySlotSelection | undefined
): void {
  if (slotKey === "neck") {
    equipment.neck = slot ?? { enhancement: 0 };
    return;
  }
  if (slot) equipment[slotKey] = slot;
  else delete equipment[slotKey];
}

export function setMagicOnlySlotEnchantmentFamily(
  build: CharacterBuild,
  index: RulesIndex,
  slotKey: MagicOnlyEquipmentSlotKey,
  familyKey: string | undefined,
  catalog: MagicItem[]
): CharacterBuild {
  const equipment = baseEquipment(build);
  const prevEnh = equipment[slotKey]?.enhancement ?? 0;
  let next: MagicOnlySlotSelection | undefined;
  if (!familyKey) {
    next = slotKey === "neck" || prevEnh > 0 ? { enhancement: prevEnh } : undefined;
  } else {
    const family = findEnchantmentFamilyByKey(index, familyKey, catalog);
    if (!family) {
      next = equipment[slotKey] ?? (slotKey === "neck" ? { enhancement: 0 } : undefined);
    } else {
      const enhancement = clampEnhancementToFamily(family, prevEnh || family.allowedEnhancements[0]);
      const enchantmentId = resolveEnchantmentIdForFamily(index, familyKey, enhancement, family.items[0]);
      next = { enchantmentId, enhancement };
    }
  }
  const updated: CharacterEquipment = { ...equipment };
  assignMagicOnlySlot(updated, slotKey, slotKey === "neck" ? next : pruneMagicOnlySlot(next));
  return withEquipment(build, updated);
}

export function setMagicOnlySlotEnhancement(
  build: CharacterBuild,
  index: RulesIndex,
  slotKey: MagicOnlyEquipmentSlotKey,
  enhancement: EnhancementLevel,
  catalog: MagicItem[]
): CharacterBuild {
  const equipment = baseEquipment(build);
  const prev = equipment[slotKey] ?? { enhancement: 0 };
  let next: MagicOnlySlotSelection = { ...prev, enhancement };
  if (prev.enchantmentId) {
    const family =
      findEnchantmentFamilyById(index, prev.enchantmentId) ??
      (() => {
        const key = enchantmentFamilyKeyFromId(index, prev.enchantmentId);
        return key ? findEnchantmentFamilyByKey(index, key, catalog) : undefined;
      })();
    if (family) {
      const clamped = clampEnhancementToFamily(family, enhancement);
      next.enhancement = clamped;
      const id = resolveEnchantmentIdForFamily(index, family.key, clamped, family.items[0]);
      if (id) next.enchantmentId = id;
    }
  }
  if (!next.enchantmentId) delete next.enchantmentId;
  const updated: CharacterEquipment = { ...equipment };
  assignMagicOnlySlot(updated, slotKey, slotKey === "neck" ? next : pruneMagicOnlySlot(next));
  return withEquipment(build, updated);
}

export function setNeckEnchantmentFamily(
  build: CharacterBuild,
  index: RulesIndex,
  familyKey: string | undefined,
  catalog: MagicItem[]
): CharacterBuild {
  return setMagicOnlySlotEnchantmentFamily(build, index, "neck", familyKey, catalog);
}

export function setNeckEnhancement(
  build: CharacterBuild,
  index: RulesIndex,
  enhancement: EnhancementLevel,
  catalog: MagicItem[]
): CharacterBuild {
  return setMagicOnlySlotEnhancement(build, index, "neck", enhancement, catalog);
}
