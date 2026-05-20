import { useEffect, useRef, type CSSProperties, type FocusEvent } from "react";
import { formatFeatFacetMultiSelectSummary } from "./featPowerFilters";

export type FacetOption<T extends string> = { value: T; label: string };

export interface FeatFacetMultiSelectProps<T extends string> {
  label: string;
  options: readonly FacetOption<T>[];
  selected: T[];
  onChange: (selected: T[]) => void;
  allLabel: string;
  summaryPrefix: string;
  minWidth?: string;
  /** When set, only one control in the group stays open at a time. */
  detailsName?: string;
}

const CLOSE_DELAY_MS = 200;

function containerStyle(minWidth?: string): CSSProperties {
  const basis = minWidth ?? "8.5rem";
  return {
    fontSize: "0.82rem",
    color: "var(--text-secondary)",
    flex: `1 1 ${basis}`,
    minWidth: basis,
    flexShrink: 0
  };
}

const triggerStyle: CSSProperties = {
  display: "block",
  width: "100%",
  padding: "0.35rem 0.5rem",
  border: "1px solid var(--panel-border)",
  borderRadius: "6px",
  background: "var(--surface-0)",
  color: "var(--text-primary)",
  fontSize: "0.82rem",
  textAlign: "left",
  cursor: "pointer",
  listStyle: "none",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  boxSizing: "border-box"
};

const dropdownPanelStyle: CSSProperties = {
  position: "absolute",
  zIndex: 20,
  top: "calc(100% + 0.15rem)",
  left: 0,
  minWidth: "100%",
  maxHeight: "12rem",
  overflow: "auto",
  padding: "0.4rem 0.5rem",
  border: "1px solid var(--panel-border)",
  borderRadius: "6px",
  background: "var(--surface-0)",
  boxShadow: "0 4px 12px color-mix(in srgb, var(--text-primary) 12%, transparent)"
};

export function FeatFacetMultiSelect<T extends string>({
  label,
  options,
  selected,
  onChange,
  allLabel,
  summaryPrefix,
  minWidth,
  detailsName
}: FeatFacetMultiSelectProps<T>): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedLabels = options.filter((o) => selected.includes(o.value)).map((o) => o.label);
  const summary = formatFeatFacetMultiSelectSummary(summaryPrefix, selectedLabels, allLabel);

  const clearCloseTimer = () => {
    if (closeTimerRef.current !== null) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const scheduleClose = () => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null;
      if (detailsRef.current?.open) {
        detailsRef.current.open = false;
      }
    }, CLOSE_DELAY_MS);
  };

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget;
    if (next instanceof Node && containerRef.current?.contains(next)) {
      return;
    }
    if (!detailsRef.current?.open) {
      return;
    }
    scheduleClose();
  };

  const handleFocus = () => {
    clearCloseTimer();
  };

  useEffect(() => () => clearCloseTimer(), []);

  const toggle = (value: T) => {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  };

  return (
    <div style={containerStyle(minWidth)}>
      {label}
      <div
        ref={containerRef}
        onBlur={handleBlur}
        onFocus={handleFocus}
        style={{ display: "block", width: "100%", marginTop: "0.2rem" }}
      >
        <details
          ref={detailsRef}
          className="feat-facet-multiselect"
          name={detailsName}
          style={{ display: "block", width: "100%" }}
        >
          <summary style={triggerStyle} aria-label={`${label}: ${summary}`}>
            {summary}
          </summary>
          <div style={dropdownPanelStyle} role="group" aria-label={label}>
            {options.map((opt) => {
              const checked = selected.includes(opt.value);
              return (
                <label
                  key={opt.value}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.35rem",
                    padding: "0.2rem 0",
                    fontSize: "0.82rem",
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                    userSelect: "none",
                    whiteSpace: "nowrap"
                  }}
                >
                  <input type="checkbox" checked={checked} onChange={() => toggle(opt.value)} />
                  <span>{opt.label}</span>
                </label>
              );
            })}
          </div>
        </details>
      </div>
    </div>
  );
}
