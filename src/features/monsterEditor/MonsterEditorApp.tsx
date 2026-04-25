import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent
} from "react";
import type { RulesIndex } from "../../rules/models";
import { resolveTooltipText } from "../../data/tooltipGlossary";
import { positionFixedTooltip } from "../../ui/glossaryTooltipPosition";
import {
  loadMonsterEntry,
  loadMonsterIndex,
  type MonsterEntryFile,
  type MonsterIndexEntry,
  type MonsterPower,
  type MonsterPowerAttack,
  type MonsterPowerDamage,
  type MonsterPowerOutcome,
  type MonsterPowerOutcomeEntry,
  type MonsterTrait
} from "./storage";

/** Matches CharacterSheetApp: panels, section titles, labels, and body scale. */
const panelStyle: CSSProperties = {
  backgroundColor: "var(--surface-0)",
  border: "1px solid var(--panel-border)",
  borderRadius: "var(--ui-panel-radius, 0.35rem)",
  boxShadow: "var(--ui-panel-shadow, 0 1px 2px rgba(40, 30, 10, 0.08))"
};

const sheetPanel: CSSProperties = {
  ...panelStyle
};

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: "0.9rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--text-primary)"
};

const microLabelStyle: CSSProperties = {
  fontSize: "0.72rem",
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  fontWeight: 700
};

const pageTitleStyle: CSSProperties = {
  marginTop: 0,
  marginBottom: "0.35rem",
  fontSize: "1.05rem",
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "var(--text-primary)"
};

const bodyPrimary: CSSProperties = { fontSize: "0.8rem", color: "var(--text-primary)" };
const bodySecondary: CSSProperties = { fontSize: "0.8rem", color: "var(--text-secondary)" };
const metaMuted: CSSProperties = { fontSize: "0.78rem", color: "var(--text-muted)" };
const metaSecondary: CSSProperties = { fontSize: "0.78rem", color: "var(--text-secondary)" };
const captionMuted: CSSProperties = { fontSize: "0.74rem", color: "var(--text-muted)" };
const detailsSummaryStyle: CSSProperties = {
  cursor: "pointer",
  fontSize: "0.82rem",
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "var(--text-secondary)"
};
const jsonSummaryStyle: CSSProperties = {
  cursor: "pointer",
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "var(--text-primary)"
};

const secondaryAttackTitleStyle: CSSProperties = {
  fontSize: "0.78rem",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "var(--text-secondary)"
};

const outcomeSectionLabelStyle: CSSProperties = {
  fontSize: "0.74rem",
  fontWeight: 700,
  textTransform: "uppercase",
  color: "var(--text-muted)"
};

const powerBucketHeaderStyle: CSSProperties = {
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--text-primary)"
};

const indexColumnHeaderStyle: CSSProperties = {
  padding: "0.5rem 0.75rem",
  borderBottom: "1px solid var(--panel-border)",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  fontSize: "0.78rem",
  color: "var(--text-primary)"
};

const statPanelStyle: CSSProperties = {
  border: "1px solid var(--panel-border)",
  borderRadius: "var(--ui-panel-radius, 0.35rem)",
  padding: "0.5rem",
  backgroundColor: "var(--surface-0)",
  boxShadow: "var(--ui-panel-shadow, 0 1px 2px rgba(40, 30, 10, 0.08))"
};

const glossaryLinkUnderline: CSSProperties = {
  cursor: "help",
  borderBottom: "1px dotted var(--text-muted)"
};

const microLabelInteractive: CSSProperties = {
  ...microLabelStyle,
  ...glossaryLinkUnderline,
  width: "fit-content"
};

const identityValueStyle: CSSProperties = {
  fontWeight: 700,
  fontSize: "0.8rem",
  color: "var(--text-primary)"
};

const identityValueInteractive: CSSProperties = {
  ...identityValueStyle,
  cursor: "help",
  width: "fit-content",
  borderBottom: "1px dotted var(--text-muted)"
};

const identityValueRowWithPill: CSSProperties = {
  ...identityValueStyle,
  display: "inline-flex",
  alignItems: "center",
  gap: "0.35rem"
};

const sheetTagPillStyle: CSSProperties = {
  fontSize: "0.72rem",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "var(--text-secondary)",
  border: "1px solid var(--panel-border)",
  borderRadius: "999px",
  padding: "0.05rem 0.35rem",
  backgroundColor: "var(--surface-1)",
  cursor: "help"
};

const richTextBodyPrimary: { paragraphStyle: CSSProperties; listItemStyle: CSSProperties } = {
  paragraphStyle: { fontSize: "0.8rem", color: "var(--text-primary)", margin: "0.35rem 0 0 0" },
  listItemStyle: { fontSize: "0.8rem", color: "var(--text-primary)" }
};

const statValueStrong: CSSProperties = { color: "var(--text-primary)", fontSize: "0.8rem", fontWeight: 700 };

const statEmptyPlaceholder: CSSProperties = { fontWeight: 700, fontSize: "0.8rem", color: "var(--text-primary)" };

const outcomeEntryTitleStyle: CSSProperties = { fontSize: "0.78rem", fontWeight: 700, color: "var(--text-primary)" };

type MonsterPowerActionBucket = "standard" | "minor" | "triggered" | "other";
type MonsterPowerColorBucket = "atWill" | "encounter" | "daily" | "other";

function usageAccentColor(bucket: MonsterPowerActionBucket): string {
  if (bucket === "standard") return "var(--power-accent-atwill-bar)";
  if (bucket === "minor") return "var(--power-accent-encounter-bar)";
  if (bucket === "triggered") return "var(--power-accent-daily-bar)";
  return "var(--text-secondary)";
}

function usageAccentCardStyle(bucket: MonsterPowerActionBucket): {
  border: string;
  borderLeft: string;
  backgroundColor: string;
} {
  if (bucket === "standard") {
    return {
      border: "1px solid var(--power-accent-atwill-border)",
      borderLeft: "6px solid var(--power-accent-atwill-bar)",
      backgroundColor: "var(--power-accent-atwill-bg)"
    };
  }
  if (bucket === "minor") {
    return {
      border: "1px solid var(--power-accent-encounter-border)",
      borderLeft: "6px solid var(--power-accent-encounter-bar)",
      backgroundColor: "var(--power-accent-encounter-bg)"
    };
  }
  if (bucket === "triggered") {
    return {
      border: "1px solid var(--power-accent-daily-border)",
      borderLeft: "6px solid var(--power-accent-daily-bar)",
      backgroundColor: "var(--power-accent-daily-bg)"
    };
  }
  return {
    border: "1px solid var(--panel-border)",
    borderLeft: "6px solid var(--text-secondary)",
    backgroundColor: "var(--surface-1)"
  };
}

function classifyMonsterPowerUsageBucket(action: string | undefined, trigger: string | undefined): MonsterPowerActionBucket {
  const normalizedAction = String(action || "").toLowerCase();
  const normalizedTrigger = String(trigger || "").toLowerCase();
  const hasTrigger = Boolean(normalizedTrigger.trim()) && normalizedTrigger.trim() !== "none";
  if (hasTrigger || /immediate|interrupt|reaction|opportunity/.test(normalizedAction)) return "triggered";
  if (normalizedAction.includes("standard")) return "standard";
  if (normalizedAction.includes("minor")) return "minor";
  return "other";
}

function usageBucketLabel(bucket: MonsterPowerActionBucket): string {
  if (bucket === "standard") return "Standard Action";
  if (bucket === "minor") return "Minor Action";
  if (bucket === "triggered") return "Triggered Actions";
  return "Other";
}

function classifyMonsterPowerColorBucket(usage: string | undefined): MonsterPowerColorBucket {
  const normalized = String(usage || "").toLowerCase();
  if (normalized.includes("at-will") || normalized.includes("at will")) return "atWill";
  if (normalized.includes("encounter")) return "encounter";
  if (normalized.includes("daily")) return "daily";
  return "other";
}

function usageColorAccentColor(bucket: MonsterPowerColorBucket): string {
  if (bucket === "atWill") return "var(--power-accent-atwill-bar)";
  if (bucket === "encounter") return "var(--power-accent-encounter-bar)";
  if (bucket === "daily") return "var(--power-accent-daily-bar)";
  return "var(--text-secondary)";
}

function usageColorAccentCardStyle(bucket: MonsterPowerColorBucket): {
  border: string;
  borderLeft: string;
  backgroundColor: string;
} {
  if (bucket === "atWill") {
    return {
      border: "1px solid var(--power-accent-atwill-border)",
      borderLeft: "6px solid var(--power-accent-atwill-bar)",
      backgroundColor: "var(--power-accent-atwill-bg)"
    };
  }
  if (bucket === "encounter") {
    return {
      border: "1px solid var(--power-accent-encounter-border)",
      borderLeft: "6px solid var(--power-accent-encounter-bar)",
      backgroundColor: "var(--power-accent-encounter-bg)"
    };
  }
  if (bucket === "daily") {
    return {
      border: "1px solid var(--power-accent-daily-border)",
      borderLeft: "6px solid var(--power-accent-daily-bar)",
      backgroundColor: "var(--power-accent-daily-bg)"
    };
  }
  return {
    border: "1px solid var(--panel-border)",
    borderLeft: "6px solid var(--text-secondary)",
    backgroundColor: "var(--surface-1)"
  };
}

function formatValue(value: string | number | boolean | undefined | null): string {
  if (value === undefined || value === null || value === "") return "-";
  return String(value);
}

function formatStatLabel(label: string): string {
  return label
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isRenderableCardValue(value: string | undefined | null): boolean {
  const normalized = String(value ?? "").trim();
  if (!normalized) return false;
  return normalized.toLowerCase() !== "none";
}

function normalizeSemicolonWhitespace(value: string): string {
  return value.replace(/\s*;\s*/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeTextForDupCompare(value: string): string {
  return normalizeSemicolonWhitespace(value)
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function splitFailedEscapeAttemptSections(text: string): { mainText: string; failedEscapeTexts: string[] } {
  const raw = String(text || "").trim();
  if (!raw) return { mainText: "", failedEscapeTexts: [] };
  const marker = "Failed Escape Attempt:";
  const markerRegex = /Failed Escape Attempt:/gi;
  const matches = [...raw.matchAll(markerRegex)];
  if (matches.length === 0) {
    return { mainText: raw, failedEscapeTexts: [] };
  }

  const firstIndex = matches[0]?.index ?? 0;
  const mainText = raw.slice(0, firstIndex).trim().replace(/[;,:\s]+$/g, "").trim();
  const failedEscapeTexts: string[] = [];
  for (let idx = 0; idx < matches.length; idx += 1) {
    const start = matches[idx]?.index ?? 0;
    const end = idx + 1 < matches.length ? matches[idx + 1]?.index ?? raw.length : raw.length;
    const clause = raw.slice(start + marker.length, end).trim().replace(/[;,:\s]+$/g, "").trim();
    if (!clause) continue;
    if (!failedEscapeTexts.some((existing) => existing.toLowerCase() === clause.toLowerCase())) {
      failedEscapeTexts.push(clause);
    }
  }
  return { mainText, failedEscapeTexts };
}

function renderStatValue(
  value: unknown,
  startGlossaryHover: (event: ReactMouseEvent<HTMLElement>, key: MonsterGlossaryHoverKey) => void,
  leaveGlossaryHover: () => void
): JSX.Element {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span style={statEmptyPlaceholder}>-</span>;
    }
    return (
      <span style={{ display: "inline-grid", gap: "0.12rem", justifyItems: "end", textAlign: "right" }}>
        {value.map((entry, index) => {
          if (entry && typeof entry === "object" && !Array.isArray(entry)) {
            const entryRecord = entry as Record<string, unknown>;
            const movementType = String(entryRecord.type ?? "").trim();
            const movementValue = entryRecord.value;
            if (movementType) {
              return (
                <span key={`${movementType}-${index}`} style={{ whiteSpace: "nowrap" }}>
                  <span
                    onMouseEnter={(event) => startGlossaryHover(event, `glossaryTerm:${movementType}`)}
                    onMouseLeave={leaveGlossaryHover}
                    style={{ ...glossaryLinkUnderline, marginRight: "0.3rem" }}
                  >
                    {movementType}
                  </span>
                  <strong style={statValueStrong}>
                    {formatValue(movementValue as string | number | boolean | undefined | null)}
                  </strong>
                </span>
              );
            }
          }
          return (
            <span key={`array-entry-${index}`} style={{ whiteSpace: "nowrap" }}>
              <strong style={statValueStrong}>
                {formatValue(entry as string | number | boolean | undefined | null)}
              </strong>
            </span>
          );
        })}
      </span>
    );
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      return <span style={statEmptyPlaceholder}>-</span>;
    }
    return (
      <span style={{ display: "inline-grid", gap: "0.12rem", justifyItems: "end", textAlign: "right" }}>
        {entries.map(([nestedKey, nestedValue]) => (
          <span key={nestedKey} style={{ whiteSpace: "nowrap" }}>
            <span
              onMouseEnter={(event) => startGlossaryHover(event, `glossaryTerm:${formatStatLabel(nestedKey)}`)}
              onMouseLeave={leaveGlossaryHover}
              style={{ ...glossaryLinkUnderline, marginRight: "0.3rem" }}
            >
              {formatStatLabel(nestedKey)}
            </span>
            <strong style={statValueStrong}>{formatValue(nestedValue as string | number | boolean | undefined | null)}</strong>
          </span>
        ))}
      </span>
    );
  }
  return <span style={statValueStrong}>{formatValue(value as string | number | boolean | undefined | null)}</span>;
}

function sectionChildKeys(section: unknown): string[] {
  if (!section || typeof section !== "object") return [];
  const maybeChildren = (section as { children?: Record<string, unknown> }).children;
  if (!maybeChildren || typeof maybeChildren !== "object") return [];
  return Object.keys(maybeChildren);
}

function sectionObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function sectionArrayOfObjects(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => sectionObject(entry))
    .filter((entry) => Object.keys(entry).length > 0);
}

function weaknessLine(value: Record<string, unknown>): string {
  const rawAmount = value.amount;
  const amount = typeof rawAmount === "number" ? rawAmount : Number(rawAmount);
  const amountPart = Number.isFinite(amount) && amount !== 0 ? `${amount} ` : "";
  const namePart = String(value.name ?? "").trim();
  const detailsPart = String(value.details ?? "").trim();
  return `${amountPart}${namePart}${detailsPart ? ` ${detailsPart}` : ""}`.trim();
}

function renderTagList(values: string[] | undefined): string {
  if (!Array.isArray(values) || values.length === 0) return "-";
  return values.join(", ");
}

function renderTraitMetaBadges(trait: MonsterTrait): string[] {
  const badges: string[] = [];
  const type = String(trait.type ?? "").trim();
  if (type && type.toLowerCase() !== "trait") badges.push(type);
  if (Array.isArray(trait.keywords) && trait.keywords.length > 0) {
    for (const keyword of trait.keywords) {
      const token = String(keyword ?? "").trim();
      if (!token) continue;
      badges.push(token);
    }
  }
  return [...new Set(badges)];
}

function extractMovementEntries(activeMonster: MonsterEntryFile | null): Array<{ type: string; value: string | number }> {
  const rawMovement = activeMonster?.stats?.otherNumbers?.movement;
  if (!Array.isArray(rawMovement)) return [];
  return rawMovement
    .map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
      const record = entry as Record<string, unknown>;
      const type = String(record.type ?? "").trim();
      const valueRaw = record.value;
      const valueText = String(valueRaw ?? "").trim();
      if (!type || !valueText) return null;
      const numeric = typeof valueRaw === "number" ? valueRaw : Number(valueText);
      return { type, value: Number.isFinite(numeric) ? numeric : valueText };
    })
    .filter((entry): entry is { type: string; value: string | number } => entry !== null);
}

function statsDisplayOrder(label: string): number {
  const normalized = label.trim().toLowerCase();
  if (normalized === "skills") return 1;
  if (normalized === "defenses") return 2;
  return 0;
}

function splitPowerKeywords(rawKeywords: string): string[] {
  return rawKeywords
    .split(/[;,]/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function parseLevelFilter(rawFilter: string): { exact?: number; range?: { min: number; max: number } } {
  const trimmed = rawFilter.trim();
  if (!trimmed) return {};

  if (/^-?\d+$/.test(trimmed)) {
    return { exact: Number(trimmed) };
  }

  const rangeMatch = trimmed.match(/^(-?\d+)\s*-\s*(-?\d+)$/);
  if (rangeMatch) {
    const start = Number(rangeMatch[1]);
    const end = Number(rangeMatch[2]);
    if (Number.isFinite(start) && Number.isFinite(end)) {
      return { range: { min: Math.min(start, end), max: Math.max(start, end) } };
    }
  }

  return {};
}

function renderDamageSummary(damage?: MonsterPowerDamage): string {
  if (!damage) return "";
  const parts: string[] = [];
  if (Array.isArray(damage.expressions) && damage.expressions.length > 0) {
    parts.push(`Expr: ${damage.expressions.join(", ")}`);
  }
  if (damage.averageDamage !== undefined) parts.push(`Avg: ${damage.averageDamage}`);
  if (damage.damageType) parts.push(`Type: ${damage.damageType}`);
  if (damage.diceQuantity !== undefined && damage.diceSides !== undefined) {
    parts.push(`Dice: ${damage.diceQuantity}d${damage.diceSides}`);
  }
  if (damage.damageConstant !== undefined) parts.push(`Const: ${damage.damageConstant}`);
  if (damage.modifier) parts.push(`Mod: ${damage.modifier}`);
  return parts.join(" • ");
}

function renderAttackBonusLine(attack?: MonsterPowerAttack): string {
  if (!attack?.attackBonuses?.length) return "";
  return attack.attackBonuses
    .map((bonus) => `${bonus.bonus ?? "?"} vs ${(bonus.defense ?? "?").toString().toLowerCase()}`)
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
  const nestedAttackLines =
    outcome.nestedAttackDescriptions
      ?.map((entry) => normalizeSemicolonWhitespace(String(entry || "").trim()))
      .filter((text) => isRenderableCardValue(text)) ?? [];
  for (const nestedAttack of nestedAttackLines) {
    lines.push({ label: "NESTED ATTACK", text: nestedAttack });
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

function extractOngoingText(description: string | undefined): string {
  if (!isRenderableCardValue(description)) return "";
  const desc = String(description).trim();
  const ongoingMatch = desc.match(/\bongoing\b[:\s-]*(.*)$/i);
  if (!isRenderableCardValue(ongoingMatch?.[1])) return "";
  return String(ongoingMatch?.[1]).trim();
}

type MonsterPowerCardViewModel = {
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

function buildMonsterPowerCardViewModel(power: MonsterPower): MonsterPowerCardViewModel {
  const primaryAttack = power.attacks?.[0];
  const attackBonusLine = renderAttackBonusLine(primaryAttack);
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
      const secondaryBonusLine = renderAttackBonusLine(attack);
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

function renderOutcomeEntry(
  entry: MonsterPowerOutcomeEntry,
  idx: number,
  title: string,
  startGlossaryHover: (event: ReactMouseEvent<HTMLElement>, key: MonsterGlossaryHoverKey) => void,
  leaveGlossaryHover: () => void,
  shouldHighlightTerm: (term: string) => boolean
): JSX.Element {
  const damageSummary = renderDamageSummary(entry.damage);
  return (
    <div key={`${title}-${idx}`} style={{ borderLeft: "2px solid var(--panel-border)", paddingLeft: "0.45rem", marginTop: "0.3rem" }}>
      <div style={outcomeEntryTitleStyle}>{entry.name || entry.kind || title}</div>
      {entry.description ? (
        <div style={{ ...richTextBodyPrimary.paragraphStyle, margin: "0.1rem 0 0.2rem 0", whiteSpace: "pre-wrap" }}>
          {renderGlossaryAwareText(
            entry.description,
            commonDescriptiveGlossaryPhrases,
            startGlossaryHover,
            leaveGlossaryHover,
            `${title}-${idx}-entry-description`,
            shouldHighlightTerm
          )}
        </div>
      ) : null}
      {damageSummary ? <div style={captionMuted}>{damageSummary}</div> : null}
      {entry.aftereffects?.length ? (
        <div style={{ marginTop: "0.2rem" }}>
          <div style={microLabelStyle}>Aftereffects</div>
          {entry.aftereffects.map((nested, nestedIdx) =>
            renderOutcomeEntry(nested, nestedIdx, "Aftereffect", startGlossaryHover, leaveGlossaryHover, shouldHighlightTerm)
          )}
        </div>
      ) : null}
      {entry.sustains?.length ? (
        <div style={{ marginTop: "0.2rem" }}>
          <div style={microLabelStyle}>Sustains</div>
          {entry.sustains.map((nested, nestedIdx) =>
            renderOutcomeEntry(nested, nestedIdx, "Sustain", startGlossaryHover, leaveGlossaryHover, shouldHighlightTerm)
          )}
        </div>
      ) : null}
      {entry.failedSavingThrows?.length ? (
        <div style={{ marginTop: "0.2rem" }}>
          <div style={microLabelStyle}>Failed Saving Throws</div>
          {entry.failedSavingThrows.map((nested, nestedIdx) =>
            renderOutcomeEntry(nested, nestedIdx, "Failed Save", startGlossaryHover, leaveGlossaryHover, shouldHighlightTerm)
          )}
        </div>
      ) : null}
    </div>
  );
}

function renderAttackOutcome(
  label: "hit" | "miss" | "effect",
  outcome: MonsterPowerOutcome,
  startGlossaryHover: (event: ReactMouseEvent<HTMLElement>, key: MonsterGlossaryHoverKey) => void,
  leaveGlossaryHover: () => void,
  shouldHighlightTerm: (term: string) => boolean
): JSX.Element {
  const damageSummary = renderDamageSummary(outcome.damage);
  return (
    <div style={{ marginTop: "0.28rem" }}>
      <div style={outcomeSectionLabelStyle}>{label}</div>
      {outcome.description ? (
        <div style={{ ...richTextBodyPrimary.paragraphStyle, margin: "0.06rem 0 0.16rem 0", whiteSpace: "pre-wrap" }}>
          {renderGlossaryAwareText(
            outcome.description,
            commonDescriptiveGlossaryPhrases,
            startGlossaryHover,
            leaveGlossaryHover,
            `${label}-outcome-description`,
            shouldHighlightTerm
          )}
        </div>
      ) : null}
      {damageSummary ? <div style={captionMuted}>{damageSummary}</div> : null}
      {outcome.nestedAttackDescriptions?.length ? (
        <div style={{ ...bodySecondary, marginTop: "0.15rem" }}>
          {outcome.nestedAttackDescriptions.map((text, idx) => (
            <div key={`${label}-nested-${idx}`}>
              {renderGlossaryAwareText(
                text,
                commonDescriptiveGlossaryPhrases,
                startGlossaryHover,
                leaveGlossaryHover,
                `${label}-nested-${idx}`,
                shouldHighlightTerm
              )}
            </div>
          ))}
        </div>
      ) : null}
      {outcome.aftereffects?.length ? (
        <div style={{ marginTop: "0.18rem" }}>
          <div style={microLabelStyle}>Aftereffects</div>
          {outcome.aftereffects.map((entry, idx) =>
            renderOutcomeEntry(entry, idx, "Aftereffect", startGlossaryHover, leaveGlossaryHover, shouldHighlightTerm)
          )}
        </div>
      ) : null}
      {outcome.sustains?.length ? (
        <div style={{ marginTop: "0.18rem" }}>
          <div style={microLabelStyle}>Sustains</div>
          {outcome.sustains.map((entry, idx) =>
            renderOutcomeEntry(entry, idx, "Sustain", startGlossaryHover, leaveGlossaryHover, shouldHighlightTerm)
          )}
        </div>
      ) : null}
      {outcome.failedSavingThrows?.length ? (
        <div style={{ marginTop: "0.18rem" }}>
          <div style={microLabelStyle}>Failed Saving Throws</div>
          {outcome.failedSavingThrows.map((entry, idx) =>
            renderOutcomeEntry(entry, idx, "Failed Save", startGlossaryHover, leaveGlossaryHover, shouldHighlightTerm)
          )}
        </div>
      ) : null}
    </div>
  );
}

function renderPowerAttacks(
  power: MonsterPower,
  startGlossaryHover: (event: ReactMouseEvent<HTMLElement>, key: MonsterGlossaryHoverKey) => void,
  leaveGlossaryHover: () => void,
  shouldHighlightTerm: (term: string) => boolean
): JSX.Element | null {
  if (!power.attacks?.length) return null;
  return (
    <div style={{ marginTop: "0.3rem", display: "grid", gap: "0.35rem" }}>
      {power.attacks.map((attack: MonsterPowerAttack, attackIdx) => {
        const bonusText = (attack.attackBonuses ?? [])
          .map((bonus) => `${bonus.bonus ?? "?"} vs ${bonus.defense ?? "?"}`)
          .join(", ");
        return (
          <div key={`${power.name}-attack-${attackIdx}`} style={{ border: "1px solid var(--panel-border)", borderRadius: "0.32rem", padding: "0.35rem", backgroundColor: "var(--surface-1)" }}>
            <div style={{ ...bodyPrimary, fontWeight: 700 }}>
              {attack.name || `Attack ${attackIdx + 1}`}
              {attack.kind ? ` (${attack.kind})` : ""}
            </div>
            <div style={{ ...captionMuted, marginTop: "0.06rem" }}>
              {[attack.range, attack.targets, bonusText].filter(Boolean).join(" • ") || "No range/target/bonus details"}
            </div>
            {attack.hit ? renderAttackOutcome("hit", attack.hit, startGlossaryHover, leaveGlossaryHover, shouldHighlightTerm) : null}
            {attack.miss ? renderAttackOutcome("miss", attack.miss, startGlossaryHover, leaveGlossaryHover, shouldHighlightTerm) : null}
            {attack.effect ? renderAttackOutcome("effect", attack.effect, startGlossaryHover, leaveGlossaryHover, shouldHighlightTerm) : null}
          </div>
        );
      })}
    </div>
  );
}

function splitTooltipTerms(rawTerm: string): string[] {
  const term = rawTerm.trim();
  if (!term) return [];
  const attackVsMatch = term.match(/^(.+?)\s+vs\.?\s+(.+)$/i);
  if (attackVsMatch) {
    const left = attackVsMatch[1]?.trim();
    const right = attackVsMatch[2]?.trim();
    return [left, right].filter((part): part is string => Boolean(part));
  }
  return [term];
}

function findCaseInsensitiveMatches(text: string, query: string): number[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const haystack = text.toLowerCase();
  const matches: number[] = [];
  let start = 0;
  while (start < haystack.length) {
    const idx = haystack.indexOf(needle, start);
    if (idx === -1) break;
    matches.push(idx);
    start = idx + Math.max(1, needle.length);
  }
  return matches;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function splitByGlossaryPhrases(
  text: string,
  phrases: string[]
): Array<{ text: string; glossaryTerm?: string }> {
  const source = String(text || "");
  if (!source) return [{ text: "" }];
  const cleaned = [...new Set(phrases.map((phrase) => phrase.trim()).filter(Boolean))];
  if (cleaned.length === 0) return [{ text: source }];
  const sorted = [...cleaned].sort((a, b) => b.length - a.length);
  const regex = new RegExp(`\\b(${sorted.map((phrase) => escapeRegex(phrase)).join("|")})\\b`, "gi");
  const parts: Array<{ text: string; glossaryTerm?: string }> = [];
  let cursor = 0;
  let match = regex.exec(source);
  while (match) {
    const idx = match.index;
    const matchedText = match[0] ?? "";
    if (idx > cursor) {
      parts.push({ text: source.slice(cursor, idx) });
    }
    parts.push({ text: matchedText, glossaryTerm: matchedText });
    cursor = idx + matchedText.length;
    match = regex.exec(source);
  }
  if (cursor < source.length) {
    parts.push({ text: source.slice(cursor) });
  }
  return parts;
}

const traitDetailGlossaryPhrases: string[] = [
  "combat advantage",
  "difficult terrain",
  "saving throws",
  "saving throw",
  "ongoing damage",
  "hit points",
  "healing surge",
  "temporary hit points",
  "range",
  "aura",
  "weakened",
  "slowed",
  "dazed",
  "stunned",
  "dominated",
  "immobilized",
  "restrained",
  "blinded",
  "deafened",
  "prone",
  "marked",
  "grabbed",
  "charge attack",
  "charge",
  "shift",
  "shifts"
];

const commonDescriptiveGlossaryPhrases: string[] = [
  ...traitDetailGlossaryPhrases,
  "melee",
  "ranged",
  "close burst",
  "close blast",
  "opportunity attack",
  "immediate interrupt",
  "immediate reaction",
  "save ends",
  "bloodied",
  "critical hit",
  "ongoing",
  "push",
  "pull",
  "slide",
  "teleport"
];

function renderGlossaryAwareText(
  text: string,
  phrases: string[],
  startGlossaryHover: (event: ReactMouseEvent<HTMLElement>, key: MonsterGlossaryHoverKey) => void,
  leaveGlossaryHover: () => void,
  keyPrefix: string,
  shouldHighlightTerm: (term: string) => boolean
): JSX.Element {
  const parts = splitByGlossaryPhrases(text, phrases);
  return (
    <>
      {parts.map((part, idx) =>
        part.glossaryTerm && shouldHighlightTerm(part.glossaryTerm) ? (
          <span
            key={`${keyPrefix}-${idx}`}
            onMouseEnter={(event) => startGlossaryHover(event, `glossaryTerm:${part.glossaryTerm}`)}
            onMouseLeave={leaveGlossaryHover}
            style={glossaryLinkUnderline}
          >
            {part.text}
          </span>
        ) : (
          <span key={`${keyPrefix}-${idx}`}>{part.text}</span>
        )
      )}
    </>
  );
}

function scrollTextareaToMatch(textarea: HTMLTextAreaElement, text: string, matchStart: number): void {
  const prefix = text.slice(0, Math.max(0, matchStart));
  const lineNumber = prefix.split("\n").length - 1;
  const computed = window.getComputedStyle(textarea);
  const parsedLineHeight = Number.parseFloat(computed.lineHeight);
  const fallbackLineHeight = 16;
  const lineHeight = Number.isFinite(parsedLineHeight) && parsedLineHeight > 0 ? parsedLineHeight : fallbackLineHeight;
  const targetTop = Math.max(0, (lineNumber - 2) * lineHeight);
  textarea.scrollTop = targetTop;
}

type MonsterGlossaryHoverKey = `powerKeyword:${string}` | `glossaryTerm:${string}` | `glossaryTerms:${string}`;

export function MonsterEditorApp({
  index,
  tooltipGlossary
}: {
  index: RulesIndex;
  tooltipGlossary: Record<string, string>;
}): JSX.Element {
  const [indexRows, setIndexRows] = useState<MonsterIndexEntry[]>([]);
  const [activeMonster, setActiveMonster] = useState<MonsterEntryFile | null>(null);
  const [selectedId, setSelectedId] = useState<string>("");
  const [nameQuery, setNameQuery] = useState<string>("");
  const [levelQuery, setLevelQuery] = useState<string>("");
  const [roleQuery, setRoleQuery] = useState<string>("");
  const [leaderFilter, setLeaderFilter] = useState<"both" | "leader" | "notLeader">("both");
  const [sortBy, setSortBy] = useState<"name" | "level">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [message, setMessage] = useState<string>("Load monsters from generated JSON to begin.");
  const [isBusy, setIsBusy] = useState<boolean>(false);
  const [jsonSearchInput, setJsonSearchInput] = useState<string>("");
  const [jsonSearchQuery, setJsonSearchQuery] = useState<string>("");
  const [jsonSearchResultIdx, setJsonSearchResultIdx] = useState<number>(0);
  const [jsonSearchJumpTick, setJsonSearchJumpTick] = useState<number>(0);
  const [showGlossaryHoverInfo, setShowGlossaryHoverInfo] = useState(false);
  const [glossaryHoverKey, setGlossaryHoverKey] = useState<MonsterGlossaryHoverKey | null>(null);
  const [glossaryHoverPanelPos, setGlossaryHoverPanelPos] = useState<{
    top: number;
    left: number;
    transform?: "translateY(-100%)";
  } | null>(null);
  const glossaryHoverTimerRef = useRef<number | null>(null);
  const glossaryHoverCloseTimerRef = useRef<number | null>(null);
  const jsonTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const GLOSSARY_HOVER_CLOSE_DELAY_MS = 400;

  useEffect(() => {
    void (async () => {
      try {
        const rows = await loadMonsterIndex();
        setIndexRows(rows);
        if (rows.length > 0) {
          setSelectedId(rows[0].id);
          setMessage(`Loaded monster index (${rows.length} records).`);
        } else {
          setMessage("Monster index is empty.");
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Could not load monster index.");
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setIsBusy(true);
    void (async () => {
      try {
        const entry = await loadMonsterEntry(selectedId);
        setActiveMonster(entry);
      } catch (error) {
        setActiveMonster(null);
        setMessage(error instanceof Error ? error.message : "Could not load selected monster.");
      } finally {
        setIsBusy(false);
      }
    })();
  }, [selectedId]);

  useEffect(() => {
    return () => {
      if (glossaryHoverTimerRef.current != null) {
        window.clearTimeout(glossaryHoverTimerRef.current);
      }
      if (glossaryHoverCloseTimerRef.current != null) {
        window.clearTimeout(glossaryHoverCloseTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (glossaryHoverTimerRef.current != null) {
      window.clearTimeout(glossaryHoverTimerRef.current);
      glossaryHoverTimerRef.current = null;
    }
    if (glossaryHoverCloseTimerRef.current != null) {
      window.clearTimeout(glossaryHoverCloseTimerRef.current);
      glossaryHoverCloseTimerRef.current = null;
    }
    setShowGlossaryHoverInfo(false);
    setGlossaryHoverKey(null);
    setGlossaryHoverPanelPos(null);
  }, [selectedId]);

  const filteredRows = useMemo(() => {
    const nameNeedle = nameQuery.trim().toLowerCase();
    const roleNeedle = roleQuery.trim().toLowerCase();
    const rawLevelFilter = levelQuery.trim();
    const parsedLevelFilter = parseLevelFilter(rawLevelFilter);

    const rows = indexRows.filter((entry) => {
      if (nameNeedle && !entry.name.toLowerCase().includes(nameNeedle)) {
        return false;
      }

      if (roleNeedle && !entry.role.toLowerCase().includes(roleNeedle)) {
        return false;
      }

      const isLeader = entry.isLeader === true;
      if (leaderFilter === "leader" && !isLeader) {
        return false;
      }
      if (leaderFilter === "notLeader" && isLeader) {
        return false;
      }

      if (!rawLevelFilter) {
        return true;
      }

      const levelAsNumber = Number(entry.level);
      if (!Number.isFinite(levelAsNumber)) {
        return false;
      }

      if (parsedLevelFilter.exact !== undefined) {
        return levelAsNumber === parsedLevelFilter.exact;
      }
      if (parsedLevelFilter.range) {
        return levelAsNumber >= parsedLevelFilter.range.min && levelAsNumber <= parsedLevelFilter.range.max;
      }
      return false;
    });

    return [...rows].sort((a, b) => {
      if (sortBy === "level") {
        const levelA = Number(a.level);
        const levelB = Number(b.level);
        const hasLevelA = Number.isFinite(levelA);
        const hasLevelB = Number.isFinite(levelB);
        if (hasLevelA && hasLevelB && levelA !== levelB) {
          return sortDir === "asc" ? levelA - levelB : levelB - levelA;
        }
        if (hasLevelA !== hasLevelB) {
          return hasLevelA ? -1 : 1;
        }
      }

      const byName = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      if (byName !== 0) {
        return sortDir === "asc" ? byName : -byName;
      }
      return a.id.localeCompare(b.id, undefined, { sensitivity: "base" });
    });
  }, [indexRows, nameQuery, levelQuery, roleQuery, leaderFilter, sortBy, sortDir]);

  const roleOptions = useMemo(() => {
    const unique = new Set<string>();
    for (const row of indexRows) {
      const role = (row.role ?? "").trim();
      if (role) unique.add(role);
    }
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [indexRows]);

  const groupedPowers = useMemo(() => {
    const buckets: Record<MonsterPowerActionBucket, MonsterPower[]> = {
      standard: [],
      minor: [],
      triggered: [],
      other: []
    };
    if (!activeMonster) return buckets;
    for (const power of activeMonster.powers) {
      buckets[classifyMonsterPowerUsageBucket(power.action, power.trigger)].push(power);
    }
    return buckets;
  }, [activeMonster]);

  const rawJsonText = useMemo(() => JSON.stringify(activeMonster, null, 2), [activeMonster]);
  const jsonSearchMatches = useMemo(
    () => findCaseInsensitiveMatches(rawJsonText, jsonSearchQuery),
    [rawJsonText, jsonSearchQuery]
  );
  const glossaryResolutionCacheRef = useRef<Map<string, boolean>>(new Map());

  useEffect(() => {
    setJsonSearchResultIdx(0);
  }, [jsonSearchQuery, rawJsonText]);

  useEffect(() => {
    if (jsonSearchJumpTick === 0) return;
    if (!jsonSearchQuery.trim()) return;
    if (jsonSearchMatches.length === 0) return;
    const textarea = jsonTextareaRef.current;
    if (!textarea) return;
    const safeIdx = Math.min(jsonSearchResultIdx, jsonSearchMatches.length - 1);
    const start = jsonSearchMatches[safeIdx];
    const end = start + jsonSearchQuery.trim().length;
    textarea.focus();
    textarea.setSelectionRange(start, end);
    scrollTextareaToMatch(textarea, rawJsonText, start);
  }, [jsonSearchJumpTick, jsonSearchMatches, jsonSearchQuery, jsonSearchResultIdx, rawJsonText]);

  function monsterGlossaryContent(key: MonsterGlossaryHoverKey): JSX.Element {
    let terms: string[] = [];
    if (key.startsWith("powerKeyword:")) {
      const keyword = key.slice("powerKeyword:".length).trim();
      terms = [keyword, "Keyword"];
    } else if (key.startsWith("glossaryTerms:")) {
      const encoded = key.slice("glossaryTerms:".length).trim();
      terms = encoded
        .split("|")
        .map((token) => {
          try {
            return decodeURIComponent(token);
          } catch {
            return token;
          }
        })
        .map((term) => term.trim())
        .filter(Boolean);
    } else {
      const term = key.slice("glossaryTerm:".length).trim();
      terms = splitTooltipTerms(term);
    }
    const uniqueTerms = [...new Set(terms.filter(Boolean))];
    const resolvedEntries = uniqueTerms
      .map((term) => ({
        term,
        text: resolveTooltipText({ terms: [term], glossaryByName: tooltipGlossary, index })
      }))
      .filter((entry): entry is { term: string; text: string } => Boolean(entry.text));
    if (resolvedEntries.length === 1) {
      return <div style={{ whiteSpace: "pre-wrap" }}>{resolvedEntries[0].text}</div>;
    }
    if (resolvedEntries.length > 1) {
      return (
        <div style={{ display: "grid", gap: "0.35rem" }}>
          {resolvedEntries.map((entry) => (
            <div key={entry.term}>
              <div style={{ fontWeight: 700 }}>{entry.term}</div>
              <div style={{ whiteSpace: "pre-wrap" }}>{entry.text}</div>
            </div>
          ))}
        </div>
      );
    }
    return <div>No glossary entry found in `generated/glossary_terms.json` or `generated/rules_index.json`.</div>;
  }

  const shouldHighlightGlossaryTerm = useCallback(
    (term: string): boolean => {
      const normalized = term.trim().toLowerCase();
      if (!normalized) return false;
      const cached = glossaryResolutionCacheRef.current.get(normalized);
      if (cached !== undefined) return cached;
      const resolvedText = resolveTooltipText({ terms: splitTooltipTerms(term), glossaryByName: tooltipGlossary, index });
      const hasEntry = Boolean(resolvedText && resolvedText.trim().length > 0);
      glossaryResolutionCacheRef.current.set(normalized, hasEntry);
      return hasEntry;
    },
    [index, tooltipGlossary]
  );

  function cancelGlossaryHoverCloseTimer(): void {
    if (glossaryHoverCloseTimerRef.current != null) {
      window.clearTimeout(glossaryHoverCloseTimerRef.current);
      glossaryHoverCloseTimerRef.current = null;
    }
  }

  function hideGlossaryHoverNow(): void {
    cancelGlossaryHoverCloseTimer();
    if (glossaryHoverTimerRef.current != null) {
      window.clearTimeout(glossaryHoverTimerRef.current);
      glossaryHoverTimerRef.current = null;
    }
    setShowGlossaryHoverInfo(false);
    setGlossaryHoverKey(null);
    setGlossaryHoverPanelPos(null);
  }

  function startGlossaryHover(event: ReactMouseEvent<HTMLElement>, key: MonsterGlossaryHoverKey): void {
    cancelGlossaryHoverCloseTimer();
    const rect = event.currentTarget.getBoundingClientRect();
    setGlossaryHoverPanelPos(positionFixedTooltip(rect, { panelWidth: 340, maxHeightVh: 50 }));
    setGlossaryHoverKey(key);
    if (glossaryHoverTimerRef.current != null) {
      window.clearTimeout(glossaryHoverTimerRef.current);
    }
    glossaryHoverTimerRef.current = window.setTimeout(() => {
      setShowGlossaryHoverInfo(true);
      glossaryHoverTimerRef.current = null;
    }, 1000);
  }

  function leaveGlossaryHover(): void {
    cancelGlossaryHoverCloseTimer();
    glossaryHoverCloseTimerRef.current = window.setTimeout(() => {
      hideGlossaryHoverNow();
    }, GLOSSARY_HOVER_CLOSE_DELAY_MS);
  }

  return (
    <div
      style={{
        maxWidth: 1360,
        margin: "0 auto",
        padding: "0.75rem",
        color: "var(--text-primary)",
        background: "var(--character-sheet-background, linear-gradient(180deg, var(--surface-1) 0%, var(--surface-1) 100%))",
        border: "1px solid var(--panel-border)",
        borderRadius: "0.45rem"
      }}
    >
      <h1 style={pageTitleStyle}>Monster Sheet</h1>
      <p style={{ marginTop: 0, marginBottom: "0.5rem", color: "var(--text-muted)", fontSize: "0.8rem" }}>
        JSON-backed viewer for `generated/monsters` artifacts with formatted blocks for identity, stats, powers, and parsed
        sections.
      </p>

      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
        <button
          type="button"
          onClick={() => {
            setIsBusy(true);
            void loadMonsterIndex()
              .then((rows) => {
                setIndexRows(rows);
                if (!selectedId && rows.length > 0) {
                  setSelectedId(rows[0].id);
                }
                setMessage(`Reloaded generated index (${rows.length} records).`);
              })
              .catch((error: unknown) => {
                setMessage(error instanceof Error ? error.message : "Could not reload monster index.");
              })
              .finally(() => setIsBusy(false));
          }}
          disabled={isBusy}
        >
          Reload Generated Index
        </button>
        <input
          value={nameQuery}
          onChange={(event) => setNameQuery(event.target.value)}
          placeholder="Name"
          style={{ minWidth: 220, border: "1px solid var(--panel-border)", borderRadius: "0.28rem", padding: "0.22rem 0.3rem" }}
        />
        <input
          value={levelQuery}
          onChange={(event) => setLevelQuery(event.target.value)}
          placeholder="Level (e.g. 7 or 5-8)"
          style={{ minWidth: 200, border: "1px solid var(--panel-border)", borderRadius: "0.28rem", padding: "0.22rem 0.3rem" }}
        />
        <select
          value={roleQuery}
          onChange={(event) => setRoleQuery(event.target.value)}
          style={{ minWidth: 180, border: "1px solid var(--panel-border)", borderRadius: "0.28rem", padding: "0.22rem 0.3rem" }}
        >
          <option value="">All roles</option>
          {roleOptions.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
        <select
          value={leaderFilter}
          onChange={(event) => setLeaderFilter(event.target.value as "both" | "leader" | "notLeader")}
          style={{ minWidth: 150, border: "1px solid var(--panel-border)", borderRadius: "0.28rem", padding: "0.22rem 0.3rem" }}
        >
          <option value="both">-</option>
          <option value="leader">Leader</option>
          <option value="notLeader">Not leader</option>
        </select>
        <select
          value={sortBy}
          onChange={(event) => setSortBy(event.target.value as "name" | "level")}
          style={{ minWidth: 140, border: "1px solid var(--panel-border)", borderRadius: "0.28rem", padding: "0.22rem 0.3rem" }}
        >
          <option value="name">Sort: Name</option>
          <option value="level">Sort: Level</option>
        </select>
        <select
          value={sortDir}
          onChange={(event) => setSortDir(event.target.value as "asc" | "desc")}
          style={{ minWidth: 140, border: "1px solid var(--panel-border)", borderRadius: "0.28rem", padding: "0.22rem 0.3rem" }}
        >
          <option value="asc">Ascending</option>
          <option value="desc">Descending</option>
        </select>
      </div>

      <div
        style={{
          marginBottom: "0.75rem",
          fontSize: "0.8rem",
          color: message.toLowerCase().includes("could not") ? "var(--status-danger)" : "var(--text-muted)"
        }}
      >
        {message}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: "1rem", minHeight: "65vh" }}>
        <div
          style={{
            ...sheetPanel,
            overflow: "hidden",
            display: "grid",
            gridTemplateRows: "auto 1fr",
            minHeight: 0,
            maxHeight: "97.5vh"
          }}
        >
          <div style={indexColumnHeaderStyle}>Monsters ({filteredRows.length})</div>
          <div style={{ minHeight: 0, overflow: "auto" }}>
            {filteredRows.map((entry) => {
              const selectedRow = selectedId === entry.id;
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setSelectedId(entry.id)}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    border: "none",
                    borderBottom: "1px solid var(--surface-2)",
                    padding: "0.6rem 0.75rem",
                    background: selectedRow ? "var(--surface-2)" : "var(--surface-0)",
                    cursor: "pointer"
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{entry.name || entry.id}</div>
                  {entry.level && (
                    <div style={metaMuted}>
                      Level {entry.level}
                      {entry.role ? ` • ${entry.role}` : ""}
                    </div>
                  )}
                  {entry.parseError && <div style={{ ...metaMuted, color: "var(--status-danger)" }}>Invalid XML</div>}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ ...sheetPanel, padding: "0.75rem" }}>
          {!activeMonster ? (
            <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.8rem" }}>Select a monster to view its generated JSON data.</p>
          ) : (
            <>
              <div style={{ marginBottom: "0.75rem" }}>
                <div style={{ fontSize: "1.05rem", fontWeight: 700, letterSpacing: "0.04em", color: "var(--text-primary)" }}>{activeMonster.name}</div>
                <div style={{ ...bodySecondary, marginTop: "0.12rem" }}>
                  <span
                    onMouseEnter={(event) => startGlossaryHover(event, "glossaryTerm:Level")}
                    onMouseLeave={leaveGlossaryHover}
                    style={glossaryLinkUnderline}
                  >
                    Level
                  </span>{" "}
                  {formatValue(activeMonster.level)}{" "}
                  <span
                    onMouseEnter={(event) =>
                      startGlossaryHover(event, `glossaryTerm:${activeMonster.role || "Role"}`)
                    }
                    onMouseLeave={leaveGlossaryHover}
                    style={glossaryLinkUnderline}
                  >
                    {activeMonster.role || ""}
                  </span>
                </div>
                <div style={{ ...bodySecondary, marginTop: "0.12rem" }}>
                  <span
                    onMouseEnter={(event) =>
                      startGlossaryHover(event, `glossaryTerm:${activeMonster.size || "Size"}`)
                    }
                    onMouseLeave={leaveGlossaryHover}
                    style={glossaryLinkUnderline}
                  >
                    {activeMonster.size || "Unknown size"}
                  </span>{" "}
                  •{" "}
                  <span
                    onMouseEnter={(event) =>
                      startGlossaryHover(event, `glossaryTerm:${activeMonster.origin || "Origin"}`)
                    }
                    onMouseLeave={leaveGlossaryHover}
                    style={glossaryLinkUnderline}
                  >
                    {activeMonster.origin || "Unknown origin"}
                  </span>{" "}
                  •{" "}
                  <span
                    onMouseEnter={(event) =>
                      startGlossaryHover(event, `glossaryTerm:${activeMonster.type || "Type"}`)
                    }
                    onMouseLeave={leaveGlossaryHover}
                    style={glossaryLinkUnderline}
                  >
                    {activeMonster.type || "Unknown type"}
                  </span>{" "}
                  •{" "}
                  <span
                    onMouseEnter={(event) => startGlossaryHover(event, "glossaryTerm:Experience")}
                    onMouseLeave={leaveGlossaryHover}
                    style={glossaryLinkUnderline}
                  >
                    XP
                  </span>{" "}
                  {formatValue(activeMonster.xp)}
                </div>
                {isRenderableCardValue(activeMonster.groupRole) ? (
                  <div style={{ ...bodySecondary, marginTop: "0.12rem" }}>
                    Group Role: {String(activeMonster.groupRole)}
                  </div>
                ) : null}
              </div>

              {activeMonster.parseError && (
                <div
                  style={{
                    marginTop: "0.5rem",
                    border: "1px solid var(--status-danger)",
                    backgroundColor: "#fef2f2",
                    color: "var(--status-danger)",
                    padding: "0.45rem 0.55rem",
                    borderRadius: 6
                  }}
                >
                  Parse error: {activeMonster.parseError}
                </div>
              )}

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, minmax(180px, 1fr))",
                  gap: "0.75rem",
                  marginBottom: "0.75rem"
                }}
              >
                <div style={{ border: "1px solid var(--panel-border)", borderRadius: 6, padding: "0.6rem", background: "var(--surface-1)" }}>
                  <div style={microLabelStyle}>Name</div>
                  <div style={identityValueStyle}>{activeMonster.name}</div>
                </div>
                <div style={{ border: "1px solid var(--panel-border)", borderRadius: 6, padding: "0.6rem", background: "var(--surface-1)" }}>
                  <div
                    onMouseEnter={(event) => startGlossaryHover(event, "glossaryTerm:Role")}
                    onMouseLeave={leaveGlossaryHover}
                    style={microLabelInteractive}
                  >
                    Role
                  </div>
                  <div style={identityValueRowWithPill}>
                    <span
                      onMouseEnter={(event) =>
                        startGlossaryHover(event, `glossaryTerm:${activeMonster.role || "Role"}`)
                      }
                      onMouseLeave={leaveGlossaryHover}
                      style={identityValueInteractive}
                    >
                      {formatValue(activeMonster.role)}
                    </span>
                    {activeMonster.isLeader ? (
                      <span
                        onMouseEnter={(event) => startGlossaryHover(event, "glossaryTerm:Leader")}
                        onMouseLeave={leaveGlossaryHover}
                        style={sheetTagPillStyle}
                      >
                        Leader
                      </span>
                    ) : null}
                  </div>
                </div>
                <div style={{ border: "1px solid var(--panel-border)", borderRadius: 6, padding: "0.6rem", background: "var(--surface-1)" }}>
                  <div
                    onMouseEnter={(event) => startGlossaryHover(event, "glossaryTerm:Level")}
                    onMouseLeave={leaveGlossaryHover}
                    style={microLabelInteractive}
                  >
                    Level / XP
                  </div>
                  <div
                    onMouseEnter={(event) => startGlossaryHover(event, "glossaryTerm:Level")}
                    onMouseLeave={leaveGlossaryHover}
                    style={identityValueInteractive}
                  >
                    {formatValue(activeMonster.level)} / {formatValue(activeMonster.xp)}
                  </div>
                </div>
                <div style={{ border: "1px solid var(--panel-border)", borderRadius: 6, padding: "0.6rem", background: "var(--surface-1)" }}>
                  <div
                    onMouseEnter={(event) => startGlossaryHover(event, "glossaryTerm:Size")}
                    onMouseLeave={leaveGlossaryHover}
                    style={microLabelInteractive}
                  >
                    Size
                  </div>
                  <div
                    onMouseEnter={(event) =>
                      startGlossaryHover(event, `glossaryTerm:${activeMonster.size || "Size"}`)
                    }
                    onMouseLeave={leaveGlossaryHover}
                    style={identityValueInteractive}
                  >
                    {formatValue(activeMonster.size)}
                  </div>
                </div>
                <div style={{ border: "1px solid var(--panel-border)", borderRadius: 6, padding: "0.6rem", background: "var(--surface-1)" }}>
                  <div
                    onMouseEnter={(event) => startGlossaryHover(event, "glossaryTerm:Origin")}
                    onMouseLeave={leaveGlossaryHover}
                    style={microLabelInteractive}
                  >
                    Origin
                  </div>
                  <div
                    onMouseEnter={(event) =>
                      startGlossaryHover(event, `glossaryTerm:${activeMonster.origin || "Origin"}`)
                    }
                    onMouseLeave={leaveGlossaryHover}
                    style={identityValueInteractive}
                  >
                    {formatValue(activeMonster.origin)}
                  </div>
                </div>
                <div style={{ border: "1px solid var(--panel-border)", borderRadius: 6, padding: "0.6rem", background: "var(--surface-1)" }}>
                  <div
                    onMouseEnter={(event) => startGlossaryHover(event, "glossaryTerm:Type")}
                    onMouseLeave={leaveGlossaryHover}
                    style={microLabelInteractive}
                  >
                    Type
                  </div>
                  <div
                    onMouseEnter={(event) =>
                      startGlossaryHover(event, `glossaryTerm:${activeMonster.type || "Type"}`)
                    }
                    onMouseLeave={leaveGlossaryHover}
                    style={identityValueInteractive}
                  >
                    {formatValue(activeMonster.type)}
                  </div>
                </div>
              </div>

              {(() => {
                const movementEntries = extractMovementEntries(activeMonster);
                const showPhasing = activeMonster.phasing === true;
                if (movementEntries.length === 0 && !showPhasing) return null;
                return (
                  <div style={{ ...panelStyle, padding: "0.5rem", marginBottom: "0.75rem" }}>
                    <h3 style={sectionTitleStyle}>Movement</h3>
                    <div style={{ marginTop: "0.35rem", display: "grid", gap: "0.24rem" }}>
                      {movementEntries.map((entry, idx) => (
                        <div key={`movement-${idx}`} style={bodyPrimary}>
                          <strong>{entry.type}:</strong> {String(entry.value)}
                        </div>
                      ))}
                      {showPhasing ? (
                        <div style={{ ...bodyPrimary, display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
                          <span
                            onMouseEnter={(event) => startGlossaryHover(event, "glossaryTerm:Phasing")}
                            onMouseLeave={leaveGlossaryHover}
                            style={sheetTagPillStyle}
                          >
                            Phasing
                          </span>
                          <span>Can move through obstacles and creatures.</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })()}

              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(280px, 1fr))", gap: "0.75rem", marginBottom: "0.75rem" }}>
                {Object.entries(activeMonster.stats)
                  .filter(([label]) => label !== "attackBonuses")
                  .sort(([labelA], [labelB]) => {
                    const orderA = statsDisplayOrder(labelA);
                    const orderB = statsDisplayOrder(labelB);
                    if (orderA !== orderB) return orderA - orderB;
                    return 0;
                  })
                  .map(([label, block]) => (
                  <div key={label} style={statPanelStyle}>
                    <h3 style={sectionTitleStyle}>{formatStatLabel(label)}</h3>
                    <div style={{ marginTop: "0.45rem", ...bodySecondary, display: "grid", gap: "0.2rem" }}>
                      {Object.keys(block).filter((k) => !(label === "otherNumbers" && k === "movement")).length === 0
                        ? "No values"
                        : Object.entries(block)
                            .filter(([k]) => !(label === "otherNumbers" && k === "movement"))
                            .map(([k, v], idx) => (
                            <div
                              key={k}
                              style={{
                                display: "grid",
                                gridTemplateColumns: "1fr auto",
                                alignItems: "center",
                                columnGap: "0.5rem",
                                fontVariantNumeric: "tabular-nums",
                                padding: "0.22rem 0.35rem",
                                borderRadius: "0.25rem",
                                backgroundColor: idx % 2 === 0 ? "var(--table-stripe-even)" : "var(--table-stripe-odd)"
                              }}
                            >
                              <span
                                onMouseEnter={(event) => startGlossaryHover(event, `glossaryTerm:${formatStatLabel(k)}`)}
                                onMouseLeave={leaveGlossaryHover}
                                style={{
                                  cursor: "help",
                                  borderBottom: "1px dotted var(--text-muted)",
                                  color: "var(--text-primary)",
                                  fontWeight: 600,
                                  width: "fit-content"
                                }}
                              >
                                {formatStatLabel(k)}
                              </span>
                              {renderStatValue(v, startGlossaryHover, leaveGlossaryHover)}
                            </div>
                            ))}
                      {label === "defenses" ? (
                        <>
                          {Array.isArray(activeMonster.immunities) && activeMonster.immunities.length > 0 ? (
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "1fr auto",
                                alignItems: "center",
                                columnGap: "0.5rem",
                                fontVariantNumeric: "tabular-nums",
                                padding: "0.22rem 0.35rem",
                                borderRadius: "0.25rem",
                                backgroundColor: "var(--table-stripe-even)"
                              }}
                            >
                              <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>Immunities</span>
                              <strong style={statValueStrong}>{renderTagList(activeMonster.immunities)}</strong>
                            </div>
                          ) : null}
                          {Array.isArray(activeMonster.resistances) && activeMonster.resistances.length > 0 ? (
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "1fr auto",
                                alignItems: "center",
                                columnGap: "0.5rem",
                                fontVariantNumeric: "tabular-nums",
                                padding: "0.22rem 0.35rem",
                                borderRadius: "0.25rem",
                                backgroundColor: "var(--table-stripe-odd)"
                              }}
                            >
                              <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>Resists</span>
                              <strong style={statValueStrong}>
                                {activeMonster.resistances
                                  .map((resistance) => weaknessLine(resistance as Record<string, unknown>))
                                  .filter(Boolean)
                                  .join(", ")}
                              </strong>
                            </div>
                          ) : null}
                          {Array.isArray(activeMonster.weaknesses) && activeMonster.weaknesses.length > 0 ? (
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "1fr auto",
                                alignItems: "center",
                                columnGap: "0.5rem",
                                fontVariantNumeric: "tabular-nums",
                                padding: "0.22rem 0.35rem",
                                borderRadius: "0.25rem",
                                backgroundColor: "var(--table-stripe-even)"
                              }}
                            >
                              <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>Vulnerabilities</span>
                              <strong style={statValueStrong}>
                                {activeMonster.weaknesses
                                  .map((weakness) => weaknessLine(weakness as Record<string, unknown>))
                                  .filter(Boolean)
                                  .join(", ")}
                              </strong>
                            </div>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>

              {isRenderableCardValue(activeMonster.tactics) ? (
                <div style={{ ...panelStyle, padding: "0.5rem", marginBottom: "0.75rem" }}>
                  <h3 style={sectionTitleStyle}>Tactics</h3>
                  <div style={{ ...richTextBodyPrimary.paragraphStyle, whiteSpace: "pre-wrap" }}>
                    {renderGlossaryAwareText(
                      String(activeMonster.tactics),
                      commonDescriptiveGlossaryPhrases,
                      startGlossaryHover,
                      leaveGlossaryHover,
                      "tactics",
                      shouldHighlightGlossaryTerm
                    )}
                  </div>
                </div>
              ) : null}

              {Array.isArray(activeMonster.auras) && activeMonster.auras.length > 0 ? (
                <div style={{ ...panelStyle, padding: "0.5rem", marginBottom: "0.75rem" }}>
                  <h3 style={sectionTitleStyle}>Auras</h3>
                  <div style={{ marginTop: "0.35rem", display: "grid", gap: "0.2rem" }}>
                    {activeMonster.auras.map((aura, idx) => (
                      <div key={`aura-${idx}`} style={{ ...bodyPrimary, display: "grid", gap: "0.2rem" }}>
                        <div>
                          {(() => {
                            const name = String(aura.name ?? "").trim();
                            const details = String(aura.details ?? "").trim();
                            const rangeValue = aura.range;
                            const rangeText =
                              rangeValue !== undefined && rangeValue !== null && String(rangeValue).trim() !== ""
                                ? `Range ${String(rangeValue).trim()}`
                                : "";
                            const heading = [name, rangeText].filter(Boolean).join(" • ");
                            const detailParts = splitByGlossaryPhrases(details, traitDetailGlossaryPhrases);
                            return (
                              <>
                                {heading ? `${heading}: ` : ""}
                                {detailParts.map((part, partIdx) =>
                                  part.glossaryTerm && shouldHighlightGlossaryTerm(part.glossaryTerm) ? (
                                    <span
                                      key={`aura-${idx}-detail-${partIdx}`}
                                      onMouseEnter={(event) => startGlossaryHover(event, `glossaryTerm:${part.glossaryTerm}`)}
                                      onMouseLeave={leaveGlossaryHover}
                                      style={glossaryLinkUnderline}
                                    >
                                      {part.text}
                                    </span>
                                  ) : (
                                    <span key={`aura-${idx}-detail-${partIdx}`}>{part.text}</span>
                                  )
                                )}
                              </>
                            );
                          })()}
                        </div>
                        {(() => {
                          const badges = renderTraitMetaBadges(aura);
                          if (badges.length === 0) return null;
                          return (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                              {badges.map((badge) => (
                                shouldHighlightGlossaryTerm(badge) ? (
                                  <span
                                    key={`aura-${idx}-${badge}`}
                                    onMouseEnter={(event) => startGlossaryHover(event, `glossaryTerm:${badge}`)}
                                    onMouseLeave={leaveGlossaryHover}
                                    style={sheetTagPillStyle}
                                  >
                                    {badge}
                                  </span>
                                ) : (
                                  <span key={`aura-${idx}-${badge}`} style={{ ...sheetTagPillStyle, cursor: "default" }}>
                                    {badge}
                                  </span>
                                )
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {Array.isArray(activeMonster.traits) && activeMonster.traits.length > 0 ? (
                <div style={{ ...panelStyle, padding: "0.5rem", marginBottom: "0.75rem" }}>
                  <h3 style={sectionTitleStyle}>Traits</h3>
                  <div style={{ marginTop: "0.35rem", display: "grid", gap: "0.2rem" }}>
                    {activeMonster.traits.map((trait, idx) => (
                      <div key={`trait-${idx}`} style={{ ...bodyPrimary, display: "grid", gap: "0.2rem" }}>
                        <div>
                          {(() => {
                            const name = String(trait.name ?? "").trim();
                            const details = String(trait.details ?? "").trim();
                            const rangeValue = trait.range;
                            const rangeText =
                              rangeValue !== undefined && rangeValue !== null && String(rangeValue).trim() !== ""
                                ? `Range ${String(rangeValue).trim()}`
                                : "";
                            const heading = [name, rangeText].filter(Boolean).join(" • ");
                            const detailParts = splitByGlossaryPhrases(details, traitDetailGlossaryPhrases);
                            return (
                              <>
                                {heading ? `${heading}: ` : ""}
                                {detailParts.map((part, partIdx) =>
                                  part.glossaryTerm && shouldHighlightGlossaryTerm(part.glossaryTerm) ? (
                                    <span
                                      key={`trait-${idx}-detail-${partIdx}`}
                                      onMouseEnter={(event) => startGlossaryHover(event, `glossaryTerm:${part.glossaryTerm}`)}
                                      onMouseLeave={leaveGlossaryHover}
                                      style={glossaryLinkUnderline}
                                    >
                                      {part.text}
                                    </span>
                                  ) : (
                                    <span key={`trait-${idx}-detail-${partIdx}`}>{part.text}</span>
                                  )
                                )}
                              </>
                            );
                          })()}
                        </div>
                        {(() => {
                          const badges = renderTraitMetaBadges(trait);
                          if (badges.length === 0) return null;
                          return (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                              {badges.map((badge) => (
                                shouldHighlightGlossaryTerm(badge) ? (
                                  <span
                                    key={`trait-${idx}-${badge}`}
                                    onMouseEnter={(event) => startGlossaryHover(event, `glossaryTerm:${badge}`)}
                                    onMouseLeave={leaveGlossaryHover}
                                    style={sheetTagPillStyle}
                                  >
                                    {badge}
                                  </span>
                                ) : (
                                  <span key={`trait-${idx}-${badge}`} style={{ ...sheetTagPillStyle, cursor: "default" }}>
                                    {badge}
                                  </span>
                                )
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {Array.isArray(activeMonster.senses) && activeMonster.senses.length > 0 ? (
                <div style={{ ...panelStyle, padding: "0.5rem", marginBottom: "0.75rem" }}>
                  <h3 style={sectionTitleStyle}>Senses</h3>
                  <div style={{ marginTop: "0.35rem", display: "grid", gap: "0.24rem" }}>
                    {activeMonster.senses
                      .map((sense) => {
                        const name = String(sense.name ?? "").trim();
                        const range = sense.range;
                        if (!name) return "";
                        return range !== undefined && range !== null && range !== "" ? `${name} ${range}` : name;
                      })
                      .filter(Boolean)
                      .map((line, idx) => (
                        <div
                          key={`sense-${idx}`}
                          onMouseEnter={(event) =>
                            startGlossaryHover(event, `glossaryTerm:${String(activeMonster.senses?.[idx]?.name ?? "Senses")}`)
                          }
                          onMouseLeave={leaveGlossaryHover}
                          style={{ ...bodyPrimary, ...glossaryLinkUnderline, width: "fit-content" }}
                        >
                          {line}
                        </div>
                      ))}
                  </div>
                </div>
              ) : null}

              {(activeMonster.alignment?.name || isRenderableCardValue(activeMonster.description)) ? (
                <div style={{ ...panelStyle, padding: "0.5rem", marginBottom: "0.75rem" }}>
                  <h3 style={sectionTitleStyle}>Details</h3>
                  <div style={{ marginTop: "0.35rem", display: "grid", gap: "0.3rem" }}>
                    {activeMonster.alignment?.name ? (
                      <div style={bodyPrimary}>
                        <strong>Alignment:</strong> {activeMonster.alignment.name}
                      </div>
                    ) : null}
                    <div style={bodyPrimary}>
                      <strong>Languages:</strong> {renderTagList(activeMonster.languages)}
                    </div>
                    <div style={bodyPrimary}>
                      <strong>Keywords:</strong> {renderTagList(activeMonster.keywords)}
                    </div>
                    {Array.isArray(activeMonster.sourceBooks) && activeMonster.sourceBooks.length > 0 ? (
                      <div style={bodyPrimary}>
                        <strong>Sources:</strong> {activeMonster.sourceBooks.join(", ")}
                      </div>
                    ) : null}
                    {activeMonster.regeneration !== undefined && activeMonster.regeneration !== null && activeMonster.regeneration !== "" ? (
                      <div style={bodyPrimary}>
                        <strong>Regeneration:</strong> {String(activeMonster.regeneration)}
                      </div>
                    ) : null}
                    {isRenderableCardValue(activeMonster.description) ? (
                      <div style={{ ...richTextBodyPrimary.paragraphStyle, margin: "0.2rem 0 0 0", whiteSpace: "pre-wrap" }}>
                        {renderGlossaryAwareText(
                          String(activeMonster.description),
                          commonDescriptiveGlossaryPhrases,
                          startGlossaryHover,
                          leaveGlossaryHover,
                          "details-description",
                          shouldHighlightGlossaryTerm
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {(() => {
                const items = sectionArrayOfObjects(activeMonster.items);
                if (items.length === 0) return null;
                return (
                  <div style={{ ...panelStyle, padding: "0.5rem", marginBottom: "0.75rem" }}>
                    <h3 style={sectionTitleStyle}>Items</h3>
                    <div style={{ marginTop: "0.4rem", display: "grid", gap: "0.35rem" }}>
                      {items.map((item, idx) => {
                        const quantity = item.quantity;
                        const name = String(item.name ?? "").trim();
                        const id = String(item.id ?? "").trim();
                        const description = String(item.description ?? "").trim();
                        return (
                          <div key={`item-${idx}`} style={{ border: "1px solid var(--panel-border)", borderRadius: "0.3rem", padding: "0.4rem", backgroundColor: "var(--surface-1)" }}>
                            <div style={bodyPrimary}>
                              <strong>{name || "Item"}</strong>
                              {quantity !== undefined && quantity !== null && quantity !== "" ? ` x${quantity}` : ""}
                              {id ? <span style={{ color: "var(--text-muted)" }}> ({id})</span> : null}
                            </div>
                            {isRenderableCardValue(description) ? (
                              <details style={{ marginTop: "0.22rem" }}>
                                <summary style={detailsSummaryStyle}>Description</summary>
                                <div style={{ fontSize: "0.8rem", color: "var(--text-primary)", margin: "0.24rem 0 0 0", whiteSpace: "pre-wrap" }}>
                                  {renderGlossaryAwareText(
                                    description,
                                    commonDescriptiveGlossaryPhrases,
                                    startGlossaryHover,
                                    leaveGlossaryHover,
                                    `item-${idx}-description`,
                                    shouldHighlightGlossaryTerm
                                  )}
                                </div>
                              </details>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              <div
                style={{
                  ...panelStyle,
                  borderColor: "var(--panel-border-strong)",
                  padding: "0.5rem",
                  marginBottom: "0.75rem"
                }}
              >
                <h3 style={sectionTitleStyle}>Powers ({activeMonster.powers.length})</h3>
                <div style={{ marginTop: "0.5rem", display: "grid", gap: "0.6rem" }}>
                  {activeMonster.powers.length === 0 ? <div style={metaMuted}>No powers parsed.</div> : null}
                  {(["standard", "minor", "triggered", "other"] as const).map((bucket) => {
                    const bucketPowers = groupedPowers[bucket];
                    if (bucketPowers.length === 0) return null;
                    return (
                      <div key={bucket} style={{ display: "grid", gap: "0.4rem" }}>
                        <div style={powerBucketHeaderStyle}>{usageBucketLabel(bucket)}</div>
                        <div style={{ display: "grid", gap: "0.45rem", gridTemplateColumns: "minmax(0, 1fr)", alignItems: "stretch" }}>
                          {bucketPowers.map((power, index) => {
                            const colorBucket = classifyMonsterPowerColorBucket(power.usage);
                            const accent = usageColorAccentCardStyle(colorBucket);
                            const cardModel = buildMonsterPowerCardViewModel(power);
                      return (
                            <div
                              key={`${bucket}-${power.name}-${index}`}
                              style={{
                                border: accent.border,
                                borderLeft: accent.borderLeft,
                                borderRadius: "8px",
                                padding: "0.55rem 0.65rem",
                                backgroundColor: accent.backgroundColor,
                                boxShadow: `inset 0 0 0 1px ${usageColorAccentColor(colorBucket)}33`,
                                height: "100%",
                                boxSizing: "border-box",
                                display: "flex",
                                flexDirection: "column"
                              }}
                            >
                          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "0.35rem" }}>
                            <strong>{power.name || `Power ${index + 1}`}</strong>
                            {power.isBasic ? <span style={{ ...sheetTagPillStyle, cursor: "default" }}>Basic Attack</span> : null}
                          </div>
                          {cardModel.usagePrimaryParts.length > 0 ? (
                            <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "0.12rem" }}>
                              {cardModel.usagePrimaryParts.map((part, partIdx) => (
                                <span key={`${power.name}-${index}-usage-${part}`}>
                                  <span
                                    onMouseEnter={(event) => startGlossaryHover(event, `glossaryTerm:${part}`)}
                                    onMouseLeave={leaveGlossaryHover}
                                    style={{
                                      fontWeight: 700,
                                      color: "var(--text-primary)",
                                      cursor: "help",
                                      borderBottom: "1px dotted var(--text-muted)",
                                      textTransform: "uppercase",
                                      letterSpacing: "0.03em"
                                    }}
                                  >
                                    {part}
                                  </span>
                                  {partIdx < cardModel.usagePrimaryParts.length - 1 ? (
                                    <span style={{ color: "var(--text-muted)", margin: "0 0.1rem" }}>•</span>
                                  ) : null}
                                </span>
                              ))}
                              {cardModel.usageDetailsLines.length > 0 ? (
                                <div style={{ marginTop: "0.1rem", ...metaSecondary }}>
                                  {cardModel.usageDetailsLines.map((line, lineIdx) => (
                                    <div key={`${power.name}-${index}-usage-details-${lineIdx}`}>{line}</div>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                          {cardModel.attackLineParts.length > 0 ? (
                            <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "0.05rem", display: "flex", flexWrap: "wrap", gap: "0.22rem", alignItems: "center" }}>
                              {cardModel.attackLineParts.map((part, partIdx) => (
                                <span key={`${power.name}-${index}-attackline-${partIdx}`}>
                                  <span
                                    onMouseEnter={(event) => startGlossaryHover(event, `glossaryTerm:${part}`)}
                                    onMouseLeave={leaveGlossaryHover}
                                    style={{
                                      cursor: "help",
                                      borderBottom: "1px dotted var(--text-muted)",
                                      color: "var(--text-primary)"
                                    }}
                                  >
                                    {part}
                                  </span>
                                  {partIdx < cardModel.attackLineParts.length - 1 ? <span style={{ color: "var(--text-muted)", margin: "0 0.1rem" }}>•</span> : null}
                                </span>
                              ))}
                            </div>
                          ) : null}
                            {cardModel.keywordTokens.length > 0 ? (
                            <div style={{ ...bodySecondary, color: "var(--text-muted)", marginBottom: "0.25rem" }}>
                              <strong>Keywords:</strong>{" "}
                              {cardModel.keywordTokens.map((keyword, idx) => (
                                <span key={`${power.name}-${index}-kw-${keyword}`}>
                                  <span
                                    onMouseEnter={(event) => startGlossaryHover(event, `powerKeyword:${keyword}`)}
                                    onMouseLeave={leaveGlossaryHover}
                                    style={{
                                      color: "var(--text-primary)",
                                      cursor: "help",
                                      borderBottom: "1px dotted var(--text-muted)"
                                    }}
                                  >
                                    {keyword}
                                  </span>
                                  {idx < cardModel.keywordTokens.length - 1 ? <span> </span> : null}
                                </span>
                              ))}
                            </div>
                          ) : null}
                          <div style={{ marginTop: "0.22rem", display: "grid", gap: "0.14rem" }}>
                            {cardModel.outcomeLines.map((line) => (
                              <div key={`${power.name}-${index}-${line.label}-${line.text}`} style={{ fontSize: "0.8rem", color: "var(--text-primary)" }}>
                                {(() => {
                                  const split = splitFailedEscapeAttemptSections(line.text);
                                  return (
                                    <>
                                      {isRenderableCardValue(split.mainText) ? (
                                        <div>
                                          <strong>{line.label}:</strong>{" "}
                                          {renderGlossaryAwareText(
                                            split.mainText,
                                            commonDescriptiveGlossaryPhrases,
                                            startGlossaryHover,
                                            leaveGlossaryHover,
                                            `${power.name}-${index}-${line.label}-main`,
                                            shouldHighlightGlossaryTerm
                                          )}
                                        </div>
                                      ) : (
                                        <div>
                                          <strong>{line.label}:</strong>{" "}
                                          {renderGlossaryAwareText(
                                            line.text,
                                            commonDescriptiveGlossaryPhrases,
                                            startGlossaryHover,
                                            leaveGlossaryHover,
                                            `${power.name}-${index}-${line.label}-fallback`,
                                            shouldHighlightGlossaryTerm
                                          )}
                                        </div>
                                      )}
                                      {split.failedEscapeTexts.map((failedText) => (
                                        <div key={`${power.name}-${index}-${line.label}-failed-${failedText}`} style={{ marginTop: "0.04rem" }}>
                                          <strong>Failed Escape Attempt:</strong>{" "}
                                          {renderGlossaryAwareText(
                                            failedText,
                                            commonDescriptiveGlossaryPhrases,
                                            startGlossaryHover,
                                            leaveGlossaryHover,
                                            `${power.name}-${index}-${line.label}-failed`,
                                            shouldHighlightGlossaryTerm
                                          )}
                                        </div>
                                      ))}
                                    </>
                                  );
                                })()}
                              </div>
                            ))}
                          </div>
                          {cardModel.secondaryAttacks.length > 0 ? (
                            <div
                              style={{
                                marginTop: "0.28rem",
                                marginLeft: "0.55rem",
                                paddingLeft: "0.55rem",
                                borderLeft: "2px solid var(--panel-border)"
                              }}
                            >
                              {cardModel.secondaryAttacks.map((secondaryAttack, secondaryIndex) => (
                                <div key={`${power.name}-${index}-secondary-${secondaryIndex}`} style={{ marginTop: secondaryIndex === 0 ? 0 : "0.3rem" }}>
                                  <div style={secondaryAttackTitleStyle}>{secondaryAttack.name}</div>
                                  {secondaryAttack.attackLineParts.length > 0 ? (
                                    <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "0.05rem", display: "flex", flexWrap: "wrap", gap: "0.22rem", alignItems: "center" }}>
                                      {secondaryAttack.attackLineParts.map((part, partIdx) => (
                                        <span key={`${power.name}-${index}-secondary-${secondaryIndex}-attackline-${partIdx}`}>
                                          <span
                                            onMouseEnter={(event) => startGlossaryHover(event, `glossaryTerm:${part}`)}
                                            onMouseLeave={leaveGlossaryHover}
                                            style={{
                                              cursor: "help",
                                              borderBottom: "1px dotted var(--text-muted)",
                                              color: "var(--text-primary)"
                                            }}
                                          >
                                            {part}
                                          </span>
                                          {partIdx < secondaryAttack.attackLineParts.length - 1 ? (
                                            <span style={{ color: "var(--text-muted)", margin: "0 0.1rem" }}>•</span>
                                          ) : null}
                                        </span>
                                      ))}
                                    </div>
                                  ) : null}
                                  <div style={{ marginTop: "0.15rem", display: "grid", gap: "0.14rem" }}>
                                    {secondaryAttack.outcomeLines.map((line) => (
                                      <div key={`${power.name}-${index}-secondary-${secondaryIndex}-${line.label}-${line.text}`} style={{ fontSize: "0.8rem", color: "var(--text-primary)" }}>
                                        {(() => {
                                          const split = splitFailedEscapeAttemptSections(line.text);
                                          return (
                                            <>
                                              {isRenderableCardValue(split.mainText) ? (
                                                <div>
                                                  <strong>{line.label}:</strong>{" "}
                                                  {renderGlossaryAwareText(
                                                    split.mainText,
                                                    commonDescriptiveGlossaryPhrases,
                                                    startGlossaryHover,
                                                    leaveGlossaryHover,
                                                    `${power.name}-${index}-secondary-${secondaryIndex}-${line.label}-main`,
                                                    shouldHighlightGlossaryTerm
                                                  )}
                                                </div>
                                              ) : (
                                                <div>
                                                  <strong>{line.label}:</strong>{" "}
                                                  {renderGlossaryAwareText(
                                                    line.text,
                                                    commonDescriptiveGlossaryPhrases,
                                                    startGlossaryHover,
                                                    leaveGlossaryHover,
                                                    `${power.name}-${index}-secondary-${secondaryIndex}-${line.label}-fallback`,
                                                    shouldHighlightGlossaryTerm
                                                  )}
                                                </div>
                                              )}
                                              {split.failedEscapeTexts.map((failedText) => (
                                                <div key={`${power.name}-${index}-secondary-${secondaryIndex}-${line.label}-failed-${failedText}`} style={{ marginTop: "0.04rem" }}>
                                                  <strong>Failed Escape Attempt:</strong>{" "}
                                                  {renderGlossaryAwareText(
                                                    failedText,
                                                    commonDescriptiveGlossaryPhrases,
                                                    startGlossaryHover,
                                                    leaveGlossaryHover,
                                                    `${power.name}-${index}-secondary-${secondaryIndex}-${line.label}-failed`,
                                                    shouldHighlightGlossaryTerm
                                                  )}
                                                </div>
                                              ))}
                                            </>
                                          );
                                        })()}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : null}
                          {isRenderableCardValue(power.flavorText) ? (
                            <div style={{ ...bodySecondary, marginBottom: "0.2rem", fontStyle: "italic" }}>
                              {renderGlossaryAwareText(
                                String(power.flavorText),
                                commonDescriptiveGlossaryPhrases,
                                startGlossaryHover,
                                leaveGlossaryHover,
                                `${power.name}-${index}-flavor`,
                                shouldHighlightGlossaryTerm
                              )}
                            </div>
                          ) : null}
                          <div style={bodyPrimary}>
                            {isRenderableCardValue(cardModel.descriptionText) ? (
                              <div style={{ ...richTextBodyPrimary.paragraphStyle, margin: "0 0 0.35rem 0", whiteSpace: "pre-wrap" }}>
                                {renderGlossaryAwareText(
                                  cardModel.descriptionText,
                                  commonDescriptiveGlossaryPhrases,
                                  startGlossaryHover,
                                  leaveGlossaryHover,
                                  `${power.name}-${index}-description`,
                                  shouldHighlightGlossaryTerm
                                )}
                              </div>
                            ) : null}
                          </div>
                          {isRenderableCardValue(cardModel.ongoingText) ? (
                            <div style={{ marginTop: "0.05rem", ...bodyPrimary }}>
                              <strong>ONGOING:</strong>{" "}
                              {renderGlossaryAwareText(
                                cardModel.ongoingText,
                                commonDescriptiveGlossaryPhrases,
                                startGlossaryHover,
                                leaveGlossaryHover,
                                `${power.name}-${index}-ongoing`,
                                shouldHighlightGlossaryTerm
                              )}
                            </div>
                          ) : null}
                            </div>
                      );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </>
          )}
        </div>
      </div>

      <div style={{ marginTop: "0.85rem", ...panelStyle, padding: "0.55rem" }}>
        <details>
          <summary style={jsonSummaryStyle}>
            JSON
          </summary>
          <div style={{ marginTop: "0.5rem", display: "flex", flexWrap: "wrap", gap: "0.35rem", alignItems: "center" }}>
            <input
              value={jsonSearchInput}
              onChange={(event) => setJsonSearchInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                const committed = jsonSearchInput.trim();
                setJsonSearchQuery(committed);
                setJsonSearchResultIdx(0);
                setJsonSearchJumpTick((prev) => prev + 1);
              }}
              placeholder="Search JSON..."
              style={{
                minWidth: 260,
                border: "1px solid var(--panel-border)",
                borderRadius: "0.28rem",
                padding: "0.22rem 0.3rem"
              }}
            />
            <button
              type="button"
              disabled={jsonSearchMatches.length === 0}
              onClick={() =>
                setJsonSearchResultIdx((prev) => {
                  const nextIdx = jsonSearchMatches.length === 0 ? 0 : (prev - 1 + jsonSearchMatches.length) % jsonSearchMatches.length;
                  setJsonSearchJumpTick((tick) => tick + 1);
                  return nextIdx;
                })
              }
            >
              Previous
            </button>
            <button
              type="button"
              disabled={jsonSearchMatches.length === 0}
              onClick={() =>
                setJsonSearchResultIdx((prev) => {
                  const nextIdx = jsonSearchMatches.length === 0 ? 0 : (prev + 1) % jsonSearchMatches.length;
                  setJsonSearchJumpTick((tick) => tick + 1);
                  return nextIdx;
                })
              }
            >
              Next
            </button>
            <span style={metaSecondary}>
              {jsonSearchQuery.trim()
                ? jsonSearchMatches.length > 0
                  ? `${Math.min(jsonSearchResultIdx + 1, jsonSearchMatches.length)} of ${jsonSearchMatches.length}`
                  : "0 matches"
                : "Type and press Enter"}
            </span>
            <button
              type="button"
              onClick={() => {
                if (!navigator.clipboard?.writeText) {
                  alert("Clipboard API unavailable in this browser.");
                  return;
                }
                void navigator.clipboard.writeText(rawJsonText);
              }}
              style={{ marginLeft: "auto" }}
            >
              Copy Contents
            </button>
          </div>
          <textarea
            ref={jsonTextareaRef}
            value={rawJsonText}
            readOnly
            style={{
              margin: "0.55rem 0 0 0",
              padding: "0.55rem",
              borderRadius: "0.32rem",
              border: "1px solid var(--panel-border)",
              backgroundColor: "var(--surface-1)",
              color: "var(--text-primary)",
              overflow: "auto",
              height: "44rem",
              minHeight: "12rem",
              width: "100%",
              boxSizing: "border-box",
              resize: "vertical",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
              fontSize: "0.76rem",
              lineHeight: 1.35
            }}
          />
        </details>
      </div>

      {showGlossaryHoverInfo && glossaryHoverKey && glossaryHoverPanelPos && (
        <div
          onMouseEnter={cancelGlossaryHoverCloseTimer}
          onMouseLeave={leaveGlossaryHover}
          style={{
            position: "fixed",
            top: glossaryHoverPanelPos.top,
            left: glossaryHoverPanelPos.left,
            transform: glossaryHoverPanelPos.transform ?? "none",
            width: "340px",
            maxHeight: "50vh",
            overflow: "auto",
            border: "1px solid var(--panel-border)",
            backgroundColor: "var(--surface-0)",
            borderRadius: "0.35rem",
            padding: "0.45rem 0.5rem",
            color: "var(--text-primary)",
            textTransform: "none",
            letterSpacing: "normal",
            fontWeight: 500,
            fontSize: "0.76rem",
            lineHeight: 1.35,
            zIndex: 1000,
            boxShadow: "0 8px 24px rgba(45, 34, 16, 0.2)",
            display: "grid",
            gap: "0.2rem"
          }}
        >
          {monsterGlossaryContent(glossaryHoverKey)}
        </div>
      )}
    </div>
  );
}
