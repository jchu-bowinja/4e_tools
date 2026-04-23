import type { Armor } from "./models";

export type BodyArmorKind = "none" | "cloth" | "leatherOrHide" | "heavy";

/** Body armor only (not shields). Shields are passed separately. */
export function classifyBodyArmor(armor: Armor | undefined): BodyArmorKind {
  if (!armor) return "none";
  const typ = String(armor.armorType || "").toLowerCase();
  if (typ.includes("shield")) return "none";
  const cat = String(armor.armorCategory || "").toLowerCase();

  if (typ.includes("heavy")) return "heavy";
  if (cat.includes("chain") || cat.includes("scale") || cat.includes("plate")) return "heavy";
  if (cat.includes("leather") || cat.includes("hide")) return "leatherOrHide";
  if (cat.includes("cloth")) return "cloth";
  if (typ.includes("light")) {
    if (cat.includes("leather") || cat.includes("hide")) return "leatherOrHide";
    if (cat.includes("cloth")) return "cloth";
  }
  return "leatherOrHide";
}

export interface AcBreakdown {
  base: number;
  armorBonus: number;
  shieldBonus: number;
  abilityBonus: number;
  abilityLabel: "INT" | "DEX" | "max DEX/INT" | "—";
  total: number;
}

function n(x: number | null | undefined): number {
  return typeof x === "number" && !Number.isNaN(x) ? x : 0;
}

/**
 * Core 4e AC: heavy armor uses no ability bonus; light cloth uses Intelligence; leather/hide use Dexterity;
 * no body armor uses the better of Dex or Int (unarmored / bracers-style defense).
 */
export function computeAcBreakdown(
  dexMod: number,
  intMod: number,
  bodyArmor: Armor | undefined,
  shield: Armor | undefined
): AcBreakdown {
  const base = 10;
  const shieldBonus = n(shield?.armorBonus);
  const body = bodyArmor && !String(bodyArmor.armorType || "").toLowerCase().includes("shield") ? bodyArmor : undefined;
  const armorBonus = n(body?.armorBonus);
  const kind = classifyBodyArmor(body || undefined);

  let abilityBonus = 0;
  let abilityLabel: AcBreakdown["abilityLabel"] = "—";

  switch (kind) {
    case "none":
      abilityBonus = Math.max(dexMod, intMod);
      abilityLabel = "max DEX/INT";
      break;
    case "cloth":
      abilityBonus = intMod;
      abilityLabel = "INT";
      break;
    case "leatherOrHide":
      abilityBonus = dexMod;
      abilityLabel = "DEX";
      break;
    case "heavy":
      abilityBonus = 0;
      abilityLabel = "—";
      break;
    default:
      abilityBonus = Math.max(dexMod, intMod);
      abilityLabel = "max DEX/INT";
  }

  const total = base + armorBonus + shieldBonus + abilityBonus;
  return {
    base,
    armorBonus,
    shieldBonus,
    abilityBonus,
    abilityLabel,
    total
  };
}

/** Sum armor check penalties from worn body armor and shield (shields can impose a check penalty). */
export function totalArmorCheckPenalty(bodyArmor: Armor | undefined, shield: Armor | undefined): number {
  let sum = 0;
  const body = bodyArmor && !String(bodyArmor.armorType || "").toLowerCase().includes("shield") ? bodyArmor : undefined;
  if (body) sum += n(body.checkPenalty);
  if (shield) sum += n(shield.checkPenalty);
  return sum;
}

/** Speed penalty applies to worn body armor (not shields). */
export function bodyArmorSpeedPenalty(bodyArmor: Armor | undefined): number {
  const body = bodyArmor && !String(bodyArmor.armorType || "").toLowerCase().includes("shield") ? bodyArmor : undefined;
  return body ? n(body.speedPenalty) : 0;
}
