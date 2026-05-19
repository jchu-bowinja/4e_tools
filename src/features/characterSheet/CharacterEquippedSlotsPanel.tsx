import { useMemo } from "react";
import type { CSSProperties } from "react";
import type { CharacterEquipment, EquippedSlotKey, InventoryItem, RulesIndex } from "../../rules/models";
import { normalizeCharacterEquipment } from "../../rules/equipment";
import { normalizeEquippedSlots } from "../../rules/weaponWielding";
import {
  EQUIPPED_SLOT_LABELS,
  EQUIPPED_SLOT_ORDER,
  equipSlotDropdownChoices,
  equipSlotShouldDisplay,
  equippedSlotWieldHint,
  selectedEquipSlotItemId,
  type EquipSlotDropdownChoice
} from "./sheetEquipment";

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
  gap: "0.55rem 0.75rem",
  alignItems: "start"
};

const rowStyle: CSSProperties = {
  display: "grid",
  gap: "0.2rem",
  minWidth: 0
};

const labelStyle: CSSProperties = {
  fontSize: "0.76rem",
  fontWeight: 600,
  color: "var(--text-secondary)"
};

const selectStyle: CSSProperties = {
  width: "100%",
  minWidth: 0,
  padding: "0.35rem 0.45rem",
  borderRadius: "6px",
  border: "1px solid var(--panel-border)",
  backgroundColor: "var(--surface-0)",
  color: "var(--text-primary)",
  fontSize: "0.82rem"
};

const hintStyle: CSSProperties = {
  margin: 0,
  fontSize: "0.72rem",
  color: "var(--text-muted)",
  lineHeight: 1.35
};

const emptyStyle: CSSProperties = {
  margin: 0,
  fontSize: "0.82rem",
  color: "var(--text-muted)",
  lineHeight: 1.45
};

export interface CharacterEquippedSlotsPanelProps {
  inventory: InventoryItem[];
  equippedSlots: Partial<Record<EquippedSlotKey, string>>;
  index: RulesIndex;
  characterEquipment?: CharacterEquipment;
  onEquipItem?: (itemId: string, slot: EquippedSlotKey) => void;
  onUnequipItem?: (itemId: string, slot: EquippedSlotKey) => void;
}

export function CharacterEquippedSlotsPanel({
  inventory,
  equippedSlots,
  index,
  characterEquipment,
  onEquipItem,
  onUnequipItem
}: CharacterEquippedSlotsPanelProps): JSX.Element {
  const normalizedEquipment = useMemo(
    () => (characterEquipment ? normalizeCharacterEquipment(characterEquipment) : undefined),
    [characterEquipment]
  );

  const visibleSlots = useMemo(
    () =>
      EQUIPPED_SLOT_ORDER.filter((slot) =>
        equipSlotShouldDisplay(inventory, equippedSlots, slot, index, normalizedEquipment)
      ),
    [inventory, equippedSlots, index, normalizedEquipment]
  );

  const choicesBySlot = useMemo(() => {
    const map = new Map<EquippedSlotKey, EquipSlotDropdownChoice[]>();
    for (const slot of visibleSlots) {
      map.set(slot, equipSlotDropdownChoices(inventory, equippedSlots, slot, index));
    }
    return map;
  }, [inventory, equippedSlots, index, visibleSlots]);

  const canChange = Boolean(onEquipItem || onUnequipItem);
  const hasAnyEquipped = Object.values(equippedSlots).some(Boolean);

  if (!canChange && !hasAnyEquipped && visibleSlots.length === 0) {
    return (
      <p style={emptyStyle}>
        No gear equipped. Configure items on the Equipment tab, then buy or add them to inventory.
      </p>
    );
  }

  return (
    <div style={gridStyle}>
      {visibleSlots.map((slot) => (
        <EquippedSlotRow
          key={slot}
          slot={slot}
          inventory={inventory}
          equippedSlots={equippedSlots}
          index={index}
          choices={choicesBySlot.get(slot) ?? []}
          wieldHint={equippedSlotWieldHint(inventory, equippedSlots, slot, index, normalizedEquipment)}
          canChange={canChange}
          onChange={(nextItemId) => {
            const currentId = selectedEquipSlotItemId(slot, inventory, equippedSlots);
            if (currentId === nextItemId) return;

            if (!nextItemId) {
              const equippedId = normalizeEquippedSlots(equippedSlots)[slot];
              if (equippedId && onUnequipItem) {
                onUnequipItem(equippedId, slot);
              }
              return;
            }

            onEquipItem?.(nextItemId, slot);
          }}
        />
      ))}
    </div>
  );
}

function EquippedSlotRow({
  slot,
  inventory,
  equippedSlots,
  index,
  choices,
  wieldHint,
  canChange,
  onChange
}: {
  slot: EquippedSlotKey;
  inventory: InventoryItem[];
  equippedSlots: Partial<Record<EquippedSlotKey, string>>;
  index: RulesIndex;
  choices: EquipSlotDropdownChoice[];
  wieldHint?: string;
  canChange: boolean;
  onChange: (itemId: string) => void;
}): JSX.Element {
  const selectedId = selectedEquipSlotItemId(slot, inventory, equippedSlots);
  const selectedItem = selectedId ? inventory.find((entry) => entry.id === selectedId) : undefined;
  const selectedInChoices = selectedId ? choices.some((choice) => choice.itemId === selectedId) : true;

  return (
    <div style={rowStyle}>
      <label style={labelStyle} htmlFor={`equip-slot-${slot}`}>
        {EQUIPPED_SLOT_LABELS[slot]}
      </label>
      {canChange ? (
        <select
          id={`equip-slot-${slot}`}
          style={selectStyle}
          value={selectedId}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">— None —</option>
          {selectedId && selectedItem && !selectedInChoices && (
            <option value={selectedId}>{selectedItem.name}</option>
          )}
          {choices.map((choice) => (
            <option key={choice.itemId} value={choice.itemId} disabled={choice.disabled} title={choice.hint}>
              {choice.label}
              {choice.disabled ? " (unavailable)" : ""}
            </option>
          ))}
        </select>
      ) : (
        <div style={{ fontSize: "0.82rem", color: "var(--text-primary)" }}>{selectedItem?.name ?? "—"}</div>
      )}
      {wieldHint && <p style={hintStyle}>{wieldHint}</p>}
    </div>
  );
}
