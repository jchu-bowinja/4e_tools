import { RulesIndex } from "../rules/models";

export async function loadRulesIndex(): Promise<RulesIndex> {
  const response = await fetch("/generated/rules_index.json");
  if (!response.ok) {
    throw new Error("Could not load generated/rules_index.json. Run ETL first.");
  }
  const data = (await response.json()) as RulesIndex;
  return {
    ...data,
    themes: data.themes ?? [],
    paragonPaths: data.paragonPaths ?? [],
    epicDestinies: data.epicDestinies ?? [],
    autoGrantedPowerIdsByClassId: data.autoGrantedPowerIdsByClassId ?? {},
    autoGrantedSkillTrainingNamesBySupportId: data.autoGrantedSkillTrainingNamesBySupportId ?? {},
    classBuildOptionsByClassId: data.classBuildOptionsByClassId ?? {}
  };
}

