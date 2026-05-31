import { useCallback, useEffect, useRef, useState, type CSSProperties, type FocusEvent } from "react";
import { createPortal } from "react-dom";
import { positionRulesEntitySelectPanel } from "./glossaryTooltipPosition";

export interface RulesEntitySelectOption {
  id: string;
  name: string;
  source?: string | null;
}

export interface RulesEntitySelectProps {
  options: readonly RulesEntitySelectOption[];
  value?: string;
  onChange: (id: string | undefined) => void;
  placeholder: string;
  /** Accessible name when no visible field label wraps the control. */
  ariaLabel?: string;
  style?: CSSProperties;
  /** Merged into the closed trigger button. */
  triggerStyle?: CSSProperties;
}

const triggerBaseStyle: CSSProperties = {
  display: "block",
  width: "100%",
  padding: "var(--control-padding-y) var(--control-padding-x)",
  border: "1px solid var(--panel-border)",
  borderRadius: "var(--control-radius)",
  background: "var(--surface-0)",
  color: "var(--text-primary)",
  font: "inherit",
  fontSize: "inherit",
  textAlign: "left",
  cursor: "pointer",
  boxSizing: "border-box",
  minHeight: "2.1rem"
};

const dropdownPanelStyle: CSSProperties = {
  overflow: "auto",
  padding: "0.35rem",
  border: "1px solid var(--panel-border)",
  borderRadius: "var(--control-radius)",
  background: "var(--surface-0)",
  boxShadow: "0 4px 12px color-mix(in srgb, var(--text-primary) 12%, transparent)"
};

const optionButtonStyle = (selected: boolean): CSSProperties => ({
  display: "block",
  width: "100%",
  textAlign: "left",
  padding: "0.45rem 0.55rem",
  borderRadius: "6px",
  border: selected ? "1px solid var(--panel-border-strong)" : "1px solid transparent",
  background: selected ? "var(--surface-2)" : "transparent",
  cursor: "pointer",
  font: "inherit",
  fontSize: "inherit",
  color: "var(--text-primary)",
  boxSizing: "border-box"
});

export function RulesEntitySelectOptionLabel({
  name,
  source,
  emphasizeName
}: {
  name: string;
  source?: string | null;
  emphasizeName?: boolean;
}): JSX.Element {
  const src = String(source ?? "").trim();
  return (
    <span
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: "0.5rem",
        width: "100%",
        minWidth: 0
      }}
    >
      <span
        style={{
          fontWeight: emphasizeName ? 600 : 500,
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap"
        }}
      >
        {name}
      </span>
      {src ? (
        <span
          style={{
            fontSize: "0.75rem",
            color: "var(--text-muted)",
            fontWeight: 400,
            flexShrink: 0,
            whiteSpace: "nowrap"
          }}
        >
          {src}
        </span>
      ) : null}
    </span>
  );
}

export function RulesEntitySelect({
  options,
  value,
  onChange,
  placeholder,
  ariaLabel,
  style,
  triggerStyle
}: RulesEntitySelectProps): JSX.Element {
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [panelPos, setPanelPos] = useState<ReturnType<typeof positionRulesEntitySelectPanel> | null>(null);

  const selected = value ? options.find((o) => o.id === value) : undefined;
  const summaryLabel = selected?.name ?? placeholder;
  const summarySource = selected?.source;
  const labelForAria = ariaLabel ?? placeholder;

  const updatePanelPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    setPanelPos(positionRulesEntitySelectPanel(trigger.getBoundingClientRect()));
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setPanelPos(null);
  }, []);

  const pick = (id: string | undefined) => {
    onChange(id);
    close();
  };

  const toggleOpen = () => {
    if (open) {
      close();
      return;
    }
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    updatePanelPosition();
    const onLayout = () => updatePanelPosition();
    window.addEventListener("resize", onLayout);
    window.addEventListener("scroll", onLayout, true);
    return () => {
      window.removeEventListener("resize", onLayout);
      window.removeEventListener("scroll", onLayout, true);
    };
  }, [open, updatePanelPosition]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      close();
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open, close]);

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget;
    if (next instanceof Node && (rootRef.current?.contains(next) || panelRef.current?.contains(next))) {
      return;
    }
    if (open) close();
  };

  const panel =
    open && panelPos
      ? createPortal(
          <div
            ref={panelRef}
            role="listbox"
            aria-label={labelForAria}
            style={{
              position: "fixed",
              top: panelPos.top,
              left: panelPos.left,
              width: panelPos.width,
              maxHeight: panelPos.maxHeight,
              zIndex: 200,
              transform: panelPos.transform,
              ...dropdownPanelStyle
            }}
          >
            <button
              type="button"
              role="option"
              aria-selected={!value}
              style={{
                ...optionButtonStyle(!value),
                color: "var(--text-subtle)",
                fontWeight: 400,
                marginBottom: "0.15rem"
              }}
              onClick={() => pick(undefined)}
            >
              {placeholder}
            </button>
            {options.map((opt) => {
              const isSelected = opt.id === value;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  style={optionButtonStyle(isSelected)}
                  onClick={() => pick(opt.id)}
                >
                  <RulesEntitySelectOptionLabel name={opt.name} source={opt.source} emphasizeName={isSelected} />
                </button>
              );
            })}
          </div>,
          document.body
        )
      : null;

  return (
    <div
      ref={rootRef}
      className={open ? "rules-entity-select-wrap--open" : undefined}
      onBlur={handleBlur}
      style={{ display: "block", width: "100%", ...style }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{ ...triggerBaseStyle, ...triggerStyle }}
        aria-label={
          selected
            ? `${labelForAria}: ${summaryLabel}${summarySource ? `, ${summarySource}` : ""}`
            : `${labelForAria}: ${placeholder}`
        }
        onClick={toggleOpen}
      >
        {selected ? (
          <RulesEntitySelectOptionLabel name={summaryLabel} source={summarySource} emphasizeName />
        ) : (
          <span style={{ color: "var(--text-subtle)", fontWeight: 400 }}>{placeholder}</span>
        )}
      </button>
      {panel}
    </div>
  );
}
