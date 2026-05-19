import type { CSSProperties, FocusEvent, MouseEvent, ReactNode } from "react";

/** ▶ indicator; rotates when open via `.template-json-collapsible[open]` in styles.css */
export function CollapsibleDisclosureArrow(): JSX.Element {
  return (
    <span className="template-json-collapsible-arrow" aria-hidden>
      ▶
    </span>
  );
}

export type CollapsibleDisclosureProps = {
  summary: ReactNode;
  children: ReactNode;
  className?: string;
  summaryClassName?: string;
  open?: boolean;
  style?: CSSProperties;
  summaryStyle?: CSSProperties;
  bodyStyle?: CSSProperties;
  summaryTabIndex?: number;
  /** Extra attributes for the summary element (e.g. glossary hoverA11y handlers). */
  summaryExtraProps?: Record<string, unknown>;
  onSummaryMouseEnter?: (event: MouseEvent<HTMLElement>) => void;
  onSummaryMouseLeave?: () => void;
  onSummaryFocus?: (event: FocusEvent<HTMLElement>) => void;
  onSummaryBlur?: () => void;
};

export function CollapsibleDisclosure({
  summary,
  children,
  className = "template-json-collapsible",
  summaryClassName = "template-json-collapsible-summary",
  open,
  style,
  summaryStyle,
  bodyStyle,
  summaryTabIndex,
  summaryExtraProps,
  onSummaryMouseEnter,
  onSummaryMouseLeave,
  onSummaryFocus,
  onSummaryBlur
}: CollapsibleDisclosureProps): JSX.Element {
  const body = bodyStyle ? <div style={bodyStyle}>{children}</div> : children;

  return (
    <details className={className} {...(open !== undefined ? { open } : {})} style={style}>
      <summary
        className={summaryClassName}
        style={summaryStyle}
        tabIndex={summaryTabIndex}
        onMouseEnter={onSummaryMouseEnter}
        onMouseLeave={onSummaryMouseLeave}
        onFocus={onSummaryFocus}
        onBlur={onSummaryBlur}
        {...summaryExtraProps}
      >
        <CollapsibleDisclosureArrow />
        {summary}
      </summary>
      {body}
    </details>
  );
}
