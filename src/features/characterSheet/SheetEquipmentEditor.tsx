import { useMemo, useState } from "react";
import type { CharacterBuild, RulesIndex } from "../../rules/models";
import type { EquipmentCombatBonuses } from "../../rules/equipment";
import {
  ADD_EQUIPMENT_OPTIONS,
  EquipmentTab,
  equipmentPickerSelectStyle,
  type EquipmentEditorSlotFilter
} from "../builder/EquipmentTab";
import { describeArmor, describeImplement, describeMagicItem, describeWeapon } from "../../rules/equipmentDescriptions";
import { findMagicItem } from "../../rules/magicItemEquipment";
import { magicItemFamilyDisplayName } from "../../rules/enchantmentFamilies";
import { EquipmentSelectionDetails } from "../builder/EquipmentSelectionDetails";
import { characterEquipmentSummaryRows } from "./sheetEquipment";
import type { CharacterSheetState, EquipmentSlot, InventoryItem } from "./model";
import { canEquipItem } from "./selectors";

function inventoryItemDescriptions(
  index: RulesIndex,
  item: InventoryItem | undefined
): {
  baseDescription?: string;
  enchantmentName?: string;
  enchantmentDescription?: ReturnType<typeof describeMagicItem>;
} {
  if (!item) return {};
  if (item.notes?.trim()) {
    return { baseDescription: item.notes.trim() };
  }
  const sourceId = item.sourceId;
  if (!sourceId) return {};
  const armor = index.armors.find((a) => a.id === sourceId);
  if (armor) return { baseDescription: describeArmor(armor) };
  const weapon = (index.weapons ?? []).find((w) => w.id === sourceId);
  if (weapon) return { baseDescription: describeWeapon(weapon) };
  const implement = (index.implements ?? []).find((i) => i.id === sourceId);
  if (implement) return { baseDescription: describeImplement(implement) };
  const magic = findMagicItem(index, sourceId);
  if (magic) {
    return {
      enchantmentName: magicItemFamilyDisplayName(magic.name),
      enchantmentDescription: describeMagicItem(magic)
    };
  }
  return {};
}

const INVENTORY_SINGLE_SLOT_OPTIONS: { slot: EquipmentSlot; label: string }[] = [
  { slot: "armor", label: "Armor" },
  { slot: "shield", label: "Shield" },
  { slot: "implement", label: "Implement" }
];

const INVENTORY_WEAPON_HAND_OPTIONS: { slot: "mainHand" | "offHand"; label: string }[] = [
  { slot: "mainHand", label: "Main hand" },
  { slot: "offHand", label: "Off hand" }
];

function inventoryItemsForWeaponHand(sheet: CharacterSheetState, slot: "mainHand" | "offHand"): InventoryItem[] {
  return sheet.inventory.filter((item) => canEquipItem(item, slot));
}

export interface SheetEquipmentEditorProps {
  index: RulesIndex;
  build: CharacterBuild;
  onBuildChange: (next: CharacterBuild) => void;
  magicCombat: EquipmentCombatBonuses;
  sheet: CharacterSheetState;
  onEquipInventory: (slot: EquipmentSlot, itemId: string) => void;
  onUnequipInventory: (slot: EquipmentSlot) => void;
}

export function SheetEquipmentEditor({
  index,
  build,
  onBuildChange,
  magicCombat,
  sheet,
  onEquipInventory,
  onUnequipInventory
}: SheetEquipmentEditorProps): JSX.Element {
  const [activeSlot, setActiveSlot] = useState<EquipmentEditorSlotFilter | "">("");

  const equippedSummary = useMemo(
    () => characterEquipmentSummaryRows(sheet, index),
    [sheet, index]
  );

  return (
    <div style={{ display: "grid", gap: "0.65rem" }}>
      {equippedSummary.length > 0 && (
        <div
          style={{
            padding: "0.5rem 0.6rem",
            borderRadius: "6px",
            border: "1px solid var(--panel-border)",
            backgroundColor: "var(--surface-0)",
            fontSize: "0.85rem"
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: "0.35rem", color: "var(--text-secondary)" }}>Equipped</div>
          <div style={{ display: "grid", gap: "0.2rem" }}>
            {equippedSummary.map((row) => (
              <div key={row.slotLabel} style={{ display: "grid", gap: "0.1rem" }}>
                <span style={{ fontWeight: 600, fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                  {row.slotLabel}
                </span>
                <span>{row.detail}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <label style={{ fontSize: "0.88rem", fontWeight: 600 }}>
        Add equipment…
        <select
          value={activeSlot}
          onChange={(e) => setActiveSlot((e.target.value || "") as EquipmentEditorSlotFilter | "")}
          style={equipmentPickerSelectStyle}
          aria-label="Choose equipment slot to edit"
        >
          <option value="">Add equipment…</option>
          {ADD_EQUIPMENT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      {activeSlot && (
        <EquipmentTab
          index={index}
          build={build}
          hideTitle
          magicCombat={magicCombat}
          activeSlotOnly={activeSlot}
          onBuildChange={onBuildChange}
        />
      )}

      <div
        style={{
          paddingTop: "0.5rem",
          borderTop: "1px solid var(--panel-border)",
          display: "grid",
          gap: "0.55rem"
        }}
      >
        <div>
          <div style={{ fontWeight: 600, marginBottom: "0.25rem", fontSize: "0.88rem" }}>Inventory slots</div>
          <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-muted)", lineHeight: 1.45 }}>
            Equip custom items from inventory. Main and off hand share the weapon item pool.
          </p>
        </div>
        {INVENTORY_SINGLE_SLOT_OPTIONS.map(({ slot, label }) => {
          const equippedId = sheet.equipment[slot];
          const equippedItem = equippedId ? sheet.inventory.find((item) => item.id === equippedId) : undefined;
          const { baseDescription, enchantmentName, enchantmentDescription } = inventoryItemDescriptions(
            index,
            equippedItem
          );
          return (
            <div key={slot} style={{ display: "grid", gap: "0.35rem" }}>
              <label style={{ display: "grid", gap: "0.2rem", fontSize: "0.88rem" }}>
                <span style={{ fontWeight: 600 }}>{label}</span>
                <select
                  value={equippedId || ""}
                  onChange={(e) =>
                    e.target.value ? onEquipInventory(slot, e.target.value) : onUnequipInventory(slot)
                  }
                  style={{ ...equipmentPickerSelectStyle, maxWidth: "none" }}
                >
                  <option value="">Unequipped</option>
                  {sheet.inventory
                    .filter((item) => canEquipItem(item, slot))
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                </select>
              </label>
              <EquipmentSelectionDetails
                baseName={equippedItem?.name}
                baseDescription={baseDescription}
                enchantmentName={enchantmentName}
                enchantmentDescription={enchantmentDescription}
              />
            </div>
          );
        })}
        <div style={{ display: "grid", gap: "0.35rem" }}>
          <span style={{ fontWeight: 600, fontSize: "0.88rem" }}>Weapon</span>
          {INVENTORY_WEAPON_HAND_OPTIONS.map(({ slot, label }) => {
            const equippedId = sheet.equipment[slot];
            const equippedItem = equippedId ? sheet.inventory.find((item) => item.id === equippedId) : undefined;
            const { baseDescription, enchantmentName, enchantmentDescription } = inventoryItemDescriptions(
              index,
              equippedItem
            );
            return (
              <div key={slot} style={{ display: "grid", gap: "0.35rem" }}>
                <label style={{ display: "grid", gap: "0.2rem", fontSize: "0.88rem" }}>
                  <span style={{ fontWeight: 600, color: "var(--text-secondary)" }}>{label}</span>
                  <select
                    value={equippedId || ""}
                    onChange={(e) =>
                      e.target.value ? onEquipInventory(slot, e.target.value) : onUnequipInventory(slot)
                    }
                    style={{ ...equipmentPickerSelectStyle, maxWidth: "none" }}
                  >
                    <option value="">Unequipped</option>
                    {inventoryItemsForWeaponHand(sheet, slot).map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <EquipmentSelectionDetails
                  baseName={equippedItem?.name}
                  baseDescription={baseDescription}
                  enchantmentName={enchantmentName}
                  enchantmentDescription={enchantmentDescription}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
