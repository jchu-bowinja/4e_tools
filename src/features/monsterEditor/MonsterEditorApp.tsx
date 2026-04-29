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
import { STANDARD_GLOSSARY_TOOLTIP_PANEL_STYLE } from "../../ui/glossaryTooltip";
import { useGlossaryTooltip } from "../../ui/useGlossaryTooltip";
import { resolveMonsterGlossaryHoverSections, resolveMonsterStyleTooltip } from "./monsterTooltipResolve";
import { GlossaryTooltipRichText } from "../builder/RulesRichText";
import { findCaseInsensitiveMatches, scrollTextareaToMatch } from "../../ui/jsonSearch";
import {
  loadMonsterEntry,
  loadMonsterIndex,
  loadMonsterTemplates,
  type MonsterEntryFile,
  type MonsterTemplateRecord,
  type MonsterIndexEntry,
  type MonsterPower,
  type MonsterPowerAttack,
  type MonsterPowerDamage,
  type MonsterPowerOutcome,
  type MonsterPowerOutcomeEntry,
  type MonsterTrait
} from "./storage";
import {
  parsePastedMonsterTemplateText,
  type MonsterTemplateImportValidation,
  validateMonsterTemplateImport
} from "./pasteMonsterTemplateEtl";
import {
  formatMonsterStatLabelForDisplay,
  isRenderableCardValue,
  monsterAbilityAbbrevFromStatKey,
  monsterStatGlossaryTermForKey,
  normalizeSemicolonWhitespace,
  normalizeTextForDupCompare,
  parseAttackLineVsDefenseHighlightSegments,
  splitMonsterAttackRangeLineForGlossary,
  titleCaseWords
} from "./monsterTextUtils";
import { buildMonsterPowerCardViewModel } from "./monsterPowerCardViewModel";
import { normalizeMonsterPowerShape } from "./monsterPowerNormalize";
import {
  buildMonsterTemplatesExportFile,
  normalizeImportedTemplateRecord,
  parseMonsterTemplatesImportJson,
  stringifyMonsterTemplatesJsonFile
} from "./monsterTemplatesJsonFile";
import { formatMonsterTemplateStatAdjustmentLines } from "./monsterTemplateStatsDisplay";
import {
  applyMonsterTemplateToEntry,
  computeTemplateApplicationDelta,
  type TemplateApplicationDelta
} from "./applyMonsterTemplate";

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

/** Compact JSON under each aura/trait/power in create-template preview. */
const templateAbilityJsonPreStyle: CSSProperties = {
  margin: "0.35rem 0 0 0",
  padding: "0.45rem 0.5rem",
  borderRadius: 6,
  background: "rgba(0,0,0,0.06)",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  fontSize: "0.72rem",
  lineHeight: 1.45,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  overflowX: "auto",
  color: "var(--text-secondary)"
};

const templateJsonCollapsibleDetailsStyle: CSSProperties = {
  marginTop: "0.4rem"
};

const templateJsonCollapsibleSummaryStyle: CSSProperties = {
  cursor: "pointer",
  fontSize: "0.72rem",
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--text-muted)"
};

const warningPanelStyle: CSSProperties = {
  marginBottom: "0.75rem",
  border: "1px solid var(--status-warning)",
  backgroundColor: "var(--surface-0)",
  borderRadius: 8,
  padding: "0.6rem 0.75rem"
};

const errorPanelStyle: CSSProperties = {
  marginBottom: "0.75rem",
  border: "1px solid var(--status-danger)",
  backgroundColor: "var(--surface-0)",
  borderRadius: 8,
  padding: "0.6rem 0.75rem"
};

function mapImportParseErrorToMessage(errorCode: string): string {
  if (errorCode === "emptyInput") return "No paste text was provided.";
  if (errorCode === "couldNotInferTemplateName") return "Could not infer a template name from the pasted text.";
  return errorCode;
}

function TemplateJsonCollapsible({
  summaryLabel,
  value,
  preExtraStyle
}: {
  summaryLabel: string;
  value: unknown;
  /** e.g. maxHeight for large blobs like full `stats` */
  preExtraStyle?: CSSProperties;
}): JSX.Element {
  return (
    <details className="template-json-collapsible" style={templateJsonCollapsibleDetailsStyle}>
      <summary className="template-json-collapsible-summary" style={templateJsonCollapsibleSummaryStyle}>
        <span className="template-json-collapsible-arrow" aria-hidden>
          ▶
        </span>
        {summaryLabel}
      </summary>
      <pre style={{ ...templateAbilityJsonPreStyle, marginTop: "0.35rem", ...preExtraStyle }}>
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}
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

/** Monster sheet quick stats: three columns (identity / defenses / resources). */
const centerQuickStatsThreeColumnsStyle: CSSProperties = {
  marginTop: "0.5rem",
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  columnGap: "1rem",
  alignItems: "start",
  fontSize: "0.8125rem",
  lineHeight: 1.45,
  color: "var(--text-primary)"
};

const centerQuickStatsColumnGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(6.5rem, auto) minmax(0, 1fr)",
  columnGap: "0.75rem",
  rowGap: "0.35rem",
  alignItems: "baseline"
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

/** Glossary underline on attack-line range/type wording only (numbers/distances stay plain). */
const monsterAttackLineGlossaryUnderline: CSSProperties = {
  cursor: "help",
  borderBottom: "1px dotted var(--text-muted)",
  color: "var(--text-primary)"
};

const microLabelInteractive: CSSProperties = {
  ...microLabelStyle,
  ...glossaryLinkUnderline,
  width: "fit-content"
};

const MONSTER_SELECTED_ID_STORAGE_KEY = "monsterEditor.selectedId";

const MONSTER_VIEWER_TAB_KEY = "monsterEditor.viewerTab";
const MONSTER_SELECTED_TEMPLATE_IDX_STORAGE_KEY = "monsterEditor.selectedTemplateIdx";
const MONSTER_CUSTOM_TEMPLATES_STORAGE_KEY = "monsterEditor.customMonsterTemplates";

type MonsterViewerTab = "monsters" | "templates" | "createTemplate";

function normalizeTemplateDedupeKey(t: Pick<MonsterTemplateRecord, "templateName" | "sourceBook">): string {
  const name = String(t.templateName ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  const book = String(t.sourceBook ?? "");
  return `${name}\0${book}`;
}

function readCustomMonsterTemplates(): MonsterTemplateRecord[] {
  try {
    const raw = window.localStorage.getItem(MONSTER_CUSTOM_TEMPLATES_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as MonsterTemplateRecord[]) : [];
  } catch {
    return [];
  }
}

function writeCustomMonsterTemplates(rows: MonsterTemplateRecord[]): void {
  try {
    window.localStorage.setItem(MONSTER_CUSTOM_TEMPLATES_STORAGE_KEY, JSON.stringify(rows));
  } catch {
    /* ignore */
  }
}

function mergeServerAndCustomTemplates(
  custom: MonsterTemplateRecord[],
  server: MonsterTemplateRecord[]
): MonsterTemplateRecord[] {
  const customKeys = new Set(custom.map(normalizeTemplateDedupeKey));
  const out = [...custom];
  for (const s of server) {
    if (!customKeys.has(normalizeTemplateDedupeKey(s))) out.push(s);
  }
  return out;
}

/** Trait range line in the sheet (omit empty or numeric 0 placeholders). */
function shouldShowTraitRangeLabel(rangeValue: unknown): boolean {
  if (rangeValue === undefined || rangeValue === null) return false;
  const s = String(rangeValue).trim();
  if (!s) return false;
  const n = typeof rangeValue === "number" ? rangeValue : Number(s);
  return !(typeof n === "number" && Number.isFinite(n) && n === 0);
}

/** True when this row matches an entry in local custom storage (deletable); server-only rows are false. */
function isStoredCustomTemplate(record: MonsterTemplateRecord | null): boolean {
  if (!record?.templateName?.trim()) return false;
  const key = normalizeTemplateDedupeKey(record);
  return readCustomMonsterTemplates().some((c) => normalizeTemplateDedupeKey(c) === key);
}

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

function readStoredViewerTab(): MonsterViewerTab {
  try {
    const stored = window.localStorage.getItem(MONSTER_VIEWER_TAB_KEY);
    if (stored === "templates") return "templates";
    if (stored === "createTemplate") return "createTemplate";
    return "monsters";
  } catch {
    return "monsters";
  }
}

function writeStoredViewerTab(tab: MonsterViewerTab): void {
  try {
    window.localStorage.setItem(MONSTER_VIEWER_TAB_KEY, tab);
  } catch {
    /* ignore */
  }
}

function readStoredTemplateIdx(): number {
  try {
    const raw = window.localStorage.getItem(MONSTER_SELECTED_TEMPLATE_IDX_STORAGE_KEY);
    const n = Number.parseInt(raw ?? "", 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

function writeStoredTemplateIdx(idx: number): void {
  try {
    window.localStorage.setItem(MONSTER_SELECTED_TEMPLATE_IDX_STORAGE_KEY, String(idx));
  } catch {
    /* ignore */
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

type MonsterPowerActionBucket = "standard" | "move" | "minor" | "free" | "triggered" | "other";
type MonsterPowerColorBucket = "atWill" | "encounter" | "daily" | "other";

function usageAccentColor(bucket: MonsterPowerActionBucket): string {
  if (bucket === "standard") return "var(--power-accent-atwill-bar)";
  if (bucket === "move") return "var(--power-accent-move-bar)";
  if (bucket === "minor") return "var(--power-accent-encounter-bar)";
  if (bucket === "free") return "var(--power-accent-free-bar)";
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
  if (bucket === "move") {
    return {
      border: "1px solid var(--power-accent-move-border)",
      borderLeft: "6px solid var(--power-accent-move-bar)",
      backgroundColor: "var(--power-accent-move-bg)"
    };
  }
  if (bucket === "minor") {
    return {
      border: "1px solid var(--power-accent-encounter-border)",
      borderLeft: "6px solid var(--power-accent-encounter-bar)",
      backgroundColor: "var(--power-accent-encounter-bg)"
    };
  }
  if (bucket === "free") {
    return {
      border: "1px solid var(--power-accent-free-border)",
      borderLeft: "6px solid var(--power-accent-free-bar)",
      backgroundColor: "var(--power-accent-free-bg)"
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
  if (/\bmove\b/.test(normalizedAction)) return "move";
  if (normalizedAction.includes("minor")) return "minor";
  if (normalizedAction.includes("free")) return "free";
  return "other";
}

function usageBucketLabel(bucket: MonsterPowerActionBucket): string {
  if (bucket === "standard") return "Standard Action";
  if (bucket === "move") return "Move Action";
  if (bucket === "minor") return "Minor Action";
  if (bucket === "free") return "Free Action";
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

/** Case-insensitive lookup for monster stat maps (skills, otherNumbers, etc.). */
function pickFromStatBlock(block: Record<string, unknown>, candidates: string[]): string {
  const lower = new Map(Object.entries(block).map(([k, v]) => [k.toLowerCase(), v]));
  for (const c of candidates) {
    const v = lower.get(c.toLowerCase());
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      return formatValue(v as string | number | boolean | undefined | null);
    }
  }
  return "-";
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

/** Show a stat row when missing/blank is false; if the value is a finite number, show only when nonzero (like Regeneration). */
function includeUnlessZeroNumeric(formatted: string): boolean {
  if (formatted === "-") return false;
  const num = Number(String(formatted).trim().replace(/,/g, ""));
  if (Number.isFinite(num)) return num !== 0;
  return true;
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
              onMouseEnter={(event) =>
                startGlossaryHover(event, `glossaryTerm:${monsterStatGlossaryTermForKey(nestedKey)}`)
              }
              onMouseLeave={leaveGlossaryHover}
              style={{ ...glossaryLinkUnderline, marginRight: "0.3rem" }}
            >
              {formatMonsterStatLabelForDisplay(nestedKey)}
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
          {outcome.nestedAttackDescriptions.map((textOrMini, idx) => (
            <div key={`${label}-nested-${idx}`} style={{ marginTop: idx ? "0.35rem" : undefined }}>
              {typeof textOrMini === "string" ? (
                renderGlossaryAwareText(
                  textOrMini,
                  commonDescriptiveGlossaryPhrases,
                  startGlossaryHover,
                  leaveGlossaryHover,
                  `${label}-nested-${idx}`,
                  shouldHighlightTerm
                )
              ) : (
                <>
                  {textOrMini.description ? (
                    <div style={{ ...richTextBodyPrimary.paragraphStyle, whiteSpace: "pre-wrap" }}>
                      {renderGlossaryAwareText(
                        textOrMini.description,
                        commonDescriptiveGlossaryPhrases,
                        startGlossaryHover,
                        leaveGlossaryHover,
                        `${label}-nested-${idx}-desc`,
                        shouldHighlightTerm
                      )}
                    </div>
                  ) : null}
                  {textOrMini.aftereffects?.length ? (
                    <div style={{ marginTop: "0.18rem" }}>
                      <div style={microLabelStyle}>Aftereffects</div>
                      {textOrMini.aftereffects.map((entry, j) =>
                        renderOutcomeEntry(entry, j, "Aftereffect", startGlossaryHover, leaveGlossaryHover, shouldHighlightTerm)
                      )}
                    </div>
                  ) : null}
                  {textOrMini.sustains?.length ? (
                    <div style={{ marginTop: "0.18rem" }}>
                      <div style={microLabelStyle}>Sustains</div>
                      {textOrMini.sustains.map((entry, j) =>
                        renderOutcomeEntry(entry, j, "Sustain", startGlossaryHover, leaveGlossaryHover, shouldHighlightTerm)
                      )}
                    </div>
                  ) : null}
                  {textOrMini.failedSavingThrows?.length ? (
                    <div style={{ marginTop: "0.18rem" }}>
                      <div style={microLabelStyle}>Failed Saving Throws</div>
                      {textOrMini.failedSavingThrows.map((entry, j) =>
                        renderOutcomeEntry(entry, j, "Failed Save", startGlossaryHover, leaveGlossaryHover, shouldHighlightTerm)
                      )}
                    </div>
                  ) : null}
                </>
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
  "radiant",
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

function splitCommaListSegments(raw: string): string[] {
  return String(raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Short entries ("fire", "cold") match glossary terms; full-sentence rules should stay plain text. */
function immunitySegmentEligibleForGlossaryHover(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (t.length > 56) return false;
  const words = t.split(/\s+/).filter(Boolean).length;
  return words <= 6;
}

/**
 * Build hover lookup key(s). Damage types often appear in glossary as "X damage".
 * Sense names may be lowercased in JSON while glossary uses title case.
 */
function buildGlossaryHoverKeyForTerm(
  term: string,
  options?: { tryDamageTypeEntry?: boolean; tryTitleCaseVariant?: boolean }
): MonsterGlossaryHoverKey {
  const t = term.trim();
  if (!t) return "glossaryTerm:";
  const variants: string[] = [t];
  if (options?.tryTitleCaseVariant) {
    const titled = titleCaseWords(t).trim();
    if (titled.length > 0 && titled.toLowerCase() !== t.toLowerCase()) variants.push(titled);
  }
  if (options?.tryDamageTypeEntry && !/\bdamage$/i.test(t)) variants.push(`${t} damage`);
  const seenLower = new Set<string>();
  const unique = variants.filter((v) => {
    const k = v.trim().toLowerCase();
    if (!k || seenLower.has(k)) return false;
    seenLower.add(k);
    return true;
  });
  if (unique.length === 1) return `glossaryTerm:${unique[0]}`;
  return `glossaryTerms:${unique.map((v) => encodeURIComponent(v)).join("|")}`;
}

function renderMonsterAttackLinePartWithRangeGlossary(
  part: string,
  startGlossaryHover: (event: ReactMouseEvent<HTMLElement>, key: MonsterGlossaryHoverKey) => void,
  leaveGlossaryHover: () => void
): JSX.Element {
  const vsSegments = parseAttackLineVsDefenseHighlightSegments(part);
  if (vsSegments) {
    return (
      <>
        {vsSegments.map((seg, idx) =>
          seg.kind === "text" ? (
            <span key={`vs-seg-${idx}`}>{seg.value}</span>
          ) : (
            <span
              key={`vs-seg-${idx}`}
              onMouseEnter={(event) =>
                startGlossaryHover(event, buildGlossaryHoverKeyForTerm(seg.value, { tryTitleCaseVariant: true }))
              }
              onMouseLeave={leaveGlossaryHover}
              style={monsterAttackLineGlossaryUnderline}
            >
              {seg.value}
            </span>
          )
        )}
      </>
    );
  }

  const split = splitMonsterAttackRangeLineForGlossary(part);
  if (split.kind === "full") {
    return (
      <span
        onMouseEnter={(event) => startGlossaryHover(event, `glossaryTerm:${split.text}`)}
        onMouseLeave={leaveGlossaryHover}
        style={monsterAttackLineGlossaryUnderline}
      >
        {split.text}
      </span>
    );
  }
  const { glossary, tail } = split;
  return (
    <>
      <span
        onMouseEnter={(event) => startGlossaryHover(event, `glossaryTerm:${glossary}`)}
        onMouseLeave={leaveGlossaryHover}
        style={monsterAttackLineGlossaryUnderline}
      >
        {glossary}
      </span>
      {tail ? (
        <>
          {" "}
          {tail}
        </>
      ) : null}
    </>
  );
}

function MonsterPowersPanels({
  powers,
  startGlossaryHover,
  leaveGlossaryHover,
  shouldHighlightGlossaryTerm,
  showJson
}: {
  powers: MonsterPower[];
  startGlossaryHover: (event: ReactMouseEvent<HTMLElement>, key: MonsterGlossaryHoverKey) => void;
  leaveGlossaryHover: () => void;
  shouldHighlightGlossaryTerm: (term: string) => boolean;
  /** Render collapsible JSON for each power below the card body (template preview; parent defaults on). */
  showJson?: boolean;
}): JSX.Element {
  const groupedPowers = useMemo(() => {
    const normalized = powers.map((power) => normalizeMonsterPowerShape(power));
    const buckets: Record<MonsterPowerActionBucket, MonsterPower[]> = {
      standard: [],
      move: [],
      minor: [],
      free: [],
      triggered: [],
      other: []
    };
    for (const power of normalized) {
      buckets[classifyMonsterPowerUsageBucket(power.action, power.trigger)].push(power);
    }
    return buckets;
  }, [powers]);

  return (
    <div
      style={{
        ...panelStyle,
        borderColor: "var(--panel-border-strong)",
        padding: "0.6rem 0.65rem",
        marginBottom: "0.65rem"
      }}
    >
      <h3 style={sectionTitleStyle}>Powers ({powers.length})</h3>
      <div style={{ marginTop: "0.5rem", display: "grid", gap: "0.6rem" }}>
        {powers.length === 0 ? <div style={metaMuted}>No powers parsed.</div> : null}
        {(["standard", "move", "minor", "free", "triggered", "other"] as const).map((bucket) => {
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
                            <span style={{ ...metaSecondary, fontWeight: 400 }}>
                              {"("}
                              {cardModel.usageDetailsLines.join(" ")}
                              {")"}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                      {cardModel.attackLineParts.length > 0 ? (
                        <div
                          style={{
                            fontSize: "0.8rem",
                            color: "var(--text-secondary)",
                            marginTop: "0.05rem",
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "0.22rem",
                            alignItems: "center"
                          }}
                        >
                          {cardModel.attackLineParts.map((part, partIdx) => (
                            <span key={`${power.name}-${index}-attackline-${partIdx}`}>
                              {renderMonsterAttackLinePartWithRangeGlossary(part, startGlossaryHover, leaveGlossaryHover)}
                              {partIdx < cardModel.attackLineParts.length - 1 ? (
                                <span style={{ color: "var(--text-muted)", margin: "0 0.1rem" }}>•</span>
                              ) : null}
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
                          <div
                            key={`${power.name}-${index}-${line.label}-${line.text}`}
                            style={{ fontSize: "0.8rem", color: "var(--text-primary)" }}
                          >
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
                            <div
                              key={`${power.name}-${index}-secondary-${secondaryIndex}`}
                              style={{ marginTop: secondaryIndex === 0 ? 0 : "0.3rem" }}
                            >
                              <div style={secondaryAttackTitleStyle}>{secondaryAttack.name}</div>
                              {secondaryAttack.attackLineParts.length > 0 ? (
                                <div
                                  style={{
                                    fontSize: "0.8rem",
                                    color: "var(--text-secondary)",
                                    marginTop: "0.05rem",
                                    display: "flex",
                                    flexWrap: "wrap",
                                    gap: "0.22rem",
                                    alignItems: "center"
                                  }}
                                >
                                  {secondaryAttack.attackLineParts.map((part, partIdx) => (
                                    <span key={`${power.name}-${index}-secondary-${secondaryIndex}-attackline-${partIdx}`}>
                                      {renderMonsterAttackLinePartWithRangeGlossary(part, startGlossaryHover, leaveGlossaryHover)}
                                      {partIdx < secondaryAttack.attackLineParts.length - 1 ? (
                                        <span style={{ color: "var(--text-muted)", margin: "0 0.1rem" }}>•</span>
                                      ) : null}
                                    </span>
                                  ))}
                                </div>
                              ) : null}
                              <div style={{ marginTop: "0.15rem", display: "grid", gap: "0.14rem" }}>
                                {secondaryAttack.outcomeLines.map((line) => (
                                  <div
                                    key={`${power.name}-${index}-secondary-${secondaryIndex}-${line.label}-${line.text}`}
                                    style={{ fontSize: "0.8rem", color: "var(--text-primary)" }}
                                  >
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
                                            <div
                                              key={`${power.name}-${index}-secondary-${secondaryIndex}-${line.label}-failed-${failedText}`}
                                              style={{ marginTop: "0.04rem" }}
                                            >
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
                      {showJson ? <TemplateJsonCollapsible summaryLabel="JSON" value={power} /> : null}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MonsterTemplateFormattedView({
  record,
  glossaryKeyPrefix,
  startGlossaryHover,
  leaveGlossaryHover,
  shouldHighlightGlossaryTerm,
  showAbilityJson = true
}: {
  record: MonsterTemplateRecord;
  glossaryKeyPrefix: string;
  startGlossaryHover: (event: ReactMouseEvent<HTMLElement>, key: MonsterGlossaryHoverKey) => void;
  leaveGlossaryHover: () => void;
  shouldHighlightGlossaryTerm: (term: string) => boolean;
  /** Collapsible JSON under each aura, trait, and power. Default true; pass false to hide. */
  showAbilityJson?: boolean;
}): JSX.Element {
  const statAdjustmentLines = useMemo(() => {
    const mechanical = formatMonsterTemplateStatAdjustmentLines(
      record.stats as Record<string, unknown> | undefined
    );
    if (mechanical !== null && mechanical.length > 0) return mechanical;
    return record.statLines ?? [];
  }, [record.stats, record.statLines]);

  return (
    <div style={{ minWidth: 0 }}>
      <div style={centerIdentityBlockStyle}>
        <div style={centerIdentityTitleStyle}>{record.templateName}</div>
        <div style={centerMetaLineStyle}>
          {(record.roleLine ?? record.role?.raw ?? "").trim() || "—"}
          {record.isEliteTemplate ? (
            <>
              {" "}
              <span style={sheetTagPillStyle}>Elite template</span>
            </>
          ) : null}
        </div>
        <div style={centerMetaLineStyle}>
          <strong>Source:</strong> {record.sourceBook}
        </div>
      </div>

      {record.prerequisite && String(record.prerequisite).trim() !== "" ? (
        <div style={centerSubsectionPanelStyle}>
          <h3 style={sectionTitleStyle}>Prerequisites</h3>
          <div style={{ ...richTextBodyPrimary.paragraphStyle, whiteSpace: "pre-wrap" }}>
            {renderGlossaryAwareText(
              String(record.prerequisite),
              commonDescriptiveGlossaryPhrases,
              startGlossaryHover,
              leaveGlossaryHover,
              `${glossaryKeyPrefix}-prereq`,
              shouldHighlightGlossaryTerm
            )}
          </div>
        </div>
      ) : null}

      {isRenderableCardValue(record.description) ? (
        <div style={centerSubsectionPanelStyle}>
          <h3 style={sectionTitleStyle}>Description</h3>
          <div style={{ ...richTextBodyPrimary.paragraphStyle, whiteSpace: "pre-wrap" }}>
            {renderGlossaryAwareText(
              String(record.description ?? ""),
              commonDescriptiveGlossaryPhrases,
              startGlossaryHover,
              leaveGlossaryHover,
              `${glossaryKeyPrefix}-desc`,
              shouldHighlightGlossaryTerm
            )}
          </div>
        </div>
      ) : null}

      {statAdjustmentLines.length > 0 || (record.stats && Object.keys(record.stats).length > 0) ? (
        <div style={centerSubsectionPanelStyle}>
          <h3 style={sectionTitleStyle}>Stat adjustments</h3>
          {statAdjustmentLines.length > 0 ? (
            <ul style={{ margin: "0.25rem 0 0 0", paddingLeft: "1rem", ...bodyPrimary }}>
              {statAdjustmentLines.map((line, i) => (
                <li key={`${glossaryKeyPrefix}-statline-${i}`} style={{ marginBottom: "0.22rem" }}>
                  {line}
                </li>
              ))}
            </ul>
          ) : null}
          {record.stats && Object.keys(record.stats).length > 0 ? (
            <TemplateJsonCollapsible
              summaryLabel="JSON"
              value={record.stats}
              preExtraStyle={{
                maxHeight: "min(40vh, 22rem)",
                overflowY: "auto",
                background: "rgba(0,0,0,0.04)",
                fontSize: "0.82rem",
                color: "var(--text-primary)"
              }}
            />
          ) : null}
        </div>
      ) : null}

      {(record.auras ?? []).length > 0 ? (
        <div style={centerSubsectionPanelStyle}>
          <h3 style={sectionTitleStyle}>Auras</h3>
          <div style={{ marginTop: "0.35rem", display: "grid", gap: "0.35rem" }}>
            {(record.auras ?? []).map((aura, idx) => {
              const auraName = String(aura.name ?? "Aura").trim() || "Aura";
              const auraBadges = renderTraitMetaBadges(aura);
              return (
                <div key={`${glossaryKeyPrefix}-aura-${idx}`} style={bodyPrimary}>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      gap: "0.35rem",
                      marginBottom: "0.18rem"
                    }}
                  >
                    <strong>{auraName}:</strong>
                    {auraBadges.map((badge) => (
                      <span
                        key={`${glossaryKeyPrefix}-aura-${idx}-tag-${badge}`}
                        style={{ ...sheetTagPillStyle, cursor: "default" }}
                      >
                        {badge}
                      </span>
                    ))}
                  </div>
                  {renderGlossaryAwareText(
                    String(aura.details ?? ""),
                    commonDescriptiveGlossaryPhrases,
                    startGlossaryHover,
                    leaveGlossaryHover,
                    `${glossaryKeyPrefix}-aura-${idx}`,
                    shouldHighlightGlossaryTerm
                  )}
                  {showAbilityJson ? (
                    <TemplateJsonCollapsible summaryLabel="JSON" value={aura} />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {(record.traits ?? []).length > 0 ? (
        <div style={centerSubsectionPanelStyle}>
          <h3 style={sectionTitleStyle}>Traits</h3>
          <div style={{ marginTop: "0.35rem", display: "grid", gap: "0.35rem" }}>
            {(record.traits ?? []).map((trait, idx) => {
              const traitName = String(trait.name ?? "Trait").trim() || "Trait";
              const traitBadges = renderTraitMetaBadges(trait);
              return (
                <div key={`${glossaryKeyPrefix}-trait-${idx}`} style={bodyPrimary}>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      gap: "0.35rem",
                      marginBottom: "0.18rem"
                    }}
                  >
                    <strong>{traitName}:</strong>
                    {traitBadges.map((badge) => (
                      <span
                        key={`${glossaryKeyPrefix}-trait-${idx}-tag-${badge}`}
                        style={{ ...sheetTagPillStyle, cursor: "default" }}
                      >
                        {badge}
                      </span>
                    ))}
                  </div>
                  {renderGlossaryAwareText(
                    String(trait.details ?? ""),
                    commonDescriptiveGlossaryPhrases,
                    startGlossaryHover,
                    leaveGlossaryHover,
                    `${glossaryKeyPrefix}-trait-${idx}`,
                    shouldHighlightGlossaryTerm
                  )}
                  {showAbilityJson ? (
                    <TemplateJsonCollapsible summaryLabel="JSON" value={trait} />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <MonsterPowersPanels
        powers={record.powers ?? []}
        startGlossaryHover={startGlossaryHover}
        leaveGlossaryHover={leaveGlossaryHover}
        shouldHighlightGlossaryTerm={shouldHighlightGlossaryTerm}
        showJson={showAbilityJson}
      />
    </div>
  );
}

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
  const [viewerTab, setViewerTab] = useState<MonsterViewerTab>(() => readStoredViewerTab());
  const [templateRows, setTemplateRows] = useState<MonsterTemplateRecord[]>([]);
  const [selectedTemplateIdx, setSelectedTemplateIdx] = useState<number>(() => readStoredTemplateIdx());
  const [templateMessage, setTemplateMessage] = useState<string>(
    "Load monster templates from generated JSON to begin."
  );
  /** When set, monster sheet shows base creature merged with this template (preview only). */
  const [monsterTemplatePreviewIdx, setMonsterTemplatePreviewIdx] = useState<number | null>(null);
  const [templateNameQuery, setTemplateNameQuery] = useState<string>("");
  const [templateSourceQuery, setTemplateSourceQuery] = useState<string>("");
  const [serverTemplateRows, setServerTemplateRows] = useState<MonsterTemplateRecord[]>([]);
  const [createPasteText, setCreatePasteText] = useState<string>("");
  const [createNameHint, setCreateNameHint] = useState<string>("");
  const [createDraftJson, setCreateDraftJson] = useState<string>("");
  const [createImportMessage, setCreateImportMessage] = useState<string>("");
  const [createImportValidation, setCreateImportValidation] = useState<MonsterTemplateImportValidation | null>(null);
  const [isBusy, setIsBusy] = useState<boolean>(false);
  const [jsonSearchInput, setJsonSearchInput] = useState<string>("");
  const [jsonSearchQuery, setJsonSearchQuery] = useState<string>("");
  const [jsonSearchResultIdx, setJsonSearchResultIdx] = useState<number>(0);
  const [jsonSearchJumpTick, setJsonSearchJumpTick] = useState<number>(0);
  const glossaryTooltipUi = useGlossaryTooltip({
    tooltipId: MONSTER_GLOSSARY_TOOLTIP_ID,
    resetDeps: [selectedId, viewerTab, selectedTemplateIdx, monsterTemplatePreviewIdx]
  });
  const startGlossaryHover = glossaryTooltipUi.startHover;
  const leaveGlossaryHover = glossaryTooltipUi.leaveHover;
  const jsonTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const createPasteTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const customTemplatesJsonFileInputRef = useRef<HTMLInputElement | null>(null);

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
    setMonsterTemplatePreviewIdx(null);
  }, [selectedId]);

  useEffect(() => {
    writeStoredViewerTab(viewerTab);
  }, [viewerTab]);

  useEffect(() => {
    writeStoredTemplateIdx(selectedTemplateIdx);
  }, [selectedTemplateIdx]);

  useEffect(() => {
    void (async () => {
      try {
        const templates = await loadMonsterTemplates();
        setServerTemplateRows(templates);
        const custom = readCustomMonsterTemplates();
        const merged = mergeServerAndCustomTemplates(custom, templates);
        setTemplateRows(merged);
        setSelectedTemplateIdx((prev) => (merged.length === 0 ? 0 : Math.min(prev, merged.length - 1)));
        setTemplateMessage(`Loaded ${templates.length} server templates; ${custom.length} custom (local).`);
      } catch (error) {
        const custom = readCustomMonsterTemplates();
        const merged = mergeServerAndCustomTemplates(custom, []);
        setServerTemplateRows([]);
        setTemplateRows(merged);
        setSelectedTemplateIdx((prev) => (merged.length === 0 ? 0 : Math.min(prev, merged.length - 1)));
        const errMsg = error instanceof Error ? error.message : "Could not load monster templates.";
        setTemplateMessage(
          merged.length > 0
            ? `${errMsg} Showing ${custom.length} custom template(s) from local storage (no generated JSON).`
            : errMsg
        );
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
    if (monsterTemplatePreviewIdx === null) return;
    if (monsterTemplatePreviewIdx >= templateRows.length) {
      setMonsterTemplatePreviewIdx(null);
    }
  }, [templateRows.length, monsterTemplatePreviewIdx]);

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

  const filteredTemplateIndexes = useMemo(() => {
    const nameNeedle = templateNameQuery.trim().toLowerCase();
    const bookNeedle = templateSourceQuery.trim().toLowerCase();
    return templateRows
      .map((row, idx) => ({ row, idx }))
      .filter(({ row }) => {
        if (nameNeedle && !String(row.templateName ?? "").toLowerCase().includes(nameNeedle)) {
          return false;
        }
        if (bookNeedle && !String(row.sourceBook ?? "").toLowerCase().includes(bookNeedle)) {
          return false;
        }
        return true;
      });
  }, [templateRows, templateNameQuery, templateSourceQuery]);

  const selectedTemplateRecord = useMemo(() => {
    if (templateRows.length === 0) return null;
    return templateRows[selectedTemplateIdx] ?? null;
  }, [templateRows, selectedTemplateIdx]);

  const importCustomTemplatesJsonText = useCallback(
    (text: string) => {
      const parsed = parseMonsterTemplatesImportJson(text);
      if (!parsed.ok) {
        setTemplateMessage(parsed.error);
        return;
      }
      const normalized = parsed.templates.map((t) => normalizeImportedTemplateRecord(t));
      const skipped: string[] = [];
      const okRows: MonsterTemplateRecord[] = [];
      for (let i = 0; i < normalized.length; i++) {
        const row = normalized[i];
        const v = validateMonsterTemplateImport(row);
        if (v.errors.length > 0) {
          const label = String(row.templateName ?? "").trim() || `#${i + 1}`;
          skipped.push(`${label}: ${v.errors.join("; ")}`);
          continue;
        }
        okRows.push(row);
      }
      if (okRows.length === 0) {
        setTemplateMessage(
          skipped.length > 0
            ? `Could not import any templates. ${skipped.slice(0, 6).join(" · ")}${skipped.length > 6 ? "…" : ""}`
            : "Nothing to import."
        );
        return;
      }
      let nextCustom = readCustomMonsterTemplates();
      for (const t of [...okRows].reverse()) {
        const key = normalizeTemplateDedupeKey(t);
        nextCustom = [t, ...nextCustom.filter((x) => normalizeTemplateDedupeKey(x) !== key)];
      }
      writeCustomMonsterTemplates(nextCustom);
      const merged = mergeServerAndCustomTemplates(nextCustom, serverTemplateRows);
      setTemplateRows(merged);
      const firstImported = okRows[0];
      const firstKey = normalizeTemplateDedupeKey(firstImported);
      const idx = merged.findIndex((t) => normalizeTemplateDedupeKey(t) === firstKey);
      setSelectedTemplateIdx(idx >= 0 ? idx : 0);
      const skipMsg =
        skipped.length > 0
          ? ` Skipped ${skipped.length}: ${skipped.slice(0, 2).join(" · ")}${skipped.length > 2 ? "…" : ""}`
          : "";
      setTemplateMessage(`Imported ${okRows.length} custom template(s).${skipMsg}`);
    },
    [serverTemplateRows]
  );

  const roleOptions = useMemo(() => {
    const unique = new Set<string>();
    for (const row of indexRows) {
      const role = (row.role ?? "").trim();
      if (role) unique.add(role);
    }
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [indexRows]);

  const sheetMonster = useMemo((): MonsterEntryFile | null => {
    if (!activeMonster) return null;
    if (viewerTab !== "monsters" || monsterTemplatePreviewIdx === null) return activeMonster;
    const tpl = templateRows[monsterTemplatePreviewIdx];
    if (!tpl) return activeMonster;
    return applyMonsterTemplateToEntry(activeMonster, tpl);
  }, [activeMonster, viewerTab, monsterTemplatePreviewIdx, templateRows]);

  const templatePreviewDelta = useMemo((): TemplateApplicationDelta | null => {
    if (!activeMonster || monsterTemplatePreviewIdx === null) return null;
    const tpl = templateRows[monsterTemplatePreviewIdx];
    if (!tpl) return null;
    return computeTemplateApplicationDelta(activeMonster, tpl);
  }, [activeMonster, monsterTemplatePreviewIdx, templateRows]);

  const displayedAuras = useMemo(() => {
    if (!sheetMonster || !Array.isArray(sheetMonster.auras)) return [];
    return sheetMonster.auras;
  }, [sheetMonster]);

  const displayedTraits = useMemo(() => {
    if (!sheetMonster || !Array.isArray(sheetMonster.traits)) return [];
    const normalize = (value: unknown): string => String(value ?? "").trim().toLowerCase();
    const auraSignatures = new Set(
      displayedAuras.map((aura) =>
        [normalize(aura.name), normalize(aura.range), normalize(aura.details)].join("||")
      )
    );
    return sheetMonster.traits.filter((trait) => {
      const signature = [normalize(trait.name), normalize(trait.range), normalize(trait.details)].join("||");
      return !auraSignatures.has(signature);
    });
  }, [sheetMonster, displayedAuras]);

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
      const rangeText = shouldShowTraitRangeLabel(rangeValue) ? ` • Range ${String(rangeValue).trim()}` : "";
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

  const rawJsonText = useMemo(() => {
    if (viewerTab === "createTemplate") {
      const raw = createDraftJson.trim();
      if (!raw) return "{}";
      try {
        return JSON.stringify(JSON.parse(raw), null, 2);
      } catch {
        return createDraftJson;
      }
    }
    if (viewerTab === "templates") {
      return JSON.stringify(selectedTemplateRecord ?? {}, null, 2);
    }
    return JSON.stringify(sheetMonster ?? activeMonster, null, 2);
  }, [viewerTab, selectedTemplateRecord, activeMonster, sheetMonster, createDraftJson]);
  const jsonSearchMatches = useMemo(
    () => findCaseInsensitiveMatches(rawJsonText, jsonSearchQuery),
    [rawJsonText, jsonSearchQuery]
  );
  const lastHandledJsonSearchJumpTickRef = useRef<number>(0);
  const glossaryResolutionCacheRef = useRef<Map<string, boolean>>(new Map());

  useEffect(() => {
    glossaryResolutionCacheRef.current.clear();
  }, [index, tooltipGlossary]);

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
    const monsterCtx = { glossaryByName: tooltipGlossary, index };
    const resolvedEntries = resolveMonsterGlossaryHoverSections(key, monsterCtx);
    if (resolvedEntries.length === 1) {
      return <GlossaryTooltipRichText text={resolvedEntries[0].text} />;
    }
    if (resolvedEntries.length > 1) {
      return (
        <div style={{ display: "grid", gap: "0.35rem" }}>
          {resolvedEntries.map((entry) => (
            <div key={entry.term}>
              <div style={{ fontWeight: 700 }}>{entry.term}</div>
              <GlossaryTooltipRichText text={entry.text} />
            </div>
          ))}
        </div>
      );
    }
    return <div>No description available.</div>;
  }

  const shouldHighlightGlossaryTerm = useCallback(
    (term: string): boolean => {
      const normalized = term.trim().toLowerCase();
      if (!normalized) return false;
      const cached = glossaryResolutionCacheRef.current.get(normalized);
      if (cached !== undefined) return cached;
      const resolvedText = resolveMonsterStyleTooltip(term, { glossaryByName: tooltipGlossary, index });
      const hasEntry = Boolean(resolvedText && resolvedText.trim().length > 0);
      glossaryResolutionCacheRef.current.set(normalized, hasEntry);
      return hasEntry;
    },
    [index, tooltipGlossary]
  );

  const createDraftTemplateRecord = useMemo((): MonsterTemplateRecord | null => {
    if (viewerTab !== "createTemplate") return null;
    const raw = createDraftJson.trim();
    if (!raw) return null;
    try {
      return JSON.parse(raw) as MonsterTemplateRecord;
    } catch {
      return null;
    }
  }, [viewerTab, createDraftJson]);

  const createDraftJsonInvalid = useMemo(() => {
    if (viewerTab !== "createTemplate") return false;
    const raw = createDraftJson.trim();
    if (!raw) return false;
    try {
      JSON.parse(raw);
      return false;
    } catch {
      return true;
    }
  }, [viewerTab, createDraftJson]);

  const createDraftValidation = useMemo<MonsterTemplateImportValidation>(() => {
    if (viewerTab !== "createTemplate") return { errors: [], warnings: [] };
    const raw = createDraftJson.trim();
    if (!raw) return { errors: [], warnings: [] };
    if (createDraftJsonInvalid || !createDraftTemplateRecord) {
      return { errors: ["Draft JSON is invalid."], warnings: [] };
    }
    return validateMonsterTemplateImport(createDraftTemplateRecord);
  }, [viewerTab, createDraftJson, createDraftJsonInvalid, createDraftTemplateRecord]);

  const insertCreatePasteMarker = useCallback((marker: "[ABILITY]" | "[ABILITYEND]") => {
    const el = createPasteTextareaRef.current;
    if (!el) {
      setCreatePasteText((prev) => prev + marker);
      return;
    }
    const value = el.value;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = value.slice(0, start) + marker + value.slice(end);
    const caret = start + marker.length;
    setCreatePasteText(next);
    window.setTimeout(() => {
      el.focus({ preventScroll: true });
      el.setSelectionRange(caret, caret);
    }, 0);
  }, []);

  /** Joins wrapped OCR within the textarea selection; line-oriented parsing stays intact outside the selection. */
  const stripLineBreaksInCreatePasteSelection = useCallback(() => {
    const el = createPasteTextareaRef.current;
    if (!el) return;
    const value = el.value;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    if (start === end) return;
    const segment = value.slice(start, end);
    const replaced = segment.replace(/\r\n|\r|\n/g, " ").replace(/[ \t]+/g, " ");
    const next = value.slice(0, start) + replaced + value.slice(end);
    setCreatePasteText(next);
    const selEnd = start + replaced.length;
    window.setTimeout(() => {
      el.focus({ preventScroll: true });
      el.setSelectionRange(start, selEnd);
    }, 0);
  }, []);

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

      <div
        role="tablist"
        aria-label="Viewer"
        style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.5rem", alignItems: "center" }}
      >
        <button
          type="button"
          role="tab"
          aria-selected={viewerTab === "monsters"}
          onClick={() => setViewerTab("monsters")}
          disabled={viewerTab === "monsters"}
        >
          Monsters
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={viewerTab === "templates"}
          onClick={() => setViewerTab("templates")}
          disabled={viewerTab === "templates"}
        >
          Monster templates
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={viewerTab === "createTemplate"}
          onClick={() => setViewerTab("createTemplate")}
          disabled={viewerTab === "createTemplate"}
        >
          Create template
        </button>
      </div>

      <p style={{ marginTop: 0, marginBottom: "0.5rem", color: "var(--text-muted)", fontSize: "0.8rem" }}>
        {viewerTab === "monsters" ? (
          <>
            JSON-backed viewer for <code style={{ fontSize: "0.92em" }}>generated/monsters</code> with formatted identity,
            stats, powers, and parsed sections.
          </>
        ) : viewerTab === "templates" ? (
          <>
            Template overlays from{" "}
            <code style={{ fontSize: "0.92em" }}>generated/monster_templates.json</code> (published PDF-derived text plus
            structured stats and powers). Custom templates saved here live in{" "}
            <code style={{ fontSize: "0.92em" }}>localStorage</code> only until you copy them into generated JSON.{" "}
            <strong>Export Templates</strong> saves the full list shown here (generated{" "}
            <code style={{ fontSize: "0.92em" }}>monster_templates.json</code> plus browser-saved customs when loaded).{" "}
            <strong>Copy template</strong> copies JSON for the template selected in the list;{" "}
            <strong>Import templates</strong> / <strong>Import from clipboard</strong> accepts one template, an array, or the{" "}
            <code style={{ fontSize: "0.92em" }}>{`{ meta, templates }`}</code> bundle (same as generated{" "}
            <code style={{ fontSize: "0.92em" }}>monster_templates.json</code>).
          </>
        ) : (
          <>
            Paste raw text for one monster template.  Import and review the result. Edit the JSON, then save it as a local custom
            template.
            <span style={{ display: "block", marginTop: "0.35rem" }}>
              <strong>Tip:</strong> If OCR split a long resistance, vulnerability, or other stat across several lines, delete those
              line breaks so it reads as one line—this helps the importer recognize stat boundaries.
            </span>
            <span style={{ display: "block", marginTop: "0.35rem" }}>
              Optional: wrap an ability (power, trait, or aura) by putting <code style={{ fontSize: "0.92em" }}>[ABILITY]</code>{" "}
              on its own line right before the block and <code style={{ fontSize: "0.92em" }}>[ABILITYEND]</code> on its own line
              right after—those lines fence the block so parsing stays aligned.
            </span>
          </>
        )}
      </p>

      {viewerTab === "monsters" ? (
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
            Reload monster index
          </button>
          <input
            value={nameQuery}
            onChange={(event) => setNameQuery(event.target.value)}
            placeholder="Name"
            style={{
              minWidth: 220,
              border: "1px solid var(--panel-border)",
              borderRadius: "0.28rem",
              padding: "0.22rem 0.3rem"
            }}
          />
          <input
            value={levelQuery}
            onChange={(event) => setLevelQuery(event.target.value)}
            placeholder="Level (e.g. 7 or 5-8)"
            style={{
              minWidth: 200,
              border: "1px solid var(--panel-border)",
              borderRadius: "0.28rem",
              padding: "0.22rem 0.3rem"
            }}
          />
          <select
            value={roleQuery}
            onChange={(event) => setRoleQuery(event.target.value)}
            style={{
              minWidth: 180,
              border: "1px solid var(--panel-border)",
              borderRadius: "0.28rem",
              padding: "0.22rem 0.3rem"
            }}
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
            style={{
              minWidth: 150,
              border: "1px solid var(--panel-border)",
              borderRadius: "0.28rem",
              padding: "0.22rem 0.3rem"
            }}
          >
            <option value="both">-</option>
            <option value="leader">Leader</option>
            <option value="notLeader">Not leader</option>
          </select>
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as "name" | "level")}
            style={{
              minWidth: 140,
              border: "1px solid var(--panel-border)",
              borderRadius: "0.28rem",
              padding: "0.22rem 0.3rem"
            }}
          >
            <option value="name">Sort: Name</option>
            <option value="level">Sort: Level</option>
          </select>
          <select
            value={sortDir}
            onChange={(event) => setSortDir(event.target.value as "asc" | "desc")}
            style={{
              minWidth: 140,
              border: "1px solid var(--panel-border)",
              borderRadius: "0.28rem",
              padding: "0.22rem 0.3rem"
            }}
          >
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </div>
      ) : viewerTab === "templates" ? (
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.75rem", alignItems: "center" }}>
          <button
            type="button"
            onClick={() => {
              setIsBusy(true);
              void loadMonsterTemplates()
                .then((rows) => {
                  setServerTemplateRows(rows);
                  const merged = mergeServerAndCustomTemplates(readCustomMonsterTemplates(), rows);
                  setTemplateRows(merged);
                  setSelectedTemplateIdx((prev) =>
                    merged.length === 0 ? 0 : Math.min(prev, merged.length - 1)
                  );
                  setTemplateMessage(`Reloaded ${rows.length} server templates (${merged.length} total with custom).`);
                })
                .catch((error: unknown) => {
                  const custom = readCustomMonsterTemplates();
                  const merged = mergeServerAndCustomTemplates(custom, serverTemplateRows);
                  setTemplateRows(merged);
                  setSelectedTemplateIdx((prev) =>
                    merged.length === 0 ? 0 : Math.min(prev, merged.length - 1)
                  );
                  const errMsg = error instanceof Error ? error.message : "Could not reload monster templates.";
                  setTemplateMessage(
                    merged.length > 0
                      ? serverTemplateRows.length > 0
                        ? `${errMsg} Kept previous server list in memory; ${custom.length} custom from storage.`
                        : `${errMsg} Showing ${custom.length} custom template(s) from local storage.`
                      : errMsg
                  );
                })
                .finally(() => setIsBusy(false));
            }}
            disabled={isBusy}
          >
            Reload templates
          </button>
          <button
            type="button"
            disabled={isBusy || templateRows.length === 0}
            title={
              templateRows.length === 0
                ? "No templates loaded — reload or fix generated/monster_templates.json"
                : "Export { meta, templates } to a file (loaded generated templates plus local customs)"
            }
            onClick={() => {
              const rows = templateRows;
              if (rows.length === 0) return;
              const file = buildMonsterTemplatesExportFile(rows);
              const text = stringifyMonsterTemplatesJsonFile(file);
              const blob = new Blob([text], { type: "application/json;charset=utf-8" });
              const url = URL.createObjectURL(blob);
              try {
                const a = document.createElement("a");
                a.href = url;
                a.download = `monster_templates_export_${new Date().toISOString().slice(0, 10)}.json`;
                a.rel = "noopener";
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
              } finally {
                URL.revokeObjectURL(url);
              }
              setTemplateMessage(
                `Exported ${rows.length} template(s) as JSON (meta + templates, like monster_templates.json).`
              );
            }}
          >
            Export Templates
          </button>
          <button
            type="button"
            disabled={isBusy || !selectedTemplateRecord}
            title={
              !selectedTemplateRecord
                ? "Select a template in the list first"
                : "Copy this template record as pretty-printed JSON"
            }
            onClick={() => {
              const record = selectedTemplateRecord;
              if (!record) return;
              if (!navigator.clipboard?.writeText) {
                alert("Clipboard API unavailable in this browser.");
                return;
              }
              const text = `${JSON.stringify(record, null, 2)}\n`;
              void navigator.clipboard.writeText(text);
              const label = String(record.templateName ?? "").trim() || "template";
              setTemplateMessage(`Copied “${label}” as JSON.`);
            }}
          >
            Copy template
          </button>
          <input
            ref={customTemplatesJsonFileInputRef}
            type="file"
            accept=".json,application/json"
            aria-label="Import templates from a JSON file"
            style={{ display: "none" }}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              void file.text().then(importCustomTemplatesJsonText, () => {
                setTemplateMessage("Could not read file.");
              });
            }}
          />
          <button
            type="button"
            disabled={isBusy}
            title="Choose a .json file: one template object, an array of templates, or { meta, templates }"
            onClick={() => customTemplatesJsonFileInputRef.current?.click()}
          >
            Import templates
          </button>
          <button
            type="button"
            disabled={isBusy}
            title="Import JSON from the clipboard (same formats as file import)"
            onClick={() => {
              if (!navigator.clipboard?.readText) {
                alert("Clipboard read is unavailable in this browser.");
                return;
              }
              void navigator.clipboard.readText().then(importCustomTemplatesJsonText, () => {
                setTemplateMessage("Could not read clipboard.");
              });
            }}
          >
            Import from clipboard
          </button>
          <button
            type="button"
            disabled={isBusy || !isStoredCustomTemplate(selectedTemplateRecord)}
            title={
              !selectedTemplateRecord
                ? "Select a template first"
                : isStoredCustomTemplate(selectedTemplateRecord)
                  ? "Remove this entry from local custom templates (browser storage)"
                  : "Generated templates cannot be deleted here — only local custom saves"
            }
            onClick={() => {
              const record = selectedTemplateRecord;
              if (!record || !isStoredCustomTemplate(record)) return;
              const key = normalizeTemplateDedupeKey(record);
              const label = String(record.templateName ?? "").trim() || "template";
              if (
                !window.confirm(
                  `Remove custom template “${label}” from this browser’s saved templates? This does not change generated JSON files.`
                )
              ) {
                return;
              }
              const nextCustom = readCustomMonsterTemplates().filter((t) => normalizeTemplateDedupeKey(t) !== key);
              writeCustomMonsterTemplates(nextCustom);
              const merged = mergeServerAndCustomTemplates(nextCustom, serverTemplateRows);
              setTemplateRows(merged);
              const replacedIdx = merged.findIndex((t) => normalizeTemplateDedupeKey(t) === key);
              if (replacedIdx >= 0) {
                setSelectedTemplateIdx(replacedIdx);
              } else if (merged.length === 0) {
                setSelectedTemplateIdx(0);
              } else {
                setSelectedTemplateIdx((prev) => Math.min(prev, merged.length - 1));
              }
              setTemplateMessage(`Removed custom template “${label}”.`);
            }}
          >
            Delete custom template
          </button>
          <input
            value={templateNameQuery}
            onChange={(event) => setTemplateNameQuery(event.target.value)}
            placeholder="Template name"
            style={{
              minWidth: 220,
              border: "1px solid var(--panel-border)",
              borderRadius: "0.28rem",
              padding: "0.22rem 0.3rem"
            }}
          />
          <input
            value={templateSourceQuery}
            onChange={(event) => setTemplateSourceQuery(event.target.value)}
            placeholder="Source PDF (substring)"
            style={{
              minWidth: 240,
              border: "1px solid var(--panel-border)",
              borderRadius: "0.28rem",
              padding: "0.22rem 0.3rem"
            }}
          />
        </div>
      ) : viewerTab === "createTemplate" ? (
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center", marginBottom: "0.75rem" }}>
          <button
            type="button"
            disabled={isBusy || !createPasteText.trim()}
            onClick={() => {
              setIsBusy(true);
              setCreateImportMessage("");
              setCreateImportValidation(null);
              void parsePastedMonsterTemplateText(createPasteText, createNameHint)
                .then((result) => {
                  if (!result.ok) {
                    const mappedError = mapImportParseErrorToMessage(result.error);
                    setCreateImportMessage(mappedError);
                    setCreateImportValidation({ errors: [mappedError], warnings: [] });
                    return;
                  }
                  setCreateDraftJson(JSON.stringify(result.template, null, 2));
                  setCreateImportValidation(result.validation);
                  if (result.validation.errors.length > 0) {
                    setCreateImportMessage("Imported with issues. Fix import errors before saving.");
                  } else if (result.validation.warnings.length > 0) {
                    setCreateImportMessage(`Imported with ${result.validation.warnings.length} warning(s). Review before saving.`);
                  } else {
                    setCreateImportMessage(
                      "Imported. Review and edit the JSON panel below, then save to custom templates."
                    );
                  }
                })
                .finally(() => setIsBusy(false));
            }}
          >
            Import monster template
          </button>
          <button
            type="button"
            disabled={isBusy || !createDraftJson.trim() || createDraftValidation.errors.length > 0}
            onClick={() => {
              if (createDraftValidation.errors.length > 0) {
                setCreateImportMessage("Fix import issues before saving.");
                return;
              }
              let parsed: MonsterTemplateRecord;
              try {
                parsed = JSON.parse(createDraftJson) as MonsterTemplateRecord;
              } catch {
                setCreateImportMessage("Invalid JSON — fix the draft before saving.");
                return;
              }
              if (!parsed.templateName?.trim()) {
                setCreateImportMessage("Draft must include templateName.");
                return;
              }
              if (parsed.powers != null && !Array.isArray(parsed.powers)) {
                setCreateImportMessage("powers must be an array when present.");
                return;
              }
              if (!Array.isArray(parsed.powers)) parsed.powers = [];
              if (!parsed.sourceBook?.trim()) parsed.sourceBook = "manual import";
              const custom = readCustomMonsterTemplates();
              const key = normalizeTemplateDedupeKey(parsed);
              const nextCustom = [parsed, ...custom.filter((t) => normalizeTemplateDedupeKey(t) !== key)];
              writeCustomMonsterTemplates(nextCustom);
              const merged = mergeServerAndCustomTemplates(nextCustom, serverTemplateRows);
              setTemplateRows(merged);
              const idx = merged.findIndex((t) => normalizeTemplateDedupeKey(t) === key);
              setSelectedTemplateIdx(idx >= 0 ? idx : 0);
              setViewerTab("templates");
              setTemplateMessage(`Saved custom template “${parsed.templateName}”.`);
              setCreateImportMessage("");
            }}
          >
            Save to custom templates
          </button>
          <input
            value={createNameHint}
            onChange={(event) => setCreateNameHint(event.target.value)}
            placeholder="Template name hint (optional)"
            style={{
              minWidth: 200,
              border: "1px solid var(--panel-border)",
              borderRadius: "0.28rem",
              padding: "0.22rem 0.3rem"
            }}
          />
        </div>
      ) : null}

      <div
        role="status"
        aria-live="polite"
        style={{
          marginBottom: "0.75rem",
          fontSize: "0.8rem",
          color: (() => {
            const line =
              viewerTab === "monsters"
                ? message
                : viewerTab === "templates"
                  ? templateMessage
                  : createImportMessage;
            return line.toLowerCase().includes("could not") ||
              line.toLowerCase().includes("invalid") ||
              line.toLowerCase().includes("issues")
              ? "var(--status-danger)"
              : "var(--text-muted)";
          })()
        }}
      >
        {viewerTab === "monsters"
          ? message
          : viewerTab === "templates"
            ? templateMessage
            : createImportMessage}
      </div>
      {viewerTab === "createTemplate" && createImportValidation && createImportValidation.errors.length > 0 && (
        <div style={errorPanelStyle}>
          <strong style={{ fontSize: "0.85rem", color: "var(--status-danger)" }}>Import issues</strong>
          <ul style={{ margin: "0.35rem 0 0 1rem", color: "var(--status-danger)", fontSize: "0.85rem" }}>
            {createImportValidation.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}
      {viewerTab === "createTemplate" && createImportValidation && createImportValidation.warnings.length > 0 && (
        <div style={warningPanelStyle}>
          <strong style={{ fontSize: "0.85rem", color: "var(--status-warning)" }}>Import warnings</strong>
          <ul style={{ margin: "0.35rem 0 0 1rem", color: "var(--status-warning)", fontSize: "0.85rem" }}>
            {createImportValidation.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}
      {viewerTab === "createTemplate" && createDraftValidation.errors.length > 0 && (
        <div style={{ marginTop: "-0.35rem", marginBottom: "0.75rem", color: "var(--status-danger)", fontSize: "0.8rem" }}>
          Save is disabled until blocking import issues are fixed.
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 2fr)",
          gap: "1rem",
          minHeight: "65vh"
        }}
      >
        {viewerTab === "monsters" ? (
          <>
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
                      {entry.parseError && (
                        <div style={{ ...metaMuted, color: "var(--status-danger)" }}>Invalid XML</div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ ...sheetPanel, padding: "0.75rem" }}>
          {!sheetMonster ? (
            <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.8125rem", lineHeight: 1.45 }}>
              Select a monster to view its generated JSON data.
            </p>
          ) : (
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  marginBottom: "0.65rem",
                  padding: "0.45rem 0.55rem",
                  borderRadius: "var(--ui-panel-radius, 0.35rem)",
                  border: "1px solid var(--panel-border)",
                  backgroundColor: "var(--surface-1)",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.45rem",
                  alignItems: "center"
                }}
              >
                <span style={{ ...metaMuted, fontSize: "0.78rem", whiteSpace: "nowrap" }}>Template preview</span>
                <select
                  value={monsterTemplatePreviewIdx === null ? "" : String(monsterTemplatePreviewIdx)}
                  onChange={(event) => {
                    const v = event.target.value;
                    setMonsterTemplatePreviewIdx(v === "" ? null : Number.parseInt(v, 10));
                  }}
                  aria-label="Merge a monster template onto this creature for preview"
                  style={{
                    minWidth: "12rem",
                    maxWidth: "100%",
                    fontSize: "0.8125rem",
                    padding: "0.28rem 0.4rem",
                    borderRadius: "0.25rem",
                    border: "1px solid var(--panel-border)",
                    backgroundColor: "var(--surface-0)",
                    color: "var(--text-primary)"
                  }}
                >
                  <option value="">None (base creature)</option>
                  {templateRows.map((row, idx) => (
                    <option key={`monster-sheet-tpl-${idx}`} value={String(idx)}>
                      {String(row.templateName ?? "").trim() || `Template ${idx + 1}`}
                      {row.sourceBook ? ` — ${row.sourceBook}` : ""}
                    </option>
                  ))}
                </select>
                {monsterTemplatePreviewIdx !== null && templatePreviewDelta ? (
                  <span style={{ fontSize: "0.76rem", color: "var(--text-secondary)", lineHeight: 1.35 }}>
                    +{templatePreviewDelta.addedPowerNames.length} powers, +{templatePreviewDelta.addedTraitNames.length}{" "}
                    traits, +{templatePreviewDelta.addedAuraNames.length} auras
                    {templatePreviewDelta.skippedDuplicatePowers +
                      templatePreviewDelta.skippedDuplicateTraits +
                      templatePreviewDelta.skippedDuplicateAuras >
                    0
                      ? ` (${templatePreviewDelta.skippedDuplicatePowers + templatePreviewDelta.skippedDuplicateTraits + templatePreviewDelta.skippedDuplicateAuras} duplicate lines skipped)`
                      : ""}
                  </span>
                ) : null}
              </div>
              {monsterTemplatePreviewIdx !== null && templateRows[monsterTemplatePreviewIdx] ? (
                <div
                  style={{
                    marginBottom: "0.55rem",
                    padding: "0.4rem 0.55rem",
                    borderRadius: "var(--ui-panel-radius, 0.35rem)",
                    border: "1px solid var(--power-accent-encounter-border)",
                    backgroundColor: "var(--surface-1)",
                    fontSize: "0.78rem",
                    color: "var(--text-secondary)",
                    lineHeight: 1.45
                  }}
                >
                  Previewing{" "}
                  <strong style={{ color: "var(--text-primary)" }}>
                    {templateRows[monsterTemplatePreviewIdx]?.templateName}
                  </strong>
                  . Powers, traits, and auras from the template are appended below (deduped by name). Core statistics are
                  unchanged; adjust HP and defenses using the template&apos;s stat guidance in the book when applicable.
                </div>
              ) : null}
              <div style={centerIdentityBlockStyle}>
                <div style={centerIdentityTitleStyle}>
                  <span>{sheetMonster.name}</span>
                  {sheetMonster.alignment?.name ? (
                    <>
                      {" "}
                      <span
                        {...glossaryTooltipUi.hoverA11y(`glossaryTerm:${sheetMonster.alignment.name}`)}
                        style={{
                          cursor: "help",
                          borderBottom: "1px dotted var(--text-muted)",
                          fontWeight: 700,
                          letterSpacing: "0.02em",
                          color: "var(--text-primary)"
                        }}
                      >
                        ({sheetMonster.alignment.name})
                      </span>
                    </>
                  ) : null}
                </div>
                <div style={centerMetaLineStyle}>
                  <span
                    {...glossaryTooltipUi.hoverA11y("glossaryTerm:Level")}
                    style={glossaryLinkUnderline}
                  >
                    Level
                  </span>{" "}
                  {formatValue(sheetMonster.level)}{" "}
                  {isRenderableCardValue(sheetMonster.groupRole) ? (
                    <>
                      <span
                        {...glossaryTooltipUi.hoverA11y(`glossaryTerm:${String(sheetMonster.groupRole)}`)}
                        style={glossaryLinkUnderline}
                      >
                        {String(sheetMonster.groupRole)}
                      </span>{" "}
                    </>
                  ) : null}
                  <span
                    {...glossaryTooltipUi.hoverA11y(`glossaryTerm:${sheetMonster.role || "Role"}`)}
                    style={glossaryLinkUnderline}
                  >
                    {sheetMonster.role || ""}
                  </span>
                </div>
                <div style={centerMetaLineStyle}>
                  <span
                    {...glossaryTooltipUi.hoverA11y(`glossaryTerm:${sheetMonster.size || "Size"}`)}
                    style={glossaryLinkUnderline}
                  >
                    {sheetMonster.size || "Unknown size"}
                  </span>{" "}
                  <span style={centerBulletStyle} aria-hidden>
                    •
                  </span>{" "}
                  <span
                    {...glossaryTooltipUi.hoverA11y(`glossaryTerm:${sheetMonster.origin || "Origin"}`)}
                    style={glossaryLinkUnderline}
                  >
                    {sheetMonster.origin || "Unknown origin"}
                  </span>{" "}
                  <span style={centerBulletStyle} aria-hidden>
                    •
                  </span>{" "}
                  <span
                    {...glossaryTooltipUi.hoverA11y(`glossaryTerm:${sheetMonster.type || "Type"}`)}
                    style={glossaryLinkUnderline}
                  >
                    {sheetMonster.type || "Unknown type"}
                  </span>{" "}
                  {Array.isArray(sheetMonster.keywords) && sheetMonster.keywords.length > 0
                    ? sheetMonster.keywords.map((kw, idx) => (
                        <span key={`monster-header-kw-${idx}-${String(kw)}`}>
                          <span style={centerBulletStyle} aria-hidden>
                            •
                          </span>{" "}
                          <span
                            {...glossaryTooltipUi.hoverA11y(`glossaryTerm:${String(kw)}`)}
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
                    {...glossaryTooltipUi.hoverA11y("glossaryTerm:Experience")}
                    style={glossaryLinkUnderline}
                  >
                    XP
                  </span>{" "}
                  {formatValue(sheetMonster.xp)}
                </div>
                {(() => {
                  const on = (sheetMonster.stats?.otherNumbers ?? {}) as Record<string, unknown>;
                  const skillsBlock = (sheetMonster.stats?.skills ?? {}) as Record<string, unknown>;
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
                  const perceptionFromSkills = pickFromStatBlock(skillsBlock, ["perception"]);
                  const perception =
                    perceptionFromSkills !== "-" ? perceptionFromSkills : pick(["perception"]);
                  const actionPts = pick(["actionPoints", "action points"]);
                  const saves = pick(["savingThrows", "saving throws"]);
                  const defensesBlock = (sheetMonster.stats?.defenses ?? {}) as Record<string, unknown>;
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
                  const regenerationRaw = sheetMonster.regeneration;
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
                  type QuickStatRow = { label: string; glossary: MonsterGlossaryHoverKey; val: string };
                  const col1: QuickStatRow[] = [];
                  const col2: QuickStatRow[] = [];
                  const col3: QuickStatRow[] = [];
                  if (hitPoints !== "-") {
                    col1.push({ label: "Hit Points", glossary: "glossaryTerm:Hit Points", val: hitPoints });
                  }
                  if (initiative !== "-") {
                    col1.push({
                      label: "Initiative",
                      glossary: "glossaryTerm:Initiative",
                      val: formatLeadingPlusIfPositive(initiative)
                    });
                  }
                  if (perception !== "-") {
                    col1.push({
                      label: "Perception",
                      glossary: "glossaryTerm:Perception",
                      val: formatLeadingPlusIfPositive(perception)
                    });
                  }
                  if (ac !== "-") col2.push({ label: "AC", glossary: "glossaryTerm:AC", val: ac });
                  if (fortitude !== "-") {
                    col2.push({ label: "Fortitude", glossary: "glossaryTerm:Fortitude", val: fortitude });
                  }
                  if (reflex !== "-") col2.push({ label: "Reflex", glossary: "glossaryTerm:Reflex", val: reflex });
                  if (will !== "-") col2.push({ label: "Will", glossary: "glossaryTerm:Will", val: will });
                  if (regenerationVal !== null) {
                    col3.push({
                      label: "Regeneration",
                      glossary: "glossaryTerm:Regeneration",
                      val: regenerationVal
                    });
                  }
                  if (includeUnlessZeroNumeric(actionPts)) {
                    col3.push({ label: "Action Points", glossary: "glossaryTerm:Action Points", val: actionPts });
                  }
                  if (includeUnlessZeroNumeric(saves)) {
                    col3.push({
                      label: "Saving Throws",
                      glossary: "glossaryTerm:Saving Throws",
                      val: formatLeadingPlusIfPositive(saves)
                    });
                  }
                  if (col1.length === 0 && col2.length === 0 && col3.length === 0) return null;
                  const renderQuickStatColumn = (rows: QuickStatRow[], colKey: string) => (
                    <div key={colKey} style={centerQuickStatsColumnGridStyle}>
                      {rows.flatMap((r) => [
                        <span
                          key={`${colKey}-${r.label}-l`}
                          {...glossaryTooltipUi.hoverA11y(r.glossary)}
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
                        <span key={`${colKey}-${r.label}-v`} style={centerQuickStatValueStyle}>
                          {r.val}
                        </span>
                      ])}
                    </div>
                  );
                  return (
                    <div style={centerQuickStatsThreeColumnsStyle}>
                      {renderQuickStatColumn(col1, "c1")}
                      {renderQuickStatColumn(col2, "c2")}
                      {renderQuickStatColumn(col3, "c3")}
                    </div>
                  );
                })()}
              </div>

              {sheetMonster.parseError && (
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
                  Parse error: {sheetMonster.parseError}
                </div>
              )}

              {(() => {
                const movementEntries = extractMovementEntries(sheetMonster);
                const showPhasing = sheetMonster.phasing === true;
                const otherNumbers = sheetMonster.stats?.otherNumbers ?? {};
                const otherMap = otherNumbers as Record<string, unknown>;
                const skillsMap = (sheetMonster.stats?.skills ?? {}) as Record<string, unknown>;
                const bloodied = formatValue(otherMap.bloodied as string | number | boolean | undefined | null);
                const initiativeFlow = pickFromStatBlock(otherMap, ["initiative"]);
                const perceptionFromSkillsFlow = pickFromStatBlock(skillsMap, ["perception"]);
                const perceptionFlow =
                  perceptionFromSkillsFlow !== "-"
                    ? perceptionFromSkillsFlow
                    : pickFromStatBlock(otherMap, ["perception"]);
                return (
                  <>
                    <div style={centerStatFlowSectionStyle}>
                      {bloodied !== "-" ? (
                        <div style={centerFlowLineStyle}>
                          <strong style={centerFlowLabelStrongStyle}>Bloodied:</strong>
                          {bloodied}
                        </div>
                      ) : null}
                      {initiativeFlow !== "-" ? (
                        <div style={centerFlowLineStyle}>
                          <strong style={centerFlowLabelStrongStyle}>Initiative:</strong>{" "}
                          {formatLeadingPlusIfPositive(initiativeFlow)}
                        </div>
                      ) : null}
                      {perceptionFlow !== "-" ? (
                        <div style={centerFlowLineStyle}>
                          <strong style={centerFlowLabelStrongStyle}>Perception:</strong>{" "}
                          {formatLeadingPlusIfPositive(perceptionFlow)}
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
                                    {...glossaryTooltipUi.hoverA11y(`glossaryTerm:${entry.type}`)}
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
                              <span {...glossaryTooltipUi.hoverA11y("glossaryTerm:Phasing")} style={glossaryLinkUnderline}>
                                Phasing
                              </span>
                            </>
                          ) : null}
                        </div>
                      ) : null}
                      {(Array.isArray(sheetMonster.immunities) && sheetMonster.immunities.length > 0) ? (
                        <div style={centerFlowLineStyle}>
                          <strong style={centerFlowLabelStrongStyle}>Immunities:</strong>{" "}
                          {(() => {
                            const segments: string[] = [];
                            for (const imm of sheetMonster.immunities ?? []) {
                              segments.push(...splitCommaListSegments(String(imm ?? "")));
                            }
                            return segments.map((text, idx) => (
                              <span key={`flow-imm-${idx}`}>
                                {idx > 0 ? ", " : null}
                                {immunitySegmentEligibleForGlossaryHover(text) ? (
                                  <span
                                    {...glossaryTooltipUi.hoverA11y(buildGlossaryHoverKeyForTerm(text))}
                                    style={glossaryLinkUnderline}
                                  >
                                    {text}
                                  </span>
                                ) : (
                                  <span>{text}</span>
                                )}
                              </span>
                            ));
                          })()}
                        </div>
                      ) : null}
                      {(Array.isArray(sheetMonster.resistances) && sheetMonster.resistances.length > 0) ? (
                        <div style={centerFlowLineStyle}>
                          <strong style={centerFlowLabelStrongStyle}>Resistances:</strong>{" "}
                          {sheetMonster.resistances.map((resistance, idx) => {
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
                                  <span
                                    {...glossaryTooltipUi.hoverA11y(buildGlossaryHoverKeyForTerm(name, { tryDamageTypeEntry: true }))}
                                    style={glossaryLinkUnderline}
                                  >
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
                          Array.isArray(sheetMonster.senses) && sheetMonster.senses.length > 0
                            ? sheetMonster.senses
                                .map((sense) => {
                                  const name = String(sense.name ?? "").trim();
                                  if (!name) return null;
                                  const displayName = name.charAt(0).toUpperCase() + name.slice(1);
                                  const normalizedRange = String(sense.range ?? "").trim();
                                  const rangePart =
                                    normalizedRange !== "" && normalizedRange !== "0"
                                      ? normalizedRange
                                      : "";
                                  return { name, displayName, rangePart };
                                })
                                .filter(
                                  (e): e is { name: string; displayName: string; rangePart: string } =>
                                    e !== null
                                )
                            : [];
                        if (entries.length === 0) return null;
                        return (
                          <div style={centerFlowLineStyle}>
                            <strong style={centerFlowLabelStrongStyle}>Senses:</strong>{" "}
                            {entries.map((entry, idx) => (
                              <span key={`flow-sense-${idx}-${entry.name}`}>
                                {idx > 0 ? ", " : null}
                                <span
                                  {...glossaryTooltipUi.hoverA11y(buildGlossaryHoverKeyForTerm(entry.name, { tryTitleCaseVariant: true }))}
                                  style={glossaryLinkUnderline}
                                >
                                  {entry.displayName}
                                </span>
                                {entry.rangePart ? ` ${entry.rangePart}` : null}
                              </span>
                            ))}
                          </div>
                        );
                      })()}
                      {(Array.isArray(sheetMonster.weaknesses) && sheetMonster.weaknesses.length > 0) ? (
                        <div style={centerFlowLineStyle}>
                          <strong style={centerFlowLabelStrongStyle}>Vulnerabilities:</strong>{" "}
                          {sheetMonster.weaknesses.map((weakness, idx) => {
                            const w = weakness as Record<string, unknown>;
                            const name = String(w.name ?? "").trim();
                            const rawAmount = w.amount;
                            const amount = typeof rawAmount === "number" ? rawAmount : Number(rawAmount);
                            const amountPart = Number.isFinite(amount) && amount !== 0 ? `${amount} ` : "";
                            const detailsPart = String(w.details ?? "").trim();
                            return (
                              <span key={`flow-weak-${idx}`}>
                                {idx > 0 ? ", " : null}
                                {amountPart}
                                {name ? (
                                  <span
                                    {...glossaryTooltipUi.hoverA11y(buildGlossaryHoverKeyForTerm(name, { tryDamageTypeEntry: true }))}
                                    style={glossaryLinkUnderline}
                                  >
                                    {name}
                                  </span>
                                ) : (
                                  weaknessLine(w)
                                )}
                                {detailsPart ? ` ${detailsPart}` : ""}
                              </span>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                    <details style={centerDetailsBlockStyle}>
                      <summary style={detailsSummaryStyle}>Detailed Stats</summary>
                      <div style={{ marginTop: "0.5rem", display: "grid", gap: "0.4rem" }}>
                        {Object.entries(sheetMonster.stats)
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
                              <h3 style={sectionTitleStyle}>{formatMonsterStatLabelForDisplay(label)}</h3>
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
                                            onMouseEnter={(event) =>
                                              startGlossaryHover(event, `glossaryTerm:${monsterStatGlossaryTermForKey(k)}`)
                                            }
                                            onMouseLeave={leaveGlossaryHover}
                                            style={{
                                              cursor: "help",
                                              borderBottom: "1px dotted var(--text-muted)",
                                              color: "var(--text-primary)",
                                              fontWeight: 600,
                                              width: "fit-content"
                                            }}
                                          >
                                            {formatMonsterStatLabelForDisplay(k)}
                                          </span>
                                          {renderStatValue(v, startGlossaryHover, leaveGlossaryHover)}
                                        </div>
                                      ))}
                              </div>
                            </div>
                          ))}
                        {Array.isArray(sheetMonster.languages) && sheetMonster.languages.length > 0 ? (
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
                              {renderTagList(sheetMonster.languages)}
                            </div>
                          </div>
                        ) : null}
                        {Array.isArray(sheetMonster.sourceBooks) && sheetMonster.sourceBooks.length > 0 ? (
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
                              {sheetMonster.sourceBooks.join(", ")}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </details>
                  </>
                );
              })()}

              {isRenderableCardValue(sheetMonster.tactics) ? (
                <div style={centerSubsectionPanelStyle}>
                  <h3 style={sectionTitleStyle}>Tactics</h3>
                  <div style={{ ...richTextBodyPrimary.paragraphStyle, whiteSpace: "pre-wrap" }}>
                    {renderGlossaryAwareText(
                      String(sheetMonster.tactics),
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
                            const rangeText = shouldShowTraitRangeLabel(rangeValue)
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
                const items = sectionArrayOfObjects(sheetMonster.items);
                if (items.length === 0) return null;
                return (
                  <div style={centerSubsectionPanelStyle}>
                    <h3 style={sectionTitleStyle}>Items</h3>
                    <div style={{ marginTop: "0.4rem", display: "grid", gap: "0.35rem" }}>
                      {items.map((item, idx) => {
                        const quantity = item.quantity;
                        const name = String(item.name ?? "").trim();
                        const description = String(item.description ?? "").trim();
                        return (
                          <div key={`item-${idx}`} style={{ border: "1px solid var(--panel-border)", borderRadius: "0.3rem", padding: "0.4rem", backgroundColor: "var(--surface-1)" }}>
                            <div style={bodyPrimary}>
                              <strong>{name || "Item"}</strong>
                              {quantity !== undefined && quantity !== null && quantity !== "" ? ` x${quantity}` : ""}
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

              <MonsterPowersPanels
                powers={sheetMonster.powers}
                startGlossaryHover={startGlossaryHover}
                leaveGlossaryHover={leaveGlossaryHover}
                shouldHighlightGlossaryTerm={shouldHighlightGlossaryTerm}
              />

            </div>
          )}
        </div>
            </>
          ) : viewerTab === "createTemplate" ? (
            <>
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
                <div style={indexColumnHeaderStyle}>Paste raw template block</div>
                <div
                  style={{
                    minHeight: 0,
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    padding: "0.65rem 0.75rem"
                  }}
                >
                  <textarea
                    ref={createPasteTextareaRef}
                    value={createPasteText}
                    onChange={(event) => setCreatePasteText(event.target.value)}
                    placeholder="Paste OCR or extracted PDF text for a single monster template…"
                    style={{
                      flex: 1,
                      minHeight: "12rem",
                      width: "100%",
                      boxSizing: "border-box",
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                      fontSize: "0.76rem",
                      lineHeight: 1.4,
                      padding: "0.55rem",
                      borderRadius: "0.32rem",
                      border: "1px solid var(--panel-border)",
                      backgroundColor: "var(--surface-1)",
                      color: "var(--text-primary)",
                      resize: "vertical"
                    }}
                  />
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "0.35rem",
                      alignItems: "center",
                      marginTop: "0.4rem"
                    }}
                  >
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => insertCreatePasteMarker("[ABILITY]")}
                      style={{
                        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                        fontSize: "0.72rem",
                        padding: "0.2rem 0.45rem",
                        borderRadius: "0.28rem",
                        border: "1px solid var(--panel-border)",
                        backgroundColor: "var(--surface-0)",
                        color: "var(--text-primary)",
                        cursor: "pointer"
                      }}
                    >
                      [ABILITY]
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => insertCreatePasteMarker("[ABILITYEND]")}
                      style={{
                        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                        fontSize: "0.72rem",
                        padding: "0.2rem 0.45rem",
                        borderRadius: "0.28rem",
                        border: "1px solid var(--panel-border)",
                        backgroundColor: "var(--surface-0)",
                        color: "var(--text-primary)",
                        cursor: "pointer"
                      }}
                    >
                      [ABILITYEND]
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      title="Replace line breaks with spaces in the selected text. Select the wrapped lines first (e.g. a stat split across OCR lines)."
                      aria-label="Strip line breaks in selection"
                      onClick={() => stripLineBreaksInCreatePasteSelection()}
                      disabled={!createPasteText.trim()}
                      style={{
                        marginLeft: "0.25rem",
                        fontSize: "0.72rem",
                        padding: "0.2rem 0.45rem",
                        borderRadius: "0.28rem",
                        border: "1px solid var(--panel-border)",
                        backgroundColor: "var(--surface-0)",
                        color: "var(--text-primary)",
                        cursor: createPasteText.trim() ? "pointer" : "not-allowed",
                        opacity: createPasteText.trim() ? 1 : 0.55
                      }}
                    >
                      Strip line breaks
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ ...sheetPanel, padding: "0.75rem", minHeight: 0, overflow: "auto" }}>
                {createDraftJsonInvalid ? (
                  <p style={{ margin: 0, color: "var(--status-danger)", fontSize: "0.8125rem", lineHeight: 1.45 }}>
                    Invalid JSON in the draft panel below — fix syntax to preview formatted stats.
                  </p>
                ) : createDraftTemplateRecord ? (
                  <MonsterTemplateFormattedView
                    record={createDraftTemplateRecord}
                    glossaryKeyPrefix="create-draft"
                    startGlossaryHover={startGlossaryHover}
                    leaveGlossaryHover={leaveGlossaryHover}
                    shouldHighlightGlossaryTerm={shouldHighlightGlossaryTerm}
                  />
                ) : (
                  <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.8125rem", lineHeight: 1.45 }}>
                    Use <strong>Import monster template</strong> on pasted text, or edit the JSON draft below — a live preview of
                    identity, stats, traits, and powers appears here. For cleaner splitting, wrap each ability with{" "}
                    <code>[ABILITY]</code> / <code>[ABILITYEND]</code> as described above.
                  </p>
                )}
              </div>
            </>
          ) : (
            <>
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
                <div style={indexColumnHeaderStyle}>Templates ({filteredTemplateIndexes.length})</div>
                <div style={{ minHeight: 0, overflow: "auto" }}>
                  {filteredTemplateIndexes.map(({ row, idx }) => {
                    const selectedRow = selectedTemplateIdx === idx;
                    return (
                      <button
                        key={`${row.templateName}-${idx}`}
                        type="button"
                        onClick={() => setSelectedTemplateIdx(idx)}
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
                        <div style={{ fontWeight: 700 }}>{row.templateName}</div>
                        <div style={metaMuted}>{row.roleLine ?? row.role?.raw ?? ""}</div>
                        <div style={{ ...metaMuted, fontSize: "0.72rem", marginTop: "0.12rem", lineHeight: 1.35 }}>
                          {row.sourceBook ?? ""}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ ...sheetPanel, padding: "0.75rem" }}>
                {!selectedTemplateRecord ? (
                  <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.8125rem", lineHeight: 1.45 }}>
                    Select a template from the generated index, or run the extractor to build{" "}
                    <code style={{ fontSize: "0.92em" }}>generated/monster_templates.json</code>.
                  </p>
                ) : (
                  <MonsterTemplateFormattedView
                    record={selectedTemplateRecord}
                    glossaryKeyPrefix="template-index"
                    startGlossaryHover={startGlossaryHover}
                    leaveGlossaryHover={leaveGlossaryHover}
                    shouldHighlightGlossaryTerm={shouldHighlightGlossaryTerm}
                  />
                )}
              </div>
            </>
          )}
      </div>

      <div style={{ marginTop: "0.85rem", ...panelStyle, padding: "0.55rem" }}>
        <details>
          <summary style={jsonSummaryStyle}>
            {viewerTab === "createTemplate" ? "Template draft (JSON)" : "JSON"}
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
            value={viewerTab === "createTemplate" ? createDraftJson : rawJsonText}
            readOnly={viewerTab !== "createTemplate"}
            onChange={
              viewerTab === "createTemplate"
                ? (event) => setCreateDraftJson(event.target.value)
                : undefined
            }
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

      {glossaryTooltipUi.showPanel && glossaryTooltipUi.hoverKey && glossaryTooltipUi.panelPos && (
        <div
          id={MONSTER_GLOSSARY_TOOLTIP_ID}
          role="tooltip"
          onMouseEnter={glossaryTooltipUi.cancelPendingClose}
          onMouseLeave={leaveGlossaryHover}
          style={{
            position: "fixed",
            top: glossaryTooltipUi.panelPos.top,
            left: glossaryTooltipUi.panelPos.left,
            transform: glossaryTooltipUi.panelPos.transform ?? "none",
            ...STANDARD_GLOSSARY_TOOLTIP_PANEL_STYLE
          }}
        >
          {monsterGlossaryContent(glossaryTooltipUi.hoverKey as MonsterGlossaryHoverKey)}
        </div>
      )}
    </div>
  );
}
