import type { GearItem, MagicItem, RitualItem } from "./models";
import { formatGearPriceGp, formatMagicItemPrice } from "./consumablesCatalog";
import { normalizeCompendiumTextField } from "./equipmentDescriptions";

export interface ConsumableDescriptionParts {
  flavor?: string;
  body?: string;
}

export function hasConsumableDescription(parts: ConsumableDescriptionParts): boolean {
  return Boolean(parts.flavor?.trim() || parts.body?.trim());
}

export function gearDescriptionParts(g: GearItem): ConsumableDescriptionParts {
  const body = normalizeCompendiumTextField(g.body);
  return body ? { body } : {};
}

export function ritualDescriptionParts(r: RitualItem): ConsumableDescriptionParts {
  const flavor = normalizeCompendiumTextField(r.flavor);
  const body = normalizeCompendiumTextField(r.body);
  return {
    ...(flavor ? { flavor } : {}),
    ...(body ? { body } : {})
  };
}

export function alchemyDescriptionParts(item: MagicItem): ConsumableDescriptionParts {
  const flavor = normalizeCompendiumTextField(item.flavor);
  const power = normalizeCompendiumTextField(item.power);
  const rawBody = normalizeCompendiumTextField(item.raw?.body);
  const body = power || rawBody || undefined;
  return {
    ...(flavor ? { flavor } : {}),
    ...(body ? { body } : {})
  };
}

export function gearDetailMeta(g: GearItem): string {
  return [
    g.category,
    formatGearPriceGp(g.priceGp),
    g.weightLb != null ? `${g.weightLb} lb` : null,
    g.count != null && g.count !== 1 ? `×${g.count}` : null
  ]
    .filter(Boolean)
    .join(" · ");
}

export function ritualDetailMeta(r: RitualItem): string {
  return [
    r.category,
    r.level != null ? `Level ${r.level}` : null,
    r.keySkill,
    r.marketPriceGp != null ? `${r.marketPriceGp} gp` : null,
    r.componentCost ? `Components: ${r.componentCost}` : null,
    r.time ? `Time: ${r.time}` : null,
    r.duration ? `Duration: ${r.duration}` : null
  ]
    .filter(Boolean)
    .join(" · ");
}

export function alchemyDetailMeta(item: MagicItem): string {
  return [
    item.magicItemType,
    item.level != null ? `Level ${item.level}` : null,
    item.rarity,
    formatMagicItemPrice(item)
  ]
    .filter(Boolean)
    .join(" · ");
}
