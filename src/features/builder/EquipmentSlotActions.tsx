import type { CSSProperties } from "react";
import { formatGoldCost } from "../../rules/itemGold";

const rowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "0.45rem",
  alignItems: "center"
};

const buttonStyle: CSSProperties = {
  padding: "0.35rem 0.65rem",
  borderRadius: "6px",
  border: "1px solid var(--panel-border)",
  backgroundColor: "var(--surface-0)",
  fontSize: "0.82rem",
  cursor: "pointer"
};

const priceStyle: CSSProperties = {
  margin: 0,
  fontSize: "0.78rem",
  color: "var(--text-muted)"
};

export interface EquipmentSlotActionsProps {
  price: number | undefined;
  gold: number;
  hasSelection: boolean;
  showAddToInventory: boolean;
  onAddToInventory?: () => void;
  onBuy?: () => void;
}

export function EquipmentSlotActions({
  price,
  gold,
  hasSelection,
  showAddToInventory,
  onAddToInventory,
  onBuy
}: EquipmentSlotActionsProps): JSX.Element | null {
  if (!onAddToInventory && !onBuy) return null;

  const disabled = !hasSelection;
  const canAfford = price != null ? gold >= price : false;
  const buyDisabled = disabled || price == null || !canAfford;

  return (
    <div style={rowStyle}>
      {showAddToInventory && onAddToInventory && (
        <button type="button" style={buttonStyle} disabled={disabled} onClick={onAddToInventory}>
          Add to inventory
        </button>
      )}
      {onBuy && (
        <button type="button" style={buttonStyle} disabled={buyDisabled} onClick={onBuy}>
          Buy{price != null ? ` (${formatGoldCost(price)})` : ""}
        </button>
      )}
      {price != null && (
        <p style={priceStyle}>
          {canAfford ? "Market price" : `Need ${formatGoldCost(price)} (have ${formatGoldCost(gold)})`}
        </p>
      )}
    </div>
  );
}
