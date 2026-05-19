import type { CSSProperties, ReactNode } from "react";
import { CollapsibleDisclosure } from "../../ui/CollapsibleDisclosure";

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
    <CollapsibleDisclosure
      className="template-json-collapsible live-sheet-collapsible"
      open={defaultOpen}
      summary={title}
      summaryStyle={{ ...liveSheetSummaryStyle, ...summaryStyle }}
      summaryExtraProps={summaryA11y}
      bodyStyle={{ ...liveSheetSectionBodyStyle, ...bodyStyle }}
    >
      {children}
    </CollapsibleDisclosure>
  );
}
