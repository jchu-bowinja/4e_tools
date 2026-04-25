import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { GlossaryTermRow } from "../../data/tooltipGlossary";
import { displayTextForGlossaryRow, isNumberedRangeAlias, sanitizeGlossaryRows } from "../../data/tooltipGlossary";
import { saveGlossaryRowsToStorage } from "../../data/glossaryStorage";

type Props = {
  rows: GlossaryTermRow[];
  onRowsChange: (rows: GlossaryTermRow[]) => void;
  onResetToBundled: () => void | Promise<void>;
};

const panel: CSSProperties = {
  backgroundColor: "var(--surface-1)",
  border: "1px solid var(--panel-border)",
  borderRadius: "8px",
  padding: "0.75rem",
  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.18), 0 1px 2px rgba(20, 14, 8, 0.12)"
};

const labelStyle: CSSProperties = { display: "block", fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: "0.2rem" };
const fieldSurface: CSSProperties = {
  backgroundColor: "var(--surface-0)",
  border: "1px solid var(--panel-border)",
  borderRadius: "6px"
};

const GLOSSARY_SELECTED_TERM_ID_STORAGE_KEY = "glossaryEditor.selectedTermId";

function readStoredSelectedTermId(): string {
  try {
    return window.localStorage.getItem(GLOSSARY_SELECTED_TERM_ID_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeStoredSelectedTermId(id: string): void {
  try {
    if (id.trim()) {
      window.localStorage.setItem(GLOSSARY_SELECTED_TERM_ID_STORAGE_KEY, id);
    } else {
      window.localStorage.removeItem(GLOSSARY_SELECTED_TERM_ID_STORAGE_KEY);
    }
  } catch {
    // Ignore storage failures and keep selection in-memory.
  }
}

function newTermRow(): GlossaryTermRow {
  return {
    id: `glossary_custom_${Date.now()}`,
    name: "New term",
    category: "Rules",
    type: "Rules Other",
    sourceBook: "",
    definition: "",
    publishedIn: "",
    html: null,
    aliases: []
  };
}

function exportRowsJson(rows: GlossaryTermRow[]): void {
  const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "glossary_terms.json";
  link.click();
  URL.revokeObjectURL(link.href);
}

function sanitizeAliases(aliases: string[] | null | undefined): string[] {
  if (!Array.isArray(aliases)) return [];
  return aliases.filter((alias) => alias.trim().length > 0 && !isNumberedRangeAlias(alias.trim()));
}

export function GlossaryEditorApp({ rows, onRowsChange, onResetToBundled }: Props): JSX.Element {
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [storedSelectedTermId, setStoredSelectedTermId] = useState<string>(() => readStoredSelectedTermId());
  const [message, setMessage] = useState("");
  const [resetBusy, setResetBusy] = useState(false);
  const [aliasesDraft, setAliasesDraft] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => {
        if (!q) return true;
        const name = String(row.name ?? "");
        const id = String(row.id ?? "");
        const aliases = Array.isArray(row.aliases) ? row.aliases.join(" ") : "";
        const hay = `${name} ${id} ${aliases}`.toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => {
        const aName = String(a.row.name ?? "").trim();
        const bName = String(b.row.name ?? "").trim();
        const byName = aName.localeCompare(bName, undefined, { sensitivity: "base" });
        if (byName !== 0) return byName;
        return a.index - b.index;
      });
  }, [rows, search]);

  useEffect(() => {
    if (selectedIndex == null) return;
    if (selectedIndex < 0 || selectedIndex >= rows.length) {
      setSelectedIndex(null);
    }
  }, [rows.length, selectedIndex]);

  useEffect(() => {
    if (!storedSelectedTermId) return;
    const matchIndex = rows.findIndex((row) => String(row.id ?? "") === storedSelectedTermId);
    if (matchIndex >= 0 && matchIndex !== selectedIndex) {
      setSelectedIndex(matchIndex);
    }
  }, [rows, selectedIndex, storedSelectedTermId]);

  useEffect(() => {
    const selectedId = selectedIndex != null && selectedIndex < rows.length ? String(rows[selectedIndex]?.id ?? "") : "";
    setStoredSelectedTermId(selectedId);
    writeStoredSelectedTermId(selectedId);
  }, [rows, selectedIndex]);

  const selected = selectedIndex != null && selectedIndex < rows.length ? rows[selectedIndex] : null;

  useEffect(() => {
    if (!selected) {
      setAliasesDraft("");
      return;
    }
    setAliasesDraft(Array.isArray(selected.aliases) ? selected.aliases.join("\n") : "");
  }, [selected]);

  function patchSelected(patch: Partial<GlossaryTermRow>): void {
    if (selectedIndex == null) return;
    const next = rows.slice();
    next[selectedIndex] = { ...next[selectedIndex], ...patch };
    onRowsChange(next);
    setMessage("");
  }

  function setAliasesFromText(text: string): void {
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    const filtered = sanitizeAliases(lines);
    patchSelected({ aliases: filtered });
    if (filtered.length !== lines.length) {
      setMessage("Removed numbered range aliases (for example: melee 1, reach 10).");
    }
  }

  function handleNew(): void {
    const next = rows.concat(newTermRow());
    onRowsChange(next);
    setSelectedIndex(next.length - 1);
    setMessage("New term — edit fields and use Save to browser or export JSON to keep changes.");
  }

  function handleDelete(): void {
    if (selectedIndex == null) return;
    if (!window.confirm("Remove this term from the in-memory list? (Save to browser to persist.)")) return;
    const next = rows.filter((_, i) => i !== selectedIndex);
    onRowsChange(next);
    setSelectedIndex(next.length > 0 ? Math.min(selectedIndex, next.length - 1) : null);
    setMessage("Term removed. Save to browser to persist.");
  }

  function handleSaveToBrowser(): void {
    saveGlossaryRowsToStorage(sanitizeGlossaryRows(rows));
    setMessage("Saved glossary to this browser. Tooltips use this copy until you reset.");
  }

  async function handleReset(): Promise<void> {
    if (!window.confirm("Discard the saved browser copy and reload glossary from the bundled file?")) return;
    setResetBusy(true);
    setMessage("");
    try {
      await onResetToBundled();
    } finally {
      setResetBusy(false);
    }
  }

  function handleImportFile(file: File): void {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result)) as unknown;
        if (!Array.isArray(data)) {
          setMessage("File must be a JSON array of glossary terms.");
          return;
        }
        const sanitized = sanitizeGlossaryRows(data as GlossaryTermRow[]);
        onRowsChange(sanitized);
        setSelectedIndex(sanitized.length > 0 ? 0 : null);
        setMessage("Imported. Numbered range aliases were removed.");
      } catch {
        setMessage("Could not parse JSON file.");
      }
    };
    reader.readAsText(file);
  }

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "1rem", color: "var(--text-primary)" }}>
      <h1 style={{ marginTop: 0 }}>Glossary</h1>
      <p style={{ marginTop: 0, color: "var(--text-muted)", maxWidth: "52rem" }}>
        View and edit terms from <code>generated/glossary_terms.json</code>. Use <strong>Save to browser</strong> to store
        your list locally so tooltips across the app use your copy. <strong>Reset to bundled file</strong> removes the
        stored copy and reloads from the file. Export / import raw JSON to share or back up.
      </p>

      {message && (
        <div
          style={{
            marginBottom: "0.75rem",
            padding: "0.5rem 0.65rem",
            borderRadius: "6px",
            background: "linear-gradient(180deg, var(--surface-1) 0%, var(--surface-2) 100%)",
            border: "1px solid var(--panel-border)",
            color: "var(--text-muted)",
            fontSize: "0.9rem",
            boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.16)"
          }}
        >
          {message}
        </div>
      )}

      <div style={{ display: "flex", gap: "1rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
        <button type="button" onClick={handleNew}>
          New term
        </button>
        <button type="button" onClick={handleSaveToBrowser}>
          Save to browser
        </button>
        <button type="button" onClick={handleReset} disabled={resetBusy}>
          {resetBusy ? "Resetting…" : "Reset to bundled file"}
        </button>
        <button
          type="button"
          onClick={() => {
            exportRowsJson(rows);
            setMessage("Download started.");
          }}
        >
          Export JSON
        </button>
        <label style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", cursor: "pointer" }}>
          <span>Import JSON</span>
          <input
            type="file"
            accept="application/json,.json"
            style={{ maxWidth: "12rem" }}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) handleImportFile(file);
            }}
          />
        </label>
      </div>

      <div style={{ display: "flex", gap: "1rem", alignItems: "stretch", flexWrap: "wrap" }}>
        <div style={{ ...panel, width: 300, minWidth: 220, maxHeight: "70vh", display: "flex", flexDirection: "column" }}>
          <label style={labelStyle}>
            Search
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ ...fieldSurface, width: "100%", boxSizing: "border-box", marginTop: "0.15rem" }}
            />
          </label>
          <div style={{ marginTop: "0.5rem", overflow: "auto", flex: 1, fontSize: "0.9rem" }}>
            {filtered.length === 0 ? (
              <div style={{ color: "var(--text-muted)" }}>No terms match.</div>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {filtered.map(({ row, index }) => {
                  const active = index === selectedIndex;
                  return (
                    <li key={`${row.id ?? "row"}-${index}`} style={{ marginBottom: "0.25rem" }}>
                      <button
                        type="button"
                        onClick={() => setSelectedIndex(index)}
                        style={{
                          width: "100%",
                          textAlign: "left",
                          padding: "0.4rem 0.5rem",
                          borderRadius: "6px",
                          border: active ? "1px solid var(--panel-border-strong)" : "1px solid transparent",
                          background: active
                            ? "linear-gradient(180deg, color-mix(in srgb, var(--surface-2) 88%, #ffffff 12%) 0%, var(--surface-2) 100%)"
                            : "transparent",
                          color: "var(--text-primary)",
                          cursor: "pointer",
                          boxShadow: active ? "inset 0 1px 0 rgba(255, 255, 255, 0.16)" : "none"
                        }}
                      >
                        <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis" }}>{row.name || "(no name)"}</div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div style={{ ...panel, flex: 1, minWidth: 280 }}>
          {!selected ? (
            <div style={{ color: "var(--text-muted)" }}>Select a term, or create a new one.</div>
          ) : (
            <div style={{ display: "grid", gap: "0.65rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.65rem" }}>
                <label>
                  <span style={labelStyle}>Name</span>
                  <input
                    type="text"
                    value={String(selected.name ?? "")}
                    onChange={(e) => patchSelected({ name: e.target.value })}
                    style={{ ...fieldSurface, width: "100%", boxSizing: "border-box" }}
                  />
                </label>
                <label>
                  <span style={labelStyle}>ID</span>
                  <input
                    type="text"
                    value={String(selected.id ?? "")}
                    onChange={(e) => patchSelected({ id: e.target.value })}
                    style={{ ...fieldSurface, width: "100%", boxSizing: "border-box" }}
                  />
                </label>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.65rem" }}>
                <label>
                  <span style={labelStyle}>Category</span>
                  <input
                    type="text"
                    value={String(selected.category ?? "")}
                    onChange={(e) => patchSelected({ category: e.target.value || null })}
                    style={{ ...fieldSurface, width: "100%", boxSizing: "border-box" }}
                  />
                </label>
                <label>
                  <span style={labelStyle}>Type</span>
                  <input
                    type="text"
                    value={String(selected.type ?? "")}
                    onChange={(e) => patchSelected({ type: e.target.value || null })}
                    style={{ ...fieldSurface, width: "100%", boxSizing: "border-box" }}
                  />
                </label>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.65rem" }}>
                <label>
                  <span style={labelStyle}>Source book</span>
                  <input
                    type="text"
                    value={String(selected.sourceBook ?? "")}
                    onChange={(e) => patchSelected({ sourceBook: e.target.value || null })}
                    style={{ ...fieldSurface, width: "100%", boxSizing: "border-box" }}
                  />
                </label>
                <label>
                  <span style={labelStyle}>Published in</span>
                  <input
                    type="text"
                    value={String(selected.publishedIn ?? "")}
                    onChange={(e) => patchSelected({ publishedIn: e.target.value || null })}
                    style={{ ...fieldSurface, width: "100%", boxSizing: "border-box" }}
                  />
                </label>
              </div>
              <label>
                <span style={labelStyle}>Aliases (one per line; optional)</span>
                <textarea
                  value={aliasesDraft}
                  onChange={(e) => setAliasesDraft(e.target.value)}
                  onBlur={() => setAliasesFromText(aliasesDraft)}
                  rows={4}
                  style={{ ...fieldSurface, width: "100%", boxSizing: "border-box", fontFamily: "inherit", resize: "vertical" }}
                />
              </label>
              <label>
                <span style={labelStyle}>Definition (plain text; preferred for tooltips)</span>
                <textarea
                  value={String(selected.definition ?? "")}
                  onChange={(e) => patchSelected({ definition: e.target.value || null })}
                  rows={6}
                  style={{ ...fieldSurface, width: "100%", boxSizing: "border-box", fontFamily: "inherit", resize: "vertical" }}
                />
              </label>
              <label>
                <span style={labelStyle}>HTML (optional; used if definition is empty)</span>
                <textarea
                  value={String(selected.html ?? "")}
                  onChange={(e) => patchSelected({ html: e.target.value ? e.target.value : null })}
                  rows={5}
                  style={{
                    ...fieldSurface,
                    width: "100%",
                    boxSizing: "border-box",
                    fontFamily: "monospace",
                    fontSize: "0.82rem",
                    resize: "vertical"
                  }}
                />
              </label>
              <div
                style={{
                  padding: "0.55rem 0.65rem",
                  background: "linear-gradient(180deg, var(--surface-0) 0%, var(--surface-1) 100%)",
                  border: "1px solid var(--panel-border)",
                  borderRadius: "6px",
                  fontSize: "0.88rem",
                  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.14)"
                }}
              >
                <div style={{ ...labelStyle, marginBottom: "0.35rem" }}>Tooltip preview (plain text)</div>
                <div style={{ whiteSpace: "pre-wrap" }}>{displayTextForGlossaryRow(selected) || "(no definition or HTML text)"}</div>
              </div>
              <div>
                <button type="button" onClick={handleDelete}>
                  Delete this term
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
