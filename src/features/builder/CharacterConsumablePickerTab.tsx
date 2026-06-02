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
import { AdjustableNumberInput, adjustableNumberWidthCh } from "../../ui/AdjustableNumberInput";
import { CharacterGoldField } from "./CharacterGoldField";
import { SegmentedControl } from "../../ui/SegmentedControl";

export type ConsumableListSort = "name" | "level";

export interface ConsumablePickerRow {
  id: string;
  name: string;
  slug: string;
  source?: string | null;
  /** Ritual / practice level for sorting and filtering. */
  level?: number | null;
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
  /** Show Name / Level sort toggle (rituals, martial practices, alchemy). */
  showLevelSort?: boolean;
  /** Rituals or martial practices: track scrolls separately from book/practice entries. */
  scrollPurchase?: "ritual" | "martialPractice";
  scrollEntries?: CharacterConsumableEntry[];
  onScrollEntriesChange?: (entries: CharacterConsumableEntry[]) => void;
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

const selectedRowSummaryStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gap: "0.5rem",
  alignItems: "center",
  width: "100%",
  flex: "1 1 auto",
  minWidth: 0
};

const selectedRowControlsStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.4rem",
  flexShrink: 0
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
  ritualCasterBlockedMessage = null,
  showLevelSort = false,
  scrollPurchase,
  scrollEntries = [],
  onScrollEntriesChange
}: CharacterConsumablePickerTabProps): JSX.Element {
  const [search, setSearch] = useState("");
  const [listSort, setListSort] = useState<ConsumableListSort>("name");
  const ritualBlocked = requireRitualCasting && Boolean(ritualCasterBlockedMessage);
  const hasScroll = scrollPurchase != null && onScrollEntriesChange != null;
  const scrollLabels = scrollPurchase ? scrollPurchaseLabels(scrollPurchase) : null;

  const filteredItems = useMemo(() => {
    const ownedIds = new Set([
      ...entries.map((e) => e.id),
      ...(hasScroll ? scrollEntries.map((e) => e.id) : [])
    ]);
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
        const level = rowLevel(row);
        return level == null || level <= maxLevel;
      });
    }
    return rows.sort((a, b) => compareConsumablePickerRows(a, b, listSort));
  }, [items, search, maxLevel, entries, scrollEntries, hasScroll, listSort]);

  const selectedRows = useMemo(() => {
    const ids = new Set<string>();
    for (const entry of entries) ids.add(entry.id);
    if (hasScroll) {
      for (const entry of scrollEntries) ids.add(entry.id);
    }
    const rows: ConsumablePickerRow[] = [];
    for (const id of ids) {
      const row = items.find((i) => i.id === id);
      if (row) rows.push(row);
    }
    return rows.sort((a, b) => compareConsumablePickerRows(a, b, listSort));
  }, [items, entries, scrollEntries, hasScroll, listSort]);

  const totalQty = useMemo(() => {
    const bookQty = entries.reduce((sum, e) => sum + e.quantity, 0);
    const scrollQty = hasScroll ? scrollEntries.reduce((sum, e) => sum + e.quantity, 0) : 0;
    return bookQty + scrollQty;
  }, [entries, scrollEntries, hasScroll]);

  function addFree(id: string, delta = 1): void {
    if (ritualBlocked) return;
    onEntriesChange(addConsumableQuantity(entries, id, delta));
  }

  function purchaseWithGold(cost: number | undefined, onSuccess: () => void): boolean {
    if (!onGoldChange || cost == null || gold < cost) return false;
    onGoldChange(gold - cost);
    onSuccess();
    return true;
  }

  function buyBook(row: ConsumablePickerRow): void {
    if (ritualBlocked) return;
    const cost = linePurchaseCostGp(row.unitPriceGp, 1);
    purchaseWithGold(cost, () => onEntriesChange(addConsumableQuantity(entries, row.id, 1)));
  }

  function addFreeScroll(id: string, delta = 1): void {
    if (!hasScroll || !onScrollEntriesChange) return;
    onScrollEntriesChange(addConsumableQuantity(scrollEntries, id, delta));
  }

  function buyScroll(row: ConsumablePickerRow): void {
    if (!hasScroll || !onScrollEntriesChange) return;
    const cost = linePurchaseCostGp(row.unitPriceGp, 1);
    purchaseWithGold(cost, () =>
      onScrollEntriesChange(addConsumableQuantity(scrollEntries, row.id, 1))
    );
  }

  function buyOne(row: ConsumablePickerRow): void {
    buyBook(row);
  }

  function setBookQty(id: string, quantity: number): void {
    onEntriesChange(setConsumableQuantity(entries, id, quantity));
  }

  function setScrollQty(id: string, quantity: number): void {
    if (!onScrollEntriesChange) return;
    onScrollEntriesChange(setConsumableQuantity(scrollEntries, id, quantity));
  }

  function removeFromBook(id: string): void {
    onEntriesChange(removeConsumableEntry(entries, id));
  }

  function removeScrolls(id: string): void {
    if (!onScrollEntriesChange) return;
    onScrollEntriesChange(removeConsumableEntry(scrollEntries, id));
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
      {onGoldChange ? (
        <CharacterGoldField gold={gold} onChange={onGoldChange} style={{ marginBottom: "0.45rem" }} />
      ) : null}
      {showLevelSort ? (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.4rem",
            alignItems: "center",
            marginBottom: "0.45rem"
          }}
        >
          <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>Sort by</span>
          <SegmentedControl
            ariaLabel="Sort catalog by name or level"
            variant="pill"
            size="compact"
            value={listSort}
            onChange={setListSort}
            options={[
              { value: "name", label: "Name" },
              { value: "level", label: "Level" }
            ]}
          />
        </div>
      ) : null}
      <label
        style={{
          fontSize: "0.82rem",
          color: "var(--text-secondary)",
          display: "block",
          maxWidth: "28rem"
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
              const bookQty = consumableQuantity(entries, row.id);
              const scrollQty = hasScroll ? consumableQuantity(scrollEntries, row.id) : 0;
              const cost = linePurchaseCostGp(row.unitPriceGp, 1);
              const canAfford = cost != null ? gold >= cost : false;
              const addBookDisabled = ritualBlocked;
              const buyBookDisabled = addBookDisabled || cost == null || !canAfford || !onGoldChange;
              const buyScrollDisabled = cost == null || !canAfford || !onGoldChange;

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
                      <span style={{ fontWeight: bookQty > 0 || scrollQty > 0 ? 600 : 400 }}>{row.name}</span>
                      {bookQty > 0 ? (
                        <span
                          style={{
                            marginLeft: "0.35rem",
                            fontSize: "0.75rem",
                            color: "var(--text-muted)",
                            fontWeight: 500
                          }}
                        >
                          {scrollLabels?.bookShort ?? "book"} ×{bookQty}
                        </span>
                      ) : null}
                      {scrollQty > 0 ? (
                        <span
                          style={{
                            marginLeft: "0.35rem",
                            fontSize: "0.75rem",
                            color: "var(--text-muted)",
                            fontWeight: 500
                          }}
                        >
                          scroll ×{scrollQty}
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
                        disabled={addBookDisabled}
                        onClick={() => addFree(row.id, 1)}
                        title={
                          addBookDisabled
                            ? ritualCasterBlockedMessage ?? undefined
                            : hasScroll
                              ? `Add to ${scrollLabels?.bookShort ?? "book"} without spending gold`
                              : "Add without spending gold"
                        }
                      >
                        {hasScroll ? scrollLabels!.addBook : "Add"}
                      </button>
                      {showPurchaseActions && onGoldChange ? (
                        hasScroll ? (
                          <>
                            <button
                              type="button"
                              style={actionButtonStyle}
                              disabled={buyBookDisabled}
                              onClick={() => buyBook(row)}
                              title={purchaseTitle(scrollLabels!.bookShort, cost, canAfford)}
                            >
                              {scrollLabels!.buyBook}
                              {cost != null ? ` (${formatGoldCost(cost)})` : ""}
                            </button>
                            <button
                              type="button"
                              style={actionButtonStyle}
                              onClick={() => addFreeScroll(row.id, 1)}
                              title="Add scroll without spending gold"
                            >
                              {scrollLabels!.addScroll}
                            </button>
                            <button
                              type="button"
                              style={actionButtonStyle}
                              disabled={buyScrollDisabled}
                              onClick={() => buyScroll(row)}
                              title={purchaseTitle("scroll", cost, canAfford)}
                            >
                              {scrollLabels!.buyScroll}
                              {cost != null ? ` (${formatGoldCost(cost)})` : ""}
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            style={actionButtonStyle}
                            disabled={buyBookDisabled}
                            onClick={() => buyOne(row)}
                            title={purchaseTitle("item", cost, canAfford)}
                          >
                            Buy{cost != null ? ` (${formatGoldCost(cost)})` : ""}
                          </button>
                        )
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
            {selectedRows.map((row) => {
              const bookQty = consumableQuantity(entries, row.id);
              const scrollQty = hasScroll ? consumableQuantity(scrollEntries, row.id) : 0;
              return (
              <CollapsibleDisclosure
                key={row.id}
                summary={
                  <span style={selectedRowSummaryStyle}>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ fontWeight: 500 }}>{row.name}</span>
                      {row.unitPriceGp != null && showPurchaseActions ? (
                        <span
                          style={{
                            display: "block",
                            fontSize: "0.78rem",
                            color: "var(--text-muted)",
                            marginTop: "0.1rem"
                          }}
                        >
                          {hasScroll && scrollLabels
                            ? `${formatGoldCost(row.unitPriceGp)} ${scrollLabels.priceNote}`
                            : `${formatGoldCost(row.unitPriceGp)} each`}
                        </span>
                      ) : null}
                    </span>
                    <span
                      style={{
                        ...selectedRowControlsStyle,
                        flexWrap: "wrap",
                        justifyContent: "flex-end"
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {hasScroll && scrollLabels ? (
                        <>
                          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                            {scrollLabels.bookQtyLabel}
                          </span>
                          <AdjustableNumberInput
                            ariaLabel={`${scrollLabels.bookQtyLabel} copies of ${row.name}`}
                            value={bookQty}
                            min={0}
                            max={9999}
                            onChange={(v) => setBookQty(row.id, v)}
                            compact
                            style={{ flexShrink: 0 }}
                            inputStyle={{ width: adjustableNumberWidthCh(bookQty, 9999) }}
                          />
                          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginLeft: "0.15rem" }}>
                            Scroll
                          </span>
                          <AdjustableNumberInput
                            ariaLabel={`Scrolls of ${row.name}`}
                            value={scrollQty}
                            min={0}
                            max={9999}
                            onChange={(v) => setScrollQty(row.id, v)}
                            compact
                            style={{ flexShrink: 0 }}
                            inputStyle={{ width: adjustableNumberWidthCh(scrollQty, 9999) }}
                          />
                        </>
                      ) : (
                        <AdjustableNumberInput
                          ariaLabel={`Quantity of ${row.name}`}
                          value={bookQty}
                          min={0}
                          max={9999}
                          onChange={(v) => setBookQty(row.id, v)}
                          compact
                          style={{ flexShrink: 0 }}
                          inputStyle={{ width: adjustableNumberWidthCh(bookQty, 9999) }}
                        />
                      )}
                      {bookQty > 0 ? (
                        <button type="button" style={actionButtonStyle} onClick={() => removeFromBook(row.id)}>
                          {hasScroll && scrollLabels ? `Clear ${scrollLabels.bookShort}` : "Remove"}
                        </button>
                      ) : null}
                      {hasScroll && scrollQty > 0 ? (
                        <button type="button" style={actionButtonStyle} onClick={() => removeScrolls(row.id)}>
                          Clear scrolls
                        </button>
                      ) : null}
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
            );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function scrollPurchaseLabels(variant: "ritual" | "martialPractice"): {
  bookShort: string;
  addBook: string;
  buyBook: string;
  addScroll: string;
  buyScroll: string;
  bookQtyLabel: string;
  priceNote: string;
} {
  if (variant === "ritual") {
    return {
      bookShort: "book",
      addBook: "Add book",
      buyBook: "Buy book",
      addScroll: "Add scroll",
      buyScroll: "Buy scroll",
      bookQtyLabel: "Book",
      priceNote: "per book or scroll"
    };
  }
  return {
    bookShort: "practice",
    addBook: "Add",
    buyBook: "Buy",
    addScroll: "Add scroll",
    buyScroll: "Buy scroll",
    bookQtyLabel: "Practice",
    priceNote: "per practice or scroll"
  };
}

function purchaseTitle(kind: string, cost: number | undefined, canAfford: boolean): string {
  if (cost == null) return "No market price";
  if (canAfford) return `Buy ${kind} for ${formatGoldCost(cost)}`;
  return `Need ${formatGoldCost(cost)}`;
}

function rowLevel(row: ConsumablePickerRow): number | null {
  if (row.level != null && Number.isFinite(row.level)) return row.level;
  return parseLevelFromMeta(row.meta);
}

function compareConsumablePickerRows(
  a: ConsumablePickerRow,
  b: ConsumablePickerRow,
  sort: ConsumableListSort
): number {
  const byName = () => a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  if (sort === "name") return byName();
  const la = rowLevel(a);
  const lb = rowLevel(b);
  if (la == null && lb == null) return byName();
  if (la == null) return 1;
  if (lb == null) return -1;
  if (la !== lb) return la - lb;
  return byName();
}

function parseLevelFromMeta(meta: string | undefined): number | null {
  if (!meta) return null;
  const m = /\bLv(?:el)?\s*(\d+)/i.exec(meta) ?? /\bLevel\s*(\d+)/i.exec(meta);
  if (!m) return null;
  const n = Number.parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
}
