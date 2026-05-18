import type { CharacterBuild, RulesIndex } from "./models";
import { collectMulticlassEntryFeatIds, isMulticlassEntryFeat } from "./featGrantFlags";
import { hybridBaseClassNames } from "./prereqEvaluator";

/** PHB multiclass power progression feats (generic names). */
export const MULTICLASS_POWER_CHAIN = [
  { featName: "Novice Power", requires: null as string | null },
  { featName: "Acolyte Power", requires: "Novice Power" },
  { featName: "Adept Power", requires: "Acolyte Power" }
] as const;

function selectedFeatNames(index: RulesIndex, build: CharacterBuild): Set<string> {
  const names = new Set<string>();
  for (const id of build.featIds) {
    const f = index.feats.find((x) => x.id === id);
    if (f?.name) names.add(f.name);
  }
  return names;
}

function primaryClassNames(index: RulesIndex, build: CharacterBuild): Set<string> {
  const names = new Set<string>();
  if (build.characterStyle === "hybrid") {
    for (const n of hybridBaseClassNames(index, build)) {
      names.add(n.toLowerCase());
    }
  } else if (build.classId) {
    const n = index.classes.find((c) => c.id === build.classId)?.name;
    if (n) names.add(n.toLowerCase());
  }
  return names;
}

/** Multiclass training and power-chain legality (PHB-style). */
export function validateMulticlassFeats(index: RulesIndex, build: CharacterBuild): string[] {
  const errors: string[] = [];
  const entryIds = collectMulticlassEntryFeatIds(index, build);
  const featNames = selectedFeatNames(index, build);
  const ownClasses = primaryClassNames(index, build);

  if (entryIds.length > 1) {
    const labels = entryIds
      .map((id) => index.feats.find((f) => f.id === id)?.name ?? id)
      .join(", ");
    errors.push(`Only one multiclass training feat allowed (found: ${labels}).`);
  }

  for (const eid of entryIds) {
    const feat = index.feats.find((f) => f.id === eid);
    if (!feat) continue;
    for (const className of feat.countsAsClassNames ?? []) {
      if (ownClasses.has(className.toLowerCase())) {
        errors.push(
          `Multiclass feat "${feat.name}" cannot count as ${className} — that is already your class.`
        );
      }
    }
  }

  const hasEntry = entryIds.length > 0;
  for (const step of MULTICLASS_POWER_CHAIN) {
    if (!featNames.has(step.featName)) continue;
    if (!hasEntry) {
      errors.push(
        `"${step.featName}" requires a class-specific multiclass training feat (e.g. Sneak of Shadows).`
      );
    }
    if (step.requires && !featNames.has(step.requires)) {
      errors.push(`"${step.featName}" requires the "${step.requires}" feat.`);
    }
  }

  return errors;
}

/** Entry multiclass feats on the build (for display). */
export function multiclassEntryFeats(index: RulesIndex, build: CharacterBuild) {
  return collectMulticlassEntryFeatIds(index, build)
    .map((id) => index.feats.find((f) => f.id === id))
    .filter((f): f is NonNullable<typeof f> => Boolean(f && isMulticlassEntryFeat(f)));
}
