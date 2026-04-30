import type {
  MonsterEntryFile,
  MonsterPower,
  MonsterPowerAttack,
  MonsterPowerDamage,
  MonsterPowerOutcome,
  MonsterPowerOutcomeEntry
} from "./storage";

/** DMG “Monster Statistics by Role” — hit points gained or lost per level. */
const ROLE_HP_PER_LEVEL: ReadonlyArray<{ match: (roleLower: string) => boolean; hp: number }> = [
  { match: (r) => r.includes("brute"), hp: 10 },
  { match: (r) => r.includes("artillery") || r.includes("lurker"), hp: 6 },
  { match: (r) => r.includes("skirmisher") || r.includes("soldier") || r.includes("controller"), hp: 8 }
];

export const RECOMMENDED_MAX_MONSTER_LEVEL_DELTA = 5;

/**
 * DMG standard monster XP reward by level (table used for encounter building).
 * Levels 1–30; used to scale stored XP when adjusting level while preserving elite/solo/minion multiples.
 */
const STANDARD_MONSTER_XP: readonly number[] = [
  100, 125, 150, 175, 200, 250, 300, 350, 400, 500, 600, 700, 800, 1000, 1200, 1400, 1600, 2000, 2400, 2800, 3200,
  4150, 5100, 6050, 7000, 9000, 11000, 13000, 15000, 20000
];

export function standardMonsterXpForLevel(level: number): number | undefined {
  if (!Number.isFinite(level)) return undefined;
  const L = Math.trunc(level);
  if (L < 1 || L > STANDARD_MONSTER_XP.length) return undefined;
  return STANDARD_MONSTER_XP[L - 1];
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeRole(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** Hit points per level for standard monsters; defaults like Soldier/Controller/Skirmisher (8). */
export function hitPointsPerLevelForMonsterRole(role: string): number {
  const r = normalizeRole(role);
  for (const row of ROLE_HP_PER_LEVEL) {
    if (row.match(r)) return row.hp;
  }
  return 8;
}

function parseFlexibleInt(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string") {
    const m = value.match(/-?\d+/);
    if (m) {
      const n = Number.parseInt(m[0], 10);
      if (Number.isFinite(n)) return n;
    }
  }
  return undefined;
}

/** Parsed creature level for tooling (e.g. clamping quick level adjustment). */
export function parseMonsterLevel(value: unknown): number | undefined {
  return parseFlexibleInt(value);
}

/** Lowest allowed effective level after quick adjustment when base level is known (DMG level 0 creatures vs standard 1–30). */
export function minimumEffectiveMonsterLevel(baseLevel: number): number {
  const L = Math.trunc(baseLevel);
  return L === 0 ? 0 : 1;
}

/**
 * Minimum allowed level delta for a known base level (matches {@link clampMonsterLevelDelta} lower bound).
 */
export function minMonsterLevelDeltaForBase(baseLevel: number): number {
  const L = Math.trunc(baseLevel);
  return Math.max(-RECOMMENDED_MAX_MONSTER_LEVEL_DELTA, minimumEffectiveMonsterLevel(L) - L);
}

/**
 * Clamps requested level delta so the effective level stays ≥ 1 (≥ 0 if the creature starts at level 0)
 * and within ±RECOMMENDED_MAX_MONSTER_LEVEL_DELTA when the base level is known.
 */
export function clampMonsterLevelDelta(baseLevel: number | undefined, requestedDelta: number): number {
  const lo =
    baseLevel === undefined || !Number.isFinite(baseLevel)
      ? -RECOMMENDED_MAX_MONSTER_LEVEL_DELTA
      : minMonsterLevelDeltaForBase(Math.trunc(baseLevel));
  const hi = RECOMMENDED_MAX_MONSTER_LEVEL_DELTA;
  return Math.min(hi, Math.max(lo, requestedDelta));
}

function adjustXpForStandardScaling(entry: MonsterEntryFile, oldLevel: number, newLevel: number): void {
  const oldXp = parseFlexibleInt(entry.xp);
  const xs = standardMonsterXpForLevel(oldLevel);
  const xn = standardMonsterXpForLevel(newLevel);
  if (oldXp === undefined || xs === undefined || xn === undefined || xs <= 0) return;
  const scaled = Math.max(0, Math.round(oldXp * (xn / xs)));
  entry.xp = scaled;
}

function findMapKeyCaseInsensitive(map: Record<string, unknown>, wanted: string): string | undefined {
  const low = wanted.toLowerCase();
  for (const k of Object.keys(map)) {
    if (k.toLowerCase() === low) return k;
  }
  return undefined;
}

function pickHpFieldKey(on: Record<string, unknown>): "hitPoints" | "hp" {
  if (Object.prototype.hasOwnProperty.call(on, "hitPoints")) return "hitPoints";
  if (Object.prototype.hasOwnProperty.call(on, "hp")) return "hp";
  return "hitPoints";
}

function applyDefenseDeltaAll(defenses: Record<string, number | string>, delta: number): void {
  for (const key of Object.keys(defenses)) {
    const cur = parseFlexibleInt(defenses[key]);
    if (cur === undefined) continue;
    defenses[key] = cur + delta;
  }
}

function applyAttackBonusMap(map: Record<string, number | string> | undefined, delta: number): void {
  if (!map || delta === 0) return;
  for (const key of Object.keys(map)) {
    const cur = parseFlexibleInt(map[key]);
    if (cur === undefined) continue;
    map[key] = cur + delta;
  }
}

function adjustPowerAttackBonusValue(v: number | string | undefined, delta: number): number | string | undefined {
  if (v === undefined) return undefined;
  if (typeof v === "number" && Number.isFinite(v)) return v + delta;
  const s = String(v);
  const m = s.match(/^([+-]?\d+)/);
  if (m) {
    const n = Number.parseInt(m[1], 10);
    if (Number.isFinite(n)) return `${n + delta}${s.slice(m[0].length)}`;
  }
  return v;
}

function adjustMonsterPowerDamageBlock(d: MonsterPowerDamage | undefined, dmgDelta: number): void {
  if (!d || dmgDelta === 0) return;

  if (typeof d.averageDamage === "number" && Number.isFinite(d.averageDamage)) {
    d.averageDamage = d.averageDamage + dmgDelta;
  } else if (typeof d.averageDamage === "string") {
    const n = parseFlexibleInt(d.averageDamage);
    if (n !== undefined) d.averageDamage = String(n + dmgDelta);
  }

  if (typeof d.damageConstant === "number" && Number.isFinite(d.damageConstant)) {
    d.damageConstant = d.damageConstant + dmgDelta;
  } else if (typeof d.damageConstant === "string") {
    const n = parseFlexibleInt(d.damageConstant);
    if (n !== undefined) d.damageConstant = String(n + dmgDelta);
  }

  if (Array.isArray(d.expressions)) {
    d.expressions = d.expressions.map((ex) => bumpXdYPlusStatic(String(ex ?? ""), dmgDelta));
  }
}

/** Every “two levels” adjusts static modifier on NdN+M attack damage by one (DMG quick adjustment). */
export function damageDeltaForLevelDelta(levelDelta: number): number {
  return Math.trunc(levelDelta / 2);
}

function bumpXdYPlusStatic(expr: string, add: number): string {
  if (!add) return expr;
  return expr.replace(/(\d+)d(\d+)\s*\+\s*(\d+)/gi, (_full, a: string, b: string, c: string) => {
    return `${a}d${b}+${Number.parseInt(c, 10) + add}`;
  });
}

function adjustDamageProse(text: string | undefined, dmgDelta: number): string | undefined {
  if (text === undefined || dmgDelta === 0) return text;
  const s = String(text);
  const next = bumpXdYPlusStatic(s, dmgDelta);
  return next === s ? s : next;
}

function adjustOutcomeEntryDamage(entry: MonsterPowerOutcomeEntry | undefined, atkDelta: number, dmgDelta: number): void {
  if (!entry) return;
  if (dmgDelta !== 0) {
    if (entry.damage) adjustMonsterPowerDamageBlock(entry.damage, dmgDelta);
    if (entry.description) entry.description = adjustDamageProse(entry.description, dmgDelta);
  }
  entry.aftereffects?.forEach((e) => adjustOutcomeEntryDamage(e, atkDelta, dmgDelta));
  entry.sustains?.forEach((e) => adjustOutcomeEntryDamage(e, atkDelta, dmgDelta));
  entry.failedSavingThrows?.forEach((e) => adjustOutcomeEntryDamage(e, atkDelta, dmgDelta));
  entry.attacks?.forEach((a) => adjustPowerAttack(a, atkDelta, dmgDelta));
}

function adjustOutcomeDamage(outcome: MonsterPowerOutcome | undefined, atkDelta: number, dmgDelta: number): void {
  if (!outcome) return;
  if (dmgDelta !== 0) {
    adjustMonsterPowerDamageBlock(outcome.damage, dmgDelta);
    if (outcome.description) outcome.description = adjustDamageProse(outcome.description, dmgDelta);
  }
  outcome.aftereffects?.forEach((e) => adjustOutcomeEntryDamage(e, atkDelta, dmgDelta));
  outcome.sustains?.forEach((e) => adjustOutcomeEntryDamage(e, atkDelta, dmgDelta));
  outcome.failedSavingThrows?.forEach((e) => adjustOutcomeEntryDamage(e, atkDelta, dmgDelta));
  const nested = outcome.nestedAttackDescriptions;
  if (Array.isArray(nested) && dmgDelta !== 0) {
    for (let i = 0; i < nested.length; i++) {
      const item = nested[i];
      if (typeof item === "string") {
        nested[i] = bumpXdYPlusStatic(item, dmgDelta);
      } else if (item && typeof item === "object") {
        adjustOutcomeDamage(item as MonsterPowerOutcome, atkDelta, dmgDelta);
      }
    }
  }
}

function adjustPowerAttack(attack: MonsterPowerAttack | undefined, atkDelta: number, dmgDelta: number): void {
  if (!attack) return;
  if (atkDelta !== 0 && Array.isArray(attack.attackBonuses)) {
    for (const b of attack.attackBonuses) {
      if (b) b.bonus = adjustPowerAttackBonusValue(b.bonus, atkDelta);
    }
  }
  adjustOutcomeDamage(attack.hit, atkDelta, dmgDelta);
  adjustOutcomeDamage(attack.miss, atkDelta, dmgDelta);
  adjustOutcomeDamage(attack.effect, atkDelta, dmgDelta);
}

function adjustMonsterPower(power: MonsterPower, atkDelta: number, dmgDelta: number): void {
  if (dmgDelta !== 0) {
    if (Array.isArray(power.damageExpressions)) {
      power.damageExpressions = power.damageExpressions.map((ex) => bumpXdYPlusStatic(String(ex ?? ""), dmgDelta));
    }
    if (power.description) power.description = adjustDamageProse(power.description, dmgDelta) ?? power.description;
  }
  for (const atk of power.attacks ?? []) {
    adjustPowerAttack(atk, atkDelta, dmgDelta);
  }
}

function adjustHpAndBloodied(entry: MonsterEntryFile, levelDelta: number, hpPerLevel: number): void {
  if (levelDelta === 0 || hpPerLevel === 0) return;
  const on = (entry.stats?.otherNumbers ?? {}) as Record<string, unknown>;
  const hpGain = hpPerLevel * levelDelta;
  const hpKey =
    findMapKeyCaseInsensitive(on, "hit points") ??
    findMapKeyCaseInsensitive(on, "hitPoints") ??
    findMapKeyCaseInsensitive(on, "hp") ??
    pickHpFieldKey(on);

  const rawHp = on[hpKey];
  const curHp = parseFlexibleInt(rawHp);
  if (curHp !== undefined) {
    on[hpKey] = curHp + hpGain;
    const newHp = curHp + hpGain;

    const bloodiedKey =
      findMapKeyCaseInsensitive(on, "bloodied") ?? findMapKeyCaseInsensitive(on, "Bloodied");
    if (bloodiedKey) {
      const bRaw = on[bloodiedKey];
      if (parseFlexibleInt(bRaw) !== undefined) {
        on[bloodiedKey] = Math.max(0, Math.floor(newHp / 2));
      }
    }
  }
}

/**
 * Applies DMG quick level adjustment: +1 attacks, defenses, AC, and role HP per level;
 * +1 damage per two levels on attack damage expressions; scales XP by standard monster XP table;
 * clamps adjustment so effective level is never below 1, or below 0 if the creature starts at level 0 (within ±5 when base level is known).
 * Preview-only — pass a clone if you must preserve the source entry.
 */
export function applyMonsterLevelDelta(entry: MonsterEntryFile, levelDelta: number): MonsterEntryFile {
  const baseLevel = parseFlexibleInt(entry.level);
  const applyDelta = clampMonsterLevelDelta(baseLevel, levelDelta);

  if (applyDelta === 0) return entry;

  const out = deepClone(entry);
  const roleLower = normalizeRole(out.role);
  const minion = roleLower.includes("minion");
  const dmgDelta = damageDeltaForLevelDelta(applyDelta);

  if (out.stats?.defenses) {
    applyDefenseDeltaAll(out.stats.defenses as Record<string, number | string>, applyDelta);
  }
  applyAttackBonusMap(out.stats?.attackBonuses as Record<string, number | string> | undefined, applyDelta);

  if (baseLevel !== undefined) {
    const newLevel = baseLevel + applyDelta;
    out.level = newLevel;
    adjustXpForStandardScaling(out, baseLevel, newLevel);
  }

  if (!minion) {
    const hpPer = hitPointsPerLevelForMonsterRole(out.role ?? "");
    adjustHpAndBloodied(out, applyDelta, hpPer);
  }

  const atkDelta = applyDelta;
  for (const p of out.powers ?? []) {
    adjustMonsterPower(p, atkDelta, dmgDelta);
  }

  return out;
}
