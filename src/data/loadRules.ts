import { RulesIndex } from "../rules/models";

function ensureArray<T>(value: T[] | undefined, label: string): T[] {
  if (!Array.isArray(value)) {
    throw new Error(`rules_index.json is missing required array: ${label}`);
  }
  return value;
}

export function validateRulesIndexShape(data: RulesIndex): RulesIndex {
  return {
    ...data,
    races: ensureArray(data.races, "races"),
    classes: ensureArray(data.classes, "classes"),
    feats: ensureArray(data.feats, "feats"),
    powers: ensureArray(data.powers, "powers"),
    skills: ensureArray(data.skills, "skills"),
    languages: ensureArray(data.languages, "languages"),
    armors: ensureArray(data.armors, "armors"),
    abilityScores: ensureArray(data.abilityScores, "abilityScores"),
    racialTraits: ensureArray(data.racialTraits, "racialTraits"),
    themes: data.themes ?? [],
    paragonPaths: data.paragonPaths ?? [],
    epicDestinies: data.epicDestinies ?? [],
    hybridClasses: data.hybridClasses ?? [],
    weapons: data.weapons ?? [],
    implements: data.implements ?? [],
    autoGrantedPowerIdsByClassId: data.autoGrantedPowerIdsByClassId ?? {},
    autoGrantedSkillTrainingNamesBySupportId: data.autoGrantedSkillTrainingNamesBySupportId ?? {},
    classBuildOptionsByClassId: data.classBuildOptionsByClassId ?? {}
  };
}

export async function loadRulesIndex(): Promise<RulesIndex> {
  const response = await fetch("/generated/rules_index.json");
  if (!response.ok) {
    throw new Error("Could not load generated/rules_index.json. Run ETL first.");
  }
  const data = (await response.json()) as RulesIndex;
  return validateRulesIndexShape(data);
}

