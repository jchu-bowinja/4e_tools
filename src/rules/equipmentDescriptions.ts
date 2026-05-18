import type { Armor, Implement, MagicItem, Weapon } from "./models";

function compendiumBody(raw: Record<string, unknown> | undefined): string | undefined {
  const body = raw?.body;
  if (typeof body === "string" && body.trim()) return body.trim();
  return undefined;
}

function joinLines(lines: string[]): string | undefined {
  const filtered = lines.filter(Boolean);
  return filtered.length > 0 ? filtered.join("\n") : undefined;
}

export function describeArmor(armor: Armor): string | undefined {
  const body = compendiumBody(armor.raw as Record<string, unknown>);
  if (body) return body;
  return joinLines([
    armor.armorCategory && armor.armorType
      ? `${armor.armorCategory} (${armor.armorType})`
      : armor.armorType || armor.armorCategory || undefined,
    armor.armorBonus != null ? `Armor bonus +${armor.armorBonus}` : undefined,
    armor.checkPenalty != null && armor.checkPenalty !== 0 ? `Check penalty ${armor.checkPenalty}` : undefined,
    armor.speedPenalty != null && armor.speedPenalty !== 0 ? `Speed penalty ${armor.speedPenalty}` : undefined
  ]);
}

export function describeWeapon(weapon: Weapon): string | undefined {
  const body = compendiumBody(weapon.raw as Record<string, unknown>);
  if (body) return body;
  return joinLines([
    weapon.damage ? `Damage ${weapon.damage}` : undefined,
    weapon.weaponCategory ? `Category ${weapon.weaponCategory}` : undefined,
    weapon.weaponGroup ? `Group ${weapon.weaponGroup}` : undefined,
    weapon.range ? `Range ${weapon.range}` : undefined,
    weapon.properties ? `Properties ${weapon.properties}` : undefined,
    weapon.proficiencyBonus != null ? `Proficiency bonus +${weapon.proficiencyBonus}` : undefined
  ]);
}

export function describeImplement(implement: Implement): string | undefined {
  const body = compendiumBody(implement.raw as Record<string, unknown>);
  if (body) return body;
  return joinLines([
    implement.implementGroup ? `Group ${implement.implementGroup}` : undefined,
    implement.properties ? `Properties ${implement.properties}` : undefined,
    implement.itemSlot ? `Slot ${implement.itemSlot}` : undefined
  ]);
}

export interface MagicItemDescription {
  flavor?: string;
  property?: string;
  power?: string;
  critical?: string;
  enhancement?: string;
  requirement?: string;
}

export function describeMagicItem(item: MagicItem): MagicItemDescription {
  const out: MagicItemDescription = {};
  const flavor = item.flavor?.trim();
  if (flavor) out.flavor = flavor;
  const property = item.property?.trim();
  if (property) out.property = property;
  const power = item.power?.trim();
  if (power) out.power = power;
  const critical = item.critical?.trim();
  if (critical) out.critical = critical;
  const enhancement = item.enhancement?.trim();
  if (enhancement) out.enhancement = enhancement;
  const requirement = item.requirement?.trim();
  if (requirement) out.requirement = requirement;
  return out;
}

export function hasMagicItemDescription(desc: MagicItemDescription | undefined): boolean {
  if (!desc) return false;
  return Boolean(
    desc.flavor || desc.property || desc.power || desc.critical || desc.enhancement || desc.requirement
  );
}

