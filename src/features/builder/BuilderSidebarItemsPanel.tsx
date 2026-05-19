import { useMemo } from "react";
import type { CharacterBuild, EquippedSlotKey, RulesIndex } from "../../rules/models";
import { CharacterInventoryList } from "../characterSheet/CharacterInventoryList";
import { characterBuildInventoryItems } from "../characterSheet/sheetEquipment";
import { LiveSheetCollapsibleSection } from "./LiveSheetCollapsibleSection";

export interface BuilderSidebarItemsPanelProps {
  index: RulesIndex;
  build: CharacterBuild;
  onEquipItem?: (itemId: string, slot: EquippedSlotKey) => void;
  onUnequipItem?: (itemId: string, slot: EquippedSlotKey) => void;
}

export function BuilderSidebarItemsPanel({
  index,
  build,
  onEquipItem,
  onUnequipItem
}: BuilderSidebarItemsPanelProps): JSX.Element {
  const items = useMemo(() => characterBuildInventoryItems(build, index), [build, index]);

  return (
    <LiveSheetCollapsibleSection title={items.length > 0 ? `Items (${items.length})` : "Items"}>
      <CharacterInventoryList items={items} onEquipItem={onEquipItem} onUnequipItem={onUnequipItem} />
    </LiveSheetCollapsibleSection>
  );
}
