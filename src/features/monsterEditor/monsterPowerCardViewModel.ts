import type {
  MonsterPower,
  MonsterPowerAttack,
  MonsterPowerOutcome,
  MonsterPowerOutcomeEntry
} from "./storage";
import { isRenderableCardValue, normalizeSemicolonWhitespace, normalizeTextForDupCompare } from "./monsterTextUtils";

function splitPowerKeywords(rawKeywords: string): string[] {
  return rawKeywords
    .split(/[;,]/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function hasLevelBasedAttackLanguage(power: MonsterPower, attack?: MonsterPowerAttack): boolean {
  const fragments: string[] = [String(power.description || "")];
  const hitDesc = String(attack?.hit?.description || "");
  const missDesc = String(attack?.miss?.description || "");
  const effectDesc = String(attack?.effect?.description || "");
  if (hitDesc) fragments.push(hitDesc);
  if (missDesc) fragments.push(missDesc);
  if (effectDesc) fragments.push(effectDesc);
  return fragments.some((text) => /\blevel\s*\+\s*\d+\s+vs\.\s*(?:ac|fortitude|reflex|will)\b/i.test(text));
}

function renderAttackBonusLine(power: MonsterPower, attack?: MonsterPowerAttack): string {
  if (!attack?.attackBonuses?.length) return "";
  const useLevelFormulaDisplay = hasLevelBasedAttackLanguage(power, attack);
  return attack.attackBonuses
    .map((bonus) => {
      const rawBonus = bonus.bonus ?? "?";
      const parsedBonus =
        typeof rawBonus === "number"
          ? rawBonus
          : typeof rawBonus === "string" && /^[+-]?\d+$/.test(rawBonus.trim())
            ? Number.parseInt(rawBonus.trim(), 10)
            : null;
      const displayBonus =
        useLevelFormulaDisplay && parsedBonus !== null
          ? parsedBonus >= 0
            ? `level + ${parsedBonus}`
            : `level - ${Math.abs(parsedBonus)}`
          : rawBonus;
      return `${displayBonus} vs ${(bonus.defense ?? "?").toString().toLowerCase()}`;
    })
    .join(" * ");
}

function renderDamageExpression(outcome?: MonsterPowerOutcome, fallbackExpressions?: string[]): string {
  const fromOutcome = outcome?.damage?.expressions?.filter(Boolean) ?? [];
  if (fromOutcome.length > 0) return fromOutcome.join(" + ");
  const fallback = fallbackExpressions?.filter(Boolean) ?? [];
  if (fallback.length > 0) return fallback.join(" + ");
  return "";
}

function appendNestedOutcomeLines(
  lines: Array<{ label: string; text: string }>,
  outcome: MonsterPowerOutcome | undefined
): void {
  if (!outcome) return;
  const outcomeEntryDescription = (entry: MonsterPowerOutcomeEntry): string => {
    const direct = normalizeSemicolonWhitespace(String(entry.description || "").trim());
    if (isRenderableCardValue(direct)) return direct;
    const fromChildren = normalizeSemicolonWhitespace(
      String((entry as { children?: { Description?: { text?: string } } }).children?.Description?.text || "").trim()
    );
    if (isRenderableCardValue(fromChildren)) return fromChildren;
    return "";
  };
  const aftereffectLines =
    outcome.aftereffects
      ?.map((entry) => outcomeEntryDescription(entry))
      .filter((text) => isRenderableCardValue(text)) ?? [];
  for (const aftereffect of aftereffectLines) {
    lines.push({ label: "AFTEREFFECT", text: aftereffect });
  }
  const sustainLines =
    outcome.sustains
      ?.map((entry) => outcomeEntryDescription(entry))
      .filter((text) => isRenderableCardValue(text)) ?? [];
  for (const sustain of sustainLines) {
    lines.push({ label: "SUSTAIN", text: sustain });
  }
  const failedSaveLines =
    outcome.failedSavingThrows
      ?.map((entry) => outcomeEntryDescription(entry))
      .filter((text) => isRenderableCardValue(text)) ?? [];
  for (const failedSave of failedSaveLines) {
    lines.push({ label: "FAILED SAVE", text: failedSave });
  }
  const nestedRaw = outcome.nestedAttackDescriptions;
  if (nestedRaw?.length) {
    for (const entry of nestedRaw) {
      if (typeof entry === "string") {
        const text = normalizeSemicolonWhitespace(entry.trim());
        if (isRenderableCardValue(text)) lines.push({ label: "NESTED ATTACK", text });
        continue;
      }
      const mini = entry as MonsterPowerOutcome;
      const head = normalizeSemicolonWhitespace(String(mini.description || "").trim());
      if (isRenderableCardValue(head)) {
        lines.push({ label: "NESTED ATTACK", text: head });
      }
      appendNestedOutcomeLines(lines, { ...mini, description: undefined, nestedAttackDescriptions: undefined });
    }
  }
}

function renderCompactAttackOutcomeLines(attack: MonsterPowerAttack | undefined): Array<{ label: string; text: string }> {
  const lines: Array<{ label: string; text: string }> = [];
  if (isRenderableCardValue(attack?.targets)) {
    lines.push({ label: "TARGET", text: normalizeSemicolonWhitespace(String(attack?.targets).trim()) });
  }
  const hitExpr = renderDamageExpression(attack?.hit);
  const hitDescription = isRenderableCardValue(attack?.hit?.description)
    ? normalizeSemicolonWhitespace(String(attack?.hit?.description).trim())
    : "";
  if (hitExpr) {
    const combinedHit = isRenderableCardValue(hitDescription) ? `${hitExpr} ${hitDescription}`.trim() : hitExpr;
    lines.push({ label: "HIT", text: combinedHit });
  } else if (isRenderableCardValue(hitDescription)) {
    lines.push({ label: "HIT", text: hitDescription });
  }
  if (isRenderableCardValue(attack?.miss?.description)) {
    lines.push({ label: "MISS", text: normalizeSemicolonWhitespace(String(attack?.miss?.description).trim()) });
  }
  if (isRenderableCardValue(attack?.effect?.description)) {
    lines.push({ label: "EFFECT", text: String(attack?.effect?.description).trim() });
  }
  appendNestedOutcomeLines(lines, attack?.hit);
  appendNestedOutcomeLines(lines, attack?.miss);
  appendNestedOutcomeLines(lines, attack?.effect);
  return lines;
}

function renderCompactOutcomeLines(
  power: MonsterPower,
  attack: MonsterPowerAttack | undefined
): Array<{ label: string; text: string }> {
  const lines: Array<{ label: string; text: string }> = [];
  if (isRenderableCardValue(power.trigger)) {
    lines.push({ label: "TRIGGER", text: normalizeSemicolonWhitespace(String(power.trigger).trim()) });
  }
  if (isRenderableCardValue(power.requirements)) {
    lines.push({ label: "REQUIREMENTS", text: normalizeSemicolonWhitespace(String(power.requirements).trim()) });
  }
  lines.push(...renderCompactAttackOutcomeLines(attack));
  return lines;
}

/** Stop ongoing snippet before inline subconditions (same phrases as outcome splitters). */
const ONGOING_STOP_BEFORE_SUBCONDITION = /\.\s+(?=(?:First Failed Saving Throw|Second Failed Saving Throw|Third Failed Saving Throw|Each Failed Saving Throw|Failed Saving Throw|Aftereffect|Additional Effect|Sustain Standard|Sustain Minor|Sustain Move|Sustain Free)\s*:)/i;
const ONGOING_STOP_SEMICOLON = /[;]\s+(?=(?:First Failed Saving Throw|Second Failed Saving Throw|Third Failed Saving Throw|Each Failed Saving Throw|Failed Saving Throw|Aftereffect|Additional Effect|Sustain Standard|Sustain Minor|Sustain Move|Sustain Free)\s*:)/i;

function clipOngoingTailAtSubconditions(tail: string): string {
  let t = tail.trim();
  const m = ONGOING_STOP_BEFORE_SUBCONDITION.exec(t) ?? ONGOING_STOP_SEMICOLON.exec(t);
  if (m && m.index !== undefined) {
    t = t.slice(0, m.index).trim();
  }
  return t;
}

function extractOngoingText(description: string | undefined): string {
  if (!isRenderableCardValue(description)) return "";
  const desc = String(description).trim();
  const ongoingMatch = desc.match(/\bongoing\b[:\s-]*(.*)$/i);
  if (!isRenderableCardValue(ongoingMatch?.[1])) return "";
  return clipOngoingTailAtSubconditions(String(ongoingMatch?.[1]));
}

export type MonsterPowerCardViewModel = {
  usagePrimaryParts: string[];
  usageDetailsLines: string[];
  attackLineParts: string[];
  keywordTokens: string[];
  outcomeLines: Array<{ label: string; text: string }>;
  secondaryAttacks: Array<{
    name: string;
    attackLineParts: string[];
    outcomeLines: Array<{ label: string; text: string }>;
  }>;
  descriptionText: string;
  ongoingText: string;
};

function dedupeLabeledLines(lines: Array<{ label: string; text: string }>): Array<{ label: string; text: string }> {
  const seen = new Set<string>();
  const deduped: Array<{ label: string; text: string }> = [];
  for (const line of lines) {
    const normalizedLabel = normalizeSemicolonWhitespace(String(line.label || "").trim()).toLowerCase();
    const normalizedText = normalizeSemicolonWhitespace(String(line.text || "").trim()).toLowerCase();
    if (!normalizedLabel || !normalizedText) continue;
    const key = `${normalizedLabel}::${normalizedText}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push({ label: String(line.label).trim(), text: String(line.text).trim() });
  }
  return deduped;
}

export function buildMonsterPowerCardViewModel(power: MonsterPower): MonsterPowerCardViewModel {
  const primaryAttack = power.attacks?.[0];
  const attackBonusLine = renderAttackBonusLine(power, primaryAttack);
  const compactOutcomeLines = dedupeLabeledLines(renderCompactOutcomeLines(power, primaryAttack));
  const normalizedDescription = normalizeSemicolonWhitespace(String(power.description || "").trim());
  const normalizedEffectDescription = normalizeSemicolonWhitespace(String(primaryAttack?.effect?.description || "").trim());
  const normalizedHitDescription = normalizeSemicolonWhitespace(String(primaryAttack?.hit?.description || "").trim());
  const hitAlreadyContainsDescription =
    isRenderableCardValue(normalizedDescription) &&
    isRenderableCardValue(normalizedHitDescription) &&
    (normalizedHitDescription.toLowerCase().includes(normalizedDescription.toLowerCase()) ||
      normalizedDescription.toLowerCase().includes(normalizedHitDescription.toLowerCase()));

  const shouldInlineDescriptionWithHit =
    isRenderableCardValue(normalizedDescription) &&
    /^(?:[a-z]+\s+)?damage\b/i.test(normalizedDescription) &&
    compactOutcomeLines.some((line) => line.label === "HIT") &&
    !hitAlreadyContainsDescription;

  let outcomeLines = dedupeLabeledLines(
    compactOutcomeLines.map((line) =>
      line.label === "HIT" && shouldInlineDescriptionWithHit ? { ...line, text: `${line.text} ${normalizedDescription}`.trim() } : line
    )
  );

  const descriptionDuplicatesEffect =
    isRenderableCardValue(normalizedDescription) &&
    isRenderableCardValue(normalizedEffectDescription) &&
    normalizeTextForDupCompare(normalizedDescription) === normalizeTextForDupCompare(normalizedEffectDescription);
  const descriptionDuplicatesOutcomeLine =
    isRenderableCardValue(normalizedDescription) &&
    outcomeLines.some(
      (line) =>
        isRenderableCardValue(line.text) &&
        (() => {
          const normalizedLineText = normalizeTextForDupCompare(String(line.text).trim());
          const normalizedDescriptionText = normalizeTextForDupCompare(normalizedDescription);
          return (
            normalizedLineText === normalizedDescriptionText ||
            normalizedLineText.includes(normalizedDescriptionText) ||
            normalizedDescriptionText.includes(normalizedLineText)
          );
        })()
    );
  const descriptionText =
    isRenderableCardValue(normalizedDescription) &&
    !shouldInlineDescriptionWithHit &&
    !descriptionDuplicatesEffect &&
    !descriptionDuplicatesOutcomeLine
      ? String(power.description)
      : "";

  const usagePrimaryParts = [
    normalizeSemicolonWhitespace(String(power.action || "").trim().toLowerCase()),
    normalizeSemicolonWhitespace(String(power.usage || "").trim().toLowerCase())
  ].filter((part) => isRenderableCardValue(part));

  const usageDetails = normalizeSemicolonWhitespace(String(power.usageDetails || "").trim());
  const usageDetailsLines = isRenderableCardValue(usageDetails) ? [usageDetails] : [];

  const powerRange = String(power.range || "").trim();
  const attackRange = String(primaryAttack?.range || "").trim();
  const attackLineParts = [powerRange, powerRange.toLowerCase() === attackRange.toLowerCase() ? "" : attackRange, attackBonusLine]
    .map((part) => String(part || "").trim())
    .filter((part) => isRenderableCardValue(part));

  const secondaryAttacks = (power.attacks ?? [])
    .slice(1)
    .map((attack, idx) => {
      const secondaryRange = String(attack.range || "").trim();
      const secondaryBonusLine = renderAttackBonusLine(power, attack);
      const secondaryAttackLineParts = [secondaryRange, secondaryBonusLine]
        .map((part) => String(part || "").trim())
        .filter((part) => isRenderableCardValue(part));
      return {
        name: String(attack.name || `Secondary Attack ${idx + 1}`),
        attackLineParts: secondaryAttackLineParts,
        outcomeLines: dedupeLabeledLines(renderCompactAttackOutcomeLines(attack))
      };
    })
    .filter((attack) => attack.attackLineParts.length > 0 || attack.outcomeLines.length > 0);

  if (secondaryAttacks.length > 0) {
    const secondaryOutcomeTexts = new Set(
      secondaryAttacks
        .flatMap((attack) => attack.outcomeLines.map((line) => normalizeSemicolonWhitespace(String(line.text || "").trim()).toLowerCase()))
        .filter((text) => isRenderableCardValue(text))
    );
    outcomeLines = outcomeLines.filter((line) => {
      if (line.label !== "NESTED ATTACK") return true;
      const normalizedText = normalizeSemicolonWhitespace(String(line.text || "").trim()).toLowerCase();
      if (!isRenderableCardValue(normalizedText)) return true;
      return !secondaryOutcomeTexts.has(normalizedText);
    });
  }

  const keywordTokens = [
    ...(power.keywordTokens?.filter(Boolean) ?? []),
    ...splitPowerKeywords(power.keywords || ""),
    ...(power.keywordNames?.filter(Boolean) ?? [])
  ];
  const uniqueKeywordTokens = [...new Set(keywordTokens.filter((keyword) => isRenderableCardValue(keyword)))];

  return {
    usagePrimaryParts,
    usageDetailsLines,
    attackLineParts,
    keywordTokens: uniqueKeywordTokens,
    outcomeLines,
    secondaryAttacks,
    descriptionText,
    ongoingText: extractOngoingText(power.description)
  };
}
