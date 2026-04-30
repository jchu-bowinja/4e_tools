import type { MonsterEntryFile, MonsterPower, MonsterStats, MonsterTrait } from "./storage";
import { normalizeMonsterPowerShape } from "./monsterPowerNormalize";
import { parseMm3StatBlock, shouldUseMm3Parser } from "./monsterRawTextParseMm3";

const SECTION_HEAD =
  /^(TRAITS|STANDARD\s+ACTIONS|MOVE\s+ACTIONS|MINOR\s+ACTIONS|TRIGGERED\s+ACTIONS|FREE\s+ACTIONS)\b/i;

/** Stat block title line: Name Level N [Solo|Elite] Role — Role includes Minion as a creature type line */
const HEADER_RE =
  /^(.+?)\s+Level\s+(\d+)\s+(?:(Solo|Elite)\s+)?(Brute|Soldier|Controller|Skirmisher|Artillery|Lurker|Minion)(?:\s*\(Leader\))?\s*$/i;

const SIZE_XP_RE = /^(Tiny|Small|Medium|Large|Huge|Gargantuan)\s+(.+?)\s+XP\s+([\d,]+)\s*$/i;

const HP_LINE_RE =
  /^HP\s+(\d+)\s*;\s*Bloodied\s+(\d+)(?:\s+Initiative\s+([+-]?\d+))?\s*$/i;

const AC_LINE_RE =
  /^AC\s+(\d+)\s*,\s*Fortitude\s+(\d+)\s*,\s*Reflex\s+(\d+)\s*,\s*Will\s+(\d+)(?:\s+Perception\s+([+-]?\d+))?\s*$/i;

const SAVES_AP_RE = /^Saving Throws\s+([+-]?\d+)\s*;\s*Action Points\s+(\d+)\s*$/i;

const RESIST_RE = /^Resist\s+(\d+)\s+(.+?)\s*$/i;
const VULN_RE = /^Vulnerable\s+(\d+)\s+(.+?)\s*$/i;

const SKILLS_RE = /^Skills\s+(.+)$/i;
const ALIGN_RE = /^Alignment\s+(.+?)(?:\s+Languages\s+(.+))?$/i;
const EQUIP_RE = /^Equipment\s+(.+)$/i;

/** Power header: optional action glyph, name, ✦, usage */
const POWER_HEAD_RE =
  /^\s*(?:([5Mm,+.\-*Q])\s+)?(.+?)\s*[✦◆]\s*(.+)$/;
const IS_SECTION = (line: string): boolean => SECTION_HEAD.test(line.trim());

function normalizeRaw(text: string): string {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/\u2013|\u2014/g, "-")
    .replace(/\u2019/g, "'")
    .replace(/\r\n/g, "\n")
    .trim();
}

function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36).slice(0, 8);
}

function slugId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

/** When set, replaces parsed stat-block title name and rebuilds import id (same hash input as default id). */
function applyMonsterNameHintToEntry(
  entry: MonsterEntryFile,
  nameHint: string | undefined,
  rawNormalized: string
): MonsterEntryFile {
  const hint = nameHint?.trim();
  if (!hint) return entry;
  const id = `import-${slugId(hint)}-${simpleHash(rawNormalized)}`;
  return {
    ...entry,
    name: hint,
    id,
    fileName: `${id}.json`,
    relativePath: `import/${id}.json`
  };
}

function titleCaseAlign(raw: string): string {
  const t = raw.trim().toLowerCase();
  if (t === "evil") return "Evil";
  if (t === "good") return "Good";
  if (t === "lawful good") return "Lawful Good";
  if (t === "chaotic evil") return "Chaotic Evil";
  if (t === "unaligned") return "Unaligned";
  if (t === "any alignment") return "Any alignment";
  return raw.replace(/\b\w/g, (c) => c.toUpperCase());
}

function parseLanguages(rest: string | undefined): string[] {
  if (!rest || !rest.trim()) return [];
  const t = rest.replace(/^Languages\s+/i, "").trim();
  if (t === "—" || t === "-" || /^none$/i.test(t)) return [];
  return t.split(/,/).map((p) => p.trim()).filter(Boolean);
}

function splitPhysicalLine(line: string): {
  speedPart: string;
  sensesPart: string;
} {
  const speedMatch = line.match(/^Speed\s+(.+)$/i);
  if (!speedMatch) return { speedPart: "", sensesPart: line };
  const rest = speedMatch[1].trim();
  const senseNames = [
    "Darkvision",
    "Low-light vision",
    "Low-Light Vision",
    "Tremorsense",
    "Blindsight",
    "Truesight"
  ];
  let cut = rest.length;
  for (const sn of senseNames) {
    const idx = rest.indexOf(sn);
    if (idx >= 0 && idx < cut) cut = idx;
  }
  const speedPart = cut < rest.length ? rest.slice(0, cut).replace(/[,\s]+$/g, "").trim() : rest;
  const sensesPart = cut < rest.length ? rest.slice(cut).trim() : "";
  return { speedPart: speedPart, sensesPart: sensesPart };
}

function parseSpeedToMovement(speedPart: string): Array<{ type: string; value: string | number }> {
  const out: Array<{ type: string; value: string | number }> = [];
  const cleaned = speedPart.replace(/^Speed\s+/i, "").trim();
  if (!cleaned) return out;
  const chunks = cleaned.split(/,\s*/);
  for (const chunk of chunks) {
    const fly = chunk.match(/^fly\s+(\d+)/i);
    if (fly) {
      out.push({ type: "Fly", value: Number(fly[1]) });
      continue;
    }
    const swim = chunk.match(/^swim\s+(\d+)/i);
    if (swim) {
      out.push({ type: "Swim", value: Number(swim[1]) });
      continue;
    }
    const climb = chunk.match(/^climb\s+(\d+)/i);
    if (climb) {
      out.push({ type: "Climb", value: Number(climb[1]) });
      continue;
    }
    const land = chunk.match(/^(\d+)/);
    if (land) {
      out.push({ type: "Land", value: Number(land[1]) });
    }
  }
  return out;
}

function parseSensesFragment(s: string): Array<{ name: string; range?: string | number }> {
  if (!s.trim()) return [];
  return [{ name: s.trim(), range: 0 }];
}

function parseSkillsLine(line: string): Record<string, number | string> {
  const m = line.match(SKILLS_RE);
  if (!m) return {};
  const body = m[1];
  const parts = body.split(/,(?![^(]*\))/);
  const skills: Record<string, number | string> = {};
  for (const part of parts) {
    const p = part.trim();
    const mm = p.match(/^(.+?)\s+([+-][\d]+)$/);
    if (mm) {
      skills[mm[1].trim()] = mm[2];
    }
  }
  return skills;
}

function parseAbilityScoresFromDocument(lines: string[]): Record<string, number | string> {
  const scores: Record<string, number | string> = {};
  const abiRe = /\b(Str|Dex|Con|Int|Wis|Cha)\s+(\d+)\s*\(([^)]+)\)/gi;
  for (const line of lines) {
    let m: RegExpExecArray | null;
    while ((m = abiRe.exec(line)) !== null) {
      scores[m[1].toUpperCase()] = Number.parseInt(m[2], 10);
    }
  }
  return scores;
}

function extractParenKeywords(nameLine: string): { title: string; keywordParts: string[] } {
  const kws: string[] = [];
  const title = nameLine.replace(/\(([^)]+)\)/g, (_, inner) => {
    inner.split(/,\s*/).forEach((piece: string) => {
      const t = piece.trim();
      if (t) kws.push(t);
    });
    return "";
  });
  return { title: title.replace(/\s+/g, " ").trim(), keywordParts: kws };
}

function stripLeadingActionGlyph(name: string): string {
  return name
    .replace(/^[5Mm]\s+/, "")
    .replace(/^[,+.\-*]\s*/, "")
    .replace(/^Q\s+/, "")
    .trim();
}

function mapSectionToAction(section: string): string {
  const s = section.trim().toUpperCase();
  if (s.includes("STANDARD")) return "Standard";
  if (s.includes("MOVE")) return "Move";
  if (s.includes("MINOR")) return "Minor";
  if (s.includes("TRIGGERED") || s.includes("FREE")) return "Triggered";
  return "Standard";
}

function looksLikeTraitTitleLine(line: string): boolean {
  const t = line.trim();
  if (t.length < 2 || t.length > 100) return false;
  if (/^(Whenever|While |On an? |Each |The |If |An |Enemies|This |These |All |Any |At |For |In |It |As |When |After |Before |Creatures? |You |Your )/i.test(t)) {
    return false;
  }
  if (/^Attack:|^Hit:|^Miss:|^Effect:|^Trigger:/i.test(t)) return false;
  if (/✦\s*Aura/i.test(t)) return true;
  if (/^\d+\s+\w/.test(t)) return false;
  return /^[A-Z0-9]/.test(t);
}

/** Split TRAITS body into blocks: double newlines, or single newline before a new title line. */
function splitTraitParagraphs(body: string): string[] {
  const trimmed = body.trim();
  if (!trimmed) return [];
  const byDouble = trimmed.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (byDouble.length > 1) return byDouble;
  const lines = trimmed.split("\n");
  const out: string[] = [];
  let buf: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (i > 0 && line.trim() && looksLikeTraitTitleLine(line) && buf.length > 0) {
      const prev = buf[buf.length - 1].trim();
      if (prev && !looksLikeTraitTitleLine(prev)) {
        out.push(buf.join("\n").trim());
        buf = [];
      }
    }
    buf.push(line);
  }
  if (buf.length) out.push(buf.join("\n").trim());
  return out.filter(Boolean);
}

function parseTraitsSection(body: string): { traits: MonsterTrait[]; auras: MonsterTrait[]; warnings: string[] } {
  const warnings: string[] = [];
  const traits: MonsterTrait[] = [];
  const auras: MonsterTrait[] = [];
  const trimmed = body.trim();
  if (!trimmed) return { traits, auras, warnings };

  const paragraphs = splitTraitParagraphs(trimmed);
  for (const para of paragraphs) {
    const lines = para.split("\n").map((l) => l.trim());
    const titleLine = lines[0] ?? "";
    const details = lines.slice(1).join("\n").trim();
    if (/✦\s*Aura/i.test(titleLine)) {
      const withoutQ = titleLine.replace(/^\s*Q\s+/i, "");
      const auraNamePart = withoutQ.split(/\s*[✦◆]/)[0]?.trim() ?? withoutQ;
      const rangeM = withoutQ.match(/Aura\s*(\d+)/i);
      auras.push({
        name: auraNamePart,
        range: rangeM ? Number(rangeM[1]) : undefined,
        type: "Trait",
        details,
        keywords: extractParenKeywords(withoutQ).keywordParts
      });
    } else {
      traits.push({
        name: titleLine.replace(/^\s*Q\s+/i, "").trim(),
        type: "Trait",
        details
      });
    }
  }

  return { traits, auras, warnings };
}

function parsePowerBlocks(body: string, sectionAction: string): MonsterPower[] {
  const lines = body.split("\n");
  const powers: MonsterPower[] = [];
  let i = 0;
  const action = mapSectionToAction(sectionAction);
  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) {
      i++;
      continue;
    }
    const mh = line.match(POWER_HEAD_RE);
    if (!mh) {
      i++;
      continue;
    }
    const usage = mh[3].trim();
    let nameRaw = mh[2].trim();
    nameRaw = stripLeadingActionGlyph(nameRaw).replace(/^,\s*/, "").trim();
    const { title, keywordParts } = extractParenKeywords(nameRaw);
    const kwString = keywordParts.map((k) => k.replace(/\b\w/g, (c) => c.toUpperCase())).join(", ");
    const chunks: string[] = [line];
    let j = i + 1;
    while (j < lines.length) {
      const next = lines[j];
      if (POWER_HEAD_RE.test(next.trim()) && next.trim().length > 0) break;
      if (IS_SECTION(next)) break;
      if (/^(Skills|Alignment|Equipment)\b/i.test(next.trim())) break;
      if (/^Str\s/i.test(next.trim())) break;
      chunks.push(next);
      j++;
    }
    const description = chunks.join("\n").trim();
    const power: MonsterPower = {
      name: title || nameRaw,
      usage,
      action,
      keywords: kwString,
      description
    };
    powers.push(normalizeMonsterPowerShape(power));
    i = j;
  }
  return powers;
}

export type ParseMonsterStatBlockResult =
  | { ok: true; entry: MonsterEntryFile; warnings: string[] }
  | { ok: false; error: string };

/**
 * Best-effort parse of copied 4e MM-style stat block text into {@link MonsterEntryFile} shape
 * for the monster sheet UI. Unknown lines are skipped with warnings when possible.
 *
 * @param nameHint When non-empty after trim, replaces the stat block title name and rebuilds
 *   the import `id` (same content hash as the default id).
 */
export function parseMonsterStatBlockText(raw: string, nameHint?: string): ParseMonsterStatBlockResult {
  const warnings: string[] = [];
  const text = normalizeRaw(raw);
  if (!text) {
    return { ok: false, error: "Empty text." };
  }

  const lines = text.split(/\n/).map((l) => l.replace(/\s+$/g, "").trim());
  const nonEmpty = lines.map((l) => l.trim()).filter((l) => l.length > 0);

  if (nonEmpty.length < 2) {
    return { ok: false, error: "Need at least a title line and a size/XP line." };
  }

  const hm = nonEmpty[0].match(HEADER_RE);
  if (!hm) {
    return {
      ok: false,
      error: 'Could not parse title line (expected "Name Level N [Solo|Elite] Role" — Role may be Minion, Brute, …).'
    };
  }

  const name = hm[1].trim();
  const level = Number.parseInt(hm[2], 10);
  const groupToken = hm[3]?.toLowerCase();
  const groupRole = groupToken === "solo" ? "Solo" : groupToken === "elite" ? "Elite" : undefined;
  const role = hm[4].replace(/\b\w/g, (c) => c.toUpperCase());
  const isLeader = /\([Ll]eader\)/.test(nonEmpty[0]);

  const sizeLine = nonEmpty[1];
  const sm = sizeLine.match(SIZE_XP_RE);
  if (!sm) {
    return { ok: false, error: "Could not parse size / origin / type / XP line." };
  }

  const size = sm[1];
  const middle = sm[2].trim();
  const xpNum = Number.parseInt(sm[3].replace(/,/g, ""), 10);

  const parenKws: string[] = [];
  const middleNoParen = middle.replace(/\(([^)]+)\)/g, (_, inner) => {
    parenKws.push(inner.trim());
    return "";
  });
  const commaBits = middleNoParen
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const keywordList: string[] = [...new Set(parenKws)];
  if (commaBits.length > 1) {
    const last = commaBits[commaBits.length - 1];
    if (/^[a-z]{3,24}$/i.test(last)) keywordList.push(last);
  }
  const keywords = [...new Set(keywordList)];

  const typeStr = middle.replace(/\s+/g, " ").trim();

  if (shouldUseMm3Parser(nonEmpty)) {
    const mm3 = parseMm3StatBlock({
      nonEmpty,
      name,
      level,
      role,
      groupRole,
      isLeader,
      size,
      typeStr,
      xpNum,
      keywords,
      commaBits,
      warnings
    });
    return {
      ok: true,
      entry: applyMonsterNameHintToEntry(mm3.entry, nameHint, text),
      warnings: mm3.warnings
    };
  }

  const sectionIndices: { key: string; idx: number }[] = [];
  for (let i = 2; i < nonEmpty.length; i++) {
    const m = nonEmpty[i].match(SECTION_HEAD);
    if (m) {
      sectionIndices.push({ key: m[1].toUpperCase().replace(/\s+/g, " "), idx: i });
    }
  }

  const findSection = (label: RegExp): { start: number; end: number } | null => {
    const hit = sectionIndices.find((s) => label.test(s.key));
    if (!hit) return null;
    const start = hit.idx + 1;
    const next = sectionIndices.find((s) => s.idx > hit.idx);
    const end = next ? next.idx : nonEmpty.length;
    return { start, end };
  };

  let idx = 2;
  const otherNumbers: Record<string, unknown> = {};
  const defenses: Record<string, number | string> = {};

  const hpLine = nonEmpty[idx];
  if (hpLine && HP_LINE_RE.test(hpLine)) {
    const hpM = hpLine.match(HP_LINE_RE)!;
    otherNumbers.HP = Number.parseInt(hpM[1], 10);
    otherNumbers.bloodied = Number.parseInt(hpM[2], 10);
    if (hpM[3]) otherNumbers.initiative = hpM[3].trim();
    idx++;
  } else {
    warnings.push("Could not read HP / Bloodied / Initiative line — stats may be incomplete.");
  }

  const acLine = nonEmpty[idx];
  if (acLine && AC_LINE_RE.test(acLine)) {
    const acM = acLine.match(AC_LINE_RE)!;
    defenses.AC = Number.parseInt(acM[1], 10);
    defenses.Fortitude = Number.parseInt(acM[2], 10);
    defenses.Reflex = Number.parseInt(acM[3], 10);
    defenses.Will = Number.parseInt(acM[4], 10);
    if (acM[5]) otherNumbers.perception = acM[5].trim();
    idx++;
  } else {
    warnings.push("Could not read AC / defenses / Perception line.");
  }

  const speedLine = nonEmpty[idx];
  if (speedLine && /^Speed\b/i.test(speedLine)) {
    const { speedPart, sensesPart } = splitPhysicalLine(speedLine);
    const movement = parseSpeedToMovement(speedPart);
    if (movement.length > 0) otherNumbers.movement = movement;
    if (sensesPart) {
      const sens = parseSensesFragment(sensesPart);
      if (sens.length) {
        otherNumbers.sensesLineTail = sens;
      }
    }
    idx++;
  }

  const resistances: Array<{ name?: string; amount?: number }> = [];
  const weaknesses: Array<{ name?: string; amount?: number }> = [];

  function consumeDefenseModifiers(line: string): void {
    for (const piece of line.split(";").map((p) => p.trim()).filter(Boolean)) {
      const rm = piece.match(RESIST_RE);
      if (rm) resistances.push({ amount: Number.parseInt(rm[1], 10), name: rm[2].trim() });
      const vm = piece.match(VULN_RE);
      if (vm) weaknesses.push({ amount: Number.parseInt(vm[1], 10), name: vm[2].trim() });
    }
  }

  while (idx < nonEmpty.length && !IS_SECTION(nonEmpty[idx])) {
    const L = nonEmpty[idx];
    if (RESIST_RE.test(L) || VULN_RE.test(L)) {
      consumeDefenseModifiers(L);
      idx++;
      continue;
    }
    if (SAVES_AP_RE.test(L)) {
      const smt = L.match(SAVES_AP_RE)!;
      otherNumbers.savingThrows = smt[1].trim();
      otherNumbers.actionPoints = Number.parseInt(smt[2], 10);
      idx++;
      continue;
    }
    if (SKILLS_RE.test(L)) {
      idx++;
      continue;
    }
    if (/^Str\s/i.test(L)) {
      break;
    }
    if (/^Alignment\b/i.test(L) || /^Equipment\b/i.test(L)) {
      break;
    }
    idx++;
  }

  const traitsSec = findSection(/^TRAITS$/i);
  const standardSec = findSection(/^STANDARD\s+ACTIONS$/i);
  const moveSec = findSection(/^MOVE\s+ACTIONS$/i);
  const minorSec = findSection(/^MINOR\s+ACTIONS$/i);
  const trigSec = findSection(/^TRIGGERED\s+ACTIONS$/i);

  const allTraits: MonsterTrait[] = [];
  const allAuras: MonsterTrait[] = [];
  const allPowers: MonsterPower[] = [];

  if (traitsSec) {
    const body = nonEmpty.slice(traitsSec.start, traitsSec.end).join("\n");
    const parsed = parseTraitsSection(body);
    allTraits.push(...parsed.traits);
    allAuras.push(...parsed.auras);
    warnings.push(...parsed.warnings);
  }

  const appendPowers = (sec: { start: number; end: number } | null, label: string): void => {
    if (!sec) return;
    const body = nonEmpty.slice(sec.start, sec.end).join("\n");
    allPowers.push(...parsePowerBlocks(body, label));
  };

  appendPowers(standardSec, "STANDARD ACTIONS");
  appendPowers(moveSec, "MOVE ACTIONS");
  appendPowers(minorSec, "MINOR ACTIONS");
  appendPowers(trigSec, "TRIGGERED ACTIONS");

  if (allPowers.length === 0) {
    warnings.push("No powers with ✦ headers were found — check formatting or section headers.");
  }

  const skills: Record<string, number | string> = {};
  for (const L of nonEmpty) {
    if (SKILLS_RE.test(L)) {
      Object.assign(skills, parseSkillsLine(L));
    }
  }

  let alignment: { name: string } | undefined;
  let languages: string[] = [];
  for (const L of nonEmpty) {
    const am = L.match(/^Alignment\s+(.+)$/i);
    if (am) {
      const rest = am[1];
      const langSplit = rest.split(/\bLanguages\b/i);
      const alignPart = langSplit[0]?.trim() ?? "";
      alignment = { name: titleCaseAlign(alignPart) };
      if (langSplit[1]) languages = parseLanguages(langSplit[1]);
    }
  }

  const items: Array<{ name: string }> = [];
  for (const L of nonEmpty) {
    const em = L.match(EQUIP_RE);
    if (em) {
      items.push({ name: em[1].trim() });
    }
  }

  const abilityScores = parseAbilityScoresFromDocument(nonEmpty);

  const sensesFromSpeed = (): Array<{ name: string; range?: string | number }> => {
    for (const L of nonEmpty) {
      if (/^Speed\b/i.test(L)) {
        const { sensesPart } = splitPhysicalLine(L);
        return parseSensesFragment(sensesPart);
      }
    }
    return [];
  };

  const tail = otherNumbers.sensesLineTail as Array<{ name: string; range?: string | number }> | undefined;
  delete otherNumbers.sensesLineTail;
  const senses = tail?.length ? tail : sensesFromSpeed();

  const stats: MonsterStats = {
    abilityScores,
    defenses,
    attackBonuses: {},
    skills,
    otherNumbers
  };

  const id = `import-${slugId(name)}-${simpleHash(text)}`;

  const entry: MonsterEntryFile = {
    id,
    fileName: `${id}.json`,
    relativePath: `import/${id}.json`,
    name,
    level,
    role,
    isLeader,
    parseError: "",
    sourceRoot: "import",
    size,
    origin: commaBits[0] ?? "unknown",
    type: typeStr || "Unknown",
    xp: xpNum,
    groupRole,
    alignment,
    languages: languages.length ? languages : undefined,
    keywords: keywords.length > 0 ? keywords : undefined,
    senses: senses.length ? senses : undefined,
    resistances: resistances.length ? resistances : undefined,
    weaknesses: weaknesses.length ? weaknesses : undefined,
    items: items.length ? items : undefined,
    traits: allTraits.length ? allTraits : undefined,
    auras: allAuras.length ? allAuras : undefined,
    stats,
    powers: allPowers,
    sections: warnings.length ? { importWarnings: warnings } : undefined
  };

  return { ok: true, entry: applyMonsterNameHintToEntry(entry, nameHint, text), warnings };
}
