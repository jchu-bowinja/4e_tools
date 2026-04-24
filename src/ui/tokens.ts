import type { CSSProperties } from "react";

/** Shared neutral chrome for app shell and builder (single source for page background). */
export const NEUTRAL_PAGE_BG = "#dde0e6";

export const appLoadingShell: CSSProperties = {
  minHeight: "100vh",
  boxSizing: "border-box",
  padding: "1.25rem",
  backgroundColor: NEUTRAL_PAGE_BG,
  fontFamily: "system-ui, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
  display: "flex",
  alignItems: "center",
  justifyContent: "center"
};

export const appLoadingCard: CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid #a8b4c7",
  borderRadius: "12px",
  padding: "1.5rem 2rem",
  boxShadow: "0 1px 4px rgba(15, 23, 42, 0.06)",
  color: "#1f2937",
  fontSize: "0.95rem"
};
