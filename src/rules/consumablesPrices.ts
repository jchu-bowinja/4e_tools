import type { GearItem, MagicItem, RitualItem } from "./models";
import { magicItemGold } from "./itemGold";

/** Unit price in gp for mundane gear (supports fractional gp from sp/cp). */
export function gearUnitPriceGp(gear: GearItem): number | undefined {
  if (gear.priceGp == null || Number.isNaN(gear.priceGp)) return undefined;
  return gear.priceGp > 0 ? gear.priceGp : undefined;
}

/** Cost to add ritual to ritual book (market price). */
export function ritualMarketPriceGp(ritual: RitualItem): number | undefined {
  if (ritual.marketPriceGp != null && ritual.marketPriceGp >= 0) {
    return ritual.marketPriceGp;
  }
  return undefined;
}

export function alchemyUnitPriceGp(item: MagicItem): number | undefined {
  return magicItemGold(item);
}

export function martialPracticeMarketPriceGp(practice: RitualItem): number | undefined {
  return ritualMarketPriceGp(practice);
}

export function linePurchaseCostGp(unitPrice: number | undefined, quantity: number): number | undefined {
  if (unitPrice == null || quantity <= 0) return undefined;
  return Math.ceil(unitPrice * quantity);
}
