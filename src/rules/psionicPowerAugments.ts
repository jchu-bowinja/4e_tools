import type { FeatPowerAugmentation } from "./featPowerModifications";
import type { Power, RulesIndex } from "./models";

/** Internal compendium row for a single augment tier of a base augmentable power. */
export function isPsionicAugmentVariantPower(power: Power): boolean {
  const spec = (power.raw?.specific as Record<string, unknown> | undefined) ?? {};
  if (typeof spec._AugmentParent === "string" && spec._AugmentParent.trim()) {
    return true;
  }
  if (/ID_INTERNAL_POWER_.*_\(AUGMENT_\d+\)/i.test(power.id)) {
    return true;
  }
  return /\(Augment\s+\d+\)/i.test(power.name);
}

/** Power point cost from a name like "Twisted Eye (Augment 2)". */
export function parseAugmentPointCostFromPowerName(name: string): number | null {
  const m = /\(Augment\s+(\d+)\)/i.exec(name);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
}

export function resolveBaseAugmentablePowerId(index: RulesIndex, powerId: string): string {
  const p = index.powers.find((x) => x.id === powerId);
  if (!p) return powerId;
  const parent = (p.raw?.specific as Record<string, unknown> | undefined)?._AugmentParent;
  if (typeof parent === "string" && parent.trim()) {
    return parent.trim();
  }
  return powerId;
}

/** One row per base augmentable power — hides internal Augment 0/1/2 variants from pick lists. */
export function collapseAugmentablePowersForPicker(powers: readonly Power[]): Power[] {
  const out: Power[] = [];
  const seenBase = new Set<string>();
  for (const p of powers) {
    if (isPsionicAugmentVariantPower(p)) continue;
    if (seenBase.has(p.id)) continue;
    seenBase.add(p.id);
    out.push(p);
  }
  return out;
}

function augmentVariantsForBase(index: RulesIndex, basePowerId: string): Power[] {
  return index.powers
    .filter((p) => {
      const spec = (p.raw?.specific as Record<string, unknown> | undefined) ?? {};
      return spec._AugmentParent === basePowerId;
    })
    .sort((a, b) => {
      const ca = parseAugmentPointCostFromPowerName(a.name) ?? 0;
      const cb = parseAugmentPointCostFromPowerName(b.name) ?? 0;
      if (ca !== cb) return ca - cb;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });
}

/** Augment 1 = 1 PP, etc. Augment 0 duplicates the base and is omitted. */
export function buildPsionicAugmentLinesForPower(
  index: RulesIndex,
  basePower: Power
): FeatPowerAugmentation[] {
  const baseSpec = (basePower.raw?.specific as Record<string, unknown> | undefined) ?? {};
  const baseHit = String(baseSpec.Hit ?? "").trim();
  const baseEffect = String(baseSpec.Effect ?? "").trim();

  const lines: FeatPowerAugmentation[] = [];
  for (const variant of augmentVariantsForBase(index, basePower.id)) {
    const cost = parseAugmentPointCostFromPowerName(variant.name);
    if (cost == null || cost < 1) continue;

    const spec = (variant.raw?.specific as Record<string, unknown> | undefined) ?? {};
    const parts: string[] = [];
    const special = String(spec.Special ?? "").trim();
    if (special) parts.push(special);
    const hit = String(spec.Hit ?? "").trim();
    if (hit && hit !== baseHit) parts.push(`Hit: ${hit}`);
    const effect = String(spec.Effect ?? "").trim();
    if (effect && effect !== baseEffect) parts.push(`Effect: ${effect}`);
    const text = parts.length > 0 ? parts.join(" ") : "Augmented version of this power.";

    const ppLabel = cost === 1 ? "1 power point" : `${cost} power points`;
    lines.push({
      featId: `psionic-${variant.id}`,
      featName: `Augment ${cost} (${ppLabel})`,
      text
    });
  }
  return lines;
}

export function resolvePowerForDisplay(
  index: RulesIndex,
  powerId: string
): Power | undefined {
  const baseId = resolveBaseAugmentablePowerId(index, powerId);
  return index.powers.find((p) => p.id === baseId);
}
