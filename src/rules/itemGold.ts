import type { Armor, Implement, MagicItem, RulesIndex, Weapon } from "./models";

function parseGoldText(value: unknown): number | undefined {
  if (value == null) return undefined;
  const digits = String(value).replace(/[^\d]/g, "");
  if (!digits) return undefined;
  const n = Number.parseInt(digits, 10);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/** Gold piece cost from compendium `specific.Gold` on entity raw data. */
export function goldFromEntityRaw(raw: Record<string, unknown> | undefined): number | undefined {
  if (!raw) return undefined;
  const specific = raw.specific;
  if (specific && typeof specific === "object") {
    return parseGoldText((specific as Record<string, unknown>).Gold);
  }
  return parseGoldText(raw.Gold);
}

export function magicItemGold(item: MagicItem | undefined): number | undefined {
  if (!item) return undefined;
  if (item.gold != null && item.gold >= 0) return item.gold;
  return goldFromEntityRaw(item.raw);
}

export function armorGold(index: RulesIndex, armorId: string | undefined): number | undefined {
  if (!armorId) return undefined;
  const armor = index.armors.find((a) => a.id === armorId);
  if (!armor) return undefined;
  return goldFromEntityRaw(armor.raw);
}

export function weaponGold(index: RulesIndex, weaponId: string | undefined): number | undefined {
  if (!weaponId) return undefined;
  const weapon = (index.weapons ?? []).find((w) => w.id === weaponId);
  if (!weapon) return undefined;
  return goldFromEntityRaw(weapon.raw);
}

export function implementGold(index: RulesIndex, implementId: string | undefined): number | undefined {
  if (!implementId) return undefined;
  const implement = (index.implements ?? []).find((i) => i.id === implementId);
  if (!implement) return undefined;
  return goldFromEntityRaw(implement.raw);
}

export function formatGoldCost(cost: number | undefined): string {
  if (cost == null) return "— gp";
  return `${cost.toLocaleString()} gp`;
}
