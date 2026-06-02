import type { CharacterBuild, GearItem, MagicItem, RitualItem, RulesIndex } from "./models";
import {
  consumableEntries,
  migrateCharacterConsumables,
  pruneConsumableEntries,
  martialPracticeScrollEntries,
  ritualScrollEntries,
  setMartialPracticeScrollEntries,
  setRitualScrollEntries,
  type ConsumableListKey
} from "./consumablesModel";

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

function allowedIdsForList(index: RulesIndex, key: ConsumableListKey): Set<string> {
  switch (key) {
    case "gear":
      return new Set(adventuringGearFromIndex(index).map((g) => g.id));
    case "rituals":
      return new Set(ritualsFromIndex(index).map((r) => r.id));
    case "martialPractices":
      return new Set(martialPracticesFromIndex(index).map((r) => r.id));
    case "alchemy":
      return new Set(alchemyItemsFromIndex(index).map((a) => a.id));
  }
}

export function pruneCharacterConsumables(build: CharacterBuild, index: RulesIndex): CharacterBuild {
  const migrated = migrateCharacterConsumables(build);
  let next = migrated;
  const keys: ConsumableListKey[] = ["gear", "rituals", "martialPractices", "alchemy"];
  for (const key of keys) {
    const allowed = allowedIdsForList(index, key);
    const pruned = pruneConsumableEntries(consumableEntries(next, key), allowed);
    next = { ...next, [key]: pruned.length > 0 ? pruned : undefined };
  }
  const ritualAllowed = allowedIdsForList(index, "rituals");
  const prunedScrolls = pruneConsumableEntries(ritualScrollEntries(next), ritualAllowed);
  next = setRitualScrollEntries(next, prunedScrolls);
  const practiceAllowed = allowedIdsForList(index, "martialPractices");
  const prunedPracticeScrolls = pruneConsumableEntries(martialPracticeScrollEntries(next), practiceAllowed);
  next = setMartialPracticeScrollEntries(next, prunedPracticeScrolls);
  return next;
}

/** @deprecated Use pruneCharacterConsumables */
export function pruneCharacterConsumableIds(
  ids: {
    gearIds?: string[];
    ritualIds?: string[];
    martialPracticeIds?: string[];
    alchemyItemIds?: string[];
  },
  index: RulesIndex
): typeof ids {
  const build: CharacterBuild = {
    name: "",
    level: 1,
    abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 10 },
    trainedSkillIds: [],
    featIds: [],
    powerIds: [],
    gearIds: ids.gearIds,
    ritualIds: ids.ritualIds,
    martialPracticeIds: ids.martialPracticeIds,
    alchemyItemIds: ids.alchemyItemIds
  };
  const pruned = pruneCharacterConsumables(build, index);
  return {
    gearIds: pruned.gear?.map((e) => e.id),
    ritualIds: pruned.rituals?.map((e) => e.id),
    martialPracticeIds: pruned.martialPractices?.map((e) => e.id),
    alchemyItemIds: pruned.alchemy?.map((e) => e.id)
  };
}
