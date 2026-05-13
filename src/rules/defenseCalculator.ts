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
  /** One-half character level (floor), included in 4e AC like other defenses. */
  halfLevel: number;
  armorBonus: number;
  shieldBonus: number;
  abilityBonus: number;
  abilityLabel: "INT" | "DEX" | "max DEX/INT" | "—";
  /** Unconditional AC from feat / theme / paragon / epic ETL `statAdds` (not armor or shield). */
  supportAcBonus: number;
  total: number;
}

function n(x: number | null | undefined): number {
  return typeof x === "number" && !Number.isNaN(x) ? x : 0;
}

/**
 * Core 4e AC: 10 + one-half level + armor + shield + ability (heavy: no ability bonus; cloth: Int;
 * leather/hide: Dex; unarmored: max of Dex or Int).
 */
export function computeAcBreakdown(
  dexMod: number,
  intMod: number,
  bodyArmor: Armor | undefined,
  shield: Armor | undefined,
  characterLevel = 1,
  supportAcBonus = 0
): AcBreakdown {
  const base = 10;
  const halfLevel = Math.floor(characterLevel / 2);
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

  const extraAc = typeof supportAcBonus === "number" && Number.isFinite(supportAcBonus) ? supportAcBonus : 0;
  const total = base + halfLevel + armorBonus + shieldBonus + abilityBonus + extraAc;
  return {
    base,
    halfLevel,
    armorBonus,
    shieldBonus,
    abilityBonus,
    abilityLabel,
    supportAcBonus: extraAc,
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
