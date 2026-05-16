import type { CSSProperties } from "react";

const breakdownLineGridStyle: CSSProperties = {
  gridColumn: "1 / -1",
  fontSize: "0.68rem",
  color: "var(--text-muted)",
  lineHeight: 1.25,
  padding: "0 0.35rem 0.16rem",
  fontVariantNumeric: "tabular-nums"
};

const breakdownLineInlineStyle: CSSProperties = {
  display: "block",
  fontSize: "0.68rem",
  color: "var(--text-muted)",
  lineHeight: 1.25,
  padding: "0.1rem 0 0 0.85rem",
  fontVariantNumeric: "tabular-nums"
};

export function StatScoreBreakdownLine({ text, variant = "grid" }: { text: string; variant?: "grid" | "inline" }) {
  if (!text) return null;
  return <span style={variant === "inline" ? breakdownLineInlineStyle : breakdownLineGridStyle}>{text}</span>;
}
