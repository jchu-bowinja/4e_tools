import type { ClassDef } from "./models";

/** Parses compendium "Bonus to Defense" on a class (e.g. "+2 Fortitude") into NAD modifiers. */
export function parseClassDefenseBonusesFromClassDef(
  cls: ClassDef | undefined
): Partial<Record<"Fortitude" | "Reflex" | "Will", number>> {
  if (!cls) return {};
  const bonusToDefenseText = String(
    ((cls.raw.specific as Record<string, unknown> | undefined) || {})["Bonus to Defense"] || ""
  );
  const out: Partial<Record<"Fortitude" | "Reflex" | "Will", number>> = {};
  const defenseMatches = bonusToDefenseText.matchAll(/([+-]\d+)\s*(Fortitude|Reflex|Will)/gi);
  for (const match of defenseMatches) {
    const value = Number(match[1]);
    const key = match[2] as "Fortitude" | "Reflex" | "Will";
    out[key] = (out[key] || 0) + value;
  }
  return out;
}
