import type { CSSProperties } from "react";
import type { EquippedSlotKey } from "../../rules/models";
import type { InventoryItem } from "./model";
import { type CharacterBuildItemRow } from "./sheetEquipment";
import { isEquipmentDerivedInventoryItem } from "./sheetEquipment";

const KIND_LABELS: Record<string, string> = {
  armor: "Armor",
  weapon: "Weapon",
  implement: "Implement",
  gear: "Gear"
};

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

const actionButtonDisabledStyle: CSSProperties = {
  ...actionButtonStyle,
  opacity: 0.55,
  cursor: "not-allowed"
};

const actionGroupStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.3rem",
  alignItems: "flex-end"
};

export interface CharacterInventoryListProps {
  items: CharacterBuildItemRow[];
  emptyMessage?: string;
  onRemoveItem?: (itemId: string) => void;
  onEquipItem?: (itemId: string, slot: EquippedSlotKey) => void;
  onUnequipItem?: (itemId: string, slot: EquippedSlotKey) => void;
}

export function CharacterInventoryList({
  items,
  emptyMessage = "No items yet. Add equipment on the Equipment tab.",
  onRemoveItem,
  onEquipItem,
  onUnequipItem
}: CharacterInventoryListProps): JSX.Element {
  if (items.length === 0) {
    return (
      <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--text-muted)", lineHeight: 1.45 }}>
        {emptyMessage}
      </p>
    );
  }

  return (
    <ul style={listStyle}>
      {items.map((item) => {
        const stubItem = { id: item.id } as InventoryItem;
        const canRemove = Boolean(onRemoveItem) && !isEquipmentDerivedInventoryItem(stubItem);
        const equipOptions = onEquipItem ? item.equipOptions : [];
        const unequipOptions = onUnequipItem ? item.unequipOptions : [];
        const showActions =
          canRemove || equipOptions.length > 0 || unequipOptions.length > 0;
        return (
          <li key={item.id} style={rowStyle}>
            <InventoryRow
              item={item}
              showActions={showActions}
              canRemove={canRemove}
              equipOptions={equipOptions}
              unequipOptions={unequipOptions}
              onRemoveItem={onRemoveItem}
              onEquipItem={onEquipItem}
              onUnequipItem={onUnequipItem}
            />
          </li>
        );
      })}
    </ul>
  );
}

function InventoryRow({
  item,
  showActions,
  canRemove,
  equipOptions,
  unequipOptions,
  onRemoveItem,
  onEquipItem,
  onUnequipItem
}: {
  item: CharacterBuildItemRow;
  showActions: boolean;
  canRemove: boolean;
  equipOptions: CharacterBuildItemRow["equipOptions"];
  unequipOptions: CharacterBuildItemRow["unequipOptions"];
  onRemoveItem?: (itemId: string) => void;
  onEquipItem?: (itemId: string, slot: EquippedSlotKey) => void;
  onUnequipItem?: (itemId: string, slot: EquippedSlotKey) => void;
}): JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: "0.5rem",
        alignItems: showActions ? "flex-start" : "baseline"
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", alignItems: "baseline" }}>
          <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
            {item.name}
            {item.quantity > 1 ? ` ×${item.quantity}` : ""}
          </span>
          <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", flexShrink: 0 }}>
            {KIND_LABELS[item.kind] ?? item.kind}
          </span>
        </div>
        {item.equippedSlot && (
          <p style={{ margin: "0.2rem 0 0 0", fontSize: "0.76rem", color: "var(--text-secondary)" }}>
            Equipped: {item.equippedSlot}
          </p>
        )}
        {item.notes && (
          <p style={{ margin: "0.15rem 0 0 0", fontSize: "0.76rem", color: "var(--text-muted)" }}>{item.notes}</p>
        )}
      </div>
      {showActions && (
        <div style={actionGroupStyle} role="group" aria-label={`Actions for ${item.name}`}>
          {equipOptions.map((option) => (
            <button
              key={`equip-${option.slot}`}
              type="button"
              style={option.disabled ? actionButtonDisabledStyle : actionButtonStyle}
              disabled={option.disabled}
              title={option.hint}
              onClick={() => !option.disabled && onEquipItem!(item.id, option.slot)}
            >
              Equip {option.label}
            </button>
          ))}
          {unequipOptions.map((option) => (
            <button
              key={`unequip-${option.slot}`}
              type="button"
              style={actionButtonStyle}
              onClick={() => onUnequipItem!(item.id, option.slot)}
            >
              Unequip {option.label}
            </button>
          ))}
          {canRemove && onRemoveItem && (
            <button type="button" style={actionButtonStyle} onClick={() => onRemoveItem(item.id)}>
              Remove
            </button>
          )}
        </div>
      )}
    </div>
  );
}
