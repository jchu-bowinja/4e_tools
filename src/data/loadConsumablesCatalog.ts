import type { GearItem, MagicItem, RitualItem, RulesIndex } from "../rules/models";
import {
  ADVENTURING_GEAR_CATEGORIES,
  adventuringGearFromIndex,
  alchemyItemsFromIndex,
  martialPracticesFromIndex,
  ritualsFromIndex
} from "../rules/consumablesCatalog";

export interface ConsumablesCatalog {
  adventuringGear: GearItem[];
  rituals: RitualItem[];
  martialPractices: RitualItem[];
  alchemyItems: MagicItem[];
}

const CATALOG_URLS = {
  adventuringGear: "/generated/catalogs/adventuring_gear.json",
  rituals: "/generated/catalogs/rituals.json",
  martialPractices: "/generated/catalogs/martial_practices.json",
  alchemyItems: "/generated/catalogs/alchemy_items.json"
} as const;

let cachedCatalogPromise: Promise<ConsumablesCatalog | null> | null = null;

async function fetchCatalogJson<T>(url: string): Promise<T[]> {
  const response = await fetch(url);
  if (!response.ok) {
    return [];
  }
  const data = (await response.json()) as unknown;
  return Array.isArray(data) ? (data as T[]) : [];
}

async function fetchConsumablesCatalogFiles(): Promise<ConsumablesCatalog | null> {
  try {
    const [adventuringGear, rituals, martialPractices, alchemyItems] = await Promise.all([
      fetchCatalogJson<GearItem>(CATALOG_URLS.adventuringGear),
      fetchCatalogJson<RitualItem>(CATALOG_URLS.rituals),
      fetchCatalogJson<RitualItem>(CATALOG_URLS.martialPractices),
      fetchCatalogJson<MagicItem>(CATALOG_URLS.alchemyItems)
    ]);
    const hasAny =
      adventuringGear.length > 0 ||
      rituals.length > 0 ||
      martialPractices.length > 0 ||
      alchemyItems.length > 0;
    if (!hasAny) {
      return null;
    }
    return { adventuringGear, rituals, martialPractices, alchemyItems };
  } catch {
    return null;
  }
}

function consumablesFromIndex(index: RulesIndex): ConsumablesCatalog {
  return {
    adventuringGear: adventuringGearFromIndex(index),
    rituals: ritualsFromIndex(index),
    martialPractices: martialPracticesFromIndex(index),
    alchemyItems: alchemyItemsFromIndex(index)
  };
}

export function getConsumablesFromIndex(index: RulesIndex): ConsumablesCatalog {
  return consumablesFromIndex(index);
}

function indexHasConsumablesData(index: RulesIndex): boolean {
  const fromIndex = consumablesFromIndex(index);
  return (
    fromIndex.adventuringGear.length > 0 ||
    fromIndex.rituals.length > 0 ||
    fromIndex.martialPractices.length > 0 ||
    fromIndex.alchemyItems.length > 0
  );
}

function mergeConsumables(index: RulesIndex, files: ConsumablesCatalog | null): ConsumablesCatalog {
  const fromIndex = consumablesFromIndex(index);
  if (!files) {
    return fromIndex;
  }
  return {
    adventuringGear:
      fromIndex.adventuringGear.length > 0 ? fromIndex.adventuringGear : files.adventuringGear,
    rituals: fromIndex.rituals.length > 0 ? fromIndex.rituals : files.rituals,
    martialPractices:
      fromIndex.martialPractices.length > 0 ? fromIndex.martialPractices : files.martialPractices,
    alchemyItems: fromIndex.alchemyItems.length > 0 ? fromIndex.alchemyItems : files.alchemyItems
  };
}

/** Resolve consumables from `rules_index` with fallback to `/generated/catalogs/*.json`. */
export async function resolveConsumablesCatalog(index: RulesIndex): Promise<ConsumablesCatalog> {
  if (indexHasConsumablesData(index)) {
    return consumablesFromIndex(index);
  }
  if (!cachedCatalogPromise) {
    cachedCatalogPromise = fetchConsumablesCatalogFiles();
  }
  const files = await cachedCatalogPromise;
  return mergeConsumables(index, files);
}

export function consumablesCatalogNeedsFetch(index: RulesIndex): boolean {
  return !indexHasConsumablesData(index);
}

export function filterAdventuringGearRows(gear: GearItem[]): GearItem[] {
  return gear.filter((g) => ADVENTURING_GEAR_CATEGORIES.has(g.category ?? ""));
}
