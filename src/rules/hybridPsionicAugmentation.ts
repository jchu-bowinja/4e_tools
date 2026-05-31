import type {
  CharacterBuild,
  HybridPsionicAugmentationBreakpoint,
  HybridPsionicAugmentationChoice,
  Power,
  RulesIndex
} from "./models";

/** PHB3 hybrid psionic augmentation levels where encounter use can replace power points. */
export const HYBRID_PSIONIC_AUGMENTATION_BREAKPOINTS: readonly HybridPsionicAugmentationBreakpoint[] = [
  7, 13, 17, 23, 27
];

/** Fallback when `rules_index.json` predates `hybridPsionicAugmentationBreakpoints`. */
const FALLBACK_BREAKPOINTS = HYBRID_PSIONIC_AUGMENTATION_BREAKPOINTS;

function asBreakpoint(n: number): HybridPsionicAugmentationBreakpoint | null {
  if (n === 7 || n === 13 || n === 17 || n === 23 || n === 27) return n;
  return null;
}

export function hybridPsionicBreakpointsFromIndex(
  index?: RulesIndex
): readonly HybridPsionicAugmentationBreakpoint[] {
  const fromIndex = index?.hybridPsionicAugmentationBreakpoints;
  if (!fromIndex?.length) return FALLBACK_BREAKPOINTS;
  const out: HybridPsionicAugmentationBreakpoint[] = [];
  for (const n of fromIndex) {
    const bp = asBreakpoint(n);
    if (bp !== null && !out.includes(bp)) out.push(bp);
  }
  return out.length ? out : FALLBACK_BREAKPOINTS;
}

export function hybridPsionicAugmentationBreakpointsForLevel(
  characterLevel: number,
  index?: RulesIndex
): HybridPsionicAugmentationBreakpoint[] {
  return hybridPsionicBreakpointsFromIndex(index).filter((bp) => characterLevel >= bp);
}

export function normalizeHybridPsionicAugmentationChoices(
  characterLevel: number,
  choices: CharacterBuild["hybridPsionicAugmentationChoices"] | undefined,
  index?: RulesIndex
): Partial<Record<HybridPsionicAugmentationBreakpoint, HybridPsionicAugmentationChoice>> {
  const out: Partial<Record<HybridPsionicAugmentationBreakpoint, HybridPsionicAugmentationChoice>> = {};
  for (const bp of hybridPsionicAugmentationBreakpointsForLevel(characterLevel, index)) {
    const picked = choices?.[bp];
    out[bp] = picked === "encounter" ? "encounter" : "powerPoints";
  }
  return out;
}

export function pruneHybridPsionicAugmentationChoices(
  build: CharacterBuild,
  index?: RulesIndex
): CharacterBuild {
  if (!build.hybridPsionicAugmentationChoices) return build;
  const normalized = normalizeHybridPsionicAugmentationChoices(
    build.level,
    build.hybridPsionicAugmentationChoices,
    index
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
  choices?: CharacterBuild["hybridPsionicAugmentationChoices"],
  index?: RulesIndex
): number {
  if (augmentableAtWills.length === 0 || characterLevel < 1) return 0;
  const minPrinted = Math.min(...augmentableAtWills.map((p) => p.level ?? 1));
  const resolved = normalizeHybridPsionicAugmentationChoices(characterLevel, choices, index);
  let total = 0;
  if (characterLevel >= 1) total += 2;
  if (characterLevel >= 3) total += minPrinted <= 3 ? 2 : 1;
  for (const bp of hybridPsionicBreakpointsFromIndex(index)) {
    if (characterLevel >= bp && resolved[bp] === "powerPoints") {
      total += hybridPsionicBreakpointPowerPointGain(bp, minPrinted);
    }
  }
  return total;
}

export function hybridPsionicEncounterAugmentationBreakpoints(
  characterLevel: number,
  choices?: CharacterBuild["hybridPsionicAugmentationChoices"],
  index?: RulesIndex
): HybridPsionicAugmentationBreakpoint[] {
  const resolved = normalizeHybridPsionicAugmentationChoices(characterLevel, choices, index);
  return hybridPsionicBreakpointsFromIndex(index).filter(
    (bp) => characterLevel >= bp && resolved[bp] === "encounter"
  );
}
