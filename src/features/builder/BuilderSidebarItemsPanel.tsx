import { useMemo } from "react";
import type { CharacterBuild, RulesIndex } from "../../rules/models";
import { characterBuildInventoryItems } from "../characterSheet/sheetEquipment";
import { LiveSheetCollapsibleSection } from "./LiveSheetCollapsibleSection";

const KIND_LABELS: Record<string, string> = {
  armor: "Armor",
  weapon: "Weapon",
  implement: "Implement",
  gear: "Gear"
};

export interface BuilderSidebarItemsPanelProps {
  index: RulesIndex;
  build: CharacterBuild;
}

export function BuilderSidebarItemsPanel({ index, build }: BuilderSidebarItemsPanelProps): JSX.Element {
  const items = useMemo(() => characterBuildInventoryItems(build, index), [build, index]);

  return (
    <LiveSheetCollapsibleSection title={items.length > 0 ? `Items (${items.length})` : "Items"}>
      {items.length === 0 ? (
        <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--text-muted)", lineHeight: 1.45 }}>
          No items yet. Add equipment on the Equipment tab.
        </p>
      ) : (
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: "0.45rem" }}>
          {items.map((item) => (
            <li
              key={item.id}
              style={{
                padding: "0.45rem 0.5rem",
                borderRadius: "6px",
                border: "1px solid var(--panel-border)",
                backgroundColor: "var(--surface-0)",
                fontSize: "0.84rem",
                lineHeight: 1.4
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", alignItems: "baseline" }}>
                <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{item.name}</span>
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
            </li>
          ))}
        </ul>
      )}
    </LiveSheetCollapsibleSection>
  );
}
