import type { CSSProperties, ReactNode } from "react";

export const liveSheetSummaryStyle: CSSProperties = {
  cursor: "pointer",
  fontSize: "0.82rem",
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "var(--text-secondary)"
};

export const liveSheetSectionBodyStyle: CSSProperties = {
  marginTop: "0.35rem",
  padding: "0.65rem 0.75rem",
  borderRadius: "8px",
  border: "1px solid var(--panel-border)",
  backgroundColor: "var(--surface-1)",
  display: "grid",
  gap: "0.35rem",
  minWidth: 0,
  maxWidth: "100%",
  boxSizing: "border-box",
  overflowX: "hidden"
};

export interface LiveSheetCollapsibleSectionProps {
  title: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  summaryA11y?: Record<string, unknown>;
  summaryStyle?: CSSProperties;
  bodyStyle?: CSSProperties;
}

export function LiveSheetCollapsibleSection({
  title,
  children,
  defaultOpen = true,
  summaryA11y,
  summaryStyle,
  bodyStyle
}: LiveSheetCollapsibleSectionProps): JSX.Element {
  return (
    <details open={defaultOpen}>
      <summary style={{ ...liveSheetSummaryStyle, ...summaryStyle }} {...summaryA11y}>
        {title}
      </summary>
      <div style={{ ...liveSheetSectionBodyStyle, ...bodyStyle }}>{children}</div>
    </details>
  );
}
