import { useMemo, useState, type CSSProperties } from "react";
import type { CharacterBuild, EquippedSlotKey, RulesIndex } from "../../rules/models";
import { SegmentedControl } from "../../ui/SegmentedControl";
import { AdjustableNumberInput, adjustableNumberWidthCh } from "../../ui/AdjustableNumberInput";
import { CollapsibleDisclosure } from "../../ui/CollapsibleDisclosure";
import { ConsumableItemDescription } from "../../ui/ConsumableItemDescription";
import { hasConsumableDescription } from "../../rules/consumablesDisplay";
import { CharacterInventoryList } from "./CharacterInventoryList";
import {
  equipInventoryItemOnBuild,
  isEquipmentDerivedInventoryItem,
  unequipInventoryItemOnBuild
} from "./sheetEquipment";
import {
  UNIFIED_INVENTORY_CATEGORIES,
  UNIFIED_INVENTORY_CATEGORY_LABELS,
  filterUnifiedInventoryRows,
  setUnifiedConsumableQuantity,
  unifiedInventoryRows,
  type UnifiedInventoryFilter,
  type UnifiedInventoryRow
} from "./unifiedInventory";

const listStyle: CSSProperties = {
  margin: 0,
  padding: 0,
  listStyle: "none",
  display: "grid",
  gap: "0.45rem"
};

const rowStyle: CSSProperties = {
  padding: "0.45rem 0.5rem",
  borderRadius: "6px",
  border: "1px solid var(--panel-border)",
  backgroundColor: "var(--surface-0)",
  fontSize: "0.84rem",
  lineHeight: 1.4
};

const actionButtonStyle: CSSProperties = {
  padding: "0.25rem 0.5rem",
  borderRadius: "6px",
  border: "1px solid var(--panel-border)",
  backgroundColor: "var(--surface-1)",
  fontSize: "0.78rem",
  cursor: "pointer",
  flexShrink: 0
};

const qtyRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "0.35rem",
  alignItems: "center",
  flexShrink: 0
};

const inventoryDisclosureSummaryStyle: CSSProperties = {
  cursor: "pointer",
  display: "flex",
  justifyContent: "space-between",
  gap: "0.5rem",
  alignItems: "flex-start",
  width: "100%"
};

export interface CharacterUnifiedInventoryPanelProps {
  index: RulesIndex;
  build: CharacterBuild;
  onBuildChange: (build: CharacterBuild) => void;
  hideDescription?: boolean;
  /** Minimum ritual-book quantity per id (wizard spellbook free rituals). */
  minRitualBookQuantityById?: Record<string, number>;
}

export function CharacterUnifiedInventoryPanel({
  index,
  build,
  onBuildChange,
  hideDescription = false,
  minRitualBookQuantityById = {}
}: CharacterUnifiedInventoryPanelProps): JSX.Element {
  const [filter, setFilter] = useState<UnifiedInventoryFilter>("all");
  const allRows = useMemo(() => unifiedInventoryRows(build, index), [build, index]);
  const filteredRows = useMemo(() => filterUnifiedInventoryRows(allRows, filter), [allRows, filter]);

  const filterOptions = useMemo(() => {
    const categoriesWithItems = new Set(allRows.map((r) => r.category));
    const opts: { value: UnifiedInventoryFilter; label: string }[] = [
      { value: "all", label: `All (${allRows.length})` }
    ];
    for (const category of UNIFIED_INVENTORY_CATEGORIES) {
      if (!categoriesWithItems.has(category)) continue;
      const count = allRows.filter((r) => r.category === category).length;
      opts.push({
        value: category,
        label: `${UNIFIED_INVENTORY_CATEGORY_LABELS[category]} (${count})`
      });
    }
    return opts;
  }, [allRows]);

  const equipmentRows = useMemo(
    () => filteredRows.filter((r): r is Extract<UnifiedInventoryRow, { kind: "equipment" }> => r.kind === "equipment"),
    [filteredRows]
  );
  const consumableRows = useMemo(
    () =>
      filteredRows.filter((r): r is Extract<UnifiedInventoryRow, { kind: "consumable" }> => r.kind === "consumable"),
    [filteredRows]
  );

  function removeEquipmentItem(itemId: string): void {
    const slots = { ...(build.equippedSlots ?? {}) };
    for (const [slot, id] of Object.entries(slots)) {
      if (id === itemId) delete slots[slot as EquippedSlotKey];
    }
    onBuildChange({
      ...build,
      inventory: (build.inventory ?? []).filter((item) => item.id !== itemId),
      equippedSlots: slots
    });
  }

  return (
    <div>
      {!hideDescription ? (
        <p style={{ margin: "0 0 0.55rem", fontSize: "0.88rem", color: "var(--text-secondary)" }}>
          Everything your character owns: equipment, adventuring gear, rituals, scrolls, alchemy, and martial practices.
          Use the other Items tabs to add or purchase entries.
        </p>
      ) : null}
      {filterOptions.length > 1 ? (
        <SegmentedControl
          ariaLabel="Filter inventory by category"
          variant="pill"
          size="compact"
          value={filter}
          onChange={setFilter}
          options={filterOptions}
          style={{ marginBottom: "0.55rem", flexWrap: "wrap" }}
        />
      ) : null}
      {filteredRows.length === 0 ? (
        <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--text-muted)", lineHeight: 1.45 }}>
          {allRows.length === 0
            ? "No items yet. Use the Equipment and other Items tabs to add gear, equipment, rituals, and consumables."
            : "No items in this category."}
        </p>
      ) : (
        <div style={{ display: "grid", gap: "0.65rem" }}>
          {equipmentRows.length > 0 ? (
            <CharacterInventoryList
              items={equipmentRows.map((r) => r.equipment)}
              onEquipItem={(itemId, slot) => {
                onBuildChange(equipInventoryItemOnBuild(build, itemId, slot, index));
              }}
              onUnequipItem={(itemId, slot) => {
                onBuildChange(unequipInventoryItemOnBuild(build, itemId, slot));
              }}
              onRemoveItem={(itemId) => {
                const stub = (build.inventory ?? []).find((i) => i.id === itemId);
                if (stub && !isEquipmentDerivedInventoryItem(stub)) {
                  removeEquipmentItem(itemId);
                }
              }}
            />
          ) : null}
          {consumableRows.length > 0 ? (
            <ul style={listStyle}>
              {consumableRows.map((row) => {
                const minBookQty =
                  row.category === "ritual" && row.consumableKey === "rituals"
                    ? Math.max(0, minRitualBookQuantityById[row.sourceId] ?? 0)
                    : 0;
                const inventorySummary = (
                  <>
                    <div style={{ minWidth: 0, flex: "1 1 auto" }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: "0.5rem",
                          alignItems: "baseline"
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>{row.name}</span>
                        <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", flexShrink: 0 }}>
                          {UNIFIED_INVENTORY_CATEGORY_LABELS[row.category]}
                        </span>
                      </div>
                      {row.detail ? (
                        <p style={{ margin: "0.15rem 0 0", fontSize: "0.76rem", color: "var(--text-muted)" }}>
                          {row.detail}
                        </p>
                      ) : null}
                    </div>
                    <div style={qtyRowStyle} onClick={(e) => e.stopPropagation()}>
                      <AdjustableNumberInput
                        ariaLabel={`Quantity of ${row.name}`}
                        value={row.quantity}
                        min={minBookQty}
                        max={9999}
                        compact
                        onChange={(qty) =>
                          onBuildChange(
                            setUnifiedConsumableQuantity(build, row, Math.max(minBookQty, qty))
                          )
                        }
                        style={{ flexShrink: 0 }}
                        inputStyle={{ width: adjustableNumberWidthCh(row.quantity, 9999) }}
                      />
                      {row.quantity > minBookQty ? (
                        <button
                          type="button"
                          style={actionButtonStyle}
                          onClick={() => onBuildChange(setUnifiedConsumableQuantity(build, row, 0))}
                        >
                          Remove
                        </button>
                      ) : minBookQty > 0 ? (
                        <span
                          style={{ fontSize: "0.72rem", color: "var(--text-muted)", maxWidth: "7rem" }}
                          title="Granted by your spellbook class feature; change picks on the Class tab to remove."
                        >
                          Spellbook ritual
                        </span>
                      ) : null}
                    </div>
                  </>
                );

                return (
                <li key={`${row.category}:${row.sourceId}`} style={rowStyle}>
                  {hasConsumableDescription(row) ? (
                    <CollapsibleDisclosure
                      summary={inventorySummary}
                      summaryStyle={inventoryDisclosureSummaryStyle}
                      bodyStyle={{ marginTop: "0.35rem" }}
                    >
                      <ConsumableItemDescription flavor={row.flavor} body={row.body} />
                    </CollapsibleDisclosure>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "0.5rem",
                        alignItems: "flex-start"
                      }}
                    >
                      {inventorySummary}
                    </div>
                  )}
                </li>
              );
              })}
            </ul>
          ) : null}
        </div>
      )}
    </div>
  );
}
