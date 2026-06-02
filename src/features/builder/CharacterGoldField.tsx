import type { CSSProperties } from "react";
import { AdjustableNumberInput } from "../../ui/AdjustableNumberInput";

const goldRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "0.5rem"
};

export interface CharacterGoldFieldProps {
  gold: number;
  onChange: (gold: number) => void;
  style?: CSSProperties;
}

/** Shared gold (gp) editor for equipment and consumable purchase tabs. */
export function CharacterGoldField({ gold, onChange, style }: CharacterGoldFieldProps): JSX.Element {
  return (
    <label style={{ ...goldRowStyle, ...style }}>
      <span style={{ fontSize: "0.88rem", fontWeight: 600 }}>Gold</span>
      <AdjustableNumberInput
        compact
        min={0}
        max={99_999_999}
        value={gold}
        onChange={(v) => onChange(Math.max(0, Math.trunc(v)))}
        ariaLabel="Gold pieces"
      />
      <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>gp</span>
    </label>
  );
}
