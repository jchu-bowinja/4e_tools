import type {
  MonsterEntryFile,
  MonsterTemplateAbilityKey,
  MonsterTemplatePrerequisite,
  MonsterTemplateRecord
} from "./storage";

export type { MonsterTemplatePrerequisite } from "./storage";

const ABILITY_PHRASE_TO_KEY: Record<string, MonsterTemplateAbilityKey> = {
  strength: "str",
  str: "str",
  dexterity: "dex",
  dex: "dex",
  constitution: "con",
  con: "con",
  intelligence: "int",
  int: "int",
  wisdom: "wis",
  wis: "wis",
  charisma: "cha",
  cha: "cha"
};

/** Multi-word creature types (order matters: longer phrases first). */
const COMPOUND_TYPE_PHRASES = ["magical beast"] as const;

export type PrerequisiteParseResult = {
  data: MonsterTemplatePrerequisite;
  parseOk: boolean;
  remainderText?: string;
  parseWarnings?: string[];
};

function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function stripLeadingLabel(s: string): string {
  return s.replace(/^prerequisites?\s*:\s*/i, "").trim();
}

function extractMinimumLevel(work: string): { min?: number; rest: string } {
  let rest = work;
  let min: number | undefined;
  const re = /\blevel\s+(\d+)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(work)) !== null) {
    const n = Number.parseInt(m[1], 10);
    if (Number.isFinite(n)) {
      min = min === undefined ? n : Math.min(min, n);
    }
  }
  if (min !== undefined) {
    rest = rest.replace(/\blevel\s+\d+\b/gi, " ");
  }
  return { min, rest: normalizeWhitespace(rest) };
}

function extractAbilityMinimums(work: string): {
  abilityMinimums: Partial<Record<MonsterTemplateAbilityKey, number>>;
  rest: string;
} {
  const abilityMinimums: Partial<Record<MonsterTemplateAbilityKey, number>> = {};
  let rest = work;
  const re =
    /\b(strength|dexterity|constitution|intelligence|wisdom|charisma|str|dex|con|int|wis|cha)\s*[.:]?\s*(\d+)\b/gi;
  let m: RegExpExecArray | null;
  const matches: RegExpExecArray[] = [];
  while ((m = re.exec(work)) !== null) {
    matches.push(m);
  }
  for (const match of matches) {
    const key = ABILITY_PHRASE_TO_KEY[match[1].toLowerCase()];
    const val = Number.parseInt(match[2], 10);
    if (!key || !Number.isFinite(val)) continue;
    const prev = abilityMinimums[key];
    abilityMinimums[key] = prev === undefined ? val : Math.max(prev, val);
    rest = rest.replace(match[0], " ");
  }
  return { abilityMinimums, rest: normalizeWhitespace(rest) };
}

function splitCommaChunks(s: string): string[] {
  return s.split(",").map((p) => p.trim()).filter(Boolean);
}

/**
 * Split type alternatives: "a or b", Oxford-style "a, b, or c", or comma-only lists.
 */
export function splitTypeAlternatives(fragment: string): string[] {
  const t = fragment.replace(/\.$/, "").trim();
  if (!t) return [];

  const lower = t.toLowerCase();
  const needle = ", or ";
  const idx = lower.lastIndexOf(needle);
  if (idx >= 0) {
    const left = t.slice(0, idx).trim();
    const right = t.slice(idx + needle.length).trim();
    return [...splitCommaChunks(left), right];
  }
  if (/\s+or\s+/i.test(t)) {
    return t.split(/\s+or\s+/i).map((p) => p.trim()).filter(Boolean);
  }
  return splitCommaChunks(t);
}

function collapseCompoundTypes(tokens: string[]): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    let merged = false;
    for (const phrase of COMPOUND_TYPE_PHRASES) {
      const parts = phrase.split(" ");
      if (i + parts.length <= tokens.length) {
        const slice = tokens.slice(i, i + parts.length).join(" ");
        if (slice === phrase) {
          out.push(phrase);
          i += parts.length;
          merged = true;
          break;
        }
      }
    }
    if (!merged) {
      out.push(tokens[i]);
      i++;
    }
  }
  return out;
}

/** Turn one alternative phrase into normalized AND-tags (e.g. "Living beast (reptile)" → living, beast, reptile). */
export function parseTypePhraseToTags(phrase: string): string[] {
  const raw = phrase.trim();
  if (!raw) return [];

  let main = raw;
  let paren = "";
  const parenM = /^(.+?)\s*\(([^)]+)\)\s*$/i.exec(raw);
  if (parenM) {
    main = parenM[1].trim();
    paren = parenM[2].trim();
  }

  const words = main
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  const collapsed = collapseCompoundTypes(words);

  const KNOWN_ONE_WORD = new Set([
    "living",
    "beast",
    "humanoid",
    "undead",
    "elemental",
    "fey",
    "immortal",
    "shadow",
    "aberrant",
    "animate",
    "dragon",
    "ooze",
    "plant",
    "swarm",
    "reptile",
    "construct",
    "aquatic"
  ]);

  const tags: string[] = [];
  for (const w of collapsed) {
    if (w === "magical beast") {
      tags.push(w);
      continue;
    }
    if (KNOWN_ONE_WORD.has(w)) {
      tags.push(w);
    }
  }

  if (paren) {
    for (const bit of paren.split(/[,;/]/).map((s) => s.trim()).filter(Boolean)) {
      const k = bit.toLowerCase();
      if (k && !tags.includes(k)) tags.push(k);
    }
  }

  return tags;
}

/**
 * One OR / AND branch as a single display token. Beast + reptile alone → `reptile` (book shorthand).
 */
export function tagsToFlatTypeToken(tags: string[]): string {
  if (
    tags.length === 2 &&
    tags.includes("beast") &&
    tags.includes("reptile")
  ) {
    return "reptile";
  }
  return collapseCompoundTypes(tags).join(" ");
}

/** When every OR branch starts with `living`, strip it and set `living` on the prerequisite object instead. */
export function extractLivingPrefixFromOrBranches(branches: string[][]): {
  living: boolean;
  branches: string[][];
} {
  if (branches.length < 2) return { living: false, branches };
  const allLiving =
    branches.every((b) => b.length >= 2 && b[0] === "living");
  if (!allLiving) return { living: false, branches };
  return { living: true, branches: branches.map((b) => b.slice(1)) };
}

function buildPrerequisiteFlat(params: {
  min?: number;
  abilityMinimums: Partial<Record<MonsterTemplateAbilityKey, number>>;
  livingRequired?: boolean;
  undeadRequired?: boolean;
  typeBranches?: string[][];
}): MonsterTemplatePrerequisite {
  const { min, abilityMinimums, livingRequired, undeadRequired, typeBranches } = params;

  const flat: MonsterTemplatePrerequisite = {};
  if (min !== undefined) flat.minLevel = min;
  const keys = Object.keys(abilityMinimums) as MonsterTemplateAbilityKey[];
  if (keys.length > 0) {
    flat.abilities = {};
    for (const k of keys) {
      const v = abilityMinimums[k];
      if (v !== undefined) (flat.abilities as Record<string, number>)[k] = v;
    }
  }
  let livingOut = Boolean(livingRequired);

  if (typeBranches && typeBranches.length > 1) {
    const { living: livingFromOr, branches: orBranches } = extractLivingPrefixFromOrBranches(typeBranches);
    if (livingFromOr) livingOut = true;
    flat.typeOr = orBranches.map(tagsToFlatTypeToken);
  } else if (typeBranches && typeBranches.length === 1) {
    let tags = typeBranches[0];
    if (tags[0] === "living" && tags.length > 1) {
      livingOut = true;
      tags = tags.slice(1);
    }
    if (tags.length > 0) {
      flat.typeAnd = [tagsToFlatTypeToken(tags)];
    }
  }

  if (undeadRequired) flat.undead = true;
  if (livingOut) flat.living = true;

  return flat;
}

/**
 * Parse natural-language prerequisite prose into a flat {@link MonsterTemplatePrerequisite}.
 */
export function parseMonsterTemplatePrerequisite(rawPrerequisite: string): PrerequisiteParseResult {
  const warnings: string[] = [];
  let work = normalizeWhitespace(stripLeadingLabel(String(rawPrerequisite ?? "")));
  work = work.replace(/\.$/, "").trim();

  if (!work) {
    return { data: {}, parseOk: true };
  }
  if (/^(none|no prerequisite|n\/a)\.?$/i.test(work)) {
    return { data: {}, parseOk: true };
  }

  const { abilityMinimums, rest: afterAbilities } = extractAbilityMinimums(work);
  const { min, rest: afterLevel } = extractMinimumLevel(afterAbilities);
  let remainder = normalizeWhitespace(afterLevel);
  remainder = remainder.replace(/^\s*,?\s*and\s+/i, "").trim();
  remainder = remainder.replace(/^[\s,]+|[\s,]+$/g, "").trim();

  let livingRequired: boolean | undefined;
  let undeadRequired: boolean | undefined;

  const rl = remainder.toLowerCase();
  if (rl === "living creature" || rl === "living creatures" || rl === "a living creature") {
    livingRequired = true;
    remainder = "";
  } else if (rl === "undead") {
    undeadRequired = true;
    remainder = "";
  }

  let typeBranches: string[][] | undefined;
  let remainderText: string | undefined;
  if (remainder) {
    const alts = splitTypeAlternatives(remainder);
    const branches = alts.map((phrase) => parseTypePhraseToTags(phrase)).filter((t) => t.length > 0);
    if (branches.length > 0) {
      typeBranches = branches;
      remainder = "";
    } else {
      remainderText = remainder;
      warnings.push(`Could not parse type tags from: ${remainder}`);
    }
  }

  const data = buildPrerequisiteFlat({
    min,
    abilityMinimums,
    livingRequired,
    undeadRequired,
    typeBranches
  });

  const hasStructured =
    min !== undefined ||
    Object.keys(abilityMinimums).length > 0 ||
    livingRequired ||
    undeadRequired ||
    Boolean(typeBranches?.length);

  const parseOk = Boolean(hasStructured && !remainderText);

  return {
    data,
    parseOk,
    remainderText: remainderText || undefined,
    parseWarnings: warnings.length > 0 ? warnings : undefined
  };
}

/** Migrate legacy `prerequisiteCriteria` rows into flat prerequisites. */
export function legacyPrerequisiteCriteriaToFlat(legacy: unknown): MonsterTemplatePrerequisite | undefined {
  if (!legacy || typeof legacy !== "object" || Array.isArray(legacy)) return undefined;
  const c = legacy as Record<string, unknown>;
  if (c.none === true) return {};

  const abilityMinimums: Partial<Record<MonsterTemplateAbilityKey, number>> = {};
  const ml = c.minLevel;
  const min = typeof ml === "number" && Number.isFinite(ml) ? ml : undefined;

  const am = c.abilityMinimums;
  if (am && typeof am === "object" && !Array.isArray(am)) {
    for (const k of Object.keys(am) as MonsterTemplateAbilityKey[]) {
      const v = (am as Record<string, number>)[k];
      if (typeof v === "number" && Number.isFinite(v)) abilityMinimums[k] = v;
    }
  }

  const tb = c.typeBranches;
  let typeBranches: string[][] | undefined;
  if (Array.isArray(tb) && tb.length > 0) {
    typeBranches = tb.filter((row): row is string[] => Array.isArray(row) && row.every((x) => typeof x === "string"));
    if (typeBranches.length === 0) typeBranches = undefined;
  }

  return buildPrerequisiteFlat({
    min,
    abilityMinimums,
    livingRequired: c.livingRequired === true,
    undeadRequired: c.undeadRequired === true,
    typeBranches
  });
}

/** True if `prerequisiteExpr` uses the older nested `{ op: ... }` JSON shape. */
export function isLegacyPrerequisiteAst(value: unknown): boolean {
  return value != null && typeof value === "object" && !Array.isArray(value) && "op" in (value as object);
}

/** Convert nested `{ op: ... }` prerequisite trees from older saves into flat form. */
export function flattenLegacyPrerequisiteAst(value: unknown): MonsterTemplatePrerequisite | undefined {
  if (!isLegacyPrerequisiteAst(value)) return undefined;
  const flat: MonsterTemplatePrerequisite = {};

  function walk(node: unknown): void {
    if (!node || typeof node !== "object" || Array.isArray(node)) return;
    const n = node as Record<string, unknown>;
    const op = n.op;
    switch (op) {
      case "none":
        break;
      case "minLevel":
        if (typeof n.value === "number") flat.minLevel = n.value;
        break;
      case "minAbility": {
        const ability = n.ability as MonsterTemplateAbilityKey;
        const min = n.min;
        if (ability && typeof min === "number") {
          flat.abilities = { ...flat.abilities, [ability]: min };
        }
        break;
      }
      case "living":
        flat.living = true;
        break;
      case "undead":
        flat.undead = true;
        break;
      case "creatureKind": {
        const tags = n.tags;
        if (Array.isArray(tags) && tags.every((t) => typeof t === "string")) {
          flat.typeAnd = [tagsToFlatTypeToken(tags as string[])];
        }
        break;
      }
      case "all":
        if (Array.isArray(n.of)) (n.of as unknown[]).forEach(walk);
        break;
      case "any":
        if (
          Array.isArray(n.of) &&
          n.of.length > 0 &&
          n.of.every((x) => x && typeof x === "object" && !Array.isArray(x) && (x as { op?: string }).op === "creatureKind")
        ) {
          flat.typeOr = (n.of as { tags: string[] }[]).map((x) => tagsToFlatTypeToken(x.tags));
        } else if (Array.isArray(n.of)) {
          (n.of as unknown[]).forEach(walk);
        }
        break;
      default:
        break;
    }
  }

  walk(value);
  if (Object.keys(flat).length === 0) {
    const root = value as { op?: string };
    if (root.op === "none") return {};
    return undefined;
  }
  return flat;
}

function monsterLevelNumber(entry: MonsterEntryFile): number | undefined {
  const lv = entry.level;
  if (typeof lv === "number" && Number.isFinite(lv)) return lv;
  const n = Number.parseInt(String(lv ?? "").trim(), 10);
  return Number.isFinite(n) ? n : undefined;
}

function monsterAbilityScore(entry: MonsterEntryFile, key: MonsterTemplateAbilityKey): number | undefined {
  const scores = entry.stats?.abilityScores as Record<string, unknown> | undefined;
  if (!scores) return undefined;
  const aliases = [key, key.toUpperCase()];
  const full: Record<MonsterTemplateAbilityKey, string> = {
    str: "strength",
    dex: "dexterity",
    con: "constitution",
    int: "intelligence",
    wis: "wisdom",
    cha: "charisma"
  };
  aliases.push(full[key]);
  for (const a of aliases) {
    const v = scores[a];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    const parsed = Number.parseInt(String(v ?? "").trim(), 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function monsterIsUndead(entry: MonsterEntryFile): boolean {
  const t = `${entry.type ?? ""} ${(entry.keywords ?? []).join(" ")}`.toLowerCase();
  if (/\bundead\b/i.test(t)) return true;
  for (const tr of entry.traits ?? []) {
    if (/\bundead\b/i.test(String(tr.name ?? ""))) return true;
  }
  return false;
}

function monsterIsConstruct(entry: MonsterEntryFile): boolean {
  const t = `${entry.type ?? ""} ${(entry.keywords ?? []).join(" ")}`.toLowerCase();
  return /\bconstruct\b/i.test(t);
}

function buildMonsterHaystack(entry: MonsterEntryFile): string {
  const kw = Array.isArray(entry.keywords) ? entry.keywords.join(" ") : "";
  const line = `${entry.size ?? ""} ${entry.origin ?? ""} ${entry.type ?? ""} ${kw}`.toLowerCase();
  return normalizeWhitespace(line);
}

function haystackContainsPhrase(haystack: string, phrase: string): boolean {
  const p = phrase.toLowerCase();
  if (!p) return true;
  return haystack.includes(p);
}

function monsterMatchesCreatureTags(entry: MonsterEntryFile, tags: string[]): boolean {
  const haystack = buildMonsterHaystack(entry);
  const undead = monsterIsUndead(entry);

  for (const tag of tags) {
    if (tag === "living") {
      if (undead) return false;
      continue;
    }
    if (tag === "undead") {
      if (!undead) return false;
      continue;
    }
    if (!haystackContainsPhrase(haystack, tag)) return false;
  }
  return true;
}

function prerequisiteIsUnconstrained(p: MonsterTemplatePrerequisite): boolean {
  if ((p as { none?: boolean }).none === true) return true;
  return Object.keys(p as object).length === 0;
}

/**
 * Returns whether `entry` satisfies the flat prerequisite rules (implicit AND of all fields).
 */
export function monsterMatchesPrerequisite(entry: MonsterEntryFile, p: MonsterTemplatePrerequisite): boolean {
  if (prerequisiteIsUnconstrained(p)) return true;

  if (p.minLevel !== undefined) {
    const lv = monsterLevelNumber(entry);
    if (lv === undefined || lv < p.minLevel) return false;
  }

  const mins = p.abilities;
  if (mins) {
    for (const k of Object.keys(mins) as MonsterTemplateAbilityKey[]) {
      const need = mins[k];
      if (need === undefined) continue;
      const have = monsterAbilityScore(entry, k);
      if (have === undefined || have < need) return false;
    }
  }

  if (p.living && (monsterIsUndead(entry) || monsterIsConstruct(entry))) return false;
  if (p.undead && !monsterIsUndead(entry)) return false;

  function typeTokenToTags(token: string): string[] {
    return collapseCompoundTypes(token.toLowerCase().split(/\s+/).filter(Boolean));
  }

  const hasOr = p.typeOr && p.typeOr.length > 0;
  const hasAnd = p.typeAnd && p.typeAnd.length > 0;
  if (hasOr) {
    if (!p.typeOr!.some((tok) => monsterMatchesCreatureTags(entry, typeTokenToTags(tok)))) return false;
  }
  if (hasAnd) {
    const combined = p.typeAnd!.flatMap((tok) => typeTokenToTags(tok));
    if (!monsterMatchesCreatureTags(entry, combined)) return false;
  }

  return true;
}

/** Older saves: rename kind* → type*, and flatten nested `typeOr: string[][]` → `string[]`. */
export function migrateKindFieldsToType(expr: unknown): unknown {
  if (!expr || typeof expr !== "object" || Array.isArray(expr)) return expr;
  const o = { ...(expr as Record<string, unknown>) };
  if ("kindOr" in o && !("typeOr" in o)) {
    o.typeOr = o.kindOr;
    delete o.kindOr;
  }
  if ("kindAnd" in o && !("typeAnd" in o)) {
    o.typeAnd = o.kindAnd;
    delete o.kindAnd;
  }
  const tor = o.typeOr;
  if (Array.isArray(tor) && tor.length > 0 && Array.isArray(tor[0])) {
    o.typeOr = (tor as string[][]).map((row) =>
      tagsToFlatTypeToken(row.filter((x): x is string => typeof x === "string"))
    );
  }
  if (Object.keys(o).length === 1 && o.none === true) return {};
  return o;
}

/** Resolve flat prerequisite from record (migrates legacy AST-shaped JSON when needed). */
export function resolveTemplatePrerequisite(
  record: Pick<MonsterTemplateRecord, "prerequisite" | "prerequisiteExpr">
): MonsterTemplatePrerequisite {
  const rawExpr = migrateKindFieldsToType(record.prerequisiteExpr as unknown);
  if (rawExpr != null && typeof rawExpr === "object" && !Array.isArray(rawExpr)) {
    if (!isLegacyPrerequisiteAst(rawExpr)) return rawExpr as MonsterTemplatePrerequisite;
    const flattened = flattenLegacyPrerequisiteAst(rawExpr);
    if (flattened) return flattened;
  }
  const raw = record.prerequisite?.trim();
  if (!raw) return {};
  return parseMonsterTemplatePrerequisite(raw).data;
}

/**
 * Whether `entry` meets this template's prerequisites (`prerequisiteExpr`, else parsed `prerequisite` prose).
 */
export function monsterMatchesTemplateRecord(
  entry: MonsterEntryFile,
  record: Pick<MonsterTemplateRecord, "prerequisite" | "prerequisiteExpr">
): boolean {
  return monsterMatchesPrerequisite(entry, resolveTemplatePrerequisite(record));
}
