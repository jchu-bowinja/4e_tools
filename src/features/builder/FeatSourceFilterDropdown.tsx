import { useEffect, useRef, type CSSProperties, type FocusEvent } from "react";
import {
  EMPTY_FEAT_SOURCE_FILTER,
  formatFeatSourceFilterSummary,
  type FeatSourceFilter,
  type FeatSourceFilterMode
} from "./featPowerFilters";

export interface FeatSourceFilterDropdownProps {
  sources: string[];
  value: FeatSourceFilter;
  onChange: (value: FeatSourceFilter) => void;
  minWidth?: string;
  /** When set, only one control in the group stays open at a time. */
  detailsName?: string;
}

const CLOSE_DELAY_MS = 200;

const MODE_OPTIONS: readonly { value: FeatSourceFilterMode; label: string }[] = [
  { value: "all", label: "All" },
  { value: "include", label: "Include" },
  { value: "exclude", label: "Exclude" }
];

function containerStyle(minWidth?: string): CSSProperties {
  const basis = minWidth ?? "10rem";
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
  maxHeight: "14rem",
  overflow: "auto",
  padding: "0.4rem 0.5rem",
  border: "1px solid var(--panel-border)",
  borderRadius: "6px",
  background: "var(--surface-0)",
  boxShadow: "0 4px 12px color-mix(in srgb, var(--text-primary) 12%, transparent)"
};

const checkboxLabelStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: "0.35rem",
  padding: "0.2rem 0",
  fontSize: "0.82rem",
  color: "var(--text-secondary)",
  cursor: "pointer",
  userSelect: "none"
};

export function FeatSourceFilterDropdown({
  sources,
  value,
  onChange,
  minWidth,
  detailsName
}: FeatSourceFilterDropdownProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const summary = formatFeatSourceFilterSummary(value);

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

  const setMode = (mode: FeatSourceFilterMode) => {
    if (mode === "all") {
      onChange(EMPTY_FEAT_SOURCE_FILTER);
      return;
    }
    onChange({
      mode,
      sources: value.mode === "all" ? [] : value.sources
    });
  };

  const toggleSource = (src: string) => {
    const checked = value.sources.includes(src);
    onChange({
      mode: value.mode,
      sources: checked ? value.sources.filter((s) => s !== src) : [...value.sources, src]
    });
  };

  return (
    <div style={containerStyle(minWidth)}>
      Source
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
          <summary style={triggerStyle} aria-label={`Source: ${summary}`}>
            {summary}
          </summary>
          <div style={dropdownPanelStyle} role="group" aria-label="Source filter">
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "0.35rem 0.65rem",
                marginBottom: value.mode === "all" ? 0 : "0.35rem",
                paddingBottom: value.mode === "all" ? 0 : "0.35rem",
                borderBottom: value.mode === "all" ? "none" : "1px solid var(--panel-border)"
              }}
            >
              {MODE_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  style={{
                    ...checkboxLabelStyle,
                    alignItems: "center",
                    whiteSpace: "nowrap",
                    cursor: "pointer"
                  }}
                >
                  <input
                    type="radio"
                    name="feat-source-filter-mode-panel"
                    checked={value.mode === opt.value}
                    onChange={() => setMode(opt.value)}
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
            {value.mode !== "all" &&
              sources.map((src) => {
                const checked = value.sources.includes(src);
                return (
                  <label key={src} style={checkboxLabelStyle}>
                    <input type="checkbox" checked={checked} onChange={() => toggleSource(src)} />
                    <span>{src}</span>
                  </label>
                );
              })}
          </div>
        </details>
      </div>
    </div>
  );
}
