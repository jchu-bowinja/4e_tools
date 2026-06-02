/** Sub-categories under the builder/sheet Items tab. */
export type ItemsCategory =
  | "inventory"
  | "equipment"
  | "adventuringGear"
  | "rituals"
  | "alchemy"
  | "martialPractices";

export const ITEMS_CATEGORIES: ItemsCategory[] = [
  "inventory",
  "equipment",
  "adventuringGear",
  "rituals",
  "alchemy",
  "martialPractices"
];

export const ITEMS_CATEGORY_LABELS: Record<ItemsCategory, string> = {
  inventory: "Inventory",
  equipment: "Equipment",
  adventuringGear: "Adventuring gear",
  rituals: "Rituals",
  alchemy: "Alchemy",
  martialPractices: "Martial practices"
};

/** Map validation messages to an items sub-category (equipment errors, ritual warnings, …). */
export function resolveValidationItemsCategory(message: string): ItemsCategory | null {
  const m = message.toLowerCase();
  if (m.includes("main weapon") || m.includes("off-hand weapon") || m.includes("selected implement")) {
    return "equipment";
  }
  if (m.includes("ritual casting") || m.includes("ritual book") || m.includes("ritual caster")) {
    return "rituals";
  }
  if (m.includes(" martial practice") || m.includes("martial practice")) {
    return "martialPractices";
  }
  if (m.includes(" is level ") && m.includes("character is level")) {
    if (m.includes("elixir") || m.includes("potion") || m.includes("alchemical")) {
      return "alchemy";
    }
    return "rituals";
  }
  return null;
}
