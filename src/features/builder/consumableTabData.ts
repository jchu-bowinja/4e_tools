import {
  formatGearPriceGp,
  formatMagicItemPrice
} from "../../rules/consumablesCatalog";
import {
  alchemyUnitPriceGp,
  gearUnitPriceGp,
  martialPracticeMarketPriceGp,
  ritualMarketPriceGp
} from "../../rules/consumablesPrices";
import type { ConsumablesCatalog } from "../../data/loadConsumablesCatalog";
import type { ConsumablePickerRow } from "./CharacterConsumablePickerTab";

export function adventuringGearPickerRowsFromCatalog(catalog: ConsumablesCatalog): ConsumablePickerRow[] {
  return catalog.adventuringGear.map((g) => ({
    id: g.id,
    name: g.name,
    slug: g.slug,
    source: g.source,
    meta: [g.category, formatGearPriceGp(g.priceGp)].filter(Boolean).join(" · "),
    body: g.body ?? undefined,
    unitPriceGp: gearUnitPriceGp(g)
  }));
}

export function ritualPickerRowsFromCatalog(catalog: ConsumablesCatalog): ConsumablePickerRow[] {
  return catalog.rituals.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    source: r.source,
    meta: ritualMetaLine(r),
    flavor: r.flavor ?? undefined,
    body: r.body ?? undefined,
    unitPriceGp: ritualMarketPriceGp(r)
  }));
}

export function martialPracticePickerRowsFromCatalog(catalog: ConsumablesCatalog): ConsumablePickerRow[] {
  return catalog.martialPractices.map((r) => ({
    id: r.id,
    name: r.name.replace(/\s+Martial Practice$/i, ""),
    slug: r.slug,
    source: r.source,
    meta: ritualMetaLine(r),
    flavor: r.flavor ?? undefined,
    body: r.body ?? undefined,
    unitPriceGp: martialPracticeMarketPriceGp(r)
  }));
}

export function alchemyPickerRowsFromCatalog(catalog: ConsumablesCatalog): ConsumablePickerRow[] {
  return catalog.alchemyItems.map((item) => ({
    id: item.id,
    name: item.name,
    slug: item.slug,
    source: item.source,
    meta: [
      item.magicItemType,
      item.level != null ? `Level ${item.level}` : null,
      formatMagicItemPrice(item)
    ]
      .filter(Boolean)
      .join(" · "),
    flavor: item.flavor ?? undefined,
    body: typeof item.raw?.body === "string" ? item.raw.body : undefined,
    unitPriceGp: alchemyUnitPriceGp(item)
  }));
}

function ritualMetaLine(r: {
  category?: string | null;
  level?: number | null;
  keySkill?: string | null;
  marketPriceGp?: number | null;
}): string {
  return [
    r.category,
    r.level != null ? `Level ${r.level}` : null,
    r.keySkill,
    r.marketPriceGp != null ? `${r.marketPriceGp} gp` : null
  ]
    .filter(Boolean)
    .join(" · ");
}
