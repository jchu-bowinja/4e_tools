import { useMemo } from "react";
import type { CharacterBuild, RulesIndex } from "../../rules/models";
import { CharacterInventoryList } from "../characterSheet/CharacterInventoryList";
import { characterBuildInventoryItems } from "../characterSheet/sheetEquipment";
import { LiveSheetCollapsibleSection } from "./LiveSheetCollapsibleSection";

export interface BuilderSidebarItemsPanelProps {
  index: RulesIndex;
  build: CharacterBuild;
}

export function BuilderSidebarItemsPanel({ index, build }: BuilderSidebarItemsPanelProps): JSX.Element {
  const items = useMemo(() => characterBuildInventoryItems(build, index), [build, index]);

  return (
    <LiveSheetCollapsibleSection title={items.length > 0 ? `Items (${items.length})` : "Items"}>
      <CharacterInventoryList items={items} />
    </LiveSheetCollapsibleSection>
  );
}
