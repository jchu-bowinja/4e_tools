import type { GearItem, MagicItem, RitualItem, RulesIndex } from "./models";

/** Gear categories shown on the adventuring gear tab (PHB-style supplies and ammunition). */
export const ADVENTURING_GEAR_CATEGORIES = new Set(["Gear", "Ammunition"]);

const ALCHEMY_MAGIC_ITEM_TYPES = new Set([
  "Alchemical",
  "Elixir",
  "Potion",
  "Consumable",
  "Other Consumable"
]);

export function isMartialPracticeRitual(ritual: RitualItem): boolean {
  const cat = (ritual.category ?? "").toLowerCase();
  return cat.includes("martial practice");
}

export function adventuringGearFromIndex(index: RulesIndex): GearItem[] {
  const gear = index.gear ?? [];
  return gear.filter((g) => {
    const cat = g.category ?? "";
    return ADVENTURING_GEAR_CATEGORIES.has(cat);
  });
}

export function ritualsFromIndex(index: RulesIndex): RitualItem[] {
  if (index.rituals?.length) {
    return index.rituals;
  }
  return [];
}

export function martialPracticesFromIndex(index: RulesIndex): RitualItem[] {
  if (index.martialPractices?.length) {
    return index.martialPractices;
  }
  return [];
}

export function alchemyItemsFromIndex(index: RulesIndex): MagicItem[] {
  if (index.alchemyItems?.length) {
    return index.alchemyItems;
  }
  const items = index.magicItems ?? [];
  return items.filter((item) => {
    const t = item.magicItemType;
    const type = Array.isArray(t) ? t[0] : t;
    return type != null && ALCHEMY_MAGIC_ITEM_TYPES.has(String(type));
  });
}

export function formatGearPriceGp(priceGp: number | null | undefined): string | undefined {
  if (priceGp == null || Number.isNaN(priceGp)) return undefined;
  if (priceGp === 0) return "—";
  if (priceGp >= 1) {
    const rounded = Math.round(priceGp * 100) / 100;
    return Number.isInteger(rounded) ? `${rounded} gp` : `${rounded} gp`;
  }
  const cp = Math.round(priceGp * 100);
  if (cp % 10 === 0) return `${cp / 10} sp`;
  return `${cp} cp`;
}

export function formatMagicItemPrice(item: MagicItem): string | undefined {
  if (item.gold == null) return undefined;
  return `${item.gold} gp`;
}

export function pruneIdList(ids: string[] | undefined, allowed: ReadonlySet<string>): string[] {
  if (!ids?.length) return [];
  return ids.filter((id) => allowed.has(id));
}

export interface CharacterConsumableIds {
  gearIds?: string[];
  ritualIds?: string[];
  martialPracticeIds?: string[];
  alchemyItemIds?: string[];
}

export function pruneCharacterConsumableIds(
  ids: CharacterConsumableIds,
  index: RulesIndex
): CharacterConsumableIds {
  const gearAllowed = new Set(adventuringGearFromIndex(index).map((g) => g.id));
  const ritualAllowed = new Set(ritualsFromIndex(index).map((r) => r.id));
  const practiceAllowed = new Set(martialPracticesFromIndex(index).map((r) => r.id));
  const alchemyAllowed = new Set(alchemyItemsFromIndex(index).map((a) => a.id));
  return {
    gearIds: pruneIdList(ids.gearIds, gearAllowed),
    ritualIds: pruneIdList(ids.ritualIds, ritualAllowed),
    martialPracticeIds: pruneIdList(ids.martialPracticeIds, practiceAllowed),
    alchemyItemIds: pruneIdList(ids.alchemyItemIds, alchemyAllowed)
  };
}
