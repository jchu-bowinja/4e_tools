import { CharacterBuild, PrereqToken, Tier, ValidationResult } from "./models";

function tierFromLevel(level: number): Tier {
  if (level >= 21) {
    return "EPIC";
  }
  if (level >= 11) {
    return "PARAGON";
  }
  return "HEROIC";
}

export function evaluatePrereqs(
  prereqTokens: PrereqToken[],
  build: CharacterBuild,
  raceNameById: Map<string, string>,
  classNameById: Map<string, string>,
  skillNameById: Map<string, string>
): ValidationResult {
  const reasons: string[] = [];
  const tier = tierFromLevel(build.level);
  const raceName = build.raceId ? raceNameById.get(build.raceId) : undefined;
  const className = build.classId ? classNameById.get(build.classId) : undefined;
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
      if (!className || className.toLowerCase() !== token.value.toLowerCase()) {
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

