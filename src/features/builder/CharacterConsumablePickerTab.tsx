import { useMemo, useState, type CSSProperties } from "react";
import { filterRulesEntitiesByQuery } from "./featPowerFilters";
import { CollapsibleDisclosure } from "../../ui/CollapsibleDisclosure";
import { RulesRichText } from "./RulesRichText";
import { builderSectionTitleStyle } from "../../ui/panels";
import { blockSubsectionStyle, disclosureSummaryStyle } from "../../ui/disclosureStyles";

export interface ConsumablePickerRow {
  id: string;
  name: string;
  slug: string;
  source?: string | null;
  /** Shown under the name (price, level, category, …). */
  meta?: string;
  body?: string | null;
  flavor?: string | null;
}

export interface CharacterConsumablePickerTabProps {
  title: string;
  description?: string;
  items: ConsumablePickerRow[];
  selectedIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
  /** When set, list rows above this level are hidden unless already selected. */
  maxLevel?: number;
  hideTitle?: boolean;
  loading?: boolean;
  catalogMissing?: boolean;
}

const listPanelStyle: CSSProperties = {
  ...blockSubsectionStyle,
  maxHeight: "280px",
  overflow: "auto",
  backgroundColor: "var(--surface-1)",
  padding: "0.35rem"
};

const inputStyle: CSSProperties = {
  display: "block",
  width: "100%",
  marginTop: "0.2rem",
  padding: "0.4rem 0.5rem",
  border: "1px solid var(--panel-border)",
  borderRadius: "6px",
  boxSizing: "border-box"
};

export function CharacterConsumablePickerTab({
  title,
  description,
  items,
  selectedIds,
  onSelectedIdsChange,
  maxLevel,
  hideTitle,
  loading,
  catalogMissing
}: CharacterConsumablePickerTabProps): JSX.Element {
  const [search, setSearch] = useState("");
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const filteredItems = useMemo(() => {
    let rows = search.trim()
      ? filterRulesEntitiesByQuery(
          items.map((item) => ({
            id: item.id,
            name: item.name,
            slug: item.slug,
            source: item.source
          })),
          search
        ).map((row) => items.find((i) => i.id === row.id)!)
      : [...items];
    if (maxLevel != null) {
      rows = rows.filter((row) => {
        if (selectedSet.has(row.id)) return true;
        const level = parseLevelFromMeta(row.meta);
        return level == null || level <= maxLevel;
      });
    }
    return rows.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }, [items, search, maxLevel, selectedSet]);

  const selectedRows = useMemo(
    () =>
      selectedIds
        .map((id) => items.find((i) => i.id === id))
        .filter((row): row is ConsumablePickerRow => row != null),
    [items, selectedIds]
  );

  function toggle(id: string): void {
    if (selectedSet.has(id)) {
      onSelectedIdsChange(selectedIds.filter((x) => x !== id));
    } else {
      onSelectedIdsChange([...selectedIds, id]);
    }
  }

  return (
    <div>
      {!hideTitle ? <h3 style={builderSectionTitleStyle}>{title}</h3> : null}
      {description ? (
        <p style={{ margin: "0 0 0.55rem", fontSize: "0.88rem", color: "var(--text-secondary)" }}>{description}</p>
      ) : null}
      <label style={{ fontSize: "0.82rem", color: "var(--text-secondary)", display: "block", maxWidth: "28rem" }}>
        Filter
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${title.toLowerCase()}…`}
          style={inputStyle}
        />
      </label>
      <div style={{ marginTop: "0.55rem", fontSize: "0.82rem", color: "var(--text-muted)" }}>
        {loading ? "Loading catalog…" : `${selectedIds.length} selected · ${items.length} available`}
      </div>
      <div style={{ ...listPanelStyle, marginTop: "0.45rem" }}>
        {loading ? (
          <p style={{ margin: "0.5rem", color: "var(--text-muted)", fontSize: "0.9rem" }}>Loading catalog…</p>
        ) : filteredItems.length === 0 ? (
          <p style={{ margin: "0.5rem", color: "var(--text-muted)", fontSize: "0.9rem" }}>
            {catalogMissing
              ? "No catalog data found. Run npm run etl:rules -- out_json generated, then hard-refresh the page."
              : "No entries match this filter."}
          </p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {filteredItems.map((row) => {
              const checked = selectedSet.has(row.id);
              return (
                <li
                  key={row.id}
                  style={{
                    borderBottom: "1px solid var(--panel-border)",
                    padding: "0.35rem 0.25rem"
                  }}
                >
                  <label
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "0.45rem",
                      cursor: "pointer",
                      fontSize: "0.88rem"
                    }}
                  >
                    <input type="checkbox" checked={checked} onChange={() => toggle(row.id)} />
                    <span style={{ minWidth: 0 }}>
                      <span style={{ fontWeight: checked ? 600 : 400 }}>{row.name}</span>
                      {row.meta ? (
                        <span style={{ display: "block", fontSize: "0.78rem", color: "var(--text-muted)" }}>
                          {row.meta}
                          {row.source ? ` · ${row.source}` : ""}
                        </span>
                      ) : row.source ? (
                        <span style={{ display: "block", fontSize: "0.78rem", color: "var(--text-muted)" }}>
                          {row.source}
                        </span>
                      ) : null}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {selectedRows.length > 0 ? (
        <div style={{ marginTop: "0.65rem" }}>
          <h4 style={{ margin: "0 0 0.4rem", fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            On character ({selectedRows.length})
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            {selectedRows.map((row) => (
              <CollapsibleDisclosure
                key={row.id}
                summary={row.name}
                summaryStyle={disclosureSummaryStyle}
                bodyStyle={{ marginTop: "0.35rem" }}
              >
                {row.meta ? (
                  <p style={{ margin: "0 0 0.35rem", fontSize: "0.82rem", color: "var(--text-secondary)" }}>{row.meta}</p>
                ) : null}
                {row.flavor ? (
                  <RulesRichText
                    text={row.flavor}
                    paragraphStyle={{ fontSize: "0.85rem", fontStyle: "italic" }}
                    listItemStyle={{ fontSize: "0.85rem" }}
                  />
                ) : null}
                {row.body ? (
                  <RulesRichText
                    text={row.body}
                    paragraphStyle={{ fontSize: "0.85rem" }}
                    listItemStyle={{ fontSize: "0.85rem" }}
                  />
                ) : null}
              </CollapsibleDisclosure>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function parseLevelFromMeta(meta: string | undefined): number | null {
  if (!meta) return null;
  const m = /\bLv(?:el)?\s*(\d+)/i.exec(meta) ?? /\bLevel\s*(\d+)/i.exec(meta);
  if (!m) return null;
  const n = Number.parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
}
