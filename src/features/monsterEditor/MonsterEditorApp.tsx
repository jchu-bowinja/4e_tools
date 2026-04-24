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

function formatValue(value: string | number | boolean | undefined | null): string {
  if (value === undefined || value === null || value === "") return "-";
  return String(value);
}

function sectionChildKeys(section: unknown): string[] {
  if (!section || typeof section !== "object") return [];
  const maybeChildren = (section as { children?: Record<string, unknown> }).children;
  if (!maybeChildren || typeof maybeChildren !== "object") return [];
  return Object.keys(maybeChildren);
}

function splitPowerKeywords(rawKeywords: string): string[] {
  return rawKeywords
    .split(/[;,]/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
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
  const [query, setQuery] = useState<string>("");
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
    const needle = query.trim().toLowerCase();
    if (!needle) return indexRows;
    return indexRows.filter((entry) => {
      return (
        entry.name.toLowerCase().includes(needle) ||
        String(entry.level).toLowerCase().includes(needle) ||
        entry.role.toLowerCase().includes(needle) ||
        entry.relativePath.toLowerCase().includes(needle)
      );
    });
  }, [indexRows, query]);

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
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name, level, role, or path"
          style={{ minWidth: 300, border: "1px solid var(--panel-border)", borderRadius: "0.28rem", padding: "0.22rem 0.3rem" }}
        />
      </div>

      <div style={{ marginBottom: "0.75rem", color: message.toLowerCase().includes("could not") ? "var(--status-danger)" : "var(--text-muted)" }}>
        {message}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: "1rem", minHeight: "65vh" }}>
        <div style={{ ...sheetPanel, overflow: "hidden" }}>
          <div style={{ padding: "0.5rem 0.75rem", borderBottom: "1px solid var(--panel-border)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", fontSize: "0.78rem" }}>
            Monsters ({filteredRows.length})
          </div>
          <div style={{ maxHeight: "65vh", overflow: "auto" }}>
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
                  <div style={{ fontWeight: 600 }}>{entry.name || entry.fileName.replace(/\.monster$/i, "")}</div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{entry.relativePath}</div>
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
                <div style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>{activeMonster.relativePath}</div>
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
                {Object.entries(activeMonster.stats).map(([label, block]) => (
                  <div key={label} style={{ border: "1px solid var(--panel-border)", borderRadius: "0.35rem", padding: "0.5rem", backgroundColor: "var(--surface-0)" }}>
                    <h3 style={titleStyle}>{label}</h3>
                    <div style={{ marginTop: "0.45rem", fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                      {Object.keys(block).length === 0
                        ? "No values"
                        : Object.entries(block).map(([k, v]) => (
                            <div key={k} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--panel-border)", padding: "0.15rem 0" }}>
                              <span
                                onMouseEnter={(event) => startGlossaryHover(event, `glossaryTerm:${k}`)}
                                onMouseLeave={stopGlossaryHover}
                                style={{ cursor: "help", borderBottom: "1px dotted var(--text-muted)" }}
                              >
                                {k}
                              </span>
                              <span style={{ fontWeight: 600 }}>{formatValue(v)}</span>
                            </div>
                          ))}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ border: "1px solid var(--panel-border-strong)", borderRadius: "0.35rem", backgroundColor: "var(--surface-0)", padding: "0.5rem", marginBottom: "0.75rem" }}>
                <h3 style={titleStyle}>Powers ({activeMonster.powers.length})</h3>
                <div style={{ marginTop: "0.5rem", display: "grid", gap: "0.5rem" }}>
                  {activeMonster.powers.length === 0 ? (
                    <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>No powers parsed.</div>
                  ) : (
                    activeMonster.powers.map((power, index) => {
                      const keywordTokens = [
                        ...splitPowerKeywords(power.keywords || ""),
                        ...(power.keywordNames?.filter(Boolean) ?? [])
                      ];
                      const uniqueKeywordTokens = [...new Set(keywordTokens)];
                      return (
                        <div key={`${power.name}-${index}`} style={{ border: "1px solid var(--panel-border)", borderRadius: "0.35rem", padding: "0.45rem", backgroundColor: "var(--surface-0)" }}>
                          <div style={{ fontWeight: 600 }}>{power.name || `Power ${index + 1}`}</div>
                          <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", margin: "0.1rem 0 0.3rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                            {formatValue(power.action)} • {formatValue(power.usage)}
                            {power.type ? ` • ${power.type}` : ""}
                            {power.range ? ` • ${power.range}` : ""}
                          </div>
                          {uniqueKeywordTokens.length > 0 ? (
                            <div style={{ fontSize: "0.77rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
                              <strong>Keywords:</strong>{" "}
                              {uniqueKeywordTokens.map((keyword, idx) => (
                                <span key={`${power.name}-${index}-kw-${keyword}`}>
                                  <span
                                    onMouseEnter={(event) => startGlossaryHover(event, `powerKeyword:${keyword}`)}
                                    onMouseLeave={stopGlossaryHover}
                                    style={{
                                      display: "inline-block",
                                      padding: "0.04rem 0.3rem",
                                      borderRadius: "0.2rem",
                                      border: "1px solid var(--panel-border)",
                                      backgroundColor: "var(--surface-2)",
                                      color: "var(--text-primary)",
                                      cursor: "help"
                                    }}
                                  >
                                    {keyword}
                                  </span>
                                  {idx < uniqueKeywordTokens.length - 1 ? <span> </span> : null}
                                </span>
                              ))}
                            </div>
                          ) : null}
                          {power.damageExpressions?.length ? (
                            <div style={{ fontSize: "0.77rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
                              <strong>Damage Expressions:</strong> {power.damageExpressions.join(", ")}
                            </div>
                          ) : null}
                          {power.trigger ? (
                            <div style={{ fontSize: "0.77rem", color: "var(--text-muted)", marginBottom: "0.2rem" }}>
                              <strong>Trigger:</strong> {power.trigger}
                            </div>
                          ) : null}
                          {power.requirements ? (
                            <div style={{ fontSize: "0.77rem", color: "var(--text-muted)", marginBottom: "0.2rem" }}>
                              <strong>Requirements:</strong> {power.requirements}
                            </div>
                          ) : null}
                          {power.usageDetails ? (
                            <div style={{ fontSize: "0.77rem", color: "var(--text-muted)", marginBottom: "0.2rem" }}>
                              <strong>Usage Details:</strong> {power.usageDetails}
                            </div>
                          ) : null}
                          {power.flavorText?.trim() ? (
                            <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginBottom: "0.2rem", fontStyle: "italic" }}>
                              {power.flavorText}
                            </div>
                          ) : null}
                          <div style={{ fontSize: "0.82rem", color: "var(--text-primary)" }}>
                            {power.description?.trim() ? (
                              <RulesRichText
                                text={power.description}
                                paragraphStyle={{ fontSize: "0.82rem", color: "var(--text-primary)", margin: "0 0 0.35rem 0" }}
                                listItemStyle={{ fontSize: "0.82rem", color: "var(--text-primary)" }}
                              />
                            ) : (
                              "No description."
                            )}
                          </div>
                          {renderPowerAttacks(power, startGlossaryHover, stopGlossaryHover)}
                        </div>
                      );
                    })
                  )}
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
