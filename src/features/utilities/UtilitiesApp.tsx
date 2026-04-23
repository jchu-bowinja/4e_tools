import { useMemo, useState, type CSSProperties, type ChangeEvent } from "react";
import { importSavedCharacters, type SavedCharacterEntry } from "../builder/storage";
import type { CharacterBuild } from "../../rules/models";

const panelStyle: CSSProperties = {
  border: "1px solid var(--panel-border)",
  borderRadius: 8,
  backgroundColor: "var(--surface-0)",
  padding: "0.9rem"
};

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `char-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

function looksLikeCharacterBuild(value: unknown): value is CharacterBuild {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<CharacterBuild>;
  return (
    typeof candidate.name === "string" &&
    typeof candidate.level === "number" &&
    typeof candidate.abilityScores === "object" &&
    candidate.abilityScores !== null &&
    Array.isArray(candidate.trainedSkillIds) &&
    Array.isArray(candidate.featIds) &&
    Array.isArray(candidate.powerIds)
  );
}

function coerceSavedCharacterEntry(value: unknown): SavedCharacterEntry | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Partial<SavedCharacterEntry> & { character?: unknown };
  const build = candidate.build ?? candidate.character;
  if (!looksLikeCharacterBuild(build)) return null;
  const name = (candidate.name || build.name || "Unnamed Character").trim() || "Unnamed Character";
  return {
    id: typeof candidate.id === "string" && candidate.id.trim() ? candidate.id.trim() : generateId(),
    name,
    updatedAt: typeof candidate.updatedAt === "string" && candidate.updatedAt.trim() ? candidate.updatedAt : new Date().toISOString(),
    build
  };
}

function parseImportEntries(rawText: string): SavedCharacterEntry[] {
  const parsed = JSON.parse(rawText) as unknown;
  const records: unknown[] = [];
  if (Array.isArray(parsed)) {
    records.push(...parsed);
  } else if (looksLikeCharacterBuild(parsed)) {
    records.push({ build: parsed });
  } else if (parsed && typeof parsed === "object") {
    const root = parsed as Record<string, unknown>;
    if (Array.isArray(root.savedCharacters)) records.push(...root.savedCharacters);
    else if (Array.isArray(root.characters)) records.push(...root.characters);
    else if (root.build && looksLikeCharacterBuild(root.build)) records.push(root);
    else records.push(parsed);
  }
  return records.map(coerceSavedCharacterEntry).filter((entry): entry is SavedCharacterEntry => entry !== null);
}

export function UtilitiesApp(): JSX.Element {
  const [selectedFileName, setSelectedFileName] = useState("");
  const [statusMessage, setStatusMessage] = useState("Choose a JSON file to import into Character Builder saved characters.");
  const [pendingEntries, setPendingEntries] = useState<SavedCharacterEntry[]>([]);

  const statusColor = useMemo(() => {
    if (statusMessage.toLowerCase().includes("failed") || statusMessage.toLowerCase().includes("could not")) {
      return "var(--status-danger)";
    }
    if (statusMessage.toLowerCase().includes("success")) {
      return "var(--status-success)";
    }
    return "var(--text-secondary)";
  }, [statusMessage]);

  async function onFileSelected(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) return;
    setSelectedFileName(file.name);
    try {
      const contents = await file.text();
      const entries = parseImportEntries(contents);
      setPendingEntries(entries);
      if (entries.length === 0) {
        setStatusMessage("Could not find Character Builder JSON entries in that file.");
      } else {
        setStatusMessage(`Loaded ${entries.length} character entr${entries.length === 1 ? "y" : "ies"} from file.`);
      }
    } catch {
      setPendingEntries([]);
      setStatusMessage("Could not parse the selected file as JSON.");
    }
  }

  function importPendingEntries(): void {
    if (pendingEntries.length === 0) return;
    const result = importSavedCharacters(pendingEntries, ({ incoming, existing, reason }) => {
      const duplicateType = reason === "id" ? "ID" : "name";
      const shouldOverwrite = window.confirm(
        `Duplicate ${duplicateType} detected.\n\nIncoming: "${incoming.name}" (${incoming.id})\nExisting: "${existing.name}" (${existing.id})\n\nChoose OK to overwrite existing entry, or Cancel to skip incoming entry.`
      );
      return shouldOverwrite ? "overwrite" : "skip";
    });
    setStatusMessage(
      `Import complete: ${result.imported} imported, ${result.overwritten} overwritten, ${result.skipped} skipped.`
    );
  }

  return (
    <div style={{ maxWidth: 1120, margin: "0 auto", padding: "1rem" }}>
      <h1 style={{ marginTop: 0 }}>Utilities</h1>
      <p style={{ marginTop: 0, color: "var(--text-muted)" }}>
        Import JSON character data into Character Builder saved characters, with duplicate ID/name handling.
      </p>

      <div style={{ ...panelStyle, marginBottom: "0.75rem" }}>
        <label style={{ display: "block", marginBottom: "0.6rem", fontWeight: 600 }}>Source File</label>
        <input type="file" accept=".json,application/json,text/json" onChange={onFileSelected} />
        <div style={{ marginTop: "0.6rem", color: statusColor }}>{statusMessage}</div>
      </div>

      <div style={panelStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
          <strong>Pending Import Entries</strong>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button type="button" onClick={importPendingEntries} disabled={pendingEntries.length === 0}>
              Import into Character Builder
            </button>
          </div>
        </div>
        <div style={{ color: "var(--text-muted)", marginBottom: "0.5rem", fontSize: "0.86rem" }}>
          File: {selectedFileName || "none selected"} • Entries: {pendingEntries.length}
        </div>
        <div
          style={{
            maxHeight: "58vh",
            overflow: "auto",
            border: "1px solid var(--panel-border)",
            borderRadius: 6,
            backgroundColor: "var(--surface-1)"
          }}
        >
          {pendingEntries.length === 0 ? (
            <div style={{ padding: "0.75rem", color: "var(--text-muted)", fontSize: "0.85rem" }}>No valid import entries loaded.</div>
          ) : (
            pendingEntries.map((entry, idx) => (
              <div
                key={`${entry.id}-${entry.name}-${idx}`}
                style={{
                  padding: "0.55rem 0.75rem",
                  borderBottom: "1px solid var(--panel-border)",
                  fontSize: "0.84rem"
                }}
              >
                <div style={{ fontWeight: 600 }}>{entry.name}</div>
                <div style={{ color: "var(--text-secondary)" }}>{entry.id}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
