import { useMemo } from "react";
import type { CharacterBuild, RulesIndex } from "../../rules/models";
import { CharacterUnifiedInventoryPanel } from "../characterSheet/CharacterUnifiedInventoryPanel";
import { unifiedInventoryRows } from "../characterSheet/unifiedInventory";
import { LiveSheetCollapsibleSection } from "./LiveSheetCollapsibleSection";

export interface BuilderSidebarItemsPanelProps {
  index: RulesIndex;
  build: CharacterBuild;
  onBuildChange: (build: CharacterBuild) => void;
}

export function BuilderSidebarItemsPanel({
  index,
  build,
  onBuildChange
}: BuilderSidebarItemsPanelProps): JSX.Element {
  const count = useMemo(() => unifiedInventoryRows(build, index).length, [build, index]);

  return (
    <LiveSheetCollapsibleSection title={count > 0 ? `Inventory (${count})` : "Inventory"}>
      <CharacterUnifiedInventoryPanel index={index} build={build} hideDescription onBuildChange={onBuildChange} />
    </LiveSheetCollapsibleSection>
  );
}
