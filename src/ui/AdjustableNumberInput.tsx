import type { ChangeEvent, CSSProperties } from "react";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Width for the numeric field portion (stepper column is separate). */
export function adjustableNumberWidthCh(...values: number[]): string {
  const longest = values.reduce((max, value) => {
    const digits = String(Math.max(0, Math.trunc(value))).length;
    return Math.max(max, digits);
  }, 1);
  return `calc(${Math.max(3, longest + 1)}ch + 4px)`;
}

/** Min width for a `current / max` value pane (slash + both numbers). */
export function companionMaxPaneWidthCh(current: number, companionMax: number): string {
  const currentDigits = String(Math.max(0, Math.trunc(current))).length;
  const maxDigits = String(Math.max(0, Math.trunc(companionMax))).length;
  const chars = currentDigits + 1 + maxDigits;
  return `calc(${Math.max(5, chars + 1)}ch + 8px)`;
}

type AdjustableNumberInputBaseProps = {
  min?: number;
  max?: number;
  ariaLabel: string;
  id?: string;
  className?: string;
  style?: CSSProperties;
  inputStyle?: CSSProperties;
  /** Tighter padding for compact form layouts (tables, resource strips). */
  compact?: boolean;
  /** Grow the value field to fill the container width (for grid form layouts). */
  fill?: boolean;
  /** Show read-only maximum beside the value as `current / max` (steppers edit current only). */
  companionMax?: number;
};

type AdjustableNumberInputRequiredProps = AdjustableNumberInputBaseProps & {
  optional?: false;
  value: number;
  onChange: (next: number) => void;
};

type AdjustableNumberInputOptionalProps = AdjustableNumberInputBaseProps & {
  optional: true;
  value: number | undefined;
  onChange: (next: number | undefined) => void;
};

export type AdjustableNumberInputProps = AdjustableNumberInputRequiredProps | AdjustableNumberInputOptionalProps;

export function AdjustableNumberInput(props: AdjustableNumberInputProps): JSX.Element {
  const {
    min = 0,
    max = Number.MAX_SAFE_INTEGER,
    ariaLabel,
    id,
    className,
    style,
    inputStyle,
    compact = false,
    fill = false,
    companionMax,
    optional = false
  } = props;

  const hasCompanionMax = companionMax !== undefined;
  const isEmpty = optional && props.value === undefined;
  const clamped = isEmpty ? min : clamp(props.value ?? min, min, max);

  const emitChange = (next: number | undefined): void => {
    if (optional) {
      (props as AdjustableNumberInputOptionalProps).onChange(next);
    } else if (next !== undefined) {
      (props as AdjustableNumberInputRequiredProps).onChange(next);
    }
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const raw = event.target.value;
    if (raw === "") {
      emitChange(optional ? undefined : min);
      return;
    }
    const parsed = Number(raw);
    emitChange(clamp(Number.isFinite(parsed) ? parsed : min, min, max));
  };

  const stepUp = (): void => {
    if (isEmpty) {
      emitChange(clamp(Math.max(min, 0), min, max));
      return;
    }
    emitChange(clamp(clamped + 1, min, max));
  };

  const stepDown = (): void => {
    if (optional && (isEmpty || clamped <= min)) {
      emitChange(undefined);
      return;
    }
    emitChange(clamp(clamped - 1, min, max));
  };

  const rootClass = [
    "adjustable-number",
    compact ? "adjustable-number--compact" : "",
    fill ? "adjustable-number--fill" : "",
    hasCompanionMax ? "adjustable-number--with-companion-max" : "",
    className
  ]
    .filter(Boolean)
    .join(" ");

  const widthValues = isEmpty ? [max] : [clamped, max];

  const inputWidthStyle = fill
    ? inputStyle
    : {
        width: adjustableNumberWidthCh(...(hasCompanionMax ? [clamped] : widthValues)),
        ...inputStyle
      };

  const valueInput = (
    <input
      id={id}
      type="number"
      min={min}
      max={max}
      value={isEmpty ? "" : clamped}
      onChange={handleInputChange}
      aria-label={
        hasCompanionMax && !isEmpty ? `${ariaLabel}, ${clamped} of ${companionMax}` : ariaLabel
      }
      className="adjustable-number__input"
      style={inputWidthStyle}
    />
  );

  return (
    <div className={rootClass} style={style}>
      {hasCompanionMax ? (
        <div
          className="adjustable-number__value-pane"
          style={{ minWidth: companionMaxPaneWidthCh(clamped, companionMax) }}
        >
          {valueInput}
          <span className="adjustable-number__fraction-sep" aria-hidden>
            /
          </span>
          <span className="adjustable-number__companion-max" aria-hidden>
            {companionMax}
          </span>
        </div>
      ) : (
        valueInput
      )}
      <div className="adjustable-number__stepper" role="group" aria-label={`${ariaLabel} adjustment`}>
        <button
          type="button"
          className="adjustable-number__step-btn"
          disabled={!isEmpty && clamped >= max}
          onClick={stepUp}
          aria-label={`Increase ${ariaLabel}`}
        >
          +
        </button>
        <button
          type="button"
          className="adjustable-number__step-btn"
          disabled={optional ? isEmpty : clamped <= min}
          onClick={stepDown}
          aria-label={`Decrease ${ariaLabel}`}
        >
          −
        </button>
      </div>
    </div>
  );
}
