import type { CSSProperties } from "react";

/** Uppercase section summary for builder lore / rules blocks. */
export const disclosureSummaryStyle: CSSProperties = {
  cursor: "pointer",
  fontSize: "0.82rem",
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "var(--text-secondary)"
};

/** JSON inspector and similar debug panels. */
export const jsonDisclosureSummaryStyle: CSSProperties = {
  cursor: "pointer",
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "var(--text-primary)"
};

/** Inset subsection inside a bordered panel (no extra border). */
export const blockSubsectionStyle: CSSProperties = {
  display: "grid",
  gap: "0.65rem",
  padding: "0.65rem 0.85rem",
  backgroundColor: "var(--surface-2)",
  borderRadius: "var(--ui-panel-radius, 8px)"
};
