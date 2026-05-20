import type { CSSProperties } from "react";

/** Shared neutral chrome for app shell and builder (single source for page background). */
export const NEUTRAL_PAGE_BG = "#dde0e6";

export const appLoadingShell: CSSProperties = {
  minHeight: "100vh",
  minWidth: "var(--app-min-width, 56rem)",
  boxSizing: "border-box",
  padding: "1.25rem",
  backgroundColor: "var(--app-chrome-bg, " + NEUTRAL_PAGE_BG + ")",
  color: "var(--app-chrome-fg)",
  fontFamily: "system-ui, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
  display: "flex",
  alignItems: "center",
  justifyContent: "center"
};

export const appLoadingCard: CSSProperties = {
  backgroundColor: "var(--surface-0)",
  border: "1px solid var(--panel-border)",
  borderRadius: "var(--ui-section-radius, 12px)",
  padding: "1.5rem 2rem",
  boxShadow: "var(--ui-panel-shadow, 0 1px 4px rgba(15, 23, 42, 0.06))",
  color: "var(--app-chrome-muted)",
  fontSize: "0.95rem"
};
