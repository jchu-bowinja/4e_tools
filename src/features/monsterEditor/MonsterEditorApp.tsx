import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import type { RulesIndex } from "../../rules/models";
import { resolveTooltipText } from "../../data/tooltipGlossary";
import { RulesRichText } from "../builder/RulesRichText";
import {
  loadMonsterEntry,
  loadMonsterIndex,
  type MonsterEntryFile,
  type MonsterIndexEntry,
  type MonsterPower,
  type MonsterPowerAttack,
  type MonsterPowerDamage,
  type MonsterPowerOutcome,
  type MonsterPowerOutcomeEntry
} from "./storage";

const sheetPanel = {
  border: "1px solid var(--panel-border)",
  borderRadius: "0.35rem",
  backgroundColor: "var(--surface-0)"
};

const titleStyle = {
  margin: 0,
  fontSize: "0.9rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  color: "var(--text-primary)"
};

const statPanelStyle = {
  border: "1px solid var(--panel-border)",
  borderRadius: "0.35rem",
  padding: "0.5rem",
  backgroundColor: "var(--surface-0)"
};

type MonsterPowerUsageBucket = "atWill" | "encounter" | "daily" | "other";

function usageAccentColor(bucket: MonsterPowerUsageBucket): string {
  if (bucket === "atWill") return "var(--power-accent-atwill-bar)";
  if (bucket === "encounter") return "var(--power-accent-encounter-bar)";
  if (bucket === "daily") return "var(--power-accent-daily-bar)";
  return "var(--text-secondary)";
}

function usageAccentCardStyle(bucket: MonsterPowerUsageBucket): {
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

function classifyMonsterPowerUsageBucket(usage: string | undefined): MonsterPowerUsageBucket {
  const normalized = String(usage || "").toLowerCase();
  if (normalized.includes("at-will") || normalized.includes("at will")) return "atWill";
  if (normalized.includes("encounter")) return "encounter";
  if (normalized.includes("daily")) return "daily";
  return "other";
}

function usageBucketLabel(bucket: MonsterPowerUsageBucket): string {
  if (bucket === "atWill") return "At-Will";
  if (bucket === "encounter") return "Encounter";
  if (bucket === "daily") return "Daily";
  return "Other";
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
  stopGlossaryHover: () => void
): JSX.Element {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      return <span style={{ fontWeight: 600 }}>-</span>;
    }
    return (
      <span style={{ display: "inline-grid", gap: "0.12rem", justifyItems: "end", textAlign: "right" }}>
        {entries.map(([nestedKey, nestedValue]) => (
          <span key={nestedKey} style={{ whiteSpace: "nowrap" }}>
            <span
              onMouseEnter={(event) => startGlossaryHover(event, `glossaryTerm:${nestedKey}`)}
              onMouseLeave={stopGlossaryHover}
              style={{ cursor: "help", borderBottom: "1px dotted var(--text-muted)", marginRight: "0.3rem" }}
            >
              {formatStatLabel(nestedKey)}
            </span>
            <strong style={{ color: "var(--text-primary)" }}>{formatValue(nestedValue as string | number | boolean | undefined | null)}</strong>
          </span>
        ))}
      </span>
    );
  }
  return <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{formatValue(value as string | number | boolean | undefined | null)}</span>;
}

function sectionChildKeys(section: unknown): string[] {
  if (!section || typeof section !== "object") return [];
  const maybeChildren = (section as { children?: Record<string, unknown> }).children;
  if (!maybeChildren || typeof maybeChildren !== "object") return [];
  return Object.keys(maybeChildren);
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

function renderPrimaryAttackBonus(attack?: MonsterPowerAttack): string {
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

function renderCompactOutcomeLines(
  power: MonsterPower,
  attack: MonsterPowerAttack | undefined
): Array<{ label: string; text: string }> {
  const lines: Array<{ label: string; text: string }> = [];
  const outcomeEntryDescription = (entry: MonsterPowerOutcomeEntry): string => {
    const direct = normalizeSemicolonWhitespace(String(entry.description || "").trim());
    if (isRenderableCardValue(direct)) return direct;
    const fromChildren = normalizeSemicolonWhitespace(
      String((entry as { children?: { Description?: { text?: string } } }).children?.Description?.text || "").trim()
    );
    if (isRenderableCardValue(fromChildren)) return fromChildren;
    return "";
  };
  const appendNestedOutcomeLines = (prefix: "HIT" | "MISS" | "EFFECT", outcome: MonsterPowerOutcome | undefined): void => {
    if (!outcome) return;
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
  };

  if (isRenderableCardValue(power.trigger)) {
    lines.push({ label: "TRIGGER", text: normalizeSemicolonWhitespace(String(power.trigger).trim()) });
  }
  if (isRenderableCardValue(power.requirements)) {
    lines.push({ label: "REQUIREMENTS", text: normalizeSemicolonWhitespace(String(power.requirements).trim()) });
  }
  if (isRenderableCardValue(attack?.targets)) {
    lines.push({ label: "TARGET", text: normalizeSemicolonWhitespace(String(attack?.targets).trim()) });
  }
  const hitExpr = renderDamageExpression(attack?.hit, power.damageExpressions);
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
  appendNestedOutcomeLines("HIT", attack?.hit);
  appendNestedOutcomeLines("MISS", attack?.miss);
  appendNestedOutcomeLines("EFFECT", attack?.effect);
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
  const attackBonusLine = renderPrimaryAttackBonus(primaryAttack);
  const compactOutcomeLines = dedupeLabeledLines(renderCompactOutcomeLines(power, primaryAttack));
  const normalizedDescription = normalizeSemicolonWhitespace(String(power.description || "").trim());
  const normalizedEffectDescription = normalizeSemicolonWhitespace(String(primaryAttack?.effect?.description || "").trim());

  const shouldInlineDescriptionWithHit =
    isRenderableCardValue(normalizedDescription) &&
    /^(?:[a-z]+\s+)?damage\b/i.test(normalizedDescription) &&
    compactOutcomeLines.some((line) => line.label === "HIT");

  const outcomeLines = dedupeLabeledLines(
    compactOutcomeLines.map((line) =>
      line.label === "HIT" && shouldInlineDescriptionWithHit ? { ...line, text: `${line.text} ${normalizedDescription}`.trim() } : line
    )
  );

  const descriptionDuplicatesEffect =
    isRenderableCardValue(normalizedDescription) &&
    isRenderableCardValue(normalizedEffectDescription) &&
    normalizedDescription.toLowerCase() === normalizedEffectDescription.toLowerCase();
  const descriptionDuplicatesOutcomeLine =
    isRenderableCardValue(normalizedDescription) &&
    outcomeLines.some(
      (line) =>
        isRenderableCardValue(line.text) &&
        normalizeSemicolonWhitespace(String(line.text).trim()).toLowerCase() === normalizedDescription.toLowerCase()
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

  const keywordTokens = [
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
    descriptionText,
    ongoingText: extractOngoingText(power.description)
  };
}

function renderOutcomeEntry(
  entry: MonsterPowerOutcomeEntry,
  idx: number,
  title: string,
  startGlossaryHover: (event: ReactMouseEvent<HTMLElement>, key: MonsterGlossaryHoverKey) => void,
  stopGlossaryHover: () => void
): JSX.Element {
  const damageSummary = renderDamageSummary(entry.damage);
  return (
    <div key={`${title}-${idx}`} style={{ borderLeft: "2px solid var(--panel-border)", paddingLeft: "0.45rem", marginTop: "0.3rem" }}>
      <div style={{ fontSize: "0.78rem", fontWeight: 600 }}>
        {entry.name || entry.kind || title}
      </div>
      {entry.description ? (
        <RulesRichText
          text={entry.description}
          paragraphStyle={{ fontSize: "0.79rem", color: "var(--text-primary)", margin: "0.1rem 0 0.2rem 0" }}
          listItemStyle={{ fontSize: "0.79rem", color: "var(--text-primary)" }}
        />
      ) : null}
      {damageSummary ? <div style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>{damageSummary}</div> : null}
      {entry.aftereffects?.length ? (
        <div style={{ marginTop: "0.2rem" }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)" }}>Aftereffects</div>
          {entry.aftereffects.map((nested, nestedIdx) =>
            renderOutcomeEntry(nested, nestedIdx, "Aftereffect", startGlossaryHover, stopGlossaryHover)
          )}
        </div>
      ) : null}
      {entry.sustains?.length ? (
        <div style={{ marginTop: "0.2rem" }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)" }}>Sustains</div>
          {entry.sustains.map((nested, nestedIdx) =>
            renderOutcomeEntry(nested, nestedIdx, "Sustain", startGlossaryHover, stopGlossaryHover)
          )}
        </div>
      ) : null}
      {entry.failedSavingThrows?.length ? (
        <div style={{ marginTop: "0.2rem" }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)" }}>
            Failed Saving Throws
          </div>
          {entry.failedSavingThrows.map((nested, nestedIdx) =>
            renderOutcomeEntry(nested, nestedIdx, "Failed Save", startGlossaryHover, stopGlossaryHover)
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
  stopGlossaryHover: () => void
): JSX.Element {
  const damageSummary = renderDamageSummary(outcome.damage);
  return (
    <div style={{ marginTop: "0.28rem" }}>
      <div style={{ fontSize: "0.74rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)" }}>{label}</div>
      {outcome.description ? (
        <RulesRichText
          text={outcome.description}
          paragraphStyle={{ fontSize: "0.79rem", color: "var(--text-primary)", margin: "0.06rem 0 0.16rem 0" }}
          listItemStyle={{ fontSize: "0.79rem", color: "var(--text-primary)" }}
        />
      ) : null}
      {damageSummary ? <div style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>{damageSummary}</div> : null}
      {outcome.nestedAttackDescriptions?.length ? (
        <div style={{ fontSize: "0.74rem", color: "var(--text-secondary)", marginTop: "0.15rem" }}>
          {outcome.nestedAttackDescriptions.map((text, idx) => (
            <div key={`${label}-nested-${idx}`}>{text}</div>
          ))}
        </div>
      ) : null}
      {outcome.aftereffects?.length ? (
        <div style={{ marginTop: "0.18rem" }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)" }}>Aftereffects</div>
          {outcome.aftereffects.map((entry, idx) =>
            renderOutcomeEntry(entry, idx, "Aftereffect", startGlossaryHover, stopGlossaryHover)
          )}
        </div>
      ) : null}
      {outcome.sustains?.length ? (
        <div style={{ marginTop: "0.18rem" }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)" }}>Sustains</div>
          {outcome.sustains.map((entry, idx) => renderOutcomeEntry(entry, idx, "Sustain", startGlossaryHover, stopGlossaryHover))}
        </div>
      ) : null}
      {outcome.failedSavingThrows?.length ? (
        <div style={{ marginTop: "0.18rem" }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)" }}>
            Failed Saving Throws
          </div>
          {outcome.failedSavingThrows.map((entry, idx) =>
            renderOutcomeEntry(entry, idx, "Failed Save", startGlossaryHover, stopGlossaryHover)
          )}
        </div>
      ) : null}
    </div>
  );
}

function renderPowerAttacks(
  power: MonsterPower,
  startGlossaryHover: (event: ReactMouseEvent<HTMLElement>, key: MonsterGlossaryHoverKey) => void,
  stopGlossaryHover: () => void
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
            <div style={{ fontSize: "0.8rem", fontWeight: 600 }}>
              {attack.name || `Attack ${attackIdx + 1}`}
              {attack.kind ? ` (${attack.kind})` : ""}
            </div>
            <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", marginTop: "0.06rem" }}>
              {[attack.range, attack.targets, bonusText].filter(Boolean).join(" • ") || "No range/target/bonus details"}
            </div>
            {attack.hit ? renderAttackOutcome("hit", attack.hit, startGlossaryHover, stopGlossaryHover) : null}
            {attack.miss ? renderAttackOutcome("miss", attack.miss, startGlossaryHover, stopGlossaryHover) : null}
            {attack.effect ? renderAttackOutcome("effect", attack.effect, startGlossaryHover, stopGlossaryHover) : null}
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

type MonsterGlossaryHoverKey = `powerKeyword:${string}` | `glossaryTerm:${string}`;

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
  const [showGlossaryHoverInfo, setShowGlossaryHoverInfo] = useState(false);
  const [glossaryHoverKey, setGlossaryHoverKey] = useState<MonsterGlossaryHoverKey | null>(null);
  const [glossaryHoverPanelPos, setGlossaryHoverPanelPos] = useState<{ top: number; left: number } | null>(null);
  const glossaryHoverTimerRef = useRef<number | null>(null);

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
    };
  }, []);

  useEffect(() => {
    if (glossaryHoverTimerRef.current != null) {
      window.clearTimeout(glossaryHoverTimerRef.current);
      glossaryHoverTimerRef.current = null;
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
    const buckets: Record<MonsterPowerUsageBucket, MonsterPower[]> = {
      atWill: [],
      encounter: [],
      daily: [],
      other: []
    };
    if (!activeMonster) return buckets;
    for (const power of activeMonster.powers) {
      buckets[classifyMonsterPowerUsageBucket(power.usage)].push(power);
    }
    return buckets;
  }, [activeMonster]);

  function monsterGlossaryContent(key: MonsterGlossaryHoverKey): JSX.Element {
    let terms: string[] = [];
    if (key.startsWith("powerKeyword:")) {
      const keyword = key.slice("powerKeyword:".length).trim();
      terms = [keyword, "Keyword"];
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

  function startGlossaryHover(event: ReactMouseEvent<HTMLElement>, key: MonsterGlossaryHoverKey): void {
    const rect = event.currentTarget.getBoundingClientRect();
    const panelWidth = 340;
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - panelWidth - 12));
    const top = Math.min(rect.bottom + 8, window.innerHeight - 180);
    setGlossaryHoverPanelPos({ top, left });
    setGlossaryHoverKey(key);
    if (glossaryHoverTimerRef.current != null) {
      window.clearTimeout(glossaryHoverTimerRef.current);
    }
    glossaryHoverTimerRef.current = window.setTimeout(() => {
      setShowGlossaryHoverInfo(true);
      glossaryHoverTimerRef.current = null;
    }, 1000);
  }

  function stopGlossaryHover(): void {
    if (glossaryHoverTimerRef.current != null) {
      window.clearTimeout(glossaryHoverTimerRef.current);
      glossaryHoverTimerRef.current = null;
    }
    setShowGlossaryHoverInfo(false);
    setGlossaryHoverKey(null);
    setGlossaryHoverPanelPos(null);
  }

  return (
    <div
      style={{
        maxWidth: 1360,
        margin: "0 auto",
        padding: "0.9rem",
        color: "var(--text-primary)",
        background: "linear-gradient(180deg, var(--surface-1) 0%, var(--surface-1) 100%)",
        border: "1px solid var(--panel-border)",
        borderRadius: "0.45rem"
      }}
    >
      <h1 style={{ marginTop: 0, marginBottom: "0.35rem", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "1.1rem" }}>
        Monster Sheet
      </h1>
      <p style={{ marginTop: 0, color: "var(--text-muted)" }}>
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

      <div style={{ marginBottom: "0.75rem", color: message.toLowerCase().includes("could not") ? "var(--status-danger)" : "var(--text-muted)" }}>
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
          <div style={{ padding: "0.5rem 0.75rem", borderBottom: "1px solid var(--panel-border)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", fontSize: "0.78rem" }}>
            Monsters ({filteredRows.length})
          </div>
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
                  <div style={{ fontWeight: 600 }}>{entry.name || entry.id}</div>
                  {entry.level && (
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      Level {entry.level}
                      {entry.role ? ` • ${entry.role}` : ""}
                    </div>
                  )}
                  {entry.parseError && <div style={{ fontSize: "0.75rem", color: "var(--status-danger)" }}>Invalid XML</div>}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ ...sheetPanel, padding: "0.75rem" }}>
          {!activeMonster ? (
            <p style={{ margin: 0, color: "var(--text-muted)" }}>Select a monster to view its generated JSON data.</p>
          ) : (
            <>
              <div style={{ marginBottom: "0.75rem" }}>
                <strong>{activeMonster.name}</strong>
                <div style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                  <span
                    onMouseEnter={(event) => startGlossaryHover(event, "glossaryTerm:Level")}
                    onMouseLeave={stopGlossaryHover}
                    style={{ cursor: "help", borderBottom: "1px dotted var(--text-muted)" }}
                  >
                    Level
                  </span>{" "}
                  {formatValue(activeMonster.level)}{" "}
                  <span
                    onMouseEnter={(event) =>
                      startGlossaryHover(event, `glossaryTerm:${activeMonster.role || "Role"}`)
                    }
                    onMouseLeave={stopGlossaryHover}
                    style={{ cursor: "help", borderBottom: "1px dotted var(--text-muted)" }}
                  >
                    {activeMonster.role || ""}
                  </span>
                </div>
                <div style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>
                  <span
                    onMouseEnter={(event) =>
                      startGlossaryHover(event, `glossaryTerm:${activeMonster.size || "Size"}`)
                    }
                    onMouseLeave={stopGlossaryHover}
                    style={{ cursor: "help", borderBottom: "1px dotted var(--text-muted)" }}
                  >
                    {activeMonster.size || "Unknown size"}
                  </span>{" "}
                  •{" "}
                  <span
                    onMouseEnter={(event) =>
                      startGlossaryHover(event, `glossaryTerm:${activeMonster.origin || "Origin"}`)
                    }
                    onMouseLeave={stopGlossaryHover}
                    style={{ cursor: "help", borderBottom: "1px dotted var(--text-muted)" }}
                  >
                    {activeMonster.origin || "Unknown origin"}
                  </span>{" "}
                  •{" "}
                  <span
                    onMouseEnter={(event) =>
                      startGlossaryHover(event, `glossaryTerm:${activeMonster.type || "Type"}`)
                    }
                    onMouseLeave={stopGlossaryHover}
                    style={{ cursor: "help", borderBottom: "1px dotted var(--text-muted)" }}
                  >
                    {activeMonster.type || "Unknown type"}
                  </span>{" "}
                  •{" "}
                  <span
                    onMouseEnter={(event) => startGlossaryHover(event, "glossaryTerm:Experience")}
                    onMouseLeave={stopGlossaryHover}
                    style={{ cursor: "help", borderBottom: "1px dotted var(--text-muted)" }}
                  >
                    XP
                  </span>{" "}
                  {formatValue(activeMonster.xp)}
                </div>
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
                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>Name</div>
                  <div style={{ fontWeight: 600 }}>{activeMonster.name}</div>
                </div>
                <div style={{ border: "1px solid var(--panel-border)", borderRadius: 6, padding: "0.6rem", background: "var(--surface-1)" }}>
                  <div
                    onMouseEnter={(event) => startGlossaryHover(event, "glossaryTerm:Role")}
                    onMouseLeave={stopGlossaryHover}
                    style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700, cursor: "help", width: "fit-content", borderBottom: "1px dotted var(--text-muted)" }}
                  >
                    Role
                  </div>
                  <div
                    onMouseEnter={(event) =>
                      startGlossaryHover(event, `glossaryTerm:${activeMonster.role || "Role"}`)
                    }
                    onMouseLeave={stopGlossaryHover}
                    style={{ fontWeight: 600, cursor: "help", width: "fit-content", borderBottom: "1px dotted var(--text-muted)" }}
                  >
                    {formatValue(activeMonster.role)}
                  </div>
                </div>
                <div style={{ border: "1px solid var(--panel-border)", borderRadius: 6, padding: "0.6rem", background: "var(--surface-1)" }}>
                  <div
                    onMouseEnter={(event) => startGlossaryHover(event, "glossaryTerm:Level")}
                    onMouseLeave={stopGlossaryHover}
                    style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700, cursor: "help", width: "fit-content", borderBottom: "1px dotted var(--text-muted)" }}
                  >
                    Level / XP
                  </div>
                  <div
                    onMouseEnter={(event) => startGlossaryHover(event, "glossaryTerm:Level")}
                    onMouseLeave={stopGlossaryHover}
                    style={{ fontWeight: 600, cursor: "help", width: "fit-content", borderBottom: "1px dotted var(--text-muted)" }}
                  >
                    {formatValue(activeMonster.level)} / {formatValue(activeMonster.xp)}
                  </div>
                </div>
                <div style={{ border: "1px solid var(--panel-border)", borderRadius: 6, padding: "0.6rem", background: "var(--surface-1)" }}>
                  <div
                    onMouseEnter={(event) => startGlossaryHover(event, "glossaryTerm:Size")}
                    onMouseLeave={stopGlossaryHover}
                    style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700, cursor: "help", width: "fit-content", borderBottom: "1px dotted var(--text-muted)" }}
                  >
                    Size
                  </div>
                  <div
                    onMouseEnter={(event) =>
                      startGlossaryHover(event, `glossaryTerm:${activeMonster.size || "Size"}`)
                    }
                    onMouseLeave={stopGlossaryHover}
                    style={{ fontWeight: 600, cursor: "help", width: "fit-content", borderBottom: "1px dotted var(--text-muted)" }}
                  >
                    {formatValue(activeMonster.size)}
                  </div>
                </div>
                <div style={{ border: "1px solid var(--panel-border)", borderRadius: 6, padding: "0.6rem", background: "var(--surface-1)" }}>
                  <div
                    onMouseEnter={(event) => startGlossaryHover(event, "glossaryTerm:Origin")}
                    onMouseLeave={stopGlossaryHover}
                    style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700, cursor: "help", width: "fit-content", borderBottom: "1px dotted var(--text-muted)" }}
                  >
                    Origin
                  </div>
                  <div
                    onMouseEnter={(event) =>
                      startGlossaryHover(event, `glossaryTerm:${activeMonster.origin || "Origin"}`)
                    }
                    onMouseLeave={stopGlossaryHover}
                    style={{ fontWeight: 600, cursor: "help", width: "fit-content", borderBottom: "1px dotted var(--text-muted)" }}
                  >
                    {formatValue(activeMonster.origin)}
                  </div>
                </div>
                <div style={{ border: "1px solid var(--panel-border)", borderRadius: 6, padding: "0.6rem", background: "var(--surface-1)" }}>
                  <div
                    onMouseEnter={(event) => startGlossaryHover(event, "glossaryTerm:Type")}
                    onMouseLeave={stopGlossaryHover}
                    style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700, cursor: "help", width: "fit-content", borderBottom: "1px dotted var(--text-muted)" }}
                  >
                    Type
                  </div>
                  <div
                    onMouseEnter={(event) =>
                      startGlossaryHover(event, `glossaryTerm:${activeMonster.type || "Type"}`)
                    }
                    onMouseLeave={stopGlossaryHover}
                    style={{ fontWeight: 600, cursor: "help", width: "fit-content", borderBottom: "1px dotted var(--text-muted)" }}
                  >
                    {formatValue(activeMonster.type)}
                  </div>
                </div>
              </div>

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
                    <h3 style={titleStyle}>{formatStatLabel(label)}</h3>
                    <div style={{ marginTop: "0.45rem", fontSize: "0.82rem", color: "var(--text-secondary)", display: "grid", gap: "0.2rem" }}>
                      {Object.keys(block).length === 0
                        ? "No values"
                        : Object.entries(block).map(([k, v], idx) => (
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
                                backgroundColor: idx % 2 === 0 ? "var(--surface-1)" : "var(--surface-0)"
                              }}
                            >
                              <span
                                onMouseEnter={(event) => startGlossaryHover(event, `glossaryTerm:${k}`)}
                                onMouseLeave={stopGlossaryHover}
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
                              {renderStatValue(v, startGlossaryHover, stopGlossaryHover)}
                            </div>
                          ))}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ border: "1px solid var(--panel-border-strong)", borderRadius: "0.35rem", backgroundColor: "var(--surface-0)", padding: "0.5rem", marginBottom: "0.75rem" }}>
                <h3 style={titleStyle}>Powers ({activeMonster.powers.length})</h3>
                <div style={{ marginTop: "0.5rem", display: "grid", gap: "0.6rem" }}>
                  {activeMonster.powers.length === 0 ? <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>No powers parsed.</div> : null}
                  {(["atWill", "encounter", "daily", "other"] as const).map((bucket) => {
                    const bucketPowers = groupedPowers[bucket];
                    if (bucketPowers.length === 0) return null;
                    return (
                      <div key={bucket} style={{ display: "grid", gap: "0.4rem" }}>
                        <div
                          style={{
                            fontWeight: 700,
                            borderLeft: `5px solid ${usageAccentColor(bucket)}`,
                            paddingLeft: "0.45rem",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            color: "var(--text-primary)"
                          }}
                        >
                          {usageBucketLabel(bucket)}
                        </div>
                        <div style={{ display: "grid", gap: "0.45rem", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", alignItems: "stretch" }}>
                          {bucketPowers.map((power, index) => {
                            const accent = usageAccentCardStyle(bucket);
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
                                boxShadow: `inset 0 0 0 1px ${usageAccentColor(bucket)}33`,
                                height: "100%",
                                boxSizing: "border-box",
                                display: "flex",
                                flexDirection: "column"
                              }}
                            >
                          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "0.35rem" }}>
                            <div style={{ fontWeight: 600 }}>{power.name || `Power ${index + 1}`}</div>
                            {power.isBasic ? (
                              <span
                                style={{
                                  fontSize: "0.72rem",
                                  fontWeight: 700,
                                  textTransform: "uppercase",
                                  letterSpacing: "0.04em",
                                  color: "var(--text-secondary)",
                                  border: "1px solid var(--panel-border)",
                                  borderRadius: "999px",
                                  padding: "0.05rem 0.35rem",
                                  backgroundColor: "var(--surface-1)"
                                }}
                              >
                                Basic Attack
                              </span>
                            ) : null}
                          </div>
                          {cardModel.usagePrimaryParts.length > 0 ? (
                            <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "0.12rem" }}>
                              {cardModel.usagePrimaryParts.map((part, partIdx) => (
                                <span key={`${power.name}-${index}-usage-${part}`}>
                                  <span
                                    onMouseEnter={(event) => startGlossaryHover(event, `glossaryTerm:${part}`)}
                                    onMouseLeave={stopGlossaryHover}
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
                                <div style={{ marginTop: "0.1rem", fontSize: "0.78rem", color: "var(--text-secondary)" }}>
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
                                    onMouseLeave={stopGlossaryHover}
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
                            <div style={{ fontSize: "0.77rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
                              <strong>Keywords:</strong>{" "}
                              {cardModel.keywordTokens.map((keyword, idx) => (
                                <span key={`${power.name}-${index}-kw-${keyword}`}>
                                  <span
                                    onMouseEnter={(event) => startGlossaryHover(event, `powerKeyword:${keyword}`)}
                                    onMouseLeave={stopGlossaryHover}
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
                                          <strong>{line.label}:</strong> {split.mainText}
                                        </div>
                                      ) : (
                                        <div>
                                          <strong>{line.label}:</strong> {line.text}
                                        </div>
                                      )}
                                      {split.failedEscapeTexts.map((failedText) => (
                                        <div key={`${power.name}-${index}-${line.label}-failed-${failedText}`} style={{ marginTop: "0.04rem" }}>
                                          <strong>Failed Escape Attempt:</strong> {failedText}
                                        </div>
                                      ))}
                                    </>
                                  );
                                })()}
                              </div>
                            ))}
                          </div>
                          {isRenderableCardValue(power.flavorText) ? (
                            <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginBottom: "0.2rem", fontStyle: "italic" }}>
                              {power.flavorText}
                            </div>
                          ) : null}
                          <div style={{ fontSize: "0.82rem", color: "var(--text-primary)" }}>
                            {isRenderableCardValue(cardModel.descriptionText) ? (
                              <RulesRichText
                                text={cardModel.descriptionText}
                                paragraphStyle={{ fontSize: "0.82rem", color: "var(--text-primary)", margin: "0 0 0.35rem 0" }}
                                listItemStyle={{ fontSize: "0.82rem", color: "var(--text-primary)" }}
                              />
                            ) : null}
                          </div>
                          {isRenderableCardValue(cardModel.ongoingText) ? (
                            <div style={{ marginTop: "0.05rem", fontSize: "0.8rem", color: "var(--text-primary)" }}>
                              <strong>ONGOING:</strong> {cardModel.ongoingText}
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

              <div style={{ border: "1px solid var(--panel-border)", borderRadius: "0.35rem", backgroundColor: "var(--surface-0)", padding: "0.5rem" }}>
                <h3 style={titleStyle}>Additional Sections</h3>
                <div style={{ marginTop: "0.5rem", display: "grid", gridTemplateColumns: "repeat(2, minmax(220px, 1fr))", gap: "0.5rem" }}>
                  {Object.entries(activeMonster.sections ?? {}).length === 0 ? (
                    <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>No additional sections.</div>
                  ) : (
                    Object.entries(activeMonster.sections ?? {}).map(([sectionName, sectionData]) => {
                      const childKeys = sectionChildKeys(sectionData);
                      return (
                        <div key={sectionName} style={{ border: "1px solid var(--panel-border)", borderRadius: "0.32rem", padding: "0.45rem", backgroundColor: "var(--surface-1)" }}>
                          <div style={{ fontWeight: 600, fontSize: "0.82rem" }}>{sectionName}</div>
                          <div style={{ marginTop: "0.25rem", fontSize: "0.76rem", color: "var(--text-muted)" }}>
                            {childKeys.length === 0 ? "No child tags" : childKeys.join(", ")}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

            </>
          )}
        </div>
      </div>

      <div style={{ marginTop: "0.85rem", border: "1px solid var(--panel-border)", borderRadius: "0.35rem", backgroundColor: "var(--surface-0)", padding: "0.55rem" }}>
        <details>
          <summary style={{ cursor: "pointer", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-primary)" }}>
            JSON
          </summary>
          <div style={{ marginTop: "0.5rem" }}>
            <button
              type="button"
              onClick={() => {
                const rawJson = JSON.stringify(activeMonster, null, 2);
                if (!navigator.clipboard?.writeText) {
                  alert("Clipboard API unavailable in this browser.");
                  return;
                }
                void navigator.clipboard.writeText(rawJson);
              }}
            >
              Copy Contents
            </button>
          </div>
          <textarea
            value={JSON.stringify(activeMonster, null, 2)}
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
          style={{
            position: "fixed",
            top: glossaryHoverPanelPos.top,
            left: glossaryHoverPanelPos.left,
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
