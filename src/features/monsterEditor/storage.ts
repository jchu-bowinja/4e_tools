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
  /** Set by template paste ETL: "Keyword fear" line + (Fear) in name for auras/traits */
  traitTemplateKeywords?: string[];
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

export interface MonsterTrait {
  name?: string;
  details?: string;
  range?: string | number;
  type?: string;
  keywords?: string[];
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
  traits?: MonsterTrait[];
  auras?: MonsterTrait[];
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

/** PDF-extracted monster template overlay (.generated/monster_templates.json`). */
export interface MonsterTemplateRole {
  raw?: string;
  templateLabel?: string;
  tier?: string;
  combatRole?: string;
  tags?: string[];
}

/** Paste / create-template extraction: tier-aware, source-line–aware stat bundle (Option B). */
export interface MonsterTemplatePasteHitPointsOptionB {
  default?: { perLevel?: number; addConstitution?: boolean };
  variants?: Array<{
    when?: { role?: string };
    perLevel?: number;
    addConstitution?: boolean;
    sourceLine?: string;
  }>;
  sourceLines?: string[];
}

export interface MonsterTemplatePasteScalarStatOptionB {
  value: number;
  sourceLine?: string;
  notes?: string[];
}

export interface MonsterTemplatePasteSpeedOptionB {
  raw: string;
  sourceLine?: string;
}

export interface MonsterTemplatePasteSkillEntryOptionB {
  skill: string;
  value: number;
  trained: boolean;
  sourceLine?: string;
}

export type MonsterTemplatePasteResistanceKindOptionB = "typed" | "keyword" | "variable";

export interface MonsterTemplatePasteResistanceEntryOptionB {
  kind: MonsterTemplatePasteResistanceKindOptionB;
  type?: string;
  /** Tier breakpoints (heroic / paragon / epic). */
  tiers?: Record<string, number>;
  /**
   * For `kind: "variable"` (player-chosen damage types): parenthetical rider per tier from the book,
   * e.g. `{ "1": "choose one type", "11": "choose two types", "21": "choose three types" }`.
   */
  tierRiders?: Record<string, string>;
  sourceLine?: string;
}

export interface MonsterTemplatePasteStatsOptionB {
  hitPoints?: MonsterTemplatePasteHitPointsOptionB;
  defenses?: Record<string, number>;
  savingThrows?: MonsterTemplatePasteScalarStatOptionB;
  actionPoints?: MonsterTemplatePasteScalarStatOptionB;
  initiative?: MonsterTemplatePasteScalarStatOptionB;
  speed?: MonsterTemplatePasteSpeedOptionB;
  skills?: { entries: MonsterTemplatePasteSkillEntryOptionB[] };
  /** Parsed from a stat line such as `Senses darkvision` or OCR-glued `SensesDarkvision`. */
  senses?: { raw: string; sourceLine?: string };
  immunities?: string[];
  resistances?: { entries: MonsterTemplatePasteResistanceEntryOptionB[] };
  vulnerabilities?: { entries: MonsterTemplatePasteResistanceEntryOptionB[] };
  regeneration?: number;
  unparsedStatLines?: string[];
}

export interface MonsterTemplateRecord {
  templateName: string;
  sourceBook: string;
  pageStart?: number;
  pageEnd?: number;
  description?: string;
  prerequisite?: string;
  roleLine?: string;
  role?: MonsterTemplateRole;
  isEliteTemplate?: boolean;
  statLines?: string[];
  /** Prefer `MonsterTemplatePasteStatsOptionB` when `extractionMethod` is `paste-ts`. */
  stats?: Record<string, unknown>;
  auras?: MonsterTrait[];
  traits?: MonsterTrait[];
  powers: MonsterPower[];
  /** Present on ETL / paste-import rows */
  rawText?: string;
  powersText?: string[];
  uncategorizedAbilities?: MonsterPower[];
  extractionWarnings?: string[];
  extractionMethod?: string;
  relatedFlavorText?: unknown[];
}

interface MonsterTemplatesPayload {
  meta: Record<string, unknown>;
  templates: MonsterTemplateRecord[];
}

export async function loadMonsterTemplates(): Promise<MonsterTemplateRecord[]> {
  const response = await fetch("/generated/monster_templates.json");
  if (!response.ok) {
    throw new Error("Could not load generated/monster_templates.json. Generate templates JSON first.");
  }
  const data = (await response.json()) as MonsterTemplatesPayload;
  if (!Array.isArray(data.templates)) {
    throw new Error("Invalid generated/monster_templates.json format.");
  }
  return data.templates;
}
