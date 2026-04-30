import type {
  MonsterEntryFile,
  MonsterPower,
  MonsterPowerAttack,
  MonsterPowerOutcome,
  MonsterPowerOutcomeEntry,
  MonsterTemplatePasteResistanceEntryOptionB,
  MonsterTemplatePasteSkillEntryOptionB,
  MonsterTemplatePasteStatsOptionB,
  MonsterTemplateRecord,
  MonsterTrait
} from "./storage";

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

function parseMonsterLevel(entry: MonsterEntryFile): number {
  const raw = entry.level;
  const n = typeof raw === "number" ? raw : Number.parseInt(String(raw ?? "").trim(), 10);
  return Number.isFinite(n) ? n : 0;
}

function asNumber(value: number | string | undefined): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const m = value.trim().match(/^[+-]?\d+$/);
    if (!m) return undefined;
    const n = Number.parseInt(m[0], 10);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function applyMonsterLevelToAttackBonus(value: number | string | undefined, monsterLevel: number): number | string | undefined {
  const baseBonus = asNumber(value);
  if (baseBonus === undefined || !Number.isFinite(monsterLevel)) return value;
  return monsterLevel + baseBonus;
}

function calculateAttackBonusesForAttack(attack: MonsterPowerAttack | undefined, monsterLevel: number): void {
  if (!attack) return;
  if (Array.isArray(attack.attackBonuses)) {
    for (const attackBonus of attack.attackBonuses) {
      if (!attackBonus) continue;
      attackBonus.bonus = applyMonsterLevelToAttackBonus(attackBonus.bonus, monsterLevel);
    }
  }
  calculateAttackBonusesForOutcome(attack.hit, monsterLevel);
  calculateAttackBonusesForOutcome(attack.miss, monsterLevel);
  calculateAttackBonusesForOutcome(attack.effect, monsterLevel);
}

function calculateAttackBonusesForOutcomeEntry(entry: MonsterPowerOutcomeEntry | undefined, monsterLevel: number): void {
  if (!entry) return;
  entry.attacks?.forEach((attack) => calculateAttackBonusesForAttack(attack, monsterLevel));
  entry.aftereffects?.forEach((child) => calculateAttackBonusesForOutcomeEntry(child, monsterLevel));
  entry.sustains?.forEach((child) => calculateAttackBonusesForOutcomeEntry(child, monsterLevel));
  entry.failedSavingThrows?.forEach((child) => calculateAttackBonusesForOutcomeEntry(child, monsterLevel));
}

function calculateAttackBonusesForOutcome(outcome: MonsterPowerOutcome | undefined, monsterLevel: number): void {
  if (!outcome) return;
  outcome.aftereffects?.forEach((entry) => calculateAttackBonusesForOutcomeEntry(entry, monsterLevel));
  outcome.sustains?.forEach((entry) => calculateAttackBonusesForOutcomeEntry(entry, monsterLevel));
  outcome.failedSavingThrows?.forEach((entry) => calculateAttackBonusesForOutcomeEntry(entry, monsterLevel));
  const nested = outcome.nestedAttackDescriptions;
  if (!Array.isArray(nested)) return;
  for (const nestedEntry of nested) {
    if (!nestedEntry || typeof nestedEntry !== "object" || Array.isArray(nestedEntry)) continue;
    calculateAttackBonusesForOutcome(nestedEntry as MonsterPowerOutcome, monsterLevel);
  }
}

function calculateAttackBonusesForTemplatePower(power: MonsterPower, monsterLevel: number): void {
  for (const attack of power.attacks ?? []) {
    calculateAttackBonusesForAttack(attack, monsterLevel);
  }
}

function normalizeRole(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function getConstitutionScore(entry: MonsterEntryFile): number {
  const abs = entry.stats?.abilityScores ?? {};
  const keys = ["Constitution", "constitution", "CON", "Con", "con"];
  for (const k of keys) {
    const v = (abs as Record<string, unknown>)[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const n = Number.parseInt(v.trim(), 10);
      if (Number.isFinite(n)) return n;
    }
  }
  return 0;
}

/** Parses integers from stat display strings ("17", "+4") or returns undefined. */
function parseFlexibleNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const m = value.match(/-?\d+/);
    if (m) {
      const n = Number.parseInt(m[0], 10);
      if (Number.isFinite(n)) return n;
    }
  }
  return undefined;
}

function ensureStats(entry: MonsterEntryFile): void {
  if (!entry.stats) {
    entry.stats = {
      abilityScores: {},
      defenses: {},
      attackBonuses: {},
      skills: {},
      otherNumbers: {}
    };
  }
}

function ensureOtherNumbers(entry: MonsterEntryFile): Record<string, unknown> {
  ensureStats(entry);
  if (!entry.stats!.otherNumbers) entry.stats!.otherNumbers = {};
  return entry.stats!.otherNumbers as Record<string, unknown>;
}

function pickHpFieldKey(on: Record<string, unknown>): "hitPoints" | "hp" {
  if (Object.prototype.hasOwnProperty.call(on, "hitPoints")) return "hitPoints";
  if (Object.prototype.hasOwnProperty.call(on, "hp")) return "hp";
  return "hitPoints";
}

function findMapKeyCaseInsensitive<T>(
  map: Record<string, T>,
  wanted: string
): string | undefined {
  const low = wanted.toLowerCase();
  for (const k of Object.keys(map)) {
    if (k.toLowerCase() === low) return k;
  }
  return undefined;
}

const CANON_DEFENSE_LABELS = ["ac", "fortitude", "reflex", "will"] as const;

function preferredDefenseKey(canon: string): string {
  if (canon === "ac") return "AC";
  return canon.charAt(0).toUpperCase() + canon.slice(1);
}

function applyDefenseDelta(
  defs: Record<string, number | string>,
  canon: string,
  delta: number
): void {
  const prefer = preferredDefenseKey(canon);
  const existingKey =
    findMapKeyCaseInsensitive(defs as Record<string, unknown>, prefer) ??
    findMapKeyCaseInsensitive(defs as Record<string, unknown>, canon);
  const keyToUse = existingKey ?? prefer;
  const cur = parseFlexibleNumber(defs[keyToUse]) ?? 0;
  defs[keyToUse] = cur + delta;
}

function mergeDefenseBonuses(entry: MonsterEntryFile, bonuses: Record<string, number>): void {
  ensureStats(entry);
  const defs = { ...(entry.stats!.defenses ?? {}) } as Record<string, number | string>;
  for (const [rawKey, delta] of Object.entries(bonuses)) {
    if (!Number.isFinite(delta)) continue;
    const normLower = rawKey.trim().toLowerCase();

    let matched = false;
    for (const canon of CANON_DEFENSE_LABELS) {
      if (normLower === canon) {
        applyDefenseDelta(defs, canon, delta);
        matched = true;
        break;
      }
    }
    if (matched) continue;

    const existingKey = findMapKeyCaseInsensitive(defs as Record<string, unknown>, rawKey.trim()) ?? rawKey.trim();
    const cur = parseFlexibleNumber(defs[existingKey]) ?? 0;
    defs[existingKey] = cur + delta;
  }
  entry.stats!.defenses = defs as MonsterEntryFile["stats"]["defenses"];
}

function mergeSkillBonuses(entry: MonsterEntryFile, entries: MonsterTemplatePasteSkillEntryOptionB[]): void {
  ensureStats(entry);
  const skills = { ...(entry.stats!.skills ?? {}) } as Record<string, number | string>;
  for (const row of entries) {
    const label = String(row.skill ?? "").trim();
    if (!label) continue;
    const key = findMapKeyCaseInsensitive(skills, label) ?? label;
    const cur = parseFlexibleNumber(skills[key]) ?? 0;
    skills[key] = cur + row.value;
  }
  entry.stats!.skills = skills;
}

function addOtherNumberDelta(entry: MonsterEntryFile, keys: string[], delta: number): void {
  if (delta === 0) return;
  const on = ensureOtherNumbers(entry);
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(on, k)) {
      const cur = parseFlexibleNumber(on[k]) ?? 0;
      on[k] = cur + delta;
      return;
    }
  }
  on[keys[0]] = delta;
}

function tierBracket(level: number): "1" | "11" | "21" {
  if (level >= 21) return "21";
  if (level >= 11) return "11";
  return "1";
}

function resistanceEntryToMergedLine(
  e: MonsterTemplatePasteResistanceEntryOptionB,
  level: number,
  _kind: "resist" | "vuln"
): { name: string; amount: number | string; details?: string } | null {
  const t = (e.type ?? "").trim().toLowerCase();
  if (e.kind === "keyword" && t) {
    return { name: t, details: "(template)" };
  }
  if (e.kind === "variable" && e.tiers) {
    const tb = tierBracket(level);
    const amt = e.tiers[tb];
    if (amt === undefined) return null;
    const rider = e.tierRiders?.[tb]?.trim();
    return {
      name: t || "choice",
      amount: amt,
      details: rider ? `${rider} (template)` : "(template)"
    };
  }
  if (e.plusHalfLevel && e.baseAmount !== undefined && t) {
    return { name: t, amount: e.baseAmount + Math.floor(level / 2) };
  }
  if (e.tiers && t) {
    const tb = tierBracket(level);
    const v = e.tiers[tb];
    if (v !== undefined) return { name: t, amount: v };
  }
  if (t) return { name: t, amount: "" };
  return null;
}

function normalizeResistanceEntriesLoose(raw: unknown): MonsterTemplatePasteResistanceEntryOptionB[] {
  if (!raw) return [];
  if (isRecord(raw) && Array.isArray(raw.entries)) {
    return raw.entries.filter(Boolean) as MonsterTemplatePasteResistanceEntryOptionB[];
  }
  return [];
}

function mergeHpFromTemplate(
  entry: MonsterEntryFile,
  hp: NonNullable<MonsterTemplatePasteStatsOptionB["hitPoints"]>,
  level: number,
  roleLower: string,
  conScore: number
): void {
  let perLevel: number | undefined;
  let addCon = false;
  let matched = false;

  const variants = hp.variants;
  if (Array.isArray(variants)) {
    for (const v of variants) {
      if (!v || !v.when) continue;
      const vr = normalizeRole(v.when.role);
      if (vr && (roleLower === vr || roleLower.includes(vr) || vr.includes(roleLower))) {
        perLevel = v.perLevel;
        addCon = !!v.addConstitution;
        matched = true;
        break;
      }
    }
  }
  if (!matched && hp.default) {
    perLevel = hp.default.perLevel;
    addCon = !!hp.default.addConstitution;
    matched = true;
  }
  if (!matched && Array.isArray(variants) && variants.length === 1) {
    const v = variants[0];
    perLevel = v?.perLevel;
    addCon = !!v?.addConstitution;
  }

  if (perLevel === undefined && !addCon) return;

  const hpBonus = (perLevel ?? 0) * level + (addCon ? conScore : 0);
  if (hpBonus === 0) return;

  const on = ensureOtherNumbers(entry);
  const hpKey = pickHpFieldKey(on);
  const cur = parseFlexibleNumber(on[hpKey]) ?? 0;
  on[hpKey] = cur + hpBonus;
}

function mergeTemplateStatAdjustments(entry: MonsterEntryFile, template: MonsterTemplateRecord): void {
  const rawStats = template.stats;
  if (!isRecord(rawStats)) return;

  const skipExportOnly =
    rawStats.monsterExport != null &&
    rawStats.hitPoints == null &&
    rawStats.defenses == null &&
    rawStats.skills == null &&
    rawStats.initiative == null &&
    rawStats.savingThrows == null &&
    rawStats.actionPoints == null;
  if (skipExportOnly) return;

  const stats = rawStats as MonsterTemplatePasteStatsOptionB & Record<string, unknown>;
  const level = parseMonsterLevel(entry);
  const roleLower = normalizeRole(entry.role);
  const conScore = getConstitutionScore(entry);

  const hpCfg = stats.hitPoints;
  if (hpCfg && typeof hpCfg === "object") {
    mergeHpFromTemplate(entry, hpCfg as NonNullable<MonsterTemplatePasteStatsOptionB["hitPoints"]>, level, roleLower, conScore);
  }

  const defs = stats.defenses;
  if (isRecord(defs)) {
    const nums: Record<string, number> = {};
    for (const [k, v] of Object.entries(defs)) {
      if (typeof v === "number" && Number.isFinite(v)) nums[k] = v;
    }
    if (Object.keys(nums).length > 0) mergeDefenseBonuses(entry, nums);
  }

  const skillsObj = stats.skills;
  if (isRecord(skillsObj) && Array.isArray(skillsObj.entries)) {
    mergeSkillBonuses(entry, skillsObj.entries as MonsterTemplatePasteSkillEntryOptionB[]);
  }

  const ini = stats.initiative;
  if (isRecord(ini) && typeof ini.value === "number") {
    addOtherNumberDelta(entry, ["initiative"], ini.value);
  }

  const st = stats.savingThrows;
  if (isRecord(st) && typeof st.value === "number") {
    addOtherNumberDelta(entry, ["savingThrows", "saving throws"], st.value);
  }

  const ap = stats.actionPoints;
  if (isRecord(ap) && typeof ap.value === "number") {
    addOtherNumberDelta(entry, ["actionPoints", "action points"], ap.value);
  }

  const speed = stats.speed;
  if (isRecord(speed) && typeof speed.raw === "string" && speed.raw.trim()) {
    const on = ensureOtherNumbers(entry);
    const rawList = on.movement;
    const entryObj = { type: "Speed", value: speed.raw.trim() };
    if (Array.isArray(rawList)) {
      on.movement = [...rawList, entryObj];
    } else {
      on.movement = [entryObj];
    }
  }

  const senseList = stats.senses;
  if (Array.isArray(senseList) && senseList.length > 0) {
    const existing = Array.isArray(entry.senses) ? [...entry.senses] : [];
    const seen = new Set(existing.map((s) => `${String(s.name ?? "").toLowerCase()}|${String(s.range ?? "")}`));
    for (const s of senseList) {
      if (!isRecord(s)) continue;
      const name = String(s.name ?? "").trim();
      const range = typeof s.range === "number" && Number.isFinite(s.range) ? s.range : 0;
      const sig = `${name.toLowerCase()}|${range}`;
      if (!name || seen.has(sig)) continue;
      seen.add(sig);
      existing.push({ name, range });
    }
    entry.senses = existing;
  }

  const imm = stats.immunities;
  if (Array.isArray(imm) && imm.length > 0) {
    const cur = Array.isArray(entry.immunities) ? [...entry.immunities] : [];
    const seen = new Set(cur.map((x) => String(x).toLowerCase()));
    for (const x of imm) {
      const s = String(x).trim();
      if (!s || seen.has(s.toLowerCase())) continue;
      seen.add(s.toLowerCase());
      cur.push(s);
    }
    entry.immunities = cur;
  }

  const regen = stats.regeneration;
  if (typeof regen === "number" && Number.isFinite(regen)) {
    const raw = entry.regeneration;
    let base = 0;
    if (typeof raw === "number" && Number.isFinite(raw)) base = raw;
    else base = parseFlexibleNumber(raw) ?? 0;
    entry.regeneration = base + regen;
  }

  const resistEntries = normalizeResistanceEntriesLoose(stats.resistances);
  if (resistEntries.length > 0) {
    const curArr = Array.isArray(entry.resistances) ? [...entry.resistances] : [];
    for (const e of resistEntries) {
      const line = resistanceEntryToMergedLine(e, level, "resist");
      if (!line) continue;
      curArr.push(line);
    }
    entry.resistances = curArr;
  }

  const vulnEntries = normalizeResistanceEntriesLoose(stats.vulnerabilities);
  if (vulnEntries.length > 0) {
    const curArr = Array.isArray(entry.weaknesses) ? [...entry.weaknesses] : [];
    for (const e of vulnEntries) {
      const line = resistanceEntryToMergedLine(e, level, "vuln");
      if (!line) continue;
      curArr.push(line);
    }
    entry.weaknesses = curArr;
  }
}

function normName(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

export function traitSignature(trait: MonsterTrait): string {
  return [normName(trait.name), String(trait.range ?? ""), normName(trait.details)].join("|");
}

export function powerSignature(power: MonsterPower): string {
  return normName(power.name);
}

export type TemplateApplicationDelta = {
  addedPowerNames: string[];
  addedTraitNames: string[];
  addedAuraNames: string[];
  skippedDuplicatePowers: number;
  skippedDuplicateTraits: number;
  skippedDuplicateAuras: number;
};

export function computeTemplateApplicationDelta(
  base: MonsterEntryFile,
  template: MonsterTemplateRecord
): TemplateApplicationDelta {
  const basePower = new Set((base.powers ?? []).map(powerSignature));
  const baseAura = new Set((base.auras ?? []).map(traitSignature));
  const baseTrait = new Set((base.traits ?? []).map(traitSignature));

  const addedPowerNames: string[] = [];
  let skippedDuplicatePowers = 0;
  for (const p of template.powers ?? []) {
    const sig = powerSignature(p);
    if (basePower.has(sig)) skippedDuplicatePowers++;
    else addedPowerNames.push(String(p.name ?? "").trim() || "(unnamed power)");
  }

  const addedAuraNames: string[] = [];
  let skippedDuplicateAuras = 0;
  for (const a of template.auras ?? []) {
    const sig = traitSignature(a);
    if (baseAura.has(sig)) skippedDuplicateAuras++;
    else addedAuraNames.push(String(a.name ?? "").trim() || "(unnamed aura)");
  }

  const addedTraitNames: string[] = [];
  let skippedDuplicateTraits = 0;
  for (const t of template.traits ?? []) {
    const sig = traitSignature(t);
    if (baseTrait.has(sig)) skippedDuplicateTraits++;
    else addedTraitNames.push(String(t.name ?? "").trim() || "(unnamed trait)");
  }

  return {
    addedPowerNames,
    addedTraitNames,
    addedAuraNames,
    skippedDuplicatePowers,
    skippedDuplicateTraits,
    skippedDuplicateAuras
  };
}

/**
 * Merge a monster template onto a base creature for preview: append template powers, traits, and auras
 * (deduped by name/signature). Applies structured template stat adjustments from `template.stats` when present
 * (Option B / PDF ETL): HP formula, defense bonuses, skills, initiative, saves, action points, speed line,
 * senses, immunities, regeneration, resistances, and vulnerabilities—merged onto the base creature’s numbers.
 */
export function applyMonsterTemplateToEntry(entry: MonsterEntryFile, template: MonsterTemplateRecord): MonsterEntryFile {
  const out = deepClone(entry);
  const monsterLevel = parseMonsterLevel(out);
  const powerKeys = new Set((out.powers ?? []).map(powerSignature));
  out.powers = [...(out.powers ?? [])];
  for (const p of template.powers ?? []) {
    const sig = powerSignature(p);
    if (!powerKeys.has(sig)) {
      const clonedPower = deepClone(p);
      calculateAttackBonusesForTemplatePower(clonedPower, monsterLevel);
      out.powers.push(clonedPower);
      powerKeys.add(sig);
    }
  }

  const auraKeys = new Set((out.auras ?? []).map(traitSignature));
  out.auras = [...(out.auras ?? [])];
  for (const a of template.auras ?? []) {
    const sig = traitSignature(a);
    if (!auraKeys.has(sig)) {
      out.auras.push(deepClone(a));
      auraKeys.add(sig);
    }
  }

  const traitKeys = new Set((out.traits ?? []).map(traitSignature));
  out.traits = [...(out.traits ?? [])];
  for (const t of template.traits ?? []) {
    const sig = traitSignature(t);
    if (!traitKeys.has(sig)) {
      out.traits.push(deepClone(t));
      traitKeys.add(sig);
    }
  }

  mergeTemplateStatAdjustments(out, template);

  out.sections = {
    ...(out.sections ?? {}),
    monsterTemplatePreview: {
      templateName: template.templateName,
      sourceBook: template.sourceBook
    }
  };

  return out;
}
