import type { CSSProperties } from "react";

export interface CharacterProficienciesBlockProps {
  weaponLine: string;
  armorLine: string;
  fontSize?: string;
  style?: CSSProperties;
}

export function CharacterProficienciesBlock({
  weaponLine,
  armorLine,
  fontSize = "0.88rem",
  style
}: CharacterProficienciesBlockProps): JSX.Element | null {
  if (!weaponLine && !armorLine) return null;

  const rowStyle: CSSProperties = { margin: 0, fontSize, lineHeight: 1.45 };

  return (
    <div style={{ display: "grid", gap: "0.35rem", ...style }}>
      {weaponLine ? (
        <p style={rowStyle}>
          <strong>Weapons:</strong> {weaponLine}
        </p>
      ) : null}
      {armorLine ? (
        <p style={rowStyle}>
          <strong>Armor:</strong> {armorLine}
        </p>
      ) : null}
    </div>
  );
}
