import type { CharacterBuild, PrereqToken } from "./models";
import { evaluatePrereqs, type PrereqEvaluateOptions } from "./prereqEvaluator";

export function evaluateSupportOptionLegality(
  tokens: PrereqToken[],
  minLevel: number,
  build: CharacterBuild,
  raceNameById: Map<string, string>,
  classNameById: Map<string, string>,
  skillNameById: Map<string, string>,
  options?: PrereqEvaluateOptions
): { legal: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (minLevel > 0 && build.level < minLevel) {
    reasons.push(`Requires level ${minLevel}+`);
  }
  const result = evaluatePrereqs(tokens, build, raceNameById, classNameById, skillNameById, options);
  if (!result.ok) reasons.push(...result.reasons);
  return { legal: reasons.length === 0, reasons };
}
