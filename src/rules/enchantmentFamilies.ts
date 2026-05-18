import { findMagicItem } from "./magicItemEquipment";
import type { CharacterBuild, EnhancementLevel, MagicItem, RulesIndex } from "./models";

export interface EnchantmentFamily {
  /** Stable key for UI selection (base slug / name without +N). */
  key: string;
  displayName: string;
  items: MagicItem[];
  allowedEnhancements: EnhancementLevel[];
}

const PLUS_SUFFIX_RE = /\s*\+\s*(\d+)\s*$/i;
const SLUG_PLUS_SUFFIX_RE = /-(?:[0-6])$/;

/** Strip trailing +N from display name for family grouping. */
export function magicItemFamilyDisplayName(name: string): string {
  return name.replace(PLUS_SUFFIX_RE, "").trim();
}

/** Group key shared by compendium rows that differ only by enhancement tier. */
export function magicItemFamilyKey(item: MagicItem): string {
  const slug = String(item.slug || "").trim();
  if (slug) {
    const baseSlug = slug.replace(SLUG_PLUS_SUFFIX_RE, "");
    if (baseSlug !== slug) return baseSlug;
  }
  return magicItemFamilyDisplayName(item.name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function enhancementForItem(item: MagicItem): EnhancementLevel {
  const fromField = item.enhancementBonus;
  if (typeof fromField === "number" && Number.isFinite(fromField)) {
    const n = Math.trunc(fromField);
    if (n >= 0 && n <= 6) return n as EnhancementLevel;
  }
  const m = String(item.enhancement || "").match(/\+(\d+)/);
  if (m) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n >= 0 && n <= 6) return n as EnhancementLevel;
  }
  return 0;
}

function uniqueEnhancements(levels: EnhancementLevel[]): EnhancementLevel[] {
  const seen = new Set<EnhancementLevel>();
  const out: EnhancementLevel[] = [];
  for (const n of levels.sort((a, b) => a - b)) {
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

export function groupMagicItemsIntoFamilies(items: MagicItem[]): EnchantmentFamily[] {
  const byKey = new Map<string, MagicItem[]>();
  for (const item of items) {
    const key = magicItemFamilyKey(item);
    const list = byKey.get(key) ?? [];
    list.push(item);
    byKey.set(key, list);
  }

  const families: EnchantmentFamily[] = [];
  for (const [key, members] of byKey) {
    const sorted = [...members].sort((a, b) => enhancementForItem(a) - enhancementForItem(b));
    const allowedEnhancements = uniqueEnhancements(sorted.map(enhancementForItem));
    families.push({
      key,
      displayName: magicItemFamilyDisplayName(sorted[0].name),
      items: sorted,
      allowedEnhancements
    });
  }

  return families.sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" }));
}

export function formatEnchantmentFamilyLabel(family: EnchantmentFamily): string {
  const levels = family.allowedEnhancements;
  if (levels.length === 0) return family.displayName;
  const min = levels[0];
  const max = levels[levels.length - 1];
  if (min === max) return `${family.displayName} (+${min})`;
  return `${family.displayName} (+${min}–+${max})`;
}

export function resolveMagicItemInFamily(
  family: EnchantmentFamily | MagicItem[],
  enhancement: EnhancementLevel
): MagicItem | undefined {
  const items = Array.isArray(family) ? family : family.items;
  return items.find((m) => enhancementForItem(m) === enhancement);
}

export function findEnchantmentFamilyById(
  index: RulesIndex,
  enchantmentId: string | undefined
): EnchantmentFamily | undefined {
  const item = findMagicItem(index, enchantmentId);
  if (!item) return undefined;
  return findEnchantmentFamilyByKey(index, magicItemFamilyKey(item));
}

export function findEnchantmentFamilyByKey(
  index: RulesIndex,
  familyKey: string,
  catalog?: MagicItem[]
): EnchantmentFamily | undefined {
  const pool = catalog ?? index.magicItems ?? [];
  const siblings = pool.filter((m) => magicItemFamilyKey(m) === familyKey);
  if (siblings.length === 0) return undefined;
  return groupMagicItemsIntoFamilies(siblings)[0];
}

export function enchantmentFamilyKeyFromId(
  index: RulesIndex,
  enchantmentId: string | undefined
): string | undefined {
  const item = findMagicItem(index, enchantmentId);
  return item ? magicItemFamilyKey(item) : undefined;
}

/** Pick the compendium row for this family and user-selected plus. */
export function resolveEnchantmentIdForFamily(
  index: RulesIndex,
  familyKey: string,
  enhancement: EnhancementLevel,
  typeHint?: MagicItem
): string | undefined {
  const hintType = typeHint?.magicItemType;
  const siblings = (index.magicItems ?? []).filter((m) => {
    if (magicItemFamilyKey(m) !== familyKey) return false;
    if (hintType && m.magicItemType !== hintType) return false;
    return true;
  });
  const family = groupMagicItemsIntoFamilies(siblings)[0];
  if (!family) return undefined;
  const clamped = family.allowedEnhancements.includes(enhancement)
    ? enhancement
    : family.allowedEnhancements[0];
  return resolveMagicItemInFamily(family, clamped)?.id;
}

export function clampEnhancementToFamily(
  family: EnchantmentFamily | undefined,
  enhancement: EnhancementLevel
): EnhancementLevel {
  if (!family || family.allowedEnhancements.length === 0) return enhancement;
  if (family.allowedEnhancements.includes(enhancement)) return enhancement;
  return family.allowedEnhancements[0];
}

export function equipmentDuplicateEnchantmentWarnings(build: CharacterBuild, index?: RulesIndex): string[] {
  const equipment = build.equipment;
  if (!equipment) return [];
  const main = equipment.mainHand?.enchantmentId;
  const off = equipment.offHand?.enchantmentId;
  if (!main || !off) return [];
  if (main === off) {
    return ["The same magic enchantment is selected for both main-hand and off-hand weapons."];
  }
  if (index && enchantmentFamilyKeyFromId(index, main) === enchantmentFamilyKeyFromId(index, off)) {
    return ["The same magic enchantment is selected for both main-hand and off-hand weapons."];
  }
  return [];
}
