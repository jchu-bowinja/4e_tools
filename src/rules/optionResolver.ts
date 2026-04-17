import { CharacterBuild, Feat, RulesIndex } from "./models";
import { evaluatePrereqs } from "./prereqEvaluator";

export interface ResolvedOption<T> {
  item: T;
  legal: boolean;
  reasons: string[];
}

export function resolveFeatOptions(index: RulesIndex, build: CharacterBuild): ResolvedOption<Feat>[] {
  const raceNames = new Map(index.races.map((r) => [r.id, r.name]));
  const classNames = new Map(index.classes.map((c) => [c.id, c.name]));
  const skillNames = new Map(index.skills.map((s) => [s.id, s.name]));

  return index.feats.map((feat) => {
    const result = evaluatePrereqs(feat.prereqTokens, build, raceNames, classNames, skillNames);
    return {
      item: feat,
      legal: result.ok,
      reasons: result.reasons
    };
  });
}

