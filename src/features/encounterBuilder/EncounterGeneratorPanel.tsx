import { useCallback, useId, useState } from "react";
import { AdjustableNumberInput } from "../../ui/AdjustableNumberInput";
import type { MonsterEntryFile, MonsterIndexEntry } from "../monsterEditor/storage";
import { loadMonsterEntry } from "../monsterEditor/storage";
import { readCustomMonsterEntries } from "../monsterEditor/monsterLocalStorage";
import { storeAddSnapshotToEncounter, storeUpdateEncounter, type EncounterStore } from "./encounterStorage";
import { generateEncounterRosterPlan, type EncounterTemplateKind } from "./generateEncounterRoster";
import type { EncounterDifficulty } from "./encounterXpBudget";

const TEMPLATE_OPTIONS: { value: EncounterTemplateKind; label: string; hint: string }[] = [
  { value: "balanced", label: "Balanced mix", hint: "Varied roles; good default." },
  { value: "commander", label: "Commander & troops", hint: "Controller or soldier with brutes/soldiers." },
  { value: "wolfPack", label: "Wolf pack", hint: "Skirmishers when available." },
  { value: "doubleLine", label: "Double line", hint: "Front-rank brutes/soldiers plus artillery/controller." },
  { value: "dragonsDen", label: "Solo spotlight", hint: "One solo if the budget allows; else falls back." }
];

export function EncounterGeneratorPanel({
  indexRows,
  encounterStore,
  onStoreChange
}: {
  indexRows: MonsterIndexEntry[];
  encounterStore: EncounterStore;
  onStoreChange: (next: EncounterStore) => void;
}): JSX.Element {
  const formId = useId();
  const [partyLevel, setPartyLevel] = useState(5);
  const [pcCount, setPcCount] = useState(5);
  const [difficulty, setDifficulty] = useState<EncounterDifficulty>("standard");
  const [template, setTemplate] = useState<EncounterTemplateKind>("balanced");
  const [thematic, setThematic] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [lastBlurb, setLastBlurb] = useState<string | null>(null);
  const [lastNotes, setLastNotes] = useState<string[]>([]);
  const [lastTotals, setLastTotals] = useState<{ target: number; actual: number; encLevel: number } | null>(null);

  const runGenerate = useCallback(async () => {
    setMessage(null);
    setLastBlurb(null);
    setLastNotes([]);
    setLastTotals(null);
    const encId = encounterStore.activeEncounterId;
    if (!encId) {
      setMessage("Select an encounter first (or create one).");
      return;
    }
    setBusy(true);
    try {
      const plan = generateEncounterRosterPlan({
        indexRows,
        partyLevel,
        pcCount,
        difficulty,
        template,
        thematicClustering: thematic
      });
      if (!plan.ok) {
        setMessage(plan.error);
        return;
      }
      const { picks, encounterBlurb, notes, targetXp, actualEstimatedXp, encounterLevel } = plan;
      if (picks.length === 0) {
        setMessage("No creatures in the generated plan.");
        return;
      }

      const t = new Date().toISOString();
      let nextStore = storeUpdateEncounter(encounterStore, encId, (e) => ({
        ...e,
        roster: [],
        updatedAt: t
      }));

      const failed: string[] = [];
      for (const p of picks) {
        const loaded = await resolveMonsterEntry(p.id);
        if (loaded) {
          nextStore = storeAddSnapshotToEncounter(nextStore, encId, loaded, p.id);
        } else {
          failed.push(p.id);
        }
      }

      onStoreChange(nextStore);
      setLastBlurb(encounterBlurb);
      setLastNotes(notes);
      setLastTotals({ target: targetXp, actual: actualEstimatedXp, encLevel: encounterLevel });
      if (failed.length > 0) {
        setMessage(
          `Replaced roster with ${picks.length - failed.length} of ${picks.length} creature(s). Could not load: ${failed.slice(0, 4).join(", ")}${failed.length > 4 ? "…" : ""}.`
        );
      } else {
        setMessage(`Replaced roster with ${picks.length} creature(s).`);
      }
    } finally {
      setBusy(false);
    }
  }, [
    encounterStore,
    indexRows,
    onStoreChange,
    partyLevel,
    pcCount,
    difficulty,
    template,
    thematic
  ]);

  const canRun = indexRows.length > 0 && Boolean(encounterStore.activeEncounterId) && !busy;

  return (
    <section
      aria-labelledby={`${formId}-title`}
      style={{
        flexShrink: 0,
        margin: "0 0 0.75rem 0",
        padding: "0.5rem 0.55rem",
        border: "1px solid var(--panel-border)",
        borderRadius: "var(--ui-panel-radius, 0.35rem)",
        backgroundColor: "var(--surface-1)"
      }}
    >
      <h3
        id={`${formId}-title`}
        style={{
          margin: "0 0 0.4rem 0",
          fontSize: "0.82rem",
          fontWeight: 700,
          color: "var(--text-primary)"
        }}
      >
        Encounter builder
      </h3>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(7.5rem, 1fr))",
          gap: "0.4rem 0.5rem",
          alignItems: "end"
        }}
      >
        <label style={{ display: "flex", flexDirection: "column", gap: "0.12rem", fontSize: "0.72rem" }}>
          <span style={{ color: "var(--text-secondary)" }}>Party level</span>
          <AdjustableNumberInput
            compact
            min={1}
            max={30}
            value={partyLevel}
            onChange={setPartyLevel}
            ariaLabel="Party level"
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: "0.12rem", fontSize: "0.72rem" }}>
          <span style={{ color: "var(--text-secondary)" }}>Party size</span>
          <AdjustableNumberInput
            compact
            min={1}
            max={12}
            value={pcCount}
            onChange={setPcCount}
            ariaLabel="Party size"
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: "0.12rem", fontSize: "0.72rem" }}>
          <span style={{ color: "var(--text-secondary)" }}>Difficulty</span>
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as EncounterDifficulty)}
            style={{
              fontSize: "0.8rem",
              padding: "0.25rem 0.35rem",
              borderRadius: "0.25rem",
              border: "1px solid var(--panel-border)",
              backgroundColor: "var(--surface-0)",
              color: "var(--text-primary)"
            }}
          >
            <option value="easy">Easy</option>
            <option value="standard">Standard</option>
            <option value="hard">Hard</option>
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: "0.12rem", fontSize: "0.72rem", gridColumn: "1 / -1" }}>
          <span style={{ color: "var(--text-secondary)" }}>Template</span>
          <select
            value={template}
            onChange={(e) => setTemplate(e.target.value as EncounterTemplateKind)}
            style={{
              fontSize: "0.8rem",
              padding: "0.25rem 0.35rem",
              borderRadius: "0.25rem",
              border: "1px solid var(--panel-border)",
              backgroundColor: "var(--surface-0)",
              color: "var(--text-primary)"
            }}
          >
            {TEMPLATE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} title={o.hint}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div style={{ marginTop: "0.45rem", display: "flex", flexWrap: "wrap", gap: "0.5rem 1rem", alignItems: "center" }}>
        <label style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", fontSize: "0.72rem", cursor: "pointer" }}>
          <input type="checkbox" checked={thematic} onChange={(e) => setThematic(e.target.checked)} />
          Thematic names
        </label>
      </div>
      <div style={{ marginTop: "0.5rem", display: "flex", flexWrap: "wrap", gap: "0.35rem", alignItems: "center" }}>
        <button
          type="button"
          disabled={!canRun}
          onClick={() => void runGenerate()}
          style={{
            fontSize: "0.75rem",
            padding: "0.28rem 0.55rem",
            lineHeight: 1.3,
            borderRadius: "0.25rem",
            border: "1px solid var(--panel-border)",
            backgroundColor: "var(--surface-0)",
            color: "var(--text-primary)",
            cursor: canRun ? "pointer" : "not-allowed",
            opacity: canRun ? 1 : 0.55
          }}
        >
          {busy ? "Building…" : "Generate roster"}
        </button>
        {indexRows.length === 0 ? (
          <span style={{ fontSize: "0.72rem", color: "var(--status-danger)" }}>Load monsters in the index first.</span>
        ) : null}
      </div>
      {message ? (
        <p style={{ margin: "0.45rem 0 0 0", fontSize: "0.72rem", color: "var(--text-secondary)" }} role="status">
          {message}
        </p>
      ) : null}
      {lastTotals ? (
        <p style={{ margin: "0.35rem 0 0 0", fontSize: "0.72rem", color: "var(--text-muted)" }}>
          Budget ≈ {lastTotals.target.toLocaleString()} XP (encounter level {lastTotals.encLevel}); estimated from picks ≈{" "}
          {lastTotals.actual.toLocaleString()} XP.
        </p>
      ) : null}
      {lastBlurb ? (
        <p style={{ margin: "0.35rem 0 0 0", fontSize: "0.72rem", lineHeight: 1.45, color: "var(--text-secondary)" }}>
          <strong style={{ color: "var(--text-primary)" }}>Scene hook:</strong> {lastBlurb}
        </p>
      ) : null}
      {lastNotes.length > 0 ? (
        <ul style={{ margin: "0.35rem 0 0 1rem", padding: 0, fontSize: "0.7rem", color: "var(--text-muted)" }}>
          {lastNotes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

async function resolveMonsterEntry(id: string): Promise<MonsterEntryFile | null> {
  const customs = readCustomMonsterEntries();
  const local = customs.find((m) => m.id === id);
  if (local) return local;
  try {
    return await loadMonsterEntry(id);
  } catch {
    return null;
  }
}
