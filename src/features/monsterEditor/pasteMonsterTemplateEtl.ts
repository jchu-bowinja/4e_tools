/**
 * Browser-side port of `tools/etl/extract_monster_templates_from_pdfs.py` paste path
 * (`parse_pasted_monster_template`). Used when the dev-server Python API is unavailable
 * (preview/production static builds).
 */
/// <reference types="vite/client" />

import type {
  MonsterPower,
  MonsterTemplatePasteResistanceEntryOptionB,
  MonsterTemplatePasteSkillEntryOptionB,
  MonsterTemplatePasteSenseEntryOptionB,
  MonsterTemplatePasteStatsOptionB,
  MonsterTemplateRecord,
  MonsterTrait
} from "./storage";
import { normalizeMonsterPowerShape } from "./monsterPowerNormalize";
import { parseMonsterTemplatePrerequisite } from "./templatePrerequisiteCriteria";

export type ParsePasteResult =
  | { ok: true; template: MonsterTemplateRecord; validation: MonsterTemplateImportValidation }
  | { ok: false; error: string };

export type MonsterTemplateImportValidation = {
  errors: string[];
  warnings: string[];
};

const PAGE_NUMBER_RE = /^\s*\d+\s*$/;
const ROLE_LINE_RE =
  /^([A-Za-z][A-Za-z' -]{2,})\s+Elite\s+(Soldier|Brute|Controller|Skirmisher|Artillery|Lurker)\s*$/i;
const ROLE_LINE_ELITE_ANCHOR_RE =
  /^(.+?)\s+Elite\s+(Soldier|Brute|Controller|Skirmisher|Artillery|Lurker)\b/i;
/** `Hit Points` only when a formula follows — avoids matching body text like "hit points. An affected…". */
const STAT_LINE_RE =
  /^(Prerequisite:|Defenses\b|Saving Throws|Action Points?|(?:Hit Points|HP)\b(?=\s*[+\d-])|Resist|Immune|Vulnerable|Senses|Speed|Initiative|Skills)\b/i;

/** True when `line` opens a template stat row. */
function isTemplateStatLineStart(line: string): boolean {
  const t = line.trim();
  if (/^senses(?=$|\s|[A-Za-z(])/i.test(t)) return true;
  return STAT_LINE_RE.test(t);
}

const SECTION_MARKER_RE =
  /^(POWERS|TRAITS|STANDARD\s*A\s*CTIONS|MOVE\s*A\s*CTIONS|MINOR\s*A\s*CTIONS|MAJOR\s*A\s*CTIONS)\b/i;
/** Explicit paste scaffold: start a block; repeat between abilities (closes prior + opens next). */
const ABILITY_BLOCK_START_RE = /^\s*\[ABILITY\]\s*$/i;
/** Explicit paste scaffold: end the current block without starting another (next block needs `[ABILITY]`). */
const ABILITY_BLOCK_END_RE = /^\s*\[ABILITYEND\]\s*$/i;

function isExplicitAbilityMarkerLine(line: string): boolean {
  const t = line.trim();
  return ABILITY_BLOCK_START_RE.test(t) || ABILITY_BLOCK_END_RE.test(t);
}

function normalizeLine(line: string): string {
  return line.replace(/\u2019/g, "'").replace(/\s+/g, " ").trim();
}

function isNoise(line: string): boolean {
  if (!line) return true;
  return PAGE_NUMBER_RE.test(line);
}

function toLines(text: string): string[] {
  const lines = text.replace(/\x00/g, " ").split(/\r?\n/).map(normalizeLine);
  return lines.filter((x) => !isNoise(x));
}

function titleCase(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => (part.length ? part[0].toUpperCase() + part.slice(1).toLowerCase() : part))
    .join(" ");
}

/** Wrapped resist/vuln lines: `At 11th level, 15 (choose…)` — not a power name. */
function looksLikeTieredDefenseContinuation(line: string): boolean {
  return /^\s*at\s+\d+(?:st|nd|rd|th)?\s*level\b/i.test(line.trim());
}

function looksLikePowerName(line: string): boolean {
  let clean = line.replace(/^[~✦\u2726\u2727\u2605.\s]+/u, "").trim();
  if (looksLikeTieredDefenseContinuation(clean)) return false;
  if (isTemplateStatLineStart(clean)) return false;
  if (ROLE_LINE_ELITE_ANCHOR_RE.test(clean) || ROLE_LINE_RE.test(clean.trim())) return false;
  if (/^Level\s+\d+\s*:/i.test(clean)) return false;
  if (
    /^Humanoid(?:\s+or\s+magical\s+beast)?(?:\s*\([^)]*\))?\s+XP\s+(?:Elite|Standard|Solo|Minion)\b/i.test(
      clean
    )
  )
    return false;
  if (/^Keywords?\s/i.test(clean)) return false;
  if (/^[CMRA]\s+[A-Za-z]/i.test(clean)) return true;
  const headBeforeParen = clean.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,6})\s*\(/);
  // Long headers like "Death's Release (when …) ✦ Necrotic" fail the Title Title ( probe but are valid.
  if (clean.length > 80 && !headBeforeParen && !/(?:✦|[\u2726\u2727\u2605])/u.test(clean)) return false;
  if (!clean) return false;
  if (!headBeforeParen && /[.;,]$/.test(clean)) return false;
  if (/^(✦|Aura|Effect:|Attack:|Hit:|Miss:)/.test(clean)) return false;
  if (
    clean.startsWith("(") &&
    /whichever|higher\)\s*(necrotic|acid|cold|fire|force|lightning|poison|psychic|radiant|thunder)\s+damage/i.test(
      clean
    )
  )
    return false;
  if (/^\(whichever/i.test(clean)) return false;
  if (/^vs\.\s*/i.test(clean)) return false;
  if (
    /^(First Failed Saving Throw|Second Failed Saving Throw|Each Failed Saving Throw|Failed\s+Saving\s+Throw|Aftereffect|Aftereffect:|Additional\s+Effect):/i.test(
      clean
    )
  )
    return false;
  if (clean[0] && clean[0].toLowerCase() === clean[0] && /[a-z]/i.test(clean[0])) return false;
  const nameProbe = headBeforeParen
    ? headBeforeParen[1].trim()
    : clean.includes("(")
      ? clean.split("(", 1)[0].trim()
      : clean;
  const words = nameProbe.split(/\s+/);
  if (words.length > 7) return false;
  const alpha = [...nameProbe].filter((ch) => /[a-zA-Z]/.test(ch)).length;
  if (alpha < 3) return false;
  const lower = clean.toLowerCase();
  if (
    [
      "acid",
      "cold",
      "fire",
      "force",
      "lightning",
      "necrotic",
      "poison",
      "psychic",
      "radiant",
      "thunder",
      "weapon"
    ].includes(lower)
  )
    return false;
  return true;
}

/** Second line of a wrapped Hit Points row (e.g. Lich: `… or` then `+6 per level …`). */
function looksLikeHitPointsFormulaContinuation(line: string): boolean {
  const t = line.trim();
  return /^\s*or\s+/i.test(t) || /^\+\d+\s+per\s+level\b/i.test(t);
}

/** Join wrapped defense rows (e.g. "… against" / "charm and fear effects") before parsing. */
function mergeStatLineContinuations(lines: string[]): string[] {
  const merged: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (merged.length > 0) {
      const prev = merged[merged.length - 1]!;
      if (
        /^Defenses\b/i.test(prev) &&
        !isTemplateStatLineStart(line) &&
        !looksLikePowerName(line)
      ) {
        merged[merged.length - 1] = `${prev} ${line}`;
        continue;
      }
      /** Wrapped "Resist … at 11th level, …" / choose-type resistance continues on the next line. */
      if (
        /^Resist\b/i.test(prev) &&
        !isTemplateStatLineStart(line) &&
        !looksLikePowerName(line)
      ) {
        merged[merged.length - 1] = `${prev} ${line}`;
        continue;
      }
      if (
        /^Vulnerable\b/i.test(prev) &&
        !isTemplateStatLineStart(line) &&
        !looksLikePowerName(line)
      ) {
        merged[merged.length - 1] = `${prev} ${line}`;
        continue;
      }
      /** `At 11th level, …` wrapped after `Resist 5 … (choose two types)` — merge even if title-case misfires. */
      if (
        /^Resist\b/i.test(prev) &&
        looksLikeTieredDefenseContinuation(line)
      ) {
        merged[merged.length - 1] = `${prev} ${line}`;
        continue;
      }
      if (
        /^Vulnerable\b/i.test(prev) &&
        looksLikeTieredDefenseContinuation(line)
      ) {
        merged[merged.length - 1] = `${prev} ${line}`;
        continue;
      }
      /** Book layout often breaks "… (controller) or" and puts the second HP formula on the next line. */
      if (
        /^(?:hit\s*points?|hp)\b/i.test(prev) &&
        (/\s+or\s*$/i.test(prev) || /^\s*or\s+/i.test(line)) &&
        !isTemplateStatLineStart(line) &&
        (looksLikeHitPointsFormulaContinuation(line) || !looksLikePowerName(line))
      ) {
        merged[merged.length - 1] = `${prev} ${line}`;
        continue;
      }
    }
    merged.push(line);
  }
  return merged;
}

function extractDamageExpressions(text: string): string[] {
  const re = /\b\d+d\d+(?:\s*\+\s*[^;,.]+)?/gi;
  return text.match(re) ?? [];
}

function titleCaseKeywordToken(s: string): string {
  const t = s.trim();
  if (!t) return "";
  return t
    .split(/\s+/)
    .map((w) => (w.length ? w[0]!.toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}

/** Lines like `Keyword fear` / `Keywords Cold, Fire` apply to the next aura or trait in the block. */
function parseKeywordDirectiveLine(line: string): string[] {
  const t = line.trim();
  if (!/^Keywords?\s/i.test(t)) return [];
  const m = t.match(/^Keywords?\s*:?\s*(.+)$/i);
  if (!m?.[1]) return [];
  return m[1]
    .split(/\s*,\s*|\s+and\s+/i)
    .map((x) => titleCaseKeywordToken(x))
    .filter(Boolean);
}

const PAREN_TRAIT_KEYWORD_SKIP =
  /\brecharge\b|\bstandard\b|\bminor\b|\bmove\b|\bfree\b|\bencounter\b|\bdaily\b|\bimmediate\b|\breaction\b/i;

/** Parenthetical labels on auras/traits, e.g. `Fear of Worms (Fear) aura 3` → Fear. Skips action headers like `(move; recharge …)`. */
function extractParentheticalTraitKeywords(headerLine: string): string[] {
  const out: string[] = [];
  const re = /\(([^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(headerLine)) !== null) {
    const inner = m[1].trim();
    if (!inner || inner.length > 55) continue;
    if (inner.includes(";")) continue;
    if (PAREN_TRAIT_KEYWORD_SKIP.test(inner)) continue;
    for (const part of inner.split(/\s*,\s*/)) {
      const tok = titleCaseKeywordToken(part);
      if (tok) out.push(tok);
    }
  }
  return [...new Set(out)];
}

function mergeTraitKeywordLists(...groups: (string[] | undefined)[]): string[] {
  const s = new Set<string>();
  for (const g of groups) {
    for (const x of g ?? []) {
      const t = titleCaseKeywordToken(String(x));
      if (t) s.add(t);
    }
  }
  return [...s].sort((a, b) => a.localeCompare(b));
}

/**
 * D&D 4e recharge line lists one or more d6 face symbols (⚀…⚅ = 1…6). The roll succeeds if the
 * die shows **any** listed face; we store the **lowest** face as `usageDetails` (e.g. ⚄ ⚅ → `"5"`,
 * ⚅ alone → `"6"`), matching "recharge 5–6" / "recharge 6" shorthand.
 */
function parseRechargeDetails(text: string): string {
  // Unicode dice (U+2680–U+2685); strip VS-16 (U+FE0F) so "⚄️" still matches.
  const s = String(text ?? "")
    .normalize("NFC")
    .replace(/\uFE0F/g, "");
  const values: number[] = [];
  for (const ch of s) {
    const cp = ch.codePointAt(0);
    if (cp !== undefined && cp >= 0x2680 && cp <= 0x2685) values.push(cp - 0x2680 + 1);
  }
  if (values.length) return String(Math.min(...values));
  const m = s.match(/recharge\s+(\d+)/i);
  return m ? m[1] : "";
}

function normalizePowerToMonsterShape(name: string, text: string, leadKeywords?: string[]): MonsterPower {
  const rawTitleLine = name.trim();
  let header = rawTitleLine;
  let body = text.trim();

  // Preserve inline aura lead text: "Fear of Worms (Fear) aura 3; any living creature that"
  // should keep "any living creature that" as part of details, not lose it from the header.
  const semicolonMatch = header.match(/^(.*?\baura\s+\d+\b)\s*;\s*(.+)$/i);
  if (semicolonMatch) {
    header = semicolonMatch[1].trim();
    body = `${semicolonMatch[2].trim()} ${body}`.trim();
  }

  // Preserve regeneration rider parenthetical as details while keeping concise trait name.
  // Example: "Regeneration 10 (if ...," + next wrapped line should keep "(if ...)" in details.
  const regenParenMatch =
    header.match(/^(Regeneration\s+\d+)\s*:?\s*\((.+)\)\s*$/i) ??
    header.match(/^(Regeneration\s+\d+)\s*:?\s*\((.+)$/i);
  if (regenParenMatch) {
    header = regenParenMatch[1].trim();
    body = `${regenParenMatch[2].trim()} ${body}`.trim();
    if (!body.includes("(")) body = body.replace(/\)\s*$/, "");
  }

  // Newline/OCR: "Clever Escape" on one line and "(move; recharge ⚄ ⚅)" on the next — merge into header for usage/recharge.
  const leadParen = /^\s*\(([^)]*)\)/.exec(body);
  if (
    leadParen &&
    !/\brecharge\b|\bencounter\b|\bdaily\b/i.test(header) &&
    /\brecharge\b|\bencounter\b|\bdaily\b/i.test(leadParen[0])
  ) {
    header = `${header} ${leadParen[0].trim()}`;
    body = body.slice(leadParen[0].length).trim();
  }
  let actionType = "";
  const actionPrefix = header.match(/^([CMRA])\s+(.+)$/i);
  if (actionPrefix) {
    const code = actionPrefix[1].toUpperCase();
    header = actionPrefix[2].trim();
    actionType =
      code === "C"
        ? "Close"
        : code === "M"
          ? "Melee"
          : code === "R"
            ? "Ranged"
            : code === "A"
              ? "Area"
              : "";
  }
  let usage = "At-Will";
  let usageDetails = "";
  if (/recharge/i.test(header)) {
    usage = "Recharge";
    usageDetails = parseRechargeDetails(`${header}\n${body}`);
    if (!usageDetails) usageDetails = parseRechargeDetails(header);
    if (!usageDetails) usageDetails = parseRechargeDetails(`${name.trim()}\n${text.trim()}`);
  } else if (/encounter/i.test(header)) usage = "Encounter";
  else if (/daily/i.test(header)) usage = "Daily";

  let action = "";
  const actionMatch = header.match(
    /\((standard|minor|move|free|immediate interrupt|immediate reaction|immediate)\b/i
  );
  if (actionMatch) action = actionMatch[1].replace(/\b\w/g, (c) => c.toUpperCase());

  let keywordsBlob = "";
  /** Keywords after ✦ on the header (e.g. traits: `✦ Necrotic`) — merged into template trait/aura keywords. */
  let flareTraitKeywordTokens: string[] = [];
  const kwMatch = header.match(/(?:✦|[\u2726\u2727\u2605])\s*(.+)$/u);
  if (kwMatch) {
    const flareRaw = kwMatch[1].trim().replace(/,$/, "");
    flareTraitKeywordTokens = flareRaw
      .split(",")
      .map((k) => titleCaseKeywordToken(k.trim()))
      .filter(Boolean);
    keywordsBlob = flareRaw;
  }
  let bodyForParse = body;
  // OCR/paste sometimes puts the keyword on the next line:
  // "Step Through ... ✦" + "Teleportation" + "The shadow spirit ..."
  if (!keywordsBlob && /(?:✦|[\u2726\u2727\u2605])\s*$/u.test(header)) {
    const nextLineKeyword = bodyForParse.match(/^([A-Za-z][A-Za-z ,/+-]{1,40})\s+(?=[A-Z(])/);
    if (nextLineKeyword) {
      const kw = nextLineKeyword[1].trim().replace(/,$/, "");
      if (/^[A-Za-z][A-Za-z ,/+-]{1,40}$/.test(kw) && kw.split(/\s+/).length <= 3) {
        keywordsBlob = kw;
        flareTraitKeywordTokens = kw
          .split(",")
          .map((k) => titleCaseKeywordToken(k.trim()))
          .filter(Boolean);
        bodyForParse = bodyForParse.slice(nextLineKeyword[0].length).trim();
      }
    }
  }
  if (keywordsBlob && bodyForParse) {
    const semi = bodyForParse.split(";");
    if (semi.length > 1) {
      const firstChunk = semi[0].trim();
      if (/^[A-Za-z ,/]+$/.test(firstChunk) && firstChunk.split(/\s+/).length <= 3) {
        keywordsBlob = `${keywordsBlob}, ${firstChunk}`;
        bodyForParse = semi.slice(1).join(";").trim();
      }
    }
  }
  const keywordTokens = keywordsBlob
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);

  let atkType = "";
  let atkRange = "";
  const leadKw = bodyForParse.match(
    /^([A-Za-z]+)\s+(Close burst|Close blast|Melee|Ranged|Area burst|Area wall)\s+(\d+)/i
  );
  if (leadKw) {
    const leadingKw = leadKw[1].trim();
    if (leadingKw && !keywordTokens.some((k) => k.toLowerCase() === leadingKw.toLowerCase())) {
      keywordTokens.push(leadingKw);
      keywordsBlob = keywordTokens.join(", ");
    }
    atkType = leadKw[2].replace(/\b\w/g, (c) => c.toUpperCase());
    atkRange = `${leadKw[2].replace(/\b\w/g, (c) => c.toUpperCase())} ${leadKw[3]}`;
  }
  const typeMatch = bodyForParse.match(/^(Close burst|Close blast|Melee|Ranged|Area burst|Area wall)\s+(\d+)/i);
  if (typeMatch) {
    atkType = typeMatch[1].replace(/\b\w/g, (c) => c.toUpperCase());
    atkRange = `${typeMatch[1].replace(/\b\w/g, (c) => c.toUpperCase())} ${typeMatch[2]}`;
  }
  if (!actionType && atkType) actionType = atkType.split(/\s+/)[0] ?? "";

  const auraH = header.match(/\baura\s+(\d+)\b/i);
  const auraB = bodyForParse.match(/^aura\s+(\d+)\b/i);
  const auraNum = auraH?.[1] ?? auraB?.[1] ?? "";
  if (auraNum) {
    atkType = "Aura";
    atkRange = `Aura ${auraNum}`;
    if (!actionType) actionType = "Close";
  }

  const attacks: MonsterPower["attacks"] = [];
  const vsMatch = bodyForParse.match(/level\s*\+\s*(\d+)\s+vs\.\s*(AC|Fortitude|Reflex|Will)/i);
  if (vsMatch) {
    attacks.push({
      kind: "MonsterAttack",
      name: "Hit",
      attackBonuses: [{ defense: vsMatch[2].replace(/\b\w/g, (c) => c.toUpperCase()), bonus: Number(vsMatch[1]) }],
      hit: { description: bodyForParse }
    });
  }

  const damageExpressions = extractDamageExpressions(bodyForParse);
  let cleanName = header.replace(/\s*\(.*$/, "").trim();
  cleanName = cleanName.replace(/\s*(?:✦|[\u2726\u2727\u2605]).*$/u, "").trim();
  cleanName = cleanName.replace(/^[~.\s✦\u2726\u2727\u2605]+/u, "").trim();
  cleanName = cleanName.replace(/\s{2,}/g, " ").replace(/[-;:,\s]+$/g, "").trim();

  const traitTemplateKeywords = mergeTraitKeywordLists(
    leadKeywords,
    extractParentheticalTraitKeywords(rawTitleLine),
    flareTraitKeywordTokens.length ? flareTraitKeywordTokens : undefined
  );

  return normalizeMonsterPowerShape({
    name: cleanName || header,
    usage,
    usageDetails: usageDetails || undefined,
    action,
    trigger: undefined,
    requirements: undefined,
    type: atkType,
    isBasic: false,
    tier: "",
    flavorText: "",
    keywords: keywordsBlob,
    keywordNames: keywordTokens,
    keywordTokens,
    range: atkRange,
    description: bodyForParse,
    damageExpressions,
    attacks: attacks.length ? attacks : undefined,
    ...(traitTemplateKeywords.length ? { traitTemplateKeywords } : {})
  });
}

function splitActionPrefixedPowerLines(lines: string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    const text = line.trim();
    if (!text) continue;
    const m = text.match(/^([A-Z])\s+([A-Z][A-Za-z][^:]{2,})$/);
    if (m) {
      out.push(`${m[1]} ${m[2].trim()}`);
      continue;
    }
    const fused = text.match(/\s([A-Z]\s+[A-Z][A-Za-z][^:]{2,})$/);
    if (fused && text.includes(".")) {
      const prefix = text.slice(0, fused.index!).trim();
      const header = fused[1].trim();
      if (prefix) out.push(prefix);
      out.push(header);
      continue;
    }
    out.push(text);
  }
  return out;
}

function parsePowers(powerLines: string[]): MonsterPower[] {
  const lines = splitActionPrefixedPowerLines(powerLines);
  const powers: MonsterPower[] = [];
  let pendingDirectiveKeywords: string[] = [];
  let currentName = "";
  let currentText: string[] = [];
  let currentLeadKeywords: string[] = [];
  for (const line of lines) {
    const dirKw = parseKeywordDirectiveLine(line);
    if (dirKw.length > 0) {
      pendingDirectiveKeywords.push(...dirKw);
      continue;
    }
    if (looksLikePowerName(line)) {
      if (currentName) powers.push(normalizePowerToMonsterShape(currentName, currentText.join(" "), currentLeadKeywords));
      currentName = line.trim();
      currentText = [];
      currentLeadKeywords = [...pendingDirectiveKeywords];
      pendingDirectiveKeywords = [];
      continue;
    }
    if (currentName) currentText.push(line.trim());
  }
  if (currentName) powers.push(normalizePowerToMonsterShape(currentName, currentText.join(" "), currentLeadKeywords));
  return powers.filter((p) => p.name);
}

function parseRoleLine(roleLine: string): MonsterTemplateRecord["role"] {
  const text = roleLine.trim();
  if (!text) return undefined;
  const m = text.match(
    /^(.+?)\s+(Minion|Standard|Elite|Solo)\s+(Soldier|Brute|Controller|Skirmisher|Artillery|Lurker)\s*(?:\(([^)]+)\))?$/i
  );
  if (!m) return { raw: text };
  const tagsRaw = m[4]?.trim();
  const tags = tagsRaw
    ? tagsRaw
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : [];
  return {
    raw: text,
    templateLabel: m[1].trim(),
    tier: m[2].replace(/\b\w/g, (c) => c.toUpperCase()),
    combatRole: m[3].replace(/\b\w/g, (c) => c.toUpperCase()),
    ...(tags.length ? { tags } : {})
  };
}

function inferTemplateIsElite(roleLine: string, rawText: string): boolean {
  if (/\bElite\b/i.test(roleLine)) return true;
  if (/\bXP\s+Elite\b/i.test(rawText)) return true;
  return false;
}

/** Remove prerequisite clause from prose once it is stored in `prerequisite`. */
function stripPrerequisiteFromDescription(description: string, prerequisite: string): string {
  let d = description.trim();
  if (!d) return d;
  d = d.replace(/\bPrerequisite:\s*[^\n]+/gi, "").trim();
  const p = prerequisite?.trim();
  if (p) {
    const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    d = d.replace(new RegExp(`\\s*Prerequisite:\\s*${escaped}\\s*`, "gi"), "").trim();
  }
  return d.replace(/\s{2,}/g, " ").trim();
}

function coerceIntFromText(text: string): number | undefined {
  const m = text.match(/[-+]?\d+/);
  return m ? Number.parseInt(m[0], 10) : undefined;
}

const KNOWN_SKILLS = [
  "Acrobatics",
  "Arcana",
  "Athletics",
  "Bluff",
  "Diplomacy",
  "Dungeoneering",
  "Endurance",
  "Heal",
  "History",
  "Insight",
  "Intimidate",
  "Nature",
  "Perception",
  "Religion",
  "Stealth",
  "Streetwise",
  "Thievery"
];
const DAMAGE_TYPES = ["acid", "cold", "fire", "force", "lightning", "necrotic", "poison", "psychic", "radiant", "thunder"];
const TIER_LEVELS = [1, 11, 21] as const;

const FLARE_OR_STAR_RE = /(?:✦|[\u2726\u2727\u2605])/u;
const KEYWORD_SPILL_LINE_RE = /^[A-Za-z][A-Za-z ,/+-]{1,40}$/;

/**
 * Book layout splits keywords after ✦ across lines: `✦ Fire,` + `Necrotic`, or `✦ Fire` + `Necrotic`.
 * Without this, `Necrotic` alone matches the short-title header rule and starts a bogus ability.
 */
function isLikelyFlareKeywordContinuation(prevLine: string, line: string): boolean {
  const prev = prevLine.trim();
  const next = line.trim();
  if (!FLARE_OR_STAR_RE.test(prev)) return false;
  if (!KEYWORD_SPILL_LINE_RE.test(next) || next.split(/\s+/).length > 3) return false;
  if (/(?:✦|[\u2726\u2727\u2605])\s*$/u.test(prev) || /,\s*$/.test(prev)) return true;
  const one = next.split(/\s+/).length === 1;
  if (!one) return false;
  const w = next.toLowerCase();
  if (DAMAGE_TYPES.includes(w) || w === "weapon" || w === "implement") return true;
  return false;
}

function parseSkillsLineEntries(rawLine: string): MonsterTemplatePasteSkillEntryOptionB[] {
  const out: MonsterTemplatePasteSkillEntryOptionB[] = [];
  const seen = new Set<string>();
  const lowerKnown = new Map(KNOWN_SKILLS.map((s) => [s.toLowerCase(), s]));
  const tail = rawLine.replace(/^skills?\s*/i, "").trim();
  if (!tail) return out;
  const sourceLine = rawLine.trim();

  const addSkill = (name: string, value: number, trained: boolean) => {
    const key = name.toLowerCase();
    if (!lowerKnown.has(key) || seen.has(key)) return;
    seen.add(key);
    out.push({ skill: key, value, trained, sourceLine });
  };

  for (const m of tail.matchAll(/\b([A-Za-z][A-Za-z' -]{1,30}?)\s*([+-]\d+)\b/g)) {
    const skillName = m[1].trim().toLowerCase();
    const v = Number.parseInt(m[2], 10);
    if (Number.isFinite(v)) addSkill(skillName, v, false);
  }
  for (const m of tail.matchAll(/(?:^|[;,]\s*|\s)([+-]\d+)\s*([A-Za-z][A-Za-z' -]{1,30})\b/g)) {
    const skillName = m[2].trim().toLowerCase();
    const v = Number.parseInt(m[1], 10);
    if (Number.isFinite(v)) addSkill(skillName, v, false);
  }

  if (/\btrain(?:ing|ed)?\b/i.test(tail)) {
    for (const [lowerName] of lowerKnown) {
      if (new RegExp(`\\b${lowerName}\\b`, "i").test(tail)) addSkill(lowerName, 0, true);
    }
  }

  return out;
}

function parseTieredValueEntries(tail: string): Record<string, number[]> {
  const byType = new Map<string, Array<{ level?: number; value: number }>>();
  const typeAlt = DAMAGE_TYPES.join("|");
  const re = new RegExp(`(\\d+)\\s*(${typeAlt})(?:\\s+at\\s+(\\d+)(?:st|nd|rd|th)?\\s*level)?`, "gi");
  for (const m of tail.matchAll(re)) {
    const v = Number.parseInt(m[1], 10);
    const type = m[2].toLowerCase();
    const level = m[3] ? Number.parseInt(m[3], 10) : undefined;
    if (!Number.isFinite(v)) continue;
    const arr = byType.get(type) ?? [];
    arr.push({ level, value: v });
    byType.set(type, arr);
  }

  const out: Record<string, number[]> = {};
  for (const [type, entries] of byType.entries()) {
    const leveled = entries.filter((e) => e.level !== undefined).sort((a, b) => (a.level! - b.level!));
    const unLeveled = entries.filter((e) => e.level === undefined);
    if (leveled.length === 0) {
      const base = unLeveled[0]?.value;
      if (base !== undefined) out[type] = [base, base, base];
      continue;
    }
    const withBaseline = [...leveled];
    if (unLeveled.length > 0) withBaseline.unshift({ level: 1, value: unLeveled[0].value });
    const vals: number[] = [];
    for (const tier of TIER_LEVELS) {
      let chosen = withBaseline[0]!.value;
      for (const e of withBaseline) {
        if ((e.level ?? 1) <= tier) chosen = e.value;
      }
      vals.push(chosen);
    }
    out[type] = vals;
  }
  return out;
}

function parseResistanceKeywords(tail: string): string[] {
  const out: string[] = [];
  for (const raw of tail.split(",")) {
    const t = raw.trim().toLowerCase();
    if (!t) continue;
    if (/\d/.test(t)) continue;
    if (/\bat\b|\blevel\b/.test(t)) continue;
    if (!/^[a-z][a-z -]+$/.test(t)) continue;
    if (!out.includes(t)) out.push(t);
  }
  return out;
}

function parseHitPointsFormula(formula: string): Record<string, unknown> {
  const parsed: Record<string, unknown> = {};
  const text = formula.trim();
  if (!text) return parsed;
  const compact = text.toLowerCase().replace(/\s+/g, "");
  const perLevel = text.match(/([+-]?\d+)\s*per\s*level/i);
  if (perLevel) parsed.per_level = Number.parseInt(perLevel[1], 10);
  else if (compact.includes("perlevel")) {
    const cm = compact.match(/([+-]?\d+)perlevel/);
    if (cm) parsed.per_level = Number.parseInt(cm[1], 10);
  }
  if (compact.includes("constitutionscore")) parsed.add_constitution = true;
  return parsed;
}

const HP_ROLE_SUFFIX_RE =
  /\(\s*(controller|artillery|lurker|soldier|brute|skirmisher)\s*\)\s*$/i;

function parseHitPointsStatOptionB(rawLineTrim: string): MonsterTemplatePasteStatsOptionB["hitPoints"] | null {
  const hpFormulaMatch = rawLineTrim.match(/^(?:hit\s*points?|hp)\s*(.*)$/i);
  if (!hpFormulaMatch) return null;
  const fullTail = hpFormulaMatch[1].trim();
  if (!fullTail) return null;
  const sourceLines = [rawLineTrim];
  /** Allow trailing ` or` (same line as first option) as well as ` or ` between options. */
  const segments = fullTail
    .split(/\s+or(?:\s+|$)/gi)
    .map((s) => s.trim())
    .filter(Boolean);
  const variants: NonNullable<MonsterTemplatePasteStatsOptionB["hitPoints"]>["variants"] = [];
  let defaultEntry: { perLevel?: number; addConstitution?: boolean } | undefined;

  for (const seg of segments) {
    const rm = seg.match(HP_ROLE_SUFFIX_RE);
    const formula = rm ? seg.slice(0, rm.index).trim() : seg;
    const p = parseHitPointsFormula(formula);
    const perLevel = p.per_level as number | undefined;
    const addConstitution = !!p.add_constitution;
    if (rm) {
      variants.push({
        when: { role: rm[1].toLowerCase() },
        perLevel,
        addConstitution,
        sourceLine: seg
      });
    } else {
      defaultEntry = { perLevel, addConstitution };
    }
  }

  const hasMeaningfulDefault =
    !!defaultEntry && (defaultEntry.perLevel !== undefined || !!defaultEntry.addConstitution);
  const hasVariants = (variants?.length ?? 0) > 0;
  if (!hasMeaningfulDefault && !hasVariants) return null;

  return {
    ...(hasMeaningfulDefault && defaultEntry ? { default: defaultEntry } : {}),
    ...(hasVariants ? { variants } : {}),
    sourceLines
  };
}

function tierMapToResistanceEntries(
  rec: Record<string, number[]>,
  sourceLine: string
): MonsterTemplatePasteResistanceEntryOptionB[] {
  const out: MonsterTemplatePasteResistanceEntryOptionB[] = [];
  for (const [type, arr] of Object.entries(rec)) {
    if (arr.length === 3) {
      out.push({
        kind: "typed",
        type,
        tiers: { "1": arr[0], "11": arr[1], "21": arr[2] },
        sourceLine
      });
    } else if (arr.length === 0) {
      out.push({ kind: "keyword", type, sourceLine });
    }
  }
  return out;
}

/**
 * Player-chosen resistance types by tier, e.g.
 * `5 (choose one type) at 1st level, 10 (choose two types) at 11th level, 15 (choose three types) at 21st level`.
 */
/**
 * `Resist 5 + 1/2 level necrotic` / `Vulnerable 10 + ½ level fire` style scaling.
 */
function parseBasePlusHalfLevelResistanceEntry(
  tail: string,
  sourceLine: string
): MonsterTemplatePasteResistanceEntryOptionB | null {
  const t = tail.trim().replace(/\s+/g, " ");
  const typeAlt = DAMAGE_TYPES.join("|");
  const re = new RegExp(
    `^(\\d+)\\s*\\+\\s*(?:(?:1\\s*/\\s*2)|½|half)\\s+level\\s+(${typeAlt})\\s*$`,
    "i"
  );
  const m = t.match(re);
  if (!m) return null;
  const base = Number.parseInt(m[1], 10);
  const dmg = m[2].toLowerCase();
  if (!Number.isFinite(base)) return null;
  return {
    kind: "typed",
    type: dmg,
    baseAmount: base,
    plusHalfLevel: true,
    sourceLine
  };
}

function parseVariableChoiceResistanceEntry(
  tail: string,
  sourceLine: string
): MonsterTemplatePasteResistanceEntryOptionB | null {
  if (!/\(\s*choose\b/i.test(tail)) return null;
  const re =
    /\b(\d+)\s*\(\s*([^)]+)\)\s+at\s+(\d+)(?:st|nd|rd|th)?\s*level\b/gi;
  const matches = [...tail.matchAll(re)];
  if (matches.length === 0) return null;
  const tiers: Record<string, number> = {};
  const tierRiders: Record<string, string> = {};
  for (const m of matches) {
    const amount = Number.parseInt(m[1], 10);
    const rider = m[2].trim().replace(/\s+/g, " ");
    const lvl = Number.parseInt(m[3], 10);
    const tierKey = lvl >= 21 ? "21" : lvl >= 11 ? "11" : "1";
    if (!Number.isFinite(amount)) continue;
    tiers[tierKey] = amount;
    tierRiders[tierKey] = rider;
  }
  if (Object.keys(tiers).length === 0) return null;
  return {
    kind: "variable",
    tiers,
    tierRiders,
    sourceLine
  };
}

function parseSpeedLine(rawLine: string): string {
  const tail = rawLine.replace(/^speed\s*/i, "").trim();
  return tail.replace(/\s{2,}/g, " ");
}

/** `Senses Darkvision` or `Senses tremorsense 5, low-light vision` */
function parseSensesStatTailToEntries(tail: string): MonsterTemplatePasteSenseEntryOptionB[] {
  const entries: MonsterTemplatePasteSenseEntryOptionB[] = [];
  for (const segment of tail.split(/[;,]/)) {
    const seg = segment.trim();
    if (!seg) continue;
    const m = seg.match(/^(.+?)\s+(\d+)\s*$/);
    if (m) {
      entries.push({ name: m[1].trim(), range: Number.parseInt(m[2], 10) });
    } else {
      entries.push({ name: seg, range: 0 });
    }
  }
  return entries;
}

/** Subset of Python `_parse_stat_lines` — covers common template stat rows (Option B: tiers + source lines). */
function parseStatLines(statLines: string[]): MonsterTemplatePasteStatsOptionB {
  const result: MonsterTemplatePasteStatsOptionB = {};
  const defenses: Record<string, number> = {};
  const immunities: string[] = [];
  const skillEntries: MonsterTemplatePasteSkillEntryOptionB[] = [];
  const resistEntries: MonsterTemplatePasteResistanceEntryOptionB[] = [];
  const vulnEntries: MonsterTemplatePasteResistanceEntryOptionB[] = [];
  const unparsed: string[] = [];

  for (const rawLine of statLines) {
    const rawLineTrim = rawLine.trim();
    if (!rawLineTrim) continue;

    /** Parse before letter-space collapse so `Senses Darkvision` is not turned into `SensesDarkvision`. */
    if (/^senses\b/i.test(rawLineTrim)) {
      const tail = rawLineTrim.replace(/^senses\s*/i, "").trim();
      if (tail) {
        result.senses = parseSensesStatTailToEntries(tail);
        continue;
      }
    }

    let line = rawLineTrim.replace(/([A-Za-z])\s+([A-Za-z])/g, "$1$2");
    const lower = line.toLowerCase();
    const compact = lower.replace(/\s+/g, "");
    let parsed = false;

    if (lower.startsWith("prerequisite:") || compact.startsWith("prerequisite:")) {
      parsed = true;
      continue;
    }

    if (lower.startsWith("defenses") || compact.startsWith("defenses")) {
      const defenseForAll = rawLineTrim.replace(/^defenses\s*/i, "");
      const allDef = defenseForAll.match(/\+(\d+)\s+to\s+all\s+defenses\s+against\s+(.+?)(?=;|$)/i);
      let defenseTail = line.replace(/^defenses\s*/i, "");
      defenseTail = defenseTail.replace(/;/g, ",");
      defenseTail = defenseTail.replace(/([A-Za-z])\+([0-9])/g, "$1 +$2");
      defenseTail = defenseTail.replace(/([0-9])([A-Za-z])/g, "$1 $2");
      let localFound = false;
      for (const m of defenseTail.matchAll(/\b(AC|Fortitude|Reflex|Will)\b\s*\+?\s*(-?\d+)/gi)) {
        defenses[m[1].toUpperCase()] = Number.parseInt(m[2], 10);
        localFound = true;
      }
      for (const m of defenseTail.matchAll(/\+?\s*(-?\d+)\s*(AC|Fortitude|Reflex|Will)\b/gi)) {
        defenses[m[2].toUpperCase()] = Number.parseInt(m[1], 10);
        localFound = true;
      }
      if (allDef) {
        const phrase = allDef[2].trim().replace(/\.$/, "").trim();
        defenses[`to all defenses against ${phrase}`] = Number.parseInt(allDef[1], 10);
        localFound = true;
      }
      parsed = localFound;
      if (parsed) continue;
    }

    if (lower.startsWith("saving throws") || compact.startsWith("savingthrows")) {
      const v = coerceIntFromText(line);
      if (v !== undefined) {
        const notes =
          line.includes(";") && line.split(";", 2)[1]?.trim()
            ? [line.split(";", 2)[1]!.trim()]
            : undefined;
        result.savingThrows = { value: v, sourceLine: rawLineTrim, ...(notes?.length ? { notes } : {}) };
        parsed = true;
        continue;
      }
    }

    if (
      lower.startsWith("action point") ||
      lower.startsWith("action points") ||
      compact.startsWith("actionpoint") ||
      compact.startsWith("actionpoints")
    ) {
      const v = coerceIntFromText(line);
      if (v !== undefined) {
        result.actionPoints = { value: v, sourceLine: rawLineTrim };
        parsed = true;
        continue;
      }
    }

    if (
      lower.startsWith("hit points") ||
      compact.startsWith("hitpoints") ||
      lower.startsWith("hp ") ||
      compact.startsWith("hp")
    ) {
      const hp = parseHitPointsStatOptionB(rawLineTrim);
      if (hp && (hp.default || (hp.variants && hp.variants.length))) {
        result.hitPoints = hp;
        parsed = true;
        continue;
      }
    }

    if (lower.startsWith("immune") || compact.startsWith("immune")) {
      const immuneMatch = line.match(/^immune\s*(.*)$/i);
      const value = immuneMatch?.[1]?.trim() ?? "";
      if (value) {
        immunities.push(...value.split(/[;,]/).map((x) => x.trim()).filter(Boolean));
        parsed = true;
        continue;
      }
    }

    if (lower.startsWith("initiative") || compact.startsWith("initiative")) {
      const v = coerceIntFromText(line);
      if (v !== undefined) {
        result.initiative = { value: v, sourceLine: rawLineTrim };
        parsed = true;
        continue;
      }
    }

    if (lower.startsWith("speed") || compact.startsWith("speed")) {
      const speedText = parseSpeedLine(rawLineTrim);
      if (speedText) {
        result.speed = { raw: speedText, sourceLine: rawLineTrim };
        parsed = true;
        continue;
      }
    }

    if (lower.startsWith("skills") || compact.startsWith("skills")) {
      const parsedSkills = parseSkillsLineEntries(rawLineTrim);
      if (parsedSkills.length > 0) {
        skillEntries.push(...parsedSkills);
        parsed = true;
        continue;
      }
    }

    if (lower.startsWith("resist") || compact.startsWith("resist")) {
      const tail = rawLineTrim.replace(/^resist\s*/i, "").trim();
      const variableEntry = parseVariableChoiceResistanceEntry(tail, rawLineTrim);
      if (variableEntry) {
        resistEntries.push(variableEntry);
        parsed = true;
        continue;
      }
      const halfLevelEntry = parseBasePlusHalfLevelResistanceEntry(tail, rawLineTrim);
      if (halfLevelEntry) {
        resistEntries.push(halfLevelEntry);
        parsed = true;
        continue;
      }
      const typed = parseTieredValueEntries(tail);
      const rec: Record<string, number[]> = {};
      for (const [k, v] of Object.entries(typed)) rec[k] = v;
      for (const kw of parseResistanceKeywords(tail)) rec[kw] = [];
      if (Object.keys(typed).length > 0 || parseResistanceKeywords(tail).length > 0) {
        resistEntries.push(...tierMapToResistanceEntries(rec, rawLineTrim));
        parsed = true;
        continue;
      }
    }

    if (lower.startsWith("vulnerable") || compact.startsWith("vulnerable")) {
      const tail = rawLineTrim.replace(/^vulnerable\s*/i, "").trim();
      const variableEntry = parseVariableChoiceResistanceEntry(tail, rawLineTrim);
      if (variableEntry) {
        vulnEntries.push(variableEntry);
        parsed = true;
        continue;
      }
      const halfLevelEntry = parseBasePlusHalfLevelResistanceEntry(tail, rawLineTrim);
      if (halfLevelEntry) {
        vulnEntries.push(halfLevelEntry);
        parsed = true;
        continue;
      }
      const typed = parseTieredValueEntries(tail);
      const rec: Record<string, number[]> = {};
      for (const [k, v] of Object.entries(typed)) rec[k] = v;
      for (const kw of parseResistanceKeywords(tail)) rec[kw] = [];
      if (Object.keys(typed).length > 0 || parseResistanceKeywords(tail).length > 0) {
        vulnEntries.push(...tierMapToResistanceEntries(rec, rawLineTrim));
        parsed = true;
        continue;
      }
    }

    if (!parsed) unparsed.push(line);
  }

  if (Object.keys(defenses).length) result.defenses = defenses;
  if (immunities.length) result.immunities = immunities;
  if (skillEntries.length) result.skills = { entries: skillEntries };
  if (resistEntries.length) result.resistances = { entries: resistEntries };
  if (vulnEntries.length) result.vulnerabilities = { entries: vulnEntries };
  if (unparsed.length) result.unparsedStatLines = unparsed;
  return result;
}

function isAuraAbility(entry: MonsterPower): boolean {
  const name = (entry.name ?? "").toLowerCase();
  const desc = (entry.description ?? "").toLowerCase();
  const abilityRange = (entry.range ?? "").toLowerCase();
  return name.includes("aura") || desc.startsWith("aura ") || abilityRange.startsWith("aura ");
}

function isTraitAbility(entry: MonsterPower): boolean {
  const action = (entry.action ?? "").trim();
  const usage = (entry.usage ?? "").trim().toLowerCase();
  const attackType = (entry.type ?? "").trim();
  const attackRange = (entry.range ?? "").trim();
  const attacks = entry.attacks ?? [];
  const description = (entry.description ?? "").toLowerCase();
  const damageExprs = entry.damageExpressions ?? [];
  if (action) return false;
  if (usage === "encounter" || usage === "daily") return false;
  if (attackType || attackRange || attacks.length) return false;
  if (/recharge/i.test(description)) return false;
  if (damageExprs.length) return false;
  // Do not use a bare `\bwhenever\b` match here — passive traits often use it (e.g. fighter-style
  // marks: "whenever a marked enemy shifts"). Triggered powers usually have an action header or Melee/Ranged line.
  if (
    /\b(regain .* hit points?|scores? a critical|\d+d\d+|\d+\s+squares? of| flank(s|ed|ing)?\b|\bnatural\s+(19|20)\b|\bcritical hit\b)/i.test(
      description
    )
  )
    return false;
  return true;
}

function parseTraitRange(entry: MonsterPower): number {
  const name = entry.name ?? "";
  const rng = entry.range ?? "";
  const desc = entry.description ?? "";
  for (const text of [rng, name, desc]) {
    const m = text.match(/\baura\s+(\d+)\b/i);
    if (m) return Number.parseInt(m[1], 10);
  }
  return 0;
}

function toMonsterTraitShape(entry: MonsterPower): MonsterTrait {
  const fromLead = entry.traitTemplateKeywords ?? [];
  const fromName = extractParentheticalTraitKeywords(entry.name ?? "");
  const keywords = mergeTraitKeywordLists(fromLead, fromName);
  const normalizedName = entry.name.trim().replace(/[:\s]+$/g, "");
  return {
    name: normalizedName,
    details: (entry.description ?? "").trim(),
    range: parseTraitRange(entry),
    type: "Trait",
    ...(keywords.length ? { keywords } : {})
  };
}

function bucketTemplateAbilities(entries: MonsterPower[]): {
  auras: MonsterTrait[];
  traits: MonsterTrait[];
  powers: MonsterPower[];
  uncategorized: MonsterPower[];
} {
  const auras: MonsterTrait[] = [];
  const traits: MonsterTrait[] = [];
  const powers: MonsterPower[] = [];
  const uncategorized: MonsterPower[] = [];
  for (const entry of entries) {
    if (isAuraAbility(entry)) {
      auras.push(toMonsterTraitShape(entry));
      continue;
    }
    if (isTraitAbility(entry)) {
      traits.push(toMonsterTraitShape(entry));
      continue;
    }
    if (
      entry.action ||
      (entry.usage ?? "").toLowerCase() !== "at-will" ||
      entry.type ||
      entry.range ||
      (entry.attacks?.length ?? 0) > 0
    ) {
      powers.push(entry);
      continue;
    }
    powers.push(entry);
    uncategorized.push(entry);
  }
  return { auras, traits, powers, uncategorized };
}

function buildTemplateRow(
  name: string,
  parsed: {
    prerequisite: string;
    roleLine: string;
    statLines: string[];
    powersText: string[];
    powers: MonsterPower[];
    auras: MonsterTrait[];
    traits: MonsterTrait[];
    uncategorizedAbilities: MonsterPower[];
    rawText: string;
    description?: string;
  }
): MonsterTemplateRecord {
  const roleLineStr = parsed.roleLine;
  const rawTextStr = parsed.rawText;
  const isElite = inferTemplateIsElite(roleLineStr, rawTextStr);
  const prereq = parsed.prerequisite || "";
  const mergedStatLines = mergeStatLineContinuations(parsed.statLines);
  const descriptionBase = (parsed.description ?? "").trim();
  const description = prereq
    ? stripPrerequisiteFromDescription(descriptionBase, prereq)
    : descriptionBase.replace(/\bPrerequisite:\s*[^\n]+/gi, "").trim();
  const parsedStats = parseStatLines(mergedStatLines) as MonsterTemplateRecord["stats"] & { regeneration?: number };
  if (parsed.traits.length > 0) {
    for (const t of parsed.traits) {
      const m = String(t.name ?? "").match(/^Regeneration\s+(\d+)\b/i);
      if (m) {
        parsedStats.regeneration = Number.parseInt(m[1], 10);
        break;
      }
    }
  }
  return {
    templateName: titleCase(name),
    sourceBook: "manual import",
    pageStart: 0,
    pageEnd: 0,
    description,
    prerequisite: prereq || undefined,
    prerequisiteExpr: prereq.trim() ? parseMonsterTemplatePrerequisite(prereq).data : undefined,
    roleLine: roleLineStr || undefined,
    role: parseRoleLine(roleLineStr),
    isEliteTemplate: isElite,
    statLines: mergedStatLines.length ? mergedStatLines : undefined,
    stats: parsedStats,
    auras: parsed.auras.length ? parsed.auras : undefined,
    traits: parsed.traits.length ? parsed.traits : undefined,
    powers: parsed.powers,
    extractionMethod: "paste-ts",
    powersText: parsed.powersText,
    uncategorizedAbilities: parsed.uncategorizedAbilities.length ? parsed.uncategorizedAbilities : undefined,
    rawText: rawTextStr,
    relatedFlavorText: [],
    extractionWarnings: []
  };
}

const UI_SCAFFOLD_LINE_RE = /^(statblock with|and multiple powers)/i;

function isScaffoldLine(line: string): boolean {
  const t = line.trim();
  if (!t) return true;
  if (UI_SCAFFOLD_LINE_RE.test(t)) return true;
  return false;
}

function inferTemplateNameFromSimpleSections(lines: string[], hint?: string): string | undefined {
  if (hint?.trim()) return titleCase(hint.trim());
  for (const line of lines) {
    const t = line.trim();
    if (!t || isScaffoldLine(t)) continue;
    if (isExplicitAbilityMarkerLine(t)) continue;
    if (/^prerequisites?:/i.test(t)) continue;
    if (ROLE_LINE_ELITE_ANCHOR_RE.test(t) || ROLE_LINE_RE.test(t)) continue;
    if (isTemplateStatLineStart(t)) continue;
    return titleCase(t);
  }
  return undefined;
}

/** Split on `[ABILITY]` (starts a new block; closes the previous) and `[ABILITYEND]` (closes only). */
function splitExplicitAbilityBlocks(lines: string[]): string[][] {
  const blocks: string[][] = [];
  let current: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (ABILITY_BLOCK_START_RE.test(line)) {
      if (current.length) blocks.push(current);
      current = [];
      continue;
    }
    if (ABILITY_BLOCK_END_RE.test(line)) {
      if (current.length) blocks.push(current);
      current = [];
      continue;
    }
    current.push(line);
  }
  if (current.length) blocks.push(current);
  return blocks;
}

function looksLikeSimpleAbilityHeader(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  if (looksLikeTieredDefenseContinuation(t)) return false;
  if (looksLikeHitPointsFormulaContinuation(t)) return false;
  if (isTemplateStatLineStart(t)) return false;
  /** Aura rider text ("Allies in the aura gain …") — not a separate ability name. */
  if (/\b(?:in|within)\s+the\s+aura\b/i.test(t) && !/\baura\s+\d+\b/i.test(t)) return false;
  if (/^Regeneration\b/i.test(t)) return true;
  if (/^Keywords?\s/i.test(t)) return false;
  if (/^[CMRA]\s+[A-Za-z]/i.test(t)) return true;
  if (/^(?:[CMRA]\s+)?[A-Z][A-Za-z' -]{1,80}\([^)]*\)/.test(t)) return true;
  if (/\((standard|minor|move|free|immediate|recharge|encounter|daily)\b/i.test(t)) return true;
  if (/\baura\s+\d+\b/i.test(t)) return true;
  if (/(?:✦|[\u2726\u2727\u2605])/.test(t)) return true;
  /** Short title-case names only (avoids wrapped aura prose matching as a "header"). */
  if (/^[A-Z][A-Za-z' -]{2,50}$/.test(t) && t.split(/\s+/).length <= 8) return true;
  return looksLikePowerName(t);
}

/** Matches the short-title branch of `looksLikeSimpleAbilityHeader` (ability name line without aura text). */
function isLoneShortTitleAbilityNameLine(line: string): boolean {
  const t = line.trim();
  if (!t || /\baura\s+\d+\b/i.test(t)) return false;
  return /^[A-Z][A-Za-z' -]{2,50}$/.test(t) && t.split(/\s+/).length <= 8;
}

/** Next-line aura lead in book layout: ` Aura 10; allies …` (name on previous line). */
function isAuraOnlyLeadContinuationLine(line: string): boolean {
  return /^\s*aura\s+\d+\b/i.test(line.trim());
}

function splitSimpleAbilityBlocks(lines: string[]): string[][] {
  const blocks: string[][] = [];
  let current: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (current.length > 0 && isLikelyFlareKeywordContinuation(current[current.length - 1] ?? "", line)) {
      current.push(line);
      continue;
    }
    if (looksLikeSimpleAbilityHeader(line)) {
      /** Death Knight–style: `Marshal Undead` then ` Aura 10; …` — one aura, not trait + aura. */
      if (
        current.length === 1 &&
        isLoneShortTitleAbilityNameLine(current[0] ?? "") &&
        isAuraOnlyLeadContinuationLine(line)
      ) {
        current.push(line);
        continue;
      }
      if (current.length) blocks.push(current);
      current = [line];
      continue;
    }
    if (current.length) current.push(line);
  }
  if (current.length) blocks.push(current);
  return blocks;
}

/** Join `at 11th level, 15 (choose…)` to previous `Resist` / `Vulnerable` when OCR breaks the line. */
function mergeTierDefenseIntoPrevStatLine(statLines: string[], line: string): boolean {
  if (statLines.length === 0) return false;
  const prev = statLines[statLines.length - 1] ?? "";
  if (!/^Resist\b/i.test(prev) && !/^Vulnerable\b/i.test(prev)) return false;
  if (!looksLikeTieredDefenseContinuation(line)) return false;
  statLines[statLines.length - 1] = `${prev} ${line.trim()}`.trim();
  return true;
}

function parseSimpleTemplateSections(lines: string[]) {
  const cleaned = lines.map((x) => x.trim()).filter((x) => x.length > 0 && !isScaffoldLine(x));
  let roleLine = "";
  let roleIdx = -1;
  let prereqStartIdx = -1;
  for (let i = 0; i < cleaned.length; i++) {
    const line = cleaned[i];
    if (prereqStartIdx < 0 && /^prerequisites?:/i.test(line)) prereqStartIdx = i;
    if (!roleLine && (ROLE_LINE_ELITE_ANCHOR_RE.test(line) || ROLE_LINE_RE.test(line))) {
      roleLine = line;
      roleIdx = i;
    }
  }

  const descriptionLines: string[] = [];
  const prerequisiteLines: string[] = [];
  if (prereqStartIdx >= 0) {
    const prereqEnd = roleIdx > prereqStartIdx ? roleIdx : cleaned.length;
    prerequisiteLines.push(...cleaned.slice(prereqStartIdx, prereqEnd));
    descriptionLines.push(...cleaned.slice(0, prereqStartIdx));
  } else if (roleIdx >= 0) {
    descriptionLines.push(...cleaned.slice(0, roleIdx));
  } else {
    descriptionLines.push(...cleaned);
  }

  let prerequisite = "";
  if (prerequisiteLines.length > 0) {
    const [first, ...rest] = prerequisiteLines;
    const firstTail = first.replace(/^prerequisites?\s*:\s*/i, "").trim();
    prerequisite = [firstTail, ...rest].join(" ").replace(/\s{2,}/g, " ").trim();
  }

  const statLines: string[] = [];
  const abilityRaw: string[] = [];
  let inAbilitySection = false;

  for (let i = 0; i < cleaned.length; i++) {
    const line = cleaned[i];
    if (line === roleLine) continue;
    if (prereqStartIdx >= 0 && i >= prereqStartIdx && (roleIdx < 0 || i < roleIdx)) continue;
    if (roleIdx >= 0 && i < roleIdx) continue;
    if (
      roleIdx >= 0 &&
      !inAbilitySection &&
      statLines.length === 0 &&
      /^Humanoid(?:\s+or\s+magical\s+beast)?(?:\s*\([^)]*\))?\s+XP\s+(?:Elite|Standard|Solo|Minion)\b/i.test(
        line
      )
    ) {
      continue;
    }
    if (roleIdx >= 0 && SECTION_MARKER_RE.test(line)) {
      inAbilitySection = true;
      continue;
    }
    if (roleIdx >= 0 && !inAbilitySection && (isTemplateStatLineStart(line) || statLines.length > 0)) {
      if (isTemplateStatLineStart(line)) {
        statLines.push(line);
        continue;
      }
      if (mergeTierDefenseIntoPrevStatLine(statLines, line)) {
        continue;
      }
      if (
        !looksLikeSimpleAbilityHeader(line) &&
        !isExplicitAbilityMarkerLine(line) &&
        !SECTION_MARKER_RE.test(line)
      ) {
        statLines[statLines.length - 1] = `${statLines[statLines.length - 1]} ${line}`.trim();
        continue;
      }
      inAbilitySection = true;
      abilityRaw.push(line);
      continue;
    }
    // Some blocks place stat lines (e.g. Skills) after ability text; still capture them.
    if (roleIdx >= 0 && isTemplateStatLineStart(line)) {
      statLines.push(line);
      continue;
    }
    if (roleIdx >= 0) {
      if (
        statLines.length === 0 &&
        !looksLikeSimpleAbilityHeader(line) &&
        !isExplicitAbilityMarkerLine(line)
      ) {
        continue;
      }
      inAbilitySection = true;
      abilityRaw.push(line);
    }
  }

  const powersText = abilityRaw.slice();
  const hasExplicitMarkers = abilityRaw.some((line) => isExplicitAbilityMarkerLine(line));
  const numberedBlocks = hasExplicitMarkers ? splitExplicitAbilityBlocks(abilityRaw) : [];
  const parsedEntries: MonsterPower[] =
    numberedBlocks.length > 0
      ? numberedBlocks
          .map((block) => {
            const [head, ...tail] = block;
            const entry = normalizePowerToMonsterShape(head ?? "", tail.join(" ").trim());
            return entry;
          })
          .filter((p) => p.name)
      : splitSimpleAbilityBlocks(abilityRaw)
          .map((block) => {
            const [head, ...tail] = block;
            return normalizePowerToMonsterShape(head ?? "", tail.join(" ").trim());
          })
          .filter((p) => p.name);
  const buckets = bucketTemplateAbilities(parsedEntries);

  const firstDescLine = descriptionLines[0]?.trim() ?? "";
  const roleTemplateLabel = roleLine
    .replace(/\s+Elite\s+(Soldier|Brute|Controller|Skirmisher|Artillery|Lurker)\b.*$/i, "")
    .trim();
  if (
    firstDescLine &&
    roleTemplateLabel &&
    firstDescLine.toLowerCase() === roleTemplateLabel.toLowerCase()
  ) {
    descriptionLines.shift();
  }

  return {
    prerequisite,
    roleLine,
    statLines,
    powersText,
    powers: buckets.powers,
    auras: buckets.auras,
    traits: buckets.traits,
    uncategorizedAbilities: buckets.uncategorized,
    rawText: cleaned.join(" ").slice(0, 8000),
    description: descriptionLines.join(" ").replace(/\s{2,}/g, " ").trim()
  };
}

function summarizeAbilityNames(entries: MonsterPower[], limit = 3): string {
  const labels = entries
    .map((entry) => String(entry.name ?? "").trim())
    .filter(Boolean)
    .slice(0, limit);
  if (labels.length === 0) return "";
  if (entries.length > labels.length) return `${labels.join(", ")}, ...`;
  return labels.join(", ");
}

export function validateMonsterTemplateImport(template: MonsterTemplateRecord): MonsterTemplateImportValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!String(template.templateName ?? "").trim()) {
    errors.push("Template name is missing.");
  }

  if (!Array.isArray(template.powers)) {
    errors.push("Powers must be an array.");
  } else if (template.powers.length === 0) {
    const hasTraits = Array.isArray(template.traits) && template.traits.length > 0;
    const hasAuras = Array.isArray(template.auras) && template.auras.length > 0;
    if (!hasTraits && !hasAuras) {
      errors.push("No powers were parsed from the imported text.");
    }
  }

  const unparsedStats = Array.isArray(template.stats?.unparsedStatLines) ? template.stats.unparsedStatLines : [];
  if (unparsedStats.length > 0) {
    warnings.push(`${unparsedStats.length} stat line(s) could not be parsed.`);
  }
  const longFragments = unparsedStats.filter((line) => String(line).trim().length >= 120);
  if (longFragments.length > 0) {
    warnings.push(`${longFragments.length} unparsed stat fragment(s) are unusually long; check OCR line breaks.`);
  }

  const uncategorized = Array.isArray(template.uncategorizedAbilities) ? template.uncategorizedAbilities : [];
  if (uncategorized.length > 0) {
    const names = summarizeAbilityNames(uncategorized);
    warnings.push(
      names
        ? `${uncategorized.length} ability block(s) were only partially categorized (${names}).`
        : `${uncategorized.length} ability block(s) were only partially categorized.`
    );
  }

  const hasOtherStats =
    !!template.stats &&
    Object.keys(template.stats).some((key) => key !== "unparsedStatLines");
  if (hasOtherStats && !String(template.roleLine ?? "").trim()) {
    warnings.push("Role line is missing, so role/tier metadata may be incomplete.");
  }

  return { errors, warnings };
}

export function parsePastedMonsterTemplateTextLocal(rawText: string, templateNameHint?: string): ParsePasteResult {
  const lines = toLines(rawText);
  if (!lines.length) return { ok: false, error: "emptyInput" };

  const name = inferTemplateNameFromSimpleSections(lines, templateNameHint);
  if (!name) return { ok: false, error: "couldNotInferTemplateName" };

  const mechanical = parseSimpleTemplateSections(lines);
  const template = buildTemplateRow(name, mechanical);
  const validation = validateMonsterTemplateImport(template);
  return { ok: true, template, validation };
}

export async function parsePastedMonsterTemplateText(
  rawText: string,
  templateNameHint?: string
): Promise<ParsePasteResult> {
  // Always use the local, section-based parser for paste imports.
  return parsePastedMonsterTemplateTextLocal(rawText, templateNameHint);
}

