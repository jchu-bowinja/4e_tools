import { CharacterBuild, Feat, RulesIndex } from "./models";
import { evaluatePrereqs, hybridBaseClassNames } from "./prereqEvaluator";

export interface ResolvedOption<T> {
  item: T;
  legal: boolean;
  reasons: string[];
}

export function resolveFeatOptions(index: RulesIndex, build: CharacterBuild): ResolvedOption<Feat>[] {
  const raceNames = new Map(index.races.map((r) => [r.id, r.name]));
  const classNames = new Map(index.classes.map((c) => [c.id, c.name]));
  const skillNames = new Map(index.skills.map((s) => [s.id, s.name]));

  const hybridNames = hybridBaseClassNames(index, build);
  return index.feats.map((feat) => {
    const result = evaluatePrereqs(feat.prereqTokens, build, raceNames, classNames, skillNames, {
      additionalClassNamesForMatch: hybridNames.length ? hybridNames : undefined
    });
    return {
      item: feat,
      legal: result.ok,
      reasons: result.reasons
    };
  });
}

