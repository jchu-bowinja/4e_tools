/**
 * Browser-side port of `tools/etl/extract_monster_templates_from_pdfs.py` paste path
 * (`parse_pasted_monster_template`). Used when the dev-server Python API is unavailable
 * (preview/production static builds).
 */
/// <reference types="vite/client" />

import type { MonsterPower, MonsterTemplateRecord, MonsterTrait } from "./storage";

export type ParsePasteResult =
  | { ok: true; template: MonsterTemplateRecord }
  | { ok: false; error: string };

const PAGE_NUMBER_RE = /^\s*\d+\s*$/;
const TEMPLATE_REF_RE = /\b([A-Z][A-Za-z' -]{2,})\s*\(\s*template\s*\)/gi;
const TEMPLATE_IS_A_RE = /["']?([A-Za-z][A-Za-z' -]{2,})["']?\s+is a template/gi;
const TEMPLATE_HEADING_RE = /^\s*([A-Za-z][A-Za-z' -]{2,})\s+Template\s*$/i;
const ROLE_LINE_RE =
  /^([A-Za-z][A-Za-z' -]{2,})\s+Elite\s+(Soldier|Brute|Controller|Skirmisher|Artillery|Lurker)\s*$/i;
const ROLE_LINE_ELITE_ANCHOR_RE =
  /^(.+?)\s+Elite\s+(Soldier|Brute|Controller|Skirmisher|Artillery|Lurker)\b/i;
const HEADER_TITLE_RE = /^[A-Z][A-Za-z' -]{2,}$/;
/** `Hit Points` only when a formula follows — avoids matching body text like "hit points. An affected…". */
const STAT_LINE_RE =
  /^(Prerequisite:|Defenses\s*\+|Saving Throws|Action Points?|Hit Points\b(?=\s*[+\d-])|Resist|Immune|Vulnerable|Senses)\b/i;
const SECTION_MARKER_RE =
  /^(POWERS|TRAITS|STANDARD\s*A\s*CTIONS|MOVE\s*A\s*CTIONS|MINOR\s*A\s*CTIONS|MAJOR\s*A\s*CTIONS)\b/i;

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

function expandBlockLinesForTemplateParsing(lines: string[]): string[] {
  function splitOne(chunk: string): string[] {
    chunk = chunk.trim();
    if (!chunk) return [];
    // Stat block continuation only — not narrative "(when … reduced to 0 hit points or fewer)".
    if (chunk.length > 90 && /\bHit Points\b(?=\s*[+\d-])/i.test(chunk)) {
      const parts = chunk.split(/\s+(?=Hit Points\b(?=\s*[+\d-]))/i);
      if (parts.length === 2) return [...splitOne(parts[0]), ...splitOne(parts[1])];
    }
    const m = chunk.match(
      /^(.+?\bElite\s+(?:Soldier|Brute|Controller|Skirmisher|Artillery|Lurker))\s+(Humanoid\s+XP\s+(?:Elite|Standard|Solo|Minion))\s+(.+)$/i
    );
    if (m) return [m[1].trim(), m[2].trim(), ...splitOne(m[3].trim())];
    const mBeast = chunk.match(
      /^(.+?\bElite\s+(?:Soldier|Brute|Controller|Skirmisher|Artillery|Lurker))\s+(Humanoid(?:\s+or\s+magical\s+beast)?\s+XP\s+(?:Elite|Standard|Solo|Minion))\s+(.+)$/i
    );
    if (mBeast) return [mBeast[1].trim(), mBeast[2].trim(), ...splitOne(mBeast[3].trim())];
    if (chunk.length > 100 && /\bWhenever\b/i.test(chunk)) {
      const wm = chunk.search(/\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,5}\s+Whenever\b/i);
      if (wm > 0) {
        const prefix = chunk.slice(0, wm).trim();
        const rest = chunk.slice(wm).trim();
        return [...splitOne(prefix), ...splitOne(rest)];
      }
    }
    if (chunk.includes("~") && chunk.length > 80) {
      const idx = chunk.indexOf("~");
      if (idx > 30) {
        const left = chunk.slice(0, idx).trimEnd();
        const right = chunk.slice(idx).trim();
        if (right.startsWith("~") && right.length > 5) return [left, ...splitOne(right)];
      }
    }
    if (
      chunk.length > 80 &&
      /\(standard;\s*encounter\)/i.test(chunk) &&
      !chunk.trimStart().startsWith("~")
    ) {
      const enc = chunk.split(/(?=[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,6}\s*\(standard;\s*encounter\))/i);
      if (enc.length === 2 && enc[1].trim()) return [...splitOne(enc[0].trim()), ...splitOne(enc[1].trim())];
    }
    const am = chunk.match(/^(.+?)\s+(aura\s+\d+\s*;\s*.+)$/i);
    if (am) {
      const head = am[1].trim();
      const tail = am[2].trim();
      if (
        head.split(/\s+/).length <= 6 &&
        head.length <= 72 &&
        !head.toLowerCase().startsWith("resist") &&
        !head.toLowerCase().startsWith("immune") &&
        !head.toLowerCase().startsWith("vulnerable")
      ) {
        return [head, tail];
      }
    }
    return [chunk];
  }
  const out: string[] = [];
  for (const line of lines) out.push(...splitOne(line));
  return out;
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function titleCase(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => (part.length ? part[0].toUpperCase() + part.slice(1).toLowerCase() : part))
    .join(" ");
}

function isPlausibleTemplateName(name: string): boolean {
  const clean = name.trim();
  if (!clean) return false;
  const words = clean.split(/\s+/);
  if (words.length > 5) return false;
  const allowSingle = new Set([
    "Lich",
    "Shade",
    "Shades",
    "Wererat",
    "Werewolf",
    "Demagogue",
    "Devastator",
    "Feyborn",
    "Bodyguard"
  ]);
  if (words.length === 1 && clean.length >= 11 && !allowSingle.has(titleCase(clean))) return false;
  return true;
}

function extractCandidateNames(lines: string[]): Set<string> {
  const out = new Set<string>();
  for (const line of lines) {
    for (const m of line.matchAll(TEMPLATE_REF_RE)) {
      const candidate = m[1].trim();
      if (isPlausibleTemplateName(candidate)) out.add(candidate);
    }
    for (const m of line.matchAll(TEMPLATE_IS_A_RE)) {
      const candidate = m[1].trim();
      if (isPlausibleTemplateName(candidate)) out.add(candidate);
    }
    const headingMatch = line.match(TEMPLATE_HEADING_RE);
    if (headingMatch && isPlausibleTemplateName(headingMatch[1].trim())) out.add(headingMatch[1].trim());
    const roleMatch = line.trim().match(ROLE_LINE_RE);
    if (roleMatch && isPlausibleTemplateName(roleMatch[1].trim())) out.add(roleMatch[1].trim());
  }
  for (const [, name] of scanEliteRoleAnchors(lines)) out.add(name);
  for (let idx = 0; idx < lines.length; idx++) {
    if (lines[idx].toLowerCase() === "shades") {
      const near = lines.slice(idx, idx + 8).join(" ").toLowerCase();
      if (near.includes("to create a shade")) out.add("Shades");
    }
  }
  return out;
}

function scanEliteRoleAnchors(lines: string[]): [number, string][] {
  const out: [number, string][] = [];
  for (let idx = 0; idx < lines.length; idx++) {
    const m = lines[idx].trim().match(ROLE_LINE_ELITE_ANCHOR_RE);
    if (!m) continue;
    const raw = m[1].trim();
    const name = raw ? titleCase(raw) : "";
    if (name.length >= 3) out.push([idx, name]);
  }
  return out;
}

function isHeaderish(line: string): boolean {
  if (line.split(/\s+/).length > 5) return false;
  return HEADER_TITLE_RE.test(line);
}

function lineMentionsTemplateName(line: string, templateName: string): boolean {
  const target = normalizeName(templateName);
  if (!target) return false;
  return normalizeName(line).includes(target);
}

function findHeaderIndex(lines: string[], templateName: string): number | null {
  const target = normalizeName(templateName);
  const templateHeadingNorm = normalizeName(`${templateName} Template`);
  for (let idx = 0; idx < lines.length; idx++) {
    if (normalizeName(lines[idx]) === target) return idx;
  }
  for (let idx = 0; idx < lines.length; idx++) {
    if (normalizeName(lines[idx]) === templateHeadingNorm) return idx;
  }
  for (let idx = 0; idx < lines.length; idx++) {
    const lineNorm = normalizeName(lines[idx]);
    if (target && lineNorm.startsWith(target) && lineNorm.includes("elite")) return idx;
  }
  for (let idx = 0; idx < lines.length; idx++) {
    const n = normalizeName(lines[idx]);
    if (target && n.includes(target) && isHeaderish(lines[idx]) && lines[idx].toLowerCase().includes("template"))
      return idx;
  }
  return null;
}

function isTemplateTailMarker(line: string): boolean {
  const upper = line.toUpperCase();
  return (
    upper.includes("MONSTER ABILITIES") ||
    upper.startsWith("DUPLICA") ||
    upper.startsWith("CUSTOMIZING MONSTERS") ||
    upper.startsWith("CHAPTER ") ||
    upper.includes(" FACTIONS AND FOES") ||
    upper.startsWith("SONS OF ALAGONDAR") ||
    line.startsWith("4E_DMG_") ||
    line.startsWith("4E_") ||
    line.includes("_Ch")
  );
}

function looksLikePowerName(line: string): boolean {
  let clean = line.replace(/^[~✦\u2726\u2727\u2605.\s]+/u, "").trim();
  if (STAT_LINE_RE.test(clean)) return false;
  if (ROLE_LINE_ELITE_ANCHOR_RE.test(clean) || ROLE_LINE_RE.test(clean.trim())) return false;
  if (/^Level\s+\d+\s*:/i.test(clean)) return false;
  if (/^Humanoid(?:\s+or\s+magical\s+beast)?\s+XP\s+(?:Elite|Standard|Solo|Minion)\b/i.test(clean))
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
  if (/^(Failed\s+Saving\s+Throw|Aftereffect|Aftereffect:|Additional\s+Effect):/i.test(clean)) return false;
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

/** Join wrapped defense rows (e.g. "… against" / "charm and fear effects") before parsing. */
function mergeStatLineContinuations(lines: string[]): string[] {
  const merged: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (
      merged.length > 0 &&
      /^Defenses\b/i.test(merged[merged.length - 1]!) &&
      !STAT_LINE_RE.test(line) &&
      !looksLikePowerName(line)
    ) {
      merged[merged.length - 1] = `${merged[merged.length - 1]} ${line}`;
      continue;
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

  return {
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
  };
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

function extractTemplateDescription(rawText: string, roleLine: string, isElite: boolean): string {
  const raw = rawText.trim();
  if (!raw) return "";
  const rl = roleLine.trim();
  if (isElite && rl) {
    const idx = raw.indexOf(rl);
    if (idx >= 0) return raw.slice(0, idx).trim();
  }
  const mtraits = /\bTRAITS\b/i.exec(raw);
  if (mtraits) return raw.slice(0, mtraits.index).trim();
  const mpowers = /\bPOWERS\b/i.exec(raw);
  if (mpowers) return raw.slice(0, mpowers.index).trim();
  const msections = /\b(MOVE\s*ACTIONS|STANDARD\s*ACTIONS|MINOR\s*ACTIONS)\b/i.exec(raw);
  if (msections) return raw.slice(0, msections.index).trim();
  return raw.trim();
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

/** Subset of Python `_parse_stat_lines` — covers common template stat rows. */
function parseStatLines(statLines: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const defenses: Record<string, number> = {};
  const unparsed: string[] = [];

  for (const rawLine of statLines) {
    const rawLineTrim = rawLine.trim();
    if (!rawLineTrim) continue;
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
        result.savingThrows = v;
        parsed = true;
        if (line.includes(";")) {
          const tail = line.split(";", 2)[1]?.trim();
          if (tail) result.savingThrowNotes = [tail];
        }
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
        result.actionPoints = v;
        parsed = true;
        continue;
      }
    }

    if (lower.startsWith("hit points") || compact.startsWith("hitpoints")) {
      const hpFormulaMatch = line.match(/^hit\s*points?\s*(.*)$/i);
      const hpFormula = hpFormulaMatch ? hpFormulaMatch[1].trim() : line;
      const hitPoints = parseHitPointsFormula(hpFormula);
      if (Object.keys(hitPoints).length) result.hitPoints = hitPoints;
      parsed = true;
      continue;
    }

    if (!parsed) unparsed.push(line);
  }

  if (Object.keys(defenses).length) result.defenses = defenses;
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
  if (
    /\b(regain .* hit points?|scores? a critical|\d+d\d+|\d+\s+squares? of| flank(s|ed|ing)?\b|\bnatural\s+(19|20)\b|\bcritical hit\b|whenever\b)/i.test(
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
  return {
    name: entry.name.trim(),
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

function mechanicalParseTemplateBlockLines(blockLines: string[], templateName: string): {
  prerequisite: string;
  roleLine: string;
  statLines: string[];
  powersText: string[];
  powers: MonsterPower[];
  auras: MonsterTrait[];
  traits: MonsterTrait[];
  uncategorizedAbilities: MonsterPower[];
  rawText: string;
} {
  let prerequisite = "";
  let roleLine = "";
  const statLines: string[] = [];
  const powerLines: string[] = [];
  let inPowers = false;
  let seenStatCore = false;

  for (const origLine of blockLines) {
    const fusedMatch = origLine.match(/^(Action\s*Points?\s*\d+)\s+(.+)$/i);
    const candidateLines = fusedMatch
      ? [fusedMatch[1].trim(), fusedMatch[2].trim()]
      : [origLine];

    for (let line of candidateLines) {
      if (!line) continue;
      if (line.toLowerCase().startsWith("prerequisite:")) prerequisite = line.split(":", 2)[1].trim();
      if (
        ROLE_LINE_RE.test(line.trim()) ||
        ROLE_LINE_ELITE_ANCHOR_RE.test(line.trim()) ||
        (line.includes("Elite") &&
          /Soldier|Brute|Controller|Skirmisher|Artillery|Lurker/.test(line) &&
          lineMentionsTemplateName(line, templateName))
      ) {
        if (!roleLine) {
          roleLine = line;
          seenStatCore = true;
        }
      }
      if (
        statLines.length > 0 &&
        /^Defenses\b/i.test(statLines[statLines.length - 1]!) &&
        !STAT_LINE_RE.test(line) &&
        !looksLikePowerName(line)
      ) {
        statLines[statLines.length - 1] = `${statLines[statLines.length - 1]} ${line}`;
        seenStatCore = true;
        continue;
      }
      if (STAT_LINE_RE.test(line)) {
        statLines.push(line);
        seenStatCore = true;
      }
      if (line.toLowerCase().startsWith("skills ")) break;
      if (SECTION_MARKER_RE.test(line)) {
        inPowers = true;
        continue;
      }
      if (!inPowers && seenStatCore && looksLikePowerName(line)) inPowers = true;
      if (inPowers && isTemplateTailMarker(line)) break;
      if (inPowers && STAT_LINE_RE.test(line)) continue;
      if (inPowers && /^Level\s+\d+\s*:/i.test(line.trim())) {
        statLines.push(line);
        continue;
      }
      if (inPowers && line) powerLines.push(line);
    }
  }

  const parsedPowers = parsePowers(powerLines.slice(0, 120));
  const buckets = bucketTemplateAbilities(parsedPowers);

  return {
    prerequisite,
    roleLine,
    statLines,
    powersText: powerLines.slice(0, 120),
    powers: buckets.powers,
    auras: buckets.auras,
    traits: buckets.traits,
    uncategorizedAbilities: buckets.uncategorized,
    rawText: blockLines.join(" ").slice(0, 8000)
  };
}

function buildTemplateRow(
  name: string,
  parsed: ReturnType<typeof mechanicalParseTemplateBlockLines>
): MonsterTemplateRecord {
  const roleLineStr = parsed.roleLine;
  const rawTextStr = parsed.rawText;
  const isElite = inferTemplateIsElite(roleLineStr, rawTextStr);
  const prereq = parsed.prerequisite || "";
  const mergedStatLines = mergeStatLineContinuations(parsed.statLines);
  const descriptionBase = extractTemplateDescription(rawTextStr, roleLineStr, isElite);
  const description = prereq
    ? stripPrerequisiteFromDescription(descriptionBase, prereq)
    : descriptionBase.replace(/\bPrerequisite:\s*[^\n]+/gi, "").trim();
  return {
    templateName: titleCase(name),
    sourceBook: "manual import",
    pageStart: 0,
    pageEnd: 0,
    description,
    prerequisite: prereq || undefined,
    roleLine: roleLineStr || undefined,
    role: parseRoleLine(roleLineStr),
    isEliteTemplate: isElite,
    statLines: mergedStatLines.length ? mergedStatLines : undefined,
    stats: parseStatLines(mergedStatLines) as MonsterTemplateRecord["stats"],
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

export function parsePastedMonsterTemplateTextLocal(rawText: string, templateNameHint?: string): ParsePasteResult {
  const lines = toLines(rawText);
  if (!lines.length) return { ok: false, error: "emptyInput" };

  const names = extractCandidateNames(lines);
  let name: string | undefined;
  if (templateNameHint?.trim()) name = titleCase(templateNameHint.trim());
  else if (names.size) name = [...names].sort((a, b) => b.length - a.length)[0];
  else {
    const anchors = scanEliteRoleAnchors(lines);
    if (anchors.length) name = anchors[0][1];
    else {
      const hm = lines[0].trim().match(TEMPLATE_HEADING_RE);
      if (hm) name = titleCase(hm[1].trim());
    }
  }
  if (!name) return { ok: false, error: "couldNotInferTemplateName" };

  const headerIdx = findHeaderIndex(lines, name) ?? 0;
  const tail = lines.slice(headerIdx, headerIdx + 220);
  const blockLines = expandBlockLinesForTemplateParsing(tail);
  const mechanical = mechanicalParseTemplateBlockLines(blockLines, name);
  const template = buildTemplateRow(name, mechanical);
  return { ok: true, template };
}

/**
 * Dev server can expose POST `/api/parse-monster-template-paste` (Python ETL).
 * Falls back to `parsePastedMonsterTemplateTextLocal` when unavailable.
 */
export async function parsePastedMonsterTemplateText(
  rawText: string,
  templateNameHint?: string
): Promise<ParsePasteResult> {
  if (import.meta.env.DEV) {
    try {
      const r = await fetch("/api/parse-monster-template-paste", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: rawText, templateNameHint: templateNameHint?.trim() || undefined })
      });
      if (r.ok) {
        const data = (await r.json()) as ParsePasteResult | { ok: boolean; template?: MonsterTemplateRecord; error?: string };
        if (data && typeof data === "object" && "ok" in data) return data as ParsePasteResult;
      }
    } catch {
      /* use local */
    }
  }
  return parsePastedMonsterTemplateTextLocal(rawText, templateNameHint);
}
