import type { CSSProperties } from "react";

export const GLOSSARY_TOOLTIP_OPEN_DELAY_MS = 1200;
export const GLOSSARY_TOOLTIP_CLOSE_DELAY_MS = 400;

export const STANDARD_GLOSSARY_TOOLTIP_LAYOUT = {
  panelWidth: 340,
  maxHeightVh: 50
} as const;

export const STANDARD_GLOSSARY_TOOLTIP_PANEL_STYLE: CSSProperties = {
  width: "340px",
  maxHeight: "50vh",
  overflow: "auto",
  border: "1px solid var(--panel-border)",
  backgroundColor: "var(--surface-0)",
  borderRadius: "0.35rem",
  padding: "0.45rem 0.5rem",
  color: "var(--text-primary)",
  textTransform: "none",
  letterSpacing: "normal",
  fontWeight: 500,
  fontSize: "0.76rem",
  lineHeight: 1.35,
  zIndex: 1000,
  boxShadow: "0 8px 24px rgba(45, 34, 16, 0.2)",
  display: "grid",
  gap: "0.2rem"
};
