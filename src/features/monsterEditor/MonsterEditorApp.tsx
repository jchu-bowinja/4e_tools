import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent as ReactFocusEvent,
  type MouseEvent as ReactMouseEvent
} from "react";
import type { RulesIndex } from "../../rules/models";
import { resolveTooltipText } from "../../data/tooltipGlossary";
import { positionFixedTooltip } from "../../ui/glossaryTooltipPosition";
import {
  GLOSSARY_TOOLTIP_CLOSE_DELAY_MS,
  GLOSSARY_TOOLTIP_OPEN_DELAY_MS,
  STANDARD_GLOSSARY_TOOLTIP_LAYOUT,
  STANDARD_GLOSSARY_TOOLTIP_PANEL_STYLE
} from "../../ui/glossaryTooltip";
import { findCaseInsensitiveMatches, scrollTextareaToMatch } from "../../ui/jsonSearch";
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
import {
  isRenderableCardValue,
  normalizeSemicolonWhitespace,
  normalizeTextForDupCompare,
  titleCaseWords
} from "./monsterTextUtils";
import { buildMonsterPowerCardViewModel } from "./monsterPowerCardViewModel";

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

/** Center sheet column: identity header + stat-flow typography (aligned type scale & rhythm). */
const centerIdentityBlockStyle: CSSProperties = {
  marginBottom: "0.65rem",
  paddingBottom: "0.65rem",
  borderBottom: "1px solid var(--panel-border)"
};

const centerIdentityTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: "1.125rem",
  fontWeight: 700,
  letterSpacing: "0.02em",
  lineHeight: 1.28,
  color: "var(--text-primary)"
};

const centerMetaLineStyle: CSSProperties = {
  marginTop: "0.35rem",
  fontSize: "0.8125rem",
  lineHeight: 1.5,
  color: "var(--text-secondary)"
};

const centerBulletStyle: CSSProperties = {
  color: "var(--text-muted)",
  padding: "0 0.12rem",
  fontWeight: 400,
  userSelect: "none"
};

const centerQuickStatsGridStyle: CSSProperties = {
  marginTop: "0.5rem",
  display: "grid",
  gridTemplateColumns: "minmax(7rem, auto) minmax(0, 1fr)",
  columnGap: "1.25rem",
  rowGap: "0.35rem",
  alignItems: "baseline",
  fontSize: "0.8125rem",
  lineHeight: 1.45,
  color: "var(--text-primary)"
};

const centerQuickStatValueStyle: CSSProperties = {
  fontVariantNumeric: "tabular-nums",
  fontWeight: 600,
  color: "var(--text-primary)"
};

const centerStatFlowSectionStyle: CSSProperties = {
  marginTop: "0.6rem",
  display: "grid",
  gap: "0.42rem",
  fontSize: "0.8125rem",
  lineHeight: 1.5,
  color: "var(--text-primary)"
};

const centerFlowLineStyle: CSSProperties = {
  fontSize: "0.8125rem",
  lineHeight: 1.5,
  color: "var(--text-primary)"
};

const centerFlowLabelStrongStyle: CSSProperties = {
  fontWeight: 700,
  fontSize: "0.7rem",
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  color: "var(--text-muted)",
  marginRight: "0.4rem"
};

const centerDetailsBlockStyle: CSSProperties = {
  marginTop: "0.55rem",
  marginBottom: "0.75rem",
  paddingTop: "0.55rem",
  borderTop: "1px solid var(--panel-border)"
};

/** Inline stat subsections (Tactics, Auras, Traits, Items, etc.). */
const centerSubsectionPanelStyle: CSSProperties = {
  ...panelStyle,
  padding: "0.6rem 0.65rem",
  marginBottom: "0.65rem"
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

const MONSTER_SELECTED_ID_STORAGE_KEY = "monsterEditor.selectedId";

function readStoredSelectedMonsterId(): string {
  try {
    return window.localStorage.getItem(MONSTER_SELECTED_ID_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeStoredSelectedMonsterId(id: string): void {
  try {
    if (id.trim()) {
      window.localStorage.setItem(MONSTER_SELECTED_ID_STORAGE_KEY, id);
    } else {
      window.localStorage.removeItem(MONSTER_SELECTED_ID_STORAGE_KEY);
    }
  } catch {
    // Ignore storage failures and keep app behavior in-memory.
  }
}

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

/** Initiative / saving throws: show a leading + when the value is a positive number. */
function formatLeadingPlusIfPositive(formatted: string): string {
  if (formatted === "-") return "-";
  const trimmed = formatted.trim();
  if (/^[+-]/.test(trimmed)) return formatted;
  const num = Number(trimmed.replace(/,/g, ""));
  if (Number.isFinite(num) && num > 0) return `+${trimmed}`;
  return formatted;
}

function formatStatLabel(label: string): string {
  return label
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
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

export function splitTooltipTerms(rawTerm: string): string[] {
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
  "insubstantial",
  "phasing",
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

type MonsterGlossaryHoverKey = `powerKeyword:${string}` | `glossaryTerm:${string}` | `glossaryTerms:${string}`;
const MONSTER_GLOSSARY_TOOLTIP_ID = "monster-glossary-tooltip";

export function MonsterEditorApp({
  index,
  tooltipGlossary
}: {
  index: RulesIndex;
  tooltipGlossary: Record<string, string>;
}): JSX.Element {
  const [indexRows, setIndexRows] = useState<MonsterIndexEntry[]>([]);
  const [activeMonster, setActiveMonster] = useState<MonsterEntryFile | null>(null);
  const [selectedId, setSelectedId] = useState<string>(() => readStoredSelectedMonsterId());
  const [nameQuery, setNameQuery] = useState<string>("");
  const [levelQuery, setLevelQuery] = useState<string>("");
  const [roleQuery, setRoleQuery] = useState<string>("");
  const [leaderFilter, setLeaderFilter] = useState<"both" | "leader" | "notLeader">("both");
  const [sortBy, setSortBy] = useState<"name" | "level">("level");
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

  useEffect(() => {
    void (async () => {
      try {
        const rows = await loadMonsterIndex();
        setIndexRows(rows);
        if (rows.length > 0) {
          const preferredId = selectedId && rows.some((row) => row.id === selectedId) ? selectedId : rows[0].id;
          setSelectedId(preferredId);
          setMessage(`Loaded monster index (${rows.length} records).`);
        } else {
          setSelectedId("");
          setMessage("Monster index is empty.");
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Could not load monster index.");
      }
    })();
  }, []);

  useEffect(() => {
    writeStoredSelectedMonsterId(selectedId);
  }, [selectedId]);

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
    function onWindowKeyDown(event: KeyboardEvent): void {
      if (event.key !== "Escape") return;
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
    }
    window.addEventListener("keydown", onWindowKeyDown);
    return () => window.removeEventListener("keydown", onWindowKeyDown);
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

  const displayedAuras = useMemo(() => {
    if (!activeMonster || !Array.isArray(activeMonster.auras)) return [];
    return activeMonster.auras;
  }, [activeMonster]);

  const displayedTraits = useMemo(() => {
    if (!activeMonster || !Array.isArray(activeMonster.traits)) return [];
    const normalize = (value: unknown): string => String(value ?? "").trim().toLowerCase();
    const auraSignatures = new Set(
      displayedAuras.map((aura) =>
        [normalize(aura.name), normalize(aura.range), normalize(aura.details)].join("||")
      )
    );
    return activeMonster.traits.filter((trait) => {
      const signature = [normalize(trait.name), normalize(trait.range), normalize(trait.details)].join("||");
      return !auraSignatures.has(signature);
    });
  }, [activeMonster, displayedAuras]);

  const auraHeadingColumnWidthCh = useMemo(() => {
    if (displayedAuras.length === 0) return 12;
    const longest = displayedAuras.reduce((max, aura) => {
      const name = String(aura.name ?? "").trim() || "Aura";
      const rangeValue = aura.range;
      const rangeText =
        rangeValue !== undefined && rangeValue !== null && String(rangeValue).trim() !== ""
          ? ` • Range ${String(rangeValue).trim()}`
          : "";
      return Math.max(max, `${name}${rangeText}`.length);
    }, 0);
    return Math.max(10, Math.min(26, longest + 1));
  }, [displayedAuras]);

  const traitHeadingColumnWidthCh = useMemo(() => {
    if (displayedTraits.length === 0) return 12;
    const longest = displayedTraits.reduce((max, trait) => {
      const name = String(trait.name ?? "").trim() || "Trait";
      const rangeValue = trait.range;
      const rangeText =
        rangeValue !== undefined && rangeValue !== null && String(rangeValue).trim() !== ""
          ? ` • Range ${String(rangeValue).trim()}`
          : "";
      return Math.max(max, `${name}${rangeText}`.length);
    }, 0);
    return Math.max(10, Math.min(26, longest + 1));
  }, [displayedTraits]);

  const auraHasAnyTags = useMemo(
    () => displayedAuras.some((aura) => renderTraitMetaBadges(aura).length > 0),
    [displayedAuras]
  );
  const traitHasAnyTags = useMemo(
    () => displayedTraits.some((trait) => renderTraitMetaBadges(trait).length > 0),
    [displayedTraits]
  );

  const rawJsonText = useMemo(() => JSON.stringify(activeMonster, null, 2), [activeMonster]);
  const jsonSearchMatches = useMemo(
    () => findCaseInsensitiveMatches(rawJsonText, jsonSearchQuery),
    [rawJsonText, jsonSearchQuery]
  );
  const lastHandledJsonSearchJumpTickRef = useRef<number>(0);
  const glossaryResolutionCacheRef = useRef<Map<string, boolean>>(new Map());

  useEffect(() => {
    setJsonSearchResultIdx(0);
  }, [jsonSearchQuery, rawJsonText]);

  useEffect(() => {
    if (jsonSearchJumpTick === 0) return;
    if (lastHandledJsonSearchJumpTickRef.current === jsonSearchJumpTick) return;
    lastHandledJsonSearchJumpTickRef.current = jsonSearchJumpTick;
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
        text: resolveTooltipText({ terms: [term], glossaryByName: tooltipGlossary })
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
    return <div>No glossary entry found in `generated/glossary_terms.json`.</div>;
  }

  const shouldHighlightGlossaryTerm = useCallback(
    (term: string): boolean => {
      const normalized = term.trim().toLowerCase();
      if (!normalized) return false;
      const cached = glossaryResolutionCacheRef.current.get(normalized);
      if (cached !== undefined) return cached;
      const resolvedText = resolveTooltipText({ terms: splitTooltipTerms(term), glossaryByName: tooltipGlossary });
      const hasEntry = Boolean(resolvedText && resolvedText.trim().length > 0);
      glossaryResolutionCacheRef.current.set(normalized, hasEntry);
      return hasEntry;
    },
    [tooltipGlossary]
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

  function startGlossaryHover(
    event: ReactMouseEvent<HTMLElement> | ReactFocusEvent<HTMLElement>,
    key: MonsterGlossaryHoverKey
  ): void {
    cancelGlossaryHoverCloseTimer();
    const rect = event.currentTarget.getBoundingClientRect();
    setGlossaryHoverPanelPos(positionFixedTooltip(rect, STANDARD_GLOSSARY_TOOLTIP_LAYOUT));
    const switchingHoverTarget = showGlossaryHoverInfo && glossaryHoverKey !== null && glossaryHoverKey !== key;
    if (switchingHoverTarget) {
      setShowGlossaryHoverInfo(false);
    }
    setGlossaryHoverKey(key);
    if (glossaryHoverTimerRef.current != null) {
      window.clearTimeout(glossaryHoverTimerRef.current);
    }
    if (event.type === "focus") {
      setShowGlossaryHoverInfo(true);
      glossaryHoverTimerRef.current = null;
      return;
    }
    glossaryHoverTimerRef.current = window.setTimeout(() => {
      setShowGlossaryHoverInfo(true);
      glossaryHoverTimerRef.current = null;
    }, GLOSSARY_TOOLTIP_OPEN_DELAY_MS);
  }

  function leaveGlossaryHover(): void {
    cancelGlossaryHoverCloseTimer();
    glossaryHoverCloseTimerRef.current = window.setTimeout(() => {
      hideGlossaryHoverNow();
    }, GLOSSARY_TOOLTIP_CLOSE_DELAY_MS);
  }

  function glossaryHoverA11y(key: MonsterGlossaryHoverKey): {
    onMouseEnter: (event: ReactMouseEvent<HTMLElement>) => void;
    onMouseLeave: () => void;
    onFocus: (event: ReactFocusEvent<HTMLElement>) => void;
    onBlur: () => void;
    tabIndex: number;
    "aria-describedby"?: string;
  } {
    const active = showGlossaryHoverInfo && glossaryHoverKey === key;
    return {
      onMouseEnter: (event) => startGlossaryHover(event, key),
      onMouseLeave: leaveGlossaryHover,
      onFocus: (event) => startGlossaryHover(event, key),
      onBlur: leaveGlossaryHover,
      tabIndex: 0,
      "aria-describedby": active ? MONSTER_GLOSSARY_TOOLTIP_ID : undefined
    };
  }

  return (
    <div
      style={{
        maxWidth: 1440,
        margin: "0 auto",
        padding: "clamp(0.65rem, 1.4vw, 1rem)",
        boxSizing: "border-box",
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
                if (rows.length > 0) {
                  const preferredId = selectedId && rows.some((row) => row.id === selectedId) ? selectedId : rows[0].id;
                  setSelectedId(preferredId);
                } else {
                  setSelectedId("");
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
        role="status"
        aria-live="polite"
        style={{
          marginBottom: "0.75rem",
          fontSize: "0.8rem",
          color: message.toLowerCase().includes("could not") ? "var(--status-danger)" : "var(--text-muted)"
        }}
      >
        {message}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 2fr)",
          gap: "1rem",
          minHeight: "65vh"
        }}
      >
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
            <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.8125rem", lineHeight: 1.45 }}>
              Select a monster to view its generated JSON data.
            </p>
          ) : (
            <div style={{ minWidth: 0 }}>
              <div style={centerIdentityBlockStyle}>
                <div style={centerIdentityTitleStyle}>
                  <span>{activeMonster.name}</span>
                  {activeMonster.alignment?.name ? (
                    <>
                      {" "}
                      <span
                        {...glossaryHoverA11y(`glossaryTerm:${activeMonster.alignment.name}`)}
                        style={{
                          cursor: "help",
                          borderBottom: "1px dotted var(--text-muted)",
                          fontWeight: 700,
                          letterSpacing: "0.02em",
                          color: "var(--text-primary)"
                        }}
                      >
                        ({activeMonster.alignment.name})
                      </span>
                    </>
                  ) : null}
                </div>
                <div style={centerMetaLineStyle}>
                  <span
                    {...glossaryHoverA11y("glossaryTerm:Level")}
                    style={glossaryLinkUnderline}
                  >
                    Level
                  </span>{" "}
                  {formatValue(activeMonster.level)}{" "}
                  {isRenderableCardValue(activeMonster.groupRole) ? (
                    <>
                      <span
                        {...glossaryHoverA11y(`glossaryTerm:${String(activeMonster.groupRole)}`)}
                        style={glossaryLinkUnderline}
                      >
                        {String(activeMonster.groupRole)}
                      </span>{" "}
                    </>
                  ) : null}
                  <span
                    {...glossaryHoverA11y(`glossaryTerm:${activeMonster.role || "Role"}`)}
                    style={glossaryLinkUnderline}
                  >
                    {activeMonster.role || ""}
                  </span>
                </div>
                <div style={centerMetaLineStyle}>
                  <span
                    {...glossaryHoverA11y(`glossaryTerm:${activeMonster.size || "Size"}`)}
                    style={glossaryLinkUnderline}
                  >
                    {activeMonster.size || "Unknown size"}
                  </span>{" "}
                  <span style={centerBulletStyle} aria-hidden>
                    •
                  </span>{" "}
                  <span
                    {...glossaryHoverA11y(`glossaryTerm:${activeMonster.origin || "Origin"}`)}
                    style={glossaryLinkUnderline}
                  >
                    {activeMonster.origin || "Unknown origin"}
                  </span>{" "}
                  <span style={centerBulletStyle} aria-hidden>
                    •
                  </span>{" "}
                  <span
                    {...glossaryHoverA11y(`glossaryTerm:${activeMonster.type || "Type"}`)}
                    style={glossaryLinkUnderline}
                  >
                    {activeMonster.type || "Unknown type"}
                  </span>{" "}
                  {Array.isArray(activeMonster.keywords) && activeMonster.keywords.length > 0
                    ? activeMonster.keywords.map((kw, idx) => (
                        <span key={`monster-header-kw-${idx}-${String(kw)}`}>
                          <span style={centerBulletStyle} aria-hidden>
                            •
                          </span>{" "}
                          <span
                            {...glossaryHoverA11y(`glossaryTerm:${String(kw)}`)}
                            style={glossaryLinkUnderline}
                          >
                            {titleCaseWords(String(kw))}
                          </span>{" "}
                        </span>
                      ))
                    : null}
                  <span style={centerBulletStyle} aria-hidden>
                    •
                  </span>{" "}
                  <span
                    {...glossaryHoverA11y("glossaryTerm:Experience")}
                    style={glossaryLinkUnderline}
                  >
                    XP
                  </span>{" "}
                  {formatValue(activeMonster.xp)}
                </div>
                {(() => {
                  const on = (activeMonster.stats?.otherNumbers ?? {}) as Record<string, unknown>;
                  const pick = (candidates: string[]): string => {
                    const lower = new Map(Object.entries(on).map(([k, v]) => [k.toLowerCase(), v]));
                    for (const c of candidates) {
                      const v = lower.get(c.toLowerCase());
                      if (v !== undefined && v !== null && String(v).trim() !== "") {
                        return formatValue(v as string | number | boolean | undefined | null);
                      }
                    }
                    return "-";
                  };
                  const initiative = pick(["initiative"]);
                  const hitPoints = pick(["hp", "hitPoints", "hit points"]);
                  const actionPts = pick(["actionPoints", "action points"]);
                  const saves = pick(["savingThrows", "saving throws"]);
                  const defensesBlock = (activeMonster.stats?.defenses ?? {}) as Record<string, unknown>;
                  const pickDefense = (candidates: string[]): string => {
                    const lower = new Map(Object.entries(defensesBlock).map(([k, v]) => [k.toLowerCase(), v]));
                    for (const c of candidates) {
                      const v = lower.get(c.toLowerCase());
                      if (v !== undefined && v !== null && String(v).trim() !== "") {
                        return formatValue(v as string | number | boolean | undefined | null);
                      }
                    }
                    return "-";
                  };
                  const ac = pickDefense(["ac", "AC"]);
                  const fortitude = pickDefense(["fortitude", "Fortitude"]);
                  const reflex = pickDefense(["reflex", "Reflex"]);
                  const will = pickDefense(["will", "Will"]);
                  const regenerationRaw = activeMonster.regeneration;
                  let regenerationVal: string | null = null;
                  if (regenerationRaw !== undefined && regenerationRaw !== null && String(regenerationRaw).trim() !== "") {
                    const numeric =
                      typeof regenerationRaw === "number"
                        ? regenerationRaw
                        : Number(String(regenerationRaw).replace(/,/g, "").trim());
                    const include =
                      Number.isFinite(numeric) ? numeric !== 0 : true;
                    if (include) {
                      regenerationVal = formatValue(
                        regenerationRaw as string | number | boolean | undefined | null
                      );
                    }
                  }
                  const rows: Array<{ label: string; glossary: MonsterGlossaryHoverKey; val: string }> = [];
                  if (initiative !== "-") {
                    rows.push({
                      label: "Initiative",
                      glossary: "glossaryTerm:Initiative",
                      val: formatLeadingPlusIfPositive(initiative)
                    });
                  }
                  if (hitPoints !== "-") {
                    rows.push({ label: "Hit Points", glossary: "glossaryTerm:Hit Points", val: hitPoints });
                  }
                  if (regenerationVal !== null) {
                    rows.push({
                      label: "Regeneration",
                      glossary: "glossaryTerm:Regeneration",
                      val: regenerationVal
                    });
                  }
                  if (ac !== "-") rows.push({ label: "AC", glossary: "glossaryTerm:AC", val: ac });
                  if (fortitude !== "-") {
                    rows.push({ label: "Fortitude", glossary: "glossaryTerm:Fortitude", val: fortitude });
                  }
                  if (reflex !== "-") rows.push({ label: "Reflex", glossary: "glossaryTerm:Reflex", val: reflex });
                  if (will !== "-") rows.push({ label: "Will", glossary: "glossaryTerm:Will", val: will });
                  if (actionPts !== "-") {
                    rows.push({ label: "Action Points", glossary: "glossaryTerm:Action Points", val: actionPts });
                  }
                  if (saves !== "-") {
                    rows.push({
                      label: "Saving Throws",
                      glossary: "glossaryTerm:Saving Throws",
                      val: formatLeadingPlusIfPositive(saves)
                    });
                  }
                  if (rows.length === 0) return null;
                  return (
                    <div style={centerQuickStatsGridStyle}>
                      {rows.flatMap((r) => [
                        <span
                          key={`${r.label}-l`}
                          {...glossaryHoverA11y(r.glossary)}
                          style={{
                            ...microLabelStyle,
                            cursor: "help",
                            borderBottom: "1px dotted var(--text-muted)",
                            width: "fit-content",
                            alignSelf: "center"
                          }}
                        >
                          {r.label}
                        </span>,
                        <span key={`${r.label}-v`} style={centerQuickStatValueStyle}>
                          {r.val}
                        </span>
                      ])}
                    </div>
                  );
                })()}
              </div>

              {activeMonster.parseError && (
                <div
                  style={{
                    marginTop: "0.5rem",
                    border: "1px solid var(--status-danger)",
                    backgroundColor: "var(--surface-1)",
                    color: "var(--status-danger)",
                    padding: "0.5rem 0.6rem",
                    borderRadius: "var(--ui-panel-radius, 0.35rem)",
                    fontSize: "0.8125rem",
                    lineHeight: 1.45
                  }}
                >
                  Parse error: {activeMonster.parseError}
                </div>
              )}

              {(() => {
                const movementEntries = extractMovementEntries(activeMonster);
                const showPhasing = activeMonster.phasing === true;
                const otherNumbers = activeMonster.stats?.otherNumbers ?? {};
                const bloodied = formatValue((otherNumbers as Record<string, unknown>).bloodied as string | number | boolean | undefined | null);
                return (
                  <>
                    <div style={centerStatFlowSectionStyle}>
                      {bloodied !== "-" ? (
                        <div style={centerFlowLineStyle}>
                          <strong style={centerFlowLabelStrongStyle}>Bloodied:</strong>
                          {bloodied}
                        </div>
                      ) : null}
                      {(movementEntries.length > 0 || showPhasing) ? (
                        <div style={centerFlowLineStyle}>
                          <strong style={centerFlowLabelStrongStyle}>Movement:</strong>{" "}
                          {movementEntries.length > 0
                            ? movementEntries.map((entry, idx) => (
                                <span key={`flow-mv-${idx}-${entry.type}`}>
                                  {idx > 0 ? ", " : null}
                                  <span
                                    {...glossaryHoverA11y(`glossaryTerm:${entry.type}`)}
                                    style={glossaryLinkUnderline}
                                  >
                                    {entry.type}
                                  </span>{" "}
                                  {String(entry.value)}
                                </span>
                              ))
                            : null}
                          {showPhasing ? (
                            <>
                              {movementEntries.length > 0 ? "; " : null}
                              <span {...glossaryHoverA11y("glossaryTerm:Phasing")} style={glossaryLinkUnderline}>
                                Phasing
                              </span>
                            </>
                          ) : null}
                        </div>
                      ) : null}
                      {(Array.isArray(activeMonster.immunities) && activeMonster.immunities.length > 0) ? (
                        <div style={centerFlowLineStyle}>
                          <strong style={centerFlowLabelStrongStyle}>Immunities:</strong>{" "}
                          {activeMonster.immunities.map((immText, idx) => (
                            <span key={`flow-imm-${idx}`}>
                              {idx > 0 ? ", " : null}
                              {renderGlossaryAwareText(
                                String(immText ?? ""),
                                commonDescriptiveGlossaryPhrases,
                                startGlossaryHover,
                                leaveGlossaryHover,
                                `flow-imm-${idx}`,
                                shouldHighlightGlossaryTerm
                              )}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      {(Array.isArray(activeMonster.resistances) && activeMonster.resistances.length > 0) ? (
                        <div style={centerFlowLineStyle}>
                          <strong style={centerFlowLabelStrongStyle}>Resistances:</strong>{" "}
                          {activeMonster.resistances.map((resistance, idx) => {
                            const r = resistance as Record<string, unknown>;
                            const name = String(r.name ?? "").trim();
                            const rawAmount = r.amount;
                            const amount = typeof rawAmount === "number" ? rawAmount : Number(rawAmount);
                            const amountPart = Number.isFinite(amount) && amount !== 0 ? `${amount} ` : "";
                            const detailsPart = String(r.details ?? "").trim();
                            return (
                              <span key={`flow-res-${idx}`}>
                                {idx > 0 ? ", " : null}
                                {amountPart}
                                {name ? (
                                  <span {...glossaryHoverA11y(`glossaryTerm:${name}`)} style={glossaryLinkUnderline}>
                                    {name}
                                  </span>
                                ) : (
                                  weaknessLine(r)
                                )}
                                {detailsPart ? ` ${detailsPart}` : ""}
                              </span>
                            );
                          })}
                        </div>
                      ) : null}
                      {(() => {
                        const entries =
                          Array.isArray(activeMonster.senses) && activeMonster.senses.length > 0
                            ? activeMonster.senses
                                .map((sense) => {
                                  const name = String(sense.name ?? "").trim();
                                  if (!name) return null;
                                  const displayName = name.charAt(0).toUpperCase() + name.slice(1);
                                  const normalizedRange = String(sense.range ?? "").trim();
                                  const text =
                                    normalizedRange !== "" && normalizedRange !== "0"
                                      ? `${displayName} ${normalizedRange}`
                                      : displayName;
                                  return { name, text };
                                })
                                .filter((e): e is { name: string; text: string } => e !== null)
                            : [];
                        if (entries.length === 0) return null;
                        return (
                          <div style={centerFlowLineStyle}>
                            <strong style={centerFlowLabelStrongStyle}>Senses:</strong>{" "}
                            {entries.map((entry, idx) => (
                              <span key={`flow-sense-${idx}-${entry.name}`}>
                                {idx > 0 ? ", " : null}
                                <span {...glossaryHoverA11y(`glossaryTerm:${entry.name}`)} style={glossaryLinkUnderline}>
                                  {entry.text}
                                </span>
                              </span>
                            ))}
                          </div>
                        );
                      })()}
                      {(Array.isArray(activeMonster.weaknesses) && activeMonster.weaknesses.length > 0) ? (
                        <div style={centerFlowLineStyle}>
                          <strong style={centerFlowLabelStrongStyle}>Vulnerabilities:</strong>{" "}
                          {activeMonster.weaknesses
                            .map((weakness) => weaknessLine(weakness as Record<string, unknown>))
                            .filter(Boolean)
                            .join(", ")}
                        </div>
                      ) : null}
                    </div>
                    <details style={centerDetailsBlockStyle}>
                      <summary style={detailsSummaryStyle}>Detailed Stats</summary>
                      <div style={{ marginTop: "0.5rem", display: "grid", gap: "0.4rem" }}>
                        {Object.entries(activeMonster.stats)
                          .filter(
                            ([label]) =>
                              label !== "attackBonuses" && label !== "otherNumbers" && label !== "defenses"
                          )
                          .sort(([labelA], [labelB]) => {
                            const orderA = statsDisplayOrder(labelA);
                            const orderB = statsDisplayOrder(labelB);
                            if (orderA !== orderB) return orderA - orderB;
                            return 0;
                          })
                          .map(([label, block]) => (
                            <div key={label} style={statPanelStyle}>
                              <h3 style={sectionTitleStyle}>{formatStatLabel(label)}</h3>
                              <div
                                style={{
                                  marginTop: "0.4rem",
                                  fontSize: "0.8125rem",
                                  lineHeight: 1.45,
                                  color: "var(--text-secondary)",
                                  display: "grid",
                                  gap: "0.22rem"
                                }}
                              >
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
                                            padding: "0.28rem 0.4rem",
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
                              </div>
                            </div>
                          ))}
                        {Array.isArray(activeMonster.languages) && activeMonster.languages.length > 0 ? (
                          <div style={statPanelStyle}>
                            <h3 style={sectionTitleStyle}>Languages</h3>
                            <div
                              style={{
                                marginTop: "0.4rem",
                                fontSize: "0.8125rem",
                                lineHeight: 1.45,
                                color: "var(--text-secondary)"
                              }}
                            >
                              {renderTagList(activeMonster.languages)}
                            </div>
                          </div>
                        ) : null}
                        {Array.isArray(activeMonster.sourceBooks) && activeMonster.sourceBooks.length > 0 ? (
                          <div style={statPanelStyle}>
                            <h3 style={sectionTitleStyle}>Sources</h3>
                            <div
                              style={{
                                marginTop: "0.4rem",
                                fontSize: "0.8125rem",
                                lineHeight: 1.45,
                                color: "var(--text-secondary)"
                              }}
                            >
                              {activeMonster.sourceBooks.join(", ")}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </details>
                  </>
                );
              })()}

              {isRenderableCardValue(activeMonster.tactics) ? (
                <div style={centerSubsectionPanelStyle}>
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

              {displayedAuras.length > 0 ? (
                <div style={centerSubsectionPanelStyle}>
                  <h3 style={sectionTitleStyle}>Auras</h3>
                  <div style={{ marginTop: "0.35rem", display: "grid", gap: "0.2rem" }}>
                    {displayedAuras.map((aura, idx) => (
                      <div
                        key={`aura-${idx}`}
                        style={{
                          ...bodyPrimary,
                          display: "grid",
                          gap: "0.2rem",
                          padding: "0.22rem 0.35rem",
                          borderRadius: "0.25rem",
                          backgroundColor: idx % 2 === 0 ? "var(--table-stripe-even)" : "var(--table-stripe-odd)"
                        }}
                      >
                        <div>
                          {(() => {
                            const name = String(aura.name ?? "").trim();
                            const details = String(aura.details ?? "").trim();
                            const rangeValue = aura.range;
                            const rangeText =
                              rangeValue !== undefined && rangeValue !== null && String(rangeValue).trim() !== ""
                                ? `Range ${String(rangeValue).trim()}`
                                : "";
                            const detailParts = splitByGlossaryPhrases(details, traitDetailGlossaryPhrases);
                            const badges = renderTraitMetaBadges(aura);
                            const stripeColor = idx % 2 === 0 ? "var(--table-stripe-even)" : "var(--table-stripe-odd)";
                            return (
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: auraHasAnyTags
                                    ? `minmax(10rem, ${auraHeadingColumnWidthCh}ch) 1px max-content 1px minmax(0, 1fr)`
                                    : `minmax(10rem, ${auraHeadingColumnWidthCh}ch) 1px minmax(0, 1fr)`,
                                  columnGap: "0.18rem",
                                  alignItems: "start"
                                }}
                              >
                                <span
                                  style={{
                                    padding: "0.2rem 0.35rem",
                                    borderRadius: "0.25rem",
                                    backgroundColor: stripeColor,
                                    fontWeight: 600,
                                    lineHeight: 1.25
                                  }}
                                >
                                  <div style={{ display: "grid", gap: "0.08rem" }}>
                                    <strong>{name || "Aura"}</strong>
                                    {rangeText ? (
                                      <span
                                        onMouseEnter={(event) => startGlossaryHover(event, "glossaryTerm:range")}
                                        onMouseLeave={leaveGlossaryHover}
                                        style={{
                                          color: "var(--text-secondary)",
                                          fontSize: "0.76rem",
                                          fontWeight: 600,
                                          width: "fit-content",
                                          ...(shouldHighlightGlossaryTerm("range") ? glossaryLinkUnderline : {})
                                        }}
                                      >
                                        {rangeText}
                                      </span>
                                    ) : null}
                                  </div>
                                </span>
                                <span
                                  aria-hidden="true"
                                  style={{
                                    alignSelf: "stretch",
                                    justifySelf: "center",
                                    width: "1px",
                                    backgroundColor: "var(--panel-border)"
                                  }}
                                />
                                {auraHasAnyTags ? (
                                  <>
                                    <span style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", paddingTop: "0.12rem" }}>
                                      {badges.length > 0
                                        ? badges.map((badge) =>
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
                                      )
                                        : null}
                                    </span>
                                    <span
                                      aria-hidden="true"
                                      style={{
                                        alignSelf: "stretch",
                                        justifySelf: "center",
                                        width: "1px",
                                        backgroundColor: "var(--panel-border)"
                                      }}
                                    />
                                  </>
                                ) : null}
                                <span
                                  style={{
                                    padding: "0.2rem 0.32rem",
                                    borderRadius: "0.25rem",
                                    backgroundColor: stripeColor,
                                    minHeight: "1.5rem",
                                    lineHeight: 1.25
                                  }}
                                >
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
                                </span>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {displayedTraits.length > 0 ? (
                <div style={centerSubsectionPanelStyle}>
                  <h3 style={sectionTitleStyle}>Traits</h3>
                  <div style={{ marginTop: "0.35rem", display: "grid", gap: "0.2rem" }}>
                    {displayedTraits.map((trait, idx) => (
                      <div
                        key={`trait-${idx}`}
                        style={{
                          ...bodyPrimary,
                          display: "grid",
                          gap: "0.2rem",
                          padding: "0.22rem 0.35rem",
                          borderRadius: "0.25rem",
                          backgroundColor: idx % 2 === 0 ? "var(--table-stripe-even)" : "var(--table-stripe-odd)"
                        }}
                      >
                        <div>
                          {(() => {
                            const name = String(trait.name ?? "").trim();
                            const details = String(trait.details ?? "").trim();
                            const rangeValue = trait.range;
                            const rangeText =
                              rangeValue !== undefined && rangeValue !== null && String(rangeValue).trim() !== ""
                                ? `Range ${String(rangeValue).trim()}`
                                : "";
                            const detailParts = splitByGlossaryPhrases(details, traitDetailGlossaryPhrases);
                            const badges = renderTraitMetaBadges(trait);
                            const stripeColor = idx % 2 === 0 ? "var(--table-stripe-even)" : "var(--table-stripe-odd)";
                            return (
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: traitHasAnyTags
                                    ? `minmax(10rem, ${traitHeadingColumnWidthCh}ch) 1px max-content 1px minmax(0, 1fr)`
                                    : `minmax(10rem, ${traitHeadingColumnWidthCh}ch) 1px minmax(0, 1fr)`,
                                  columnGap: "0.18rem",
                                  alignItems: "start"
                                }}
                              >
                                <span
                                  style={{
                                    padding: "0.2rem 0.35rem",
                                    borderRadius: "0.25rem",
                                    backgroundColor: stripeColor,
                                    fontWeight: 600,
                                    lineHeight: 1.25
                                  }}
                                >
                                  <div style={{ display: "grid", gap: "0.08rem" }}>
                                    <strong>{name || "Trait"}</strong>
                                    {rangeText ? (
                                      <span
                                        onMouseEnter={(event) => startGlossaryHover(event, "glossaryTerm:range")}
                                        onMouseLeave={leaveGlossaryHover}
                                        style={{
                                          color: "var(--text-secondary)",
                                          fontSize: "0.76rem",
                                          fontWeight: 600,
                                          width: "fit-content",
                                          ...(shouldHighlightGlossaryTerm("range") ? glossaryLinkUnderline : {})
                                        }}
                                      >
                                        {rangeText}
                                      </span>
                                    ) : null}
                                  </div>
                                </span>
                                <span
                                  aria-hidden="true"
                                  style={{
                                    alignSelf: "stretch",
                                    justifySelf: "center",
                                    width: "1px",
                                    backgroundColor: "var(--panel-border)"
                                  }}
                                />
                                {traitHasAnyTags ? (
                                  <>
                                    <span style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", paddingTop: "0.12rem" }}>
                                      {badges.length > 0
                                        ? badges.map((badge) =>
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
                                      )
                                        : null}
                                    </span>
                                    <span
                                      aria-hidden="true"
                                      style={{
                                        alignSelf: "stretch",
                                        justifySelf: "center",
                                        width: "1px",
                                        backgroundColor: "var(--panel-border)"
                                      }}
                                    />
                                  </>
                                ) : null}
                                <span
                                  style={{
                                    padding: "0.2rem 0.32rem",
                                    borderRadius: "0.25rem",
                                    backgroundColor: stripeColor,
                                    minHeight: "1.5rem",
                                    lineHeight: 1.25
                                  }}
                                >
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
                                </span>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {(() => {
                const items = sectionArrayOfObjects(activeMonster.items);
                if (items.length === 0) return null;
                return (
                  <div style={centerSubsectionPanelStyle}>
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
                  padding: "0.6rem 0.65rem",
                  marginBottom: "0.65rem"
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
              </div>
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
          id={MONSTER_GLOSSARY_TOOLTIP_ID}
          role="tooltip"
          onMouseEnter={cancelGlossaryHoverCloseTimer}
          onMouseLeave={leaveGlossaryHover}
          style={{
            position: "fixed",
            top: glossaryHoverPanelPos.top,
            left: glossaryHoverPanelPos.left,
            transform: glossaryHoverPanelPos.transform ?? "none",
            ...STANDARD_GLOSSARY_TOOLTIP_PANEL_STYLE
          }}
        >
          {monsterGlossaryContent(glossaryHoverKey)}
        </div>
      )}
    </div>
  );
}
