import { CharacterBuild, PrereqToken, RulesIndex, Tier, ValidationResult } from "./models";
import {
  buildPrereqCharacterContext,
  type PrereqCharacterContext
} from "./prereqContext";

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
  /** Rules index for class features, power sources, feats, etc. */
  index?: RulesIndex;
  /** Precomputed character facts; avoids rebuilding for every feat when resolving feat lists. */
  context?: PrereqCharacterContext;
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

function norm(s: string): string {
  return s.trim().toLowerCase();
}

function nameInSet(want: string, names: Set<string>): boolean {
  const w = norm(want);
  for (const n of names) {
    const h = norm(n);
    if (h === w || h.includes(w) || w.includes(h)) return true;
  }
  return false;
}

function evaluateOneToken(
  token: PrereqToken,
  build: CharacterBuild,
  raceNameById: Map<string, string>,
  classNameById: Map<string, string>,
  skillNameById: Map<string, string>,
  options: PrereqEvaluateOptions | undefined,
  tier: Tier,
  raceName: string | undefined,
  className: string | undefined,
  extraClasses: string[],
  trainedSkillNames: Set<string>,
  context: PrereqCharacterContext | undefined
): string[] {
  const reasons: string[] = [];

  if (token.kind === "anyOf" && Array.isArray(token.options)) {
    const childReasons = token.options.map((opt) =>
      evaluateOneToken(
        opt,
        build,
        raceNameById,
        classNameById,
        skillNameById,
        options,
        tier,
        raceName,
        className,
        extraClasses,
        trainedSkillNames,
        context
      )
    );
    if (!childReasons.some((r) => r.length === 0)) {
      reasons.push("Requires one of: " + childReasons.map((r) => r.join(", ")).filter(Boolean).join(" OR "));
    }
    return reasons;
  }

  if (token.kind === "allOf" && Array.isArray(token.requirements)) {
    for (const req of token.requirements) {
      reasons.push(
        ...evaluateOneToken(
          req,
          build,
          raceNameById,
          classNameById,
          skillNameById,
          options,
          tier,
          raceName,
          className,
          extraClasses,
          trainedSkillNames,
          context
        )
      );
    }
    return reasons;
  }

  if (token.kind === "levelAtLeast" && typeof token.value === "number") {
    if (build.level < token.value) {
      reasons.push(`Requires level ${token.value}+`);
    }
    return reasons;
  }

  if (token.kind === "tier" && typeof token.value === "string") {
    if (tier !== token.value) {
      reasons.push(`Requires ${token.value} tier`);
    }
    return reasons;
  }

  if (token.kind === "abilityAtLeast" && token.ability && typeof token.value === "number") {
    if ((build.abilityScores[token.ability] || 0) < token.value) {
      reasons.push(`Requires ${token.ability} ${token.value}+`);
    }
    return reasons;
  }

  if (token.kind === "race" && typeof token.value === "string") {
    if (!raceName || raceName.toLowerCase() !== token.value.toLowerCase()) {
      reasons.push(`Requires race: ${token.value}`);
    }
    return reasons;
  }

  if (token.kind === "class" && typeof token.value === "string") {
    const want = token.value.toLowerCase();
    const primaryOk = className && className.toLowerCase() === want;
    const hybridOk = extraClasses.some((n) => n.toLowerCase() === want);
    const countsAsOk = context?.countsAsClassNames.has(want) ?? false;
    if (!primaryOk && !hybridOk && !countsAsOk) {
      reasons.push(`Requires class: ${token.value}`);
    }
    return reasons;
  }

  if (token.kind === "trainedSkill" && typeof token.value === "string") {
    if (!trainedSkillNames.has(token.value.toLowerCase())) {
      reasons.push(`Requires trained in ${token.value}`);
    }
    return reasons;
  }

  if (token.kind === "powerSourceAny" && typeof token.value === "string" && context) {
    const want = norm(token.value);
    const ok = [...context.powerSourceLabels].some((s) => s.includes(want) || want.includes(s));
    if (!ok) {
      reasons.push(`Requires any ${token.value} class`);
    }
    return reasons;
  }

  if (token.kind === "classFeature" && typeof token.value === "string" && context) {
    if (!nameInSet(token.value, context.classFeatureNames)) {
      reasons.push(`Requires ${token.value} class feature`);
    }
    return reasons;
  }

  if (
    (token.kind === "power" || token.kind === "racialPower") &&
    typeof token.value === "string" &&
    context
  ) {
    if (!nameInSet(token.value, context.powerNames)) {
      reasons.push(`Requires ${token.value} power`);
    }
    return reasons;
  }

  if (token.kind === "multiclassEntry" && context) {
    if (!context.hasMulticlassEntryFeat) {
      reasons.push("Requires a class-specific multiclass training feat");
    }
    return reasons;
  }

  if (token.kind === "feat" && typeof token.value === "string" && context) {
    const want = token.value.toLowerCase();
    if (want.includes("class-specific multiclass") || want === "any class-specific multiclass") {
      if (!context.hasMulticlassEntryFeat) {
        reasons.push("Requires a class-specific multiclass training feat");
      }
      return reasons;
    }
    if (!nameInSet(token.value, context.featNames)) {
      reasons.push(`Requires ${token.value} feat`);
    }
    return reasons;
  }

  if (token.kind === "racialTrait" && typeof token.value === "string" && context) {
    if (!nameInSet(token.value, context.racialTraitNames)) {
      reasons.push(`Requires ${token.value} racial trait`);
    }
    return reasons;
  }

  if (token.kind === "heritage" && typeof token.value === "string" && context) {
    const bloodlineKey = `${token.value.toUpperCase().replace(/\s+/g, "_")}_BLOODLINE`;
    const hasHeritage =
      nameInSet(token.value, context.heritageLabels) || context.internalGrantKeys.has(bloodlineKey);
    if (!hasHeritage) {
      reasons.push(`Requires ${token.value} heritage`);
    }
    return reasons;
  }

  if (token.kind === "negatedClass" && typeof token.value === "string" && context) {
    if (context.negatedClassIds.has(token.value)) {
      reasons.push(`Not available for this class`);
    }
    return reasons;
  }

  if (token.kind === "size" && typeof token.value === "string") {
    const race = options?.index?.races.find((r) => r.id === build.raceId);
    const size = race?.size ?? "";
    if (size && size.toLowerCase() !== token.value.toLowerCase()) {
      reasons.push(`Requires ${token.value} size`);
    }
    return reasons;
  }

  if (token.kind === "negatedTag" && typeof token.value === "string" && context) {
    if (token.value.toLowerCase() === "bloodline" && context.hasBloodline) {
      reasons.push("Already has a bloodline feat");
    }
    return reasons;
  }

  if (token.kind === "tag" && typeof token.value === "string" && context) {
    const tag = token.value.toLowerCase();
    if (tag === "bloodline" && !context.hasBloodline) {
      reasons.push("Requires a bloodline feat");
    }
    if (tag === "multiclass") {
      const slotOpen = !context.hasMulticlassEntryFeat || context.hasUnlimitedMulticlass;
      if (!slotOpen) {
        reasons.push("Multiclass training slot already used");
      }
    }
    if (tag === "unlimited multiclass" && !context.hasUnlimitedMulticlass) {
      reasons.push("Requires unlimited multiclass");
    }
    return reasons;
  }

  if (token.kind === "deity" || token.kind === "implement") {
    return reasons;
  }

  if (token.kind === "proficiency") {
    return reasons;
  }

  return reasons;
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
  const index = options?.index;
  const context =
    options?.context ?? (index ? buildPrereqCharacterContext(index, build) : undefined);

  for (const token of prereqTokens) {
    reasons.push(
      ...evaluateOneToken(
        token,
        build,
        raceNameById,
        classNameById,
        skillNameById,
        options,
        tier,
        raceName,
        className,
        extraClasses,
        trainedSkillNames,
        context
      )
    );
  }

  return { ok: reasons.length === 0, reasons };
}
