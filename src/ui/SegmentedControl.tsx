import type { CSSProperties, ReactNode } from "react";

export type SegmentedControlOption<T extends string> = {
  value: T;
  label: ReactNode;
  disabled?: boolean;
};

export type SegmentedControlProps<T extends string> = {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** `pill` — separate bordered segments (sheet tabs). `joined` — single outer border (monster pane toggle). */
  variant?: "pill" | "joined";
  size?: "tab" | "compact" | "inline";
  /** `tablist` uses `role="tab"` + `aria-selected`; default `group` uses `aria-pressed`. */
  role?: "group" | "tablist";
  ariaLabel: string;
  className?: string;
  style?: CSSProperties;
};

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  variant = "pill",
  size = "tab",
  role = "group",
  ariaLabel,
  className,
  style
}: SegmentedControlProps<T>): JSX.Element {
  const rootClass = ["segmented-control", `segmented-control--${variant}`, `segmented-control--${size}`, className]
    .filter(Boolean)
    .join(" ");
  const isTablist = role === "tablist";

  return (
    <div role={role} aria-label={ariaLabel} className={rootClass} style={style}>
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role={isTablist ? "tab" : undefined}
            aria-selected={isTablist ? selected : undefined}
            aria-pressed={!isTablist ? selected : undefined}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            className="segmented-control__option"
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
