import { magicItemFamilyDisplayName } from "./enchantmentFamilies";
import { findMagicItem } from "./magicItemEquipment";
import type { CharacterEquipment, RulesIndex } from "./models";

export interface EquipmentEnchantmentEffect {
  slotLabel: string;
  name: string;
  property?: string;
  power?: string;
  critical?: string;
}

function shortEffectText(text: string, maxLen = 280): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLen) return normalized;
  return `${normalized.slice(0, maxLen - 1)}…`;
}

function pushEffect(
  rows: EquipmentEnchantmentEffect[],
  index: RulesIndex,
  slotLabel: string,
  enchantmentId: string | undefined
): void {
  if (!enchantmentId) return;
  const item = findMagicItem(index, enchantmentId);
  if (!item) return;
  const property = item.property?.trim();
  const power = item.power?.trim();
  const critical = item.critical?.trim();
  if (!property && !power && !critical) return;
  rows.push({
    slotLabel,
    name: magicItemFamilyDisplayName(item.name),
    property: property ? shortEffectText(property) : undefined,
    power: power ? shortEffectText(power) : undefined,
    critical: critical ? shortEffectText(critical) : undefined
  });
}

/** Property, power, and critical text from equipped enchantments (non-numeric effects). */
export function equipmentEnchantmentEffects(
  equipment: CharacterEquipment,
  index: RulesIndex
): EquipmentEnchantmentEffect[] {
  const rows: EquipmentEnchantmentEffect[] = [];
  pushEffect(rows, index, "Armor", equipment.armor?.enchantmentId);
  pushEffect(rows, index, "Shield", equipment.shield?.enchantmentId);
  pushEffect(rows, index, "Main hand", equipment.mainHand?.enchantmentId);
  pushEffect(rows, index, "Off hand", equipment.offHand?.enchantmentId);
  pushEffect(rows, index, "Implement", equipment.implement?.enchantmentId);
  pushEffect(rows, index, "Neck", equipment.neck?.enchantmentId);
  return rows;
}
