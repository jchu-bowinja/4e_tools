import { useMemo, useState, type CSSProperties } from "react";
import type { CharacterConsumableEntry } from "../../rules/models";
import {
  addConsumableQuantity,
  consumableQuantity,
  removeConsumableEntry,
  setConsumableQuantity
} from "../../rules/consumablesModel";
import { linePurchaseCostGp } from "../../rules/consumablesPrices";
import { formatGoldCost } from "../../rules/itemGold";
import { filterRulesEntitiesByQuery } from "./featPowerFilters";
import { CollapsibleDisclosure } from "../../ui/CollapsibleDisclosure";
import { RulesRichText } from "./RulesRichText";
import { builderSectionTitleStyle } from "../../ui/panels";
import { blockSubsectionStyle, disclosureSummaryStyle } from "../../ui/disclosureStyles";
import { AdjustableNumberInput } from "../../ui/AdjustableNumberInput";

export interface ConsumablePickerRow {
  id: string;
  name: string;
  slug: string;
  source?: string | null;
  /** Shown under the name (price, level, category, …). */
  meta?: string;
  body?: string | null;
  flavor?: string | null;
  /** Unit market price in gp for Buy actions. */
  unitPriceGp?: number;
}

export interface CharacterConsumablePickerTabProps {
  title: string;
  description?: string;
  items: ConsumablePickerRow[];
  entries: CharacterConsumableEntry[];
  onEntriesChange: (entries: CharacterConsumableEntry[]) => void;
  /** When set, list rows above this level are hidden unless already owned. */
  maxLevel?: number;
  hideTitle?: boolean;
  loading?: boolean;
  catalogMissing?: boolean;
  gold?: number;
  onGoldChange?: (gold: number) => void;
  /** Show Add (free) and Buy (deduct gold) on catalog rows. */
  showPurchaseActions?: boolean;
  /** Block adding rituals when the character cannot cast rituals. */
  requireRitualCasting?: boolean;
  ritualCasterBlockedMessage?: string | null;
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

const actionButtonStyle: CSSProperties = {
  padding: "0.25rem 0.5rem",
  borderRadius: "6px",
  border: "1px solid var(--panel-border)",
  backgroundColor: "var(--surface-0)",
  fontSize: "0.78rem",
  cursor: "pointer"
};

const qtyButtonStyle: CSSProperties = {
  ...actionButtonStyle,
  minWidth: "1.75rem",
  padding: "0.2rem 0.4rem"
};

export function CharacterConsumablePickerTab({
  title,
  description,
  items,
  entries,
  onEntriesChange,
  maxLevel,
  hideTitle,
  loading,
  catalogMissing,
  gold = 0,
  onGoldChange,
  showPurchaseActions = false,
  requireRitualCasting = false,
  ritualCasterBlockedMessage = null
}: CharacterConsumablePickerTabProps): JSX.Element {
  const [search, setSearch] = useState("");
  const ritualBlocked = requireRitualCasting && Boolean(ritualCasterBlockedMessage);

  const filteredItems = useMemo(() => {
    const ownedIds = new Set(entries.map((e) => e.id));
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
        if (ownedIds.has(row.id)) return true;
        const level = parseLevelFromMeta(row.meta);
        return level == null || level <= maxLevel;
      });
    }
    return rows.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }, [items, search, maxLevel, entries]);

  const selectedRows = useMemo(() => {
    const rows: { entry: CharacterConsumableEntry; row: ConsumablePickerRow }[] = [];
    for (const entry of entries) {
      const row = items.find((i) => i.id === entry.id);
      if (row) rows.push({ entry, row });
    }
    rows.sort((a, b) => a.row.name.localeCompare(b.row.name, undefined, { sensitivity: "base" }));
    return rows;
  }, [items, entries]);

  const totalQty = useMemo(() => entries.reduce((sum, e) => sum + e.quantity, 0), [entries]);

  function addFree(id: string, delta = 1): void {
    if (ritualBlocked) return;
    onEntriesChange(addConsumableQuantity(entries, id, delta));
  }

  function buyOne(row: ConsumablePickerRow): void {
    if (ritualBlocked || !onGoldChange) return;
    const cost = linePurchaseCostGp(row.unitPriceGp, 1);
    if (cost == null || gold < cost) return;
    onGoldChange(gold - cost);
    onEntriesChange(addConsumableQuantity(entries, row.id, 1));
  }

  function setQty(id: string, quantity: number): void {
    onEntriesChange(setConsumableQuantity(entries, id, quantity));
  }

  function remove(id: string): void {
    onEntriesChange(removeConsumableEntry(entries, id));
  }

  return (
    <div>
      {!hideTitle ? <h3 style={builderSectionTitleStyle}>{title}</h3> : null}
      {description ? (
        <p style={{ margin: "0 0 0.55rem", fontSize: "0.88rem", color: "var(--text-secondary)" }}>{description}</p>
      ) : null}
      {ritualCasterBlockedMessage ? (
        <p
          style={{
            margin: "0 0 0.55rem",
            padding: "0.45rem 0.55rem",
            fontSize: "0.85rem",
            borderRadius: "6px",
            border: "1px solid var(--panel-border)",
            backgroundColor: "var(--surface-1)",
            color: ritualBlocked ? "var(--text-warning, #b45309)" : "var(--text-secondary)"
          }}
        >
          {ritualCasterBlockedMessage}
        </p>
      ) : null}
      {showPurchaseActions && onGoldChange ? (
        <label style={{ fontSize: "0.82rem", color: "var(--text-secondary)", display: "block", maxWidth: "12rem" }}>
          Gold (gp)
          <AdjustableNumberInput
            ariaLabel="Gold pieces"
            value={gold}
            min={0}
            max={99_999_999}
            onChange={(v) => onGoldChange(Math.max(0, Math.trunc(v)))}
            style={{ ...inputStyle, marginTop: "0.2rem" }}
          />
        </label>
      ) : null}
      <label
        style={{
          fontSize: "0.82rem",
          color: "var(--text-secondary)",
          display: "block",
          maxWidth: "28rem",
          marginTop: showPurchaseActions && onGoldChange ? "0.45rem" : 0
        }}
      >
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
        {loading
          ? "Loading catalog…"
          : `${entries.length} line${entries.length === 1 ? "" : "s"} · ${totalQty} item${totalQty === 1 ? "" : "s"} · ${items.length} available`}
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
              const qty = consumableQuantity(entries, row.id);
              const cost = linePurchaseCostGp(row.unitPriceGp, 1);
              const canAfford = cost != null ? gold >= cost : false;
              const addDisabled = ritualBlocked;
              const buyDisabled = ritualBlocked || cost == null || !canAfford || !onGoldChange;

              return (
                <li
                  key={row.id}
                  style={{
                    borderBottom: "1px solid var(--panel-border)",
                    padding: "0.4rem 0.25rem"
                  }}
                >
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "flex-start" }}>
                    <span style={{ flex: "1 1 12rem", minWidth: 0, fontSize: "0.88rem" }}>
                      <span style={{ fontWeight: qty > 0 ? 600 : 400 }}>{row.name}</span>
                      {qty > 0 ? (
                        <span
                          style={{
                            marginLeft: "0.35rem",
                            fontSize: "0.75rem",
                            color: "var(--text-muted)",
                            fontWeight: 500
                          }}
                        >
                          ×{qty}
                        </span>
                      ) : null}
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
                    <span style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", alignItems: "center" }}>
                      <button
                        type="button"
                        style={actionButtonStyle}
                        disabled={addDisabled}
                        onClick={() => addFree(row.id, 1)}
                        title={ritualBlocked ? ritualCasterBlockedMessage ?? undefined : "Add without spending gold"}
                      >
                        Add
                      </button>
                      {showPurchaseActions && onGoldChange ? (
                        <button
                          type="button"
                          style={actionButtonStyle}
                          disabled={buyDisabled}
                          onClick={() => buyOne(row)}
                          title={
                            cost == null
                              ? "No market price"
                              : canAfford
                                ? `Buy for ${formatGoldCost(cost)}`
                                : `Need ${formatGoldCost(cost)} (have ${formatGoldCost(gold)})`
                          }
                        >
                          Buy{cost != null ? ` (${formatGoldCost(cost)})` : ""}
                        </button>
                      ) : null}
                    </span>
                  </div>
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
            {selectedRows.map(({ entry, row }) => (
              <CollapsibleDisclosure
                key={row.id}
                summary={
                  <span style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center", width: "100%" }}>
                    <span style={{ flex: "1 1 8rem" }}>
                      {row.name}
                      {row.unitPriceGp != null && showPurchaseActions ? (
                        <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginLeft: "0.35rem" }}>
                          {formatGoldCost(row.unitPriceGp)} each
                        </span>
                      ) : null}
                    </span>
                    <span
                      style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        style={qtyButtonStyle}
                        aria-label={`Decrease ${row.name}`}
                        onClick={() => setQty(row.id, entry.quantity - 1)}
                      >
                        −
                      </button>
                      <AdjustableNumberInput
                        ariaLabel={`Quantity of ${row.name}`}
                        value={entry.quantity}
                        min={0}
                        max={9999}
                        onChange={(v) => setQty(row.id, v)}
                        compact
                        style={{ width: `${Math.max(3, String(entry.quantity).length + 1)}ch` }}
                      />
                      <button
                        type="button"
                        style={qtyButtonStyle}
                        aria-label={`Increase ${row.name}`}
                        onClick={() => setQty(row.id, entry.quantity + 1)}
                      >
                        +
                      </button>
                      <button
                        type="button"
                        style={{ ...actionButtonStyle, marginLeft: "0.25rem" }}
                        onClick={() => remove(row.id)}
                      >
                        Remove
                      </button>
                    </span>
                  </span>
                }
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
