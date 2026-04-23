import { CharacterBuild, PrereqToken, RulesIndex, Tier, ValidationResult } from "./models";

function tierFromLevel(level: number): Tier {
  if (level >= 21) {
    return "EPIC";
  }
  if (level >= 11) {
    return "PARAGON";
  }
  return "HEROIC";
}

export type PrereqEvaluateOptions = {
  /** When set (e.g. hybrid), class prereqs match if the token equals any of these names or the primary class. */
  additionalClassNamesForMatch?: string[];
};

/** Resolve PHB base class names for hybrid builds (for feat/theme prereqs). */
export function hybridBaseClassNames(index: RulesIndex, build: CharacterBuild): string[] {
  if (build.characterStyle !== "hybrid") return [];
  const out: string[] = [];
  const ha = index.hybridClasses?.find((h) => h.id === build.hybridClassIdA);
  const hb = index.hybridClasses?.find((h) => h.id === build.hybridClassIdB);
  for (const bid of [ha?.baseClassId, hb?.baseClassId]) {
    if (!bid) continue;
    const n = index.classes.find((c) => c.id === bid)?.name;
    if (n) out.push(n);
  }
  return out;
}

export function evaluatePrereqs(
  prereqTokens: PrereqToken[],
  build: CharacterBuild,
  raceNameById: Map<string, string>,
  classNameById: Map<string, string>,
  skillNameById: Map<string, string>,
  options?: PrereqEvaluateOptions
): ValidationResult {
  const reasons: string[] = [];
  const tier = tierFromLevel(build.level);
  const raceName = build.raceId ? raceNameById.get(build.raceId) : undefined;
  const className = build.classId ? classNameById.get(build.classId) : undefined;
  const extraClasses = options?.additionalClassNamesForMatch ?? [];
  const trainedSkillNames = new Set(
    build.trainedSkillIds.map((id) => (skillNameById.get(id) || "").toLowerCase())
  );

  for (const token of prereqTokens) {
    if (token.kind === "levelAtLeast" && typeof token.value === "number") {
      if (build.level < token.value) {
        reasons.push(`Requires level ${token.value}+`);
      }
      continue;
    }

    if (token.kind === "tier" && typeof token.value === "string") {
      if (tier !== token.value) {
        reasons.push(`Requires ${token.value} tier`);
      }
      continue;
    }

    if (
      token.kind === "abilityAtLeast" &&
      token.ability &&
      typeof token.value === "number"
    ) {
      if ((build.abilityScores[token.ability] || 0) < token.value) {
        reasons.push(`Requires ${token.ability} ${token.value}+`);
      }
      continue;
    }

    if (token.kind === "race" && typeof token.value === "string") {
      if (!raceName || raceName.toLowerCase() !== token.value.toLowerCase()) {
        reasons.push(`Requires race: ${token.value}`);
      }
      continue;
    }

    if (token.kind === "class" && typeof token.value === "string") {
      const want = token.value.toLowerCase();
      const primaryOk = className && className.toLowerCase() === want;
      const hybridOk = extraClasses.some((n) => n.toLowerCase() === want);
      if (!primaryOk && !hybridOk) {
        reasons.push(`Requires class: ${token.value}`);
      }
      continue;
    }

    if (token.kind === "trainedSkill" && typeof token.value === "string") {
      if (!trainedSkillNames.has(token.value.toLowerCase())) {
        reasons.push(`Requires trained in ${token.value}`);
      }
      continue;
    }

    if (token.kind === "tag") {
      continue;
    }
  }

  return { ok: reasons.length === 0, reasons };
}

