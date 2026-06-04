import {
  alchemyDescriptionParts,
  alchemyDetailMeta,
  gearDescriptionParts,
  gearDetailMeta,
  ritualDescriptionParts,
  ritualDetailMeta
} from "../../rules/consumablesDisplay";
import {
  alchemyUnitPriceGp,
  gearUnitPriceGp,
  martialPracticeMarketPriceGp,
  ritualMarketPriceGp
} from "../../rules/consumablesPrices";
import type { ConsumablesCatalog } from "../../data/loadConsumablesCatalog";
import type { ConsumablePickerRow } from "./CharacterConsumablePickerTab";

export function adventuringGearPickerRowsFromCatalog(catalog: ConsumablesCatalog): ConsumablePickerRow[] {
  return catalog.adventuringGear.map((g) => {
    const desc = gearDescriptionParts(g);
    return {
      id: g.id,
      name: g.name,
      slug: g.slug,
      source: g.source,
      meta: gearDetailMeta(g),
      ...desc,
      unitPriceGp: gearUnitPriceGp(g)
    };
  });
}

export function ritualPickerRowsFromCatalog(catalog: ConsumablesCatalog): ConsumablePickerRow[] {
  return catalog.rituals.map((r) => {
    const desc = ritualDescriptionParts(r);
    return {
      id: r.id,
      name: r.name,
      slug: r.slug,
      source: r.source,
      level: r.level ?? undefined,
      meta: ritualDetailMeta(r),
      ...desc,
      unitPriceGp: ritualMarketPriceGp(r)
    };
  });
}

export function martialPracticePickerRowsFromCatalog(catalog: ConsumablesCatalog): ConsumablePickerRow[] {
  return catalog.martialPractices.map((r) => {
    const desc = ritualDescriptionParts(r);
    return {
      id: r.id,
      name: r.name.replace(/\s+Martial Practice$/i, ""),
      slug: r.slug,
      source: r.source,
      level: r.level ?? undefined,
      meta: ritualDetailMeta(r),
      ...desc,
      unitPriceGp: martialPracticeMarketPriceGp(r)
    };
  });
}

export function alchemyPickerRowsFromCatalog(catalog: ConsumablesCatalog): ConsumablePickerRow[] {
  return catalog.alchemyItems.map((item) => {
    const desc = alchemyDescriptionParts(item);
    return {
      id: item.id,
      name: item.name,
      slug: item.slug,
      source: item.source,
      level: item.level ?? undefined,
      meta: alchemyDetailMeta(item),
      ...desc,
      unitPriceGp: alchemyUnitPriceGp(item)
    };
  });
}
