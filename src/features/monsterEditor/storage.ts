export interface MonsterIndexEntry {
  id: string;
  fileName: string;
  relativePath: string;
  name: string;
  level: string | number;
  role: string;
  parseError: string;
}

interface MonsterIndexPayload {
  meta: { version: number; count: number; source?: string };
  monsters: MonsterIndexEntry[];
}

export interface MonsterStats {
  abilityScores: Record<string, number | string>;
  defenses: Record<string, number | string>;
  attackBonuses: Record<string, number | string>;
  skills: Record<string, number | string>;
  otherNumbers: Record<string, number | string>;
}

export interface MonsterPower {
  name: string;
  usage: string;
  usageDetails?: string;
  action: string;
  trigger?: string;
  requirements?: string;
  type?: string;
  isBasic?: boolean;
  tier?: string | number;
  flavorText?: string;
  keywords: string;
  range?: string;
  description: string;
}

export interface MonsterEntryFile extends MonsterIndexEntry {
  sourceRoot: string;
  size: string;
  origin: string;
  type: string;
  xp: string | number;
  stats: MonsterStats;
  powers: MonsterPower[];
  sections?: Record<string, unknown>;
}

export async function loadMonsterIndex(): Promise<MonsterIndexEntry[]> {
  const response = await fetch("/generated/monsters/index.json");
  if (!response.ok) {
    throw new Error("Could not load generated/monsters/index.json. Run monster ETL first.");
  }
  const data = (await response.json()) as MonsterIndexPayload;
  if (!Array.isArray(data.monsters)) {
    throw new Error("Invalid generated/monsters/index.json format.");
  }
  return data.monsters;
}

export async function loadMonsterEntry(id: string): Promise<MonsterEntryFile> {
  const response = await fetch(`/generated/monsters/entries/${encodeURIComponent(id)}.json`);
  if (!response.ok) {
    throw new Error(`Could not load generated monster entry: ${id}`);
  }
  return (await response.json()) as MonsterEntryFile;
}
