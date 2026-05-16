import type { CSSProperties } from "react";

export const scoreComponentCellStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: "1.35rem",
  padding: "0.08rem 0.15rem",
  fontSize: "0.72rem",
  fontWeight: 600,
  fontVariantNumeric: "tabular-nums",
  color: "var(--text-primary)",
  lineHeight: 1.15
};

export const scoreBonusCellStyle: CSSProperties = {
  ...scoreComponentCellStyle,
  fontWeight: 700,
  minWidth: "2rem",
  padding: "0.08rem 0.22rem",
  flexShrink: 0,
  color: "var(--status-success)"
};

export function ScoreModCell({ value, emphasize }: { value: string; emphasize?: boolean }) {
  return <span style={emphasize ? scoreBonusCellStyle : scoreComponentCellStyle}>{value}</span>;
}

export function formatScoreTotalDisplay(n: number, signed = false): string {
  if (!signed) return String(n);
  return n >= 0 ? `+${n}` : String(n);
}

export function formatScoreComponentDisplay(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return String(value);
}
