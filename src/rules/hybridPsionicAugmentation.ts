import type { CharacterBuild, HybridPsionicAugmentationBreakpoint, HybridPsionicAugmentationChoice, Power } from "./models";

/** PHB3 hybrid psionic augmentation levels where encounter use can replace power points. */
export const HYBRID_PSIONIC_AUGMENTATION_BREAKPOINTS: readonly HybridPsionicAugmentationBreakpoint[] = [
  7, 13, 17, 23, 27
];

export function hybridPsionicAugmentationBreakpointsForLevel(
  characterLevel: number
): HybridPsionicAugmentationBreakpoint[] {
  return HYBRID_PSIONIC_AUGMENTATION_BREAKPOINTS.filter((bp) => characterLevel >= bp);
}

export function normalizeHybridPsionicAugmentationChoices(
  characterLevel: number,
  choices: CharacterBuild["hybridPsionicAugmentationChoices"] | undefined
): Partial<Record<HybridPsionicAugmentationBreakpoint, HybridPsionicAugmentationChoice>> {
  const out: Partial<Record<HybridPsionicAugmentationBreakpoint, HybridPsionicAugmentationChoice>> = {};
  for (const bp of hybridPsionicAugmentationBreakpointsForLevel(characterLevel)) {
    const picked = choices?.[bp];
    out[bp] = picked === "encounter" ? "encounter" : "powerPoints";
  }
  return out;
}

export function pruneHybridPsionicAugmentationChoices(build: CharacterBuild): CharacterBuild {
  if (!build.hybridPsionicAugmentationChoices) return build;
  const normalized = normalizeHybridPsionicAugmentationChoices(
    build.level,
    build.hybridPsionicAugmentationChoices
  );
  if (Object.keys(normalized).length === 0) {
    const { hybridPsionicAugmentationChoices: _drop, ...rest } = build;
    return rest;
  }
  return { ...build, hybridPsionicAugmentationChoices: normalized };
}

/** Power points gained at a hybrid breakpoint when the power-point option is taken. */
export function hybridPsionicBreakpointPowerPointGain(
  breakpoint: HybridPsionicAugmentationBreakpoint,
  minPrintedLevel: number
): number {
  if (breakpoint === 7) return minPrintedLevel <= 7 ? 2 : 1;
  if (breakpoint === 13) return 1;
  return 2;
}

export function hybridPsionicPowerPointsFromAugmentableAtWills(
  augmentableAtWills: readonly Power[],
  characterLevel: number,
  choices?: CharacterBuild["hybridPsionicAugmentationChoices"]
): number {
  if (augmentableAtWills.length === 0 || characterLevel < 1) return 0;
  const minPrinted = Math.min(...augmentableAtWills.map((p) => p.level ?? 1));
  const resolved = normalizeHybridPsionicAugmentationChoices(characterLevel, choices);
  let total = 0;
  if (characterLevel >= 1) total += 2;
  if (characterLevel >= 3) total += minPrinted <= 3 ? 2 : 1;
  for (const bp of HYBRID_PSIONIC_AUGMENTATION_BREAKPOINTS) {
    if (characterLevel >= bp && resolved[bp] === "powerPoints") {
      total += hybridPsionicBreakpointPowerPointGain(bp, minPrinted);
    }
  }
  return total;
}

export function hybridPsionicEncounterAugmentationBreakpoints(
  characterLevel: number,
  choices?: CharacterBuild["hybridPsionicAugmentationChoices"]
): HybridPsionicAugmentationBreakpoint[] {
  const resolved = normalizeHybridPsionicAugmentationChoices(characterLevel, choices);
  return HYBRID_PSIONIC_AUGMENTATION_BREAKPOINTS.filter(
    (bp) => characterLevel >= bp && resolved[bp] === "encounter"
  );
}
