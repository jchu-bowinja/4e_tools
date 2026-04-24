export interface MonsterIndexEntry {
  id: string;
  fileName: string;
  relativePath: string;
  name: string;
  level: string | number;
  role: string;
  isLeader?: boolean;
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
  otherNumbers: Record<string, unknown>;
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
  keywordNames?: string[];
  keywordTokens?: string[];
  range?: string;
  description: string;
  damageExpressions?: string[];
  attacks?: MonsterPowerAttack[];
}

export interface MonsterPowerDamage {
  expressions?: string[];
  averageDamage?: number | string;
  damageConstant?: number | string;
  diceQuantity?: number | string;
  diceSides?: number | string;
  damageType?: string;
  modifier?: string;
}

export interface MonsterPowerOutcomeEntry {
  kind?: string;
  name?: string;
  description?: string;
  damage?: MonsterPowerDamage;
  aftereffects?: MonsterPowerOutcomeEntry[];
  sustains?: MonsterPowerOutcomeEntry[];
  failedSavingThrows?: MonsterPowerOutcomeEntry[];
  attacks?: MonsterPowerAttack[];
}

export interface MonsterPowerOutcome {
  description?: string;
  damage?: MonsterPowerDamage;
  nestedAttackDescriptions?: string[];
  aftereffects?: MonsterPowerOutcomeEntry[];
  sustains?: MonsterPowerOutcomeEntry[];
  failedSavingThrows?: MonsterPowerOutcomeEntry[];
}

export interface MonsterPowerAttackBonus {
  defense?: string;
  bonus?: number | string;
}

export interface MonsterPowerAttack {
  kind?: string;
  name?: string;
  range?: string;
  targets?: string;
  attackBonuses?: MonsterPowerAttackBonus[];
  hit?: MonsterPowerOutcome;
  miss?: MonsterPowerOutcome;
  effect?: MonsterPowerOutcome;
}

export interface MonsterEntryFile extends MonsterIndexEntry {
  sourceRoot: string;
  size: string;
  origin: string;
  type: string;
  xp: string | number;
  tactics?: string;
  groupRole?: string;
  alignment?: { id?: string | number; name?: string; description?: string };
  languages?: string[];
  keywords?: string[];
  immunities?: string[];
  senses?: Array<{ name?: string; range?: string | number }>;
  resistances?: Array<{ name?: string; amount?: string | number; details?: string }>;
  weaknesses?: Array<{ name?: string; amount?: string | number; details?: string }>;
  sourceBooks?: string[];
  regeneration?: string | number;
  items?: Array<{ quantity?: string | number; name?: string; id?: string | number; description?: string }>;
  phasing?: boolean;
  compendiumUrl?: string;
  description?: string;
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
