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

/** Normalize compendium text fields that may be strings or string arrays. */
export function normalizeCompendiumTextField(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (Array.isArray(value)) {
    const lines = value
      .map((entry) => (typeof entry === "string" ? entry.trim() : String(entry).trim()))
      .filter(Boolean);
    return lines.length > 0 ? lines.join("\n") : undefined;
  }
  const trimmed = String(value).trim();
  return trimmed || undefined;
}

export function describeMagicItem(item: MagicItem): MagicItemDescription {
  const out: MagicItemDescription = {};
  const flavor = normalizeCompendiumTextField(item.flavor);
  if (flavor) out.flavor = flavor;
  const property = normalizeCompendiumTextField(item.property);
  if (property) out.property = property;
  const power = normalizeCompendiumTextField(item.power);
  if (power) out.power = power;
  const critical = normalizeCompendiumTextField(item.critical);
  if (critical) out.critical = critical;
  const enhancement = normalizeCompendiumTextField(item.enhancement);
  if (enhancement) out.enhancement = enhancement;
  const requirement = normalizeCompendiumTextField(item.requirement);
  if (requirement) out.requirement = requirement;
  return out;
}

export function hasMagicItemDescription(desc: MagicItemDescription | undefined): boolean {
  if (!desc) return false;
  return Boolean(
    desc.flavor || desc.property || desc.power || desc.critical || desc.enhancement || desc.requirement
  );
}

