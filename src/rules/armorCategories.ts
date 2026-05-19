import type { Armor } from "./models";

/** Display order for body armor categories in the equipment picker. */
export const BODY_ARMOR_CATEGORY_ORDER: readonly string[] = [
  "Cloth",
  "Leather",
  "Studded Leather",
  "Hide",
  "Chain",
  "Ring Mail",
  "Scale",
  "Splint Mail",
  "Banded Mail",
  "Plate",
  "Full Plate",
  "Spiked Plate"
];

export const SHIELD_CATEGORY_ORDER: readonly string[] = ["Light Shields", "Heavy Shields", "Barbed Shields"];

export function isShieldArmorEntry(armor: Armor): boolean {
  return String(armor.armorType || "")
    .toLowerCase()
    .includes("shield");
}

export function armorCategoryKey(armor: Armor): string {
  return String(armor.armorCategory || "").trim() || "Other";
}

export function sortedArmorCategories(armors: Armor[], preferredOrder: readonly string[]): string[] {
  const present = new Set<string>();
  for (const armor of armors) {
    const key = armorCategoryKey(armor);
    if (key !== "Other" || armor.armorCategory) present.add(key);
  }
  const ordered = preferredOrder.filter((c) => present.has(c));
  const rest = [...present]
    .filter((c) => !preferredOrder.includes(c))
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  return [...ordered, ...rest];
}

export function armorsInCategory(armors: Armor[], category: string): Armor[] {
  if (!category) return [];
  return armors
    .filter((a) => armorCategoryKey(a) === category)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

export function formatArmorMaterialLabel(armor: Armor): string {
  const bonus = armor.armorBonus ?? 0;
  return `${armor.name} (+${bonus} AC)`;
}

export function categoryOrderForArmors(armors: Armor[]): readonly string[] {
  const hasOnlyShields = armors.length > 0 && armors.every(isShieldArmorEntry);
  return hasOnlyShields ? SHIELD_CATEGORY_ORDER : BODY_ARMOR_CATEGORY_ORDER;
}
