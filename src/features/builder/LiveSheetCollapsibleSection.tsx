import type { CSSProperties, ReactNode } from "react";

export const liveSheetSummaryStyle: CSSProperties = {
  cursor: "pointer",
  fontSize: "0.82rem",
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "var(--text-secondary)"
};

/** Body layout inside a sidebar panel; border/chrome comes from `ui.sidebarPanel`. */
export const liveSheetSectionBodyStyle: CSSProperties = {
  marginTop: "0.35rem",
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
    <details className="live-sheet-collapsible" open={defaultOpen}>
      <summary style={{ ...liveSheetSummaryStyle, ...summaryStyle }} {...summaryA11y}>
        {title}
      </summary>
      <div className="live-sheet-collapsible__body" style={{ ...liveSheetSectionBodyStyle, ...bodyStyle }}>
        {children}
      </div>
    </details>
  );
}
