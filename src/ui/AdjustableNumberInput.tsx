import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties, type KeyboardEvent } from "react";
import { parseAdjustableNumberBlur } from "./adjustableNumberBlur";

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
  /** Show read-only leading value as `leading / value` (steppers edit value only; e.g. point-buy spent / budget). */
  fractionLeading?: number;
  /** Optional style for the read-only leading fraction value (e.g. match/mismatch color). */
  fractionLeadingStyle?: CSSProperties;
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

function widthFromDraft(draftText: string, fallback: number): number {
  const parsed = Number(draftText);
  return Number.isFinite(parsed) ? parsed : fallback;
}

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
    fractionLeading,
    fractionLeadingStyle,
    optional = false
  } = props;

  const hasFractionLeading = fractionLeading !== undefined;
  const hasCompanionMax = !hasFractionLeading && companionMax !== undefined;
  const isEmpty = optional && props.value === undefined;
  const clamped = isEmpty ? min : clamp(props.value ?? min, min, max);

  const [isFocused, setIsFocused] = useState(false);
  const [draftText, setDraftText] = useState(() => (isEmpty ? "" : String(clamped)));
  const skipCommitOnBlurRef = useRef(false);

  useEffect(() => {
    if (!isFocused) {
      setDraftText(isEmpty ? "" : String(clamped));
    }
  }, [clamped, isEmpty, isFocused]);

  const emitChange = (next: number | undefined): void => {
    if (optional) {
      (props as AdjustableNumberInputOptionalProps).onChange(next);
    } else if (next !== undefined) {
      (props as AdjustableNumberInputRequiredProps).onChange(next);
    }
  };

  const commitDraft = (): void => {
    const result = parseAdjustableNumberBlur(draftText, { min, max, optional });
    if (result.kind === "revert") return;
    const next = result.value;
    if (optional) {
      if (next === props.value) return;
      emitChange(next);
      return;
    }
    if (next !== undefined && next !== (props as AdjustableNumberInputRequiredProps).value) {
      emitChange(next);
    }
  };

  const cancelDraft = (): void => {
    setDraftText(isEmpty ? "" : String(clamped));
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>): void => {
    setDraftText(event.target.value);
  };

  const handleFocus = (): void => {
    setDraftText(isEmpty ? "" : String(clamped));
    setIsFocused(true);
  };

  const handleBlur = (): void => {
    setIsFocused(false);
    if (!skipCommitOnBlurRef.current) {
      commitDraft();
    } else {
      skipCommitOnBlurRef.current = false;
    }
    cancelDraft();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "Enter") {
      event.currentTarget.blur();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      skipCommitOnBlurRef.current = true;
      setIsFocused(false);
      cancelDraft();
      event.currentTarget.blur();
    }
  };

  const clearFocus = (): void => {
    if (!isFocused) return;
    setIsFocused(false);
    cancelDraft();
  };

  const stepUp = (): void => {
    clearFocus();
    if (isEmpty) {
      emitChange(clamp(Math.max(min, 0), min, max));
      return;
    }
    emitChange(clamp(clamped + 1, min, max));
  };

  const stepDown = (): void => {
    clearFocus();
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
    hasFractionLeading ? "adjustable-number--with-fraction-leading" : "",
    className
  ]
    .filter(Boolean)
    .join(" ");

  const displayText = isFocused ? draftText : isEmpty ? "" : String(clamped);
  const widthValue = isFocused ? widthFromDraft(draftText, clamped) : clamped;
  const widthValues = isEmpty ? [max] : [widthValue, max];

  const inputWidthStyle = fill
    ? inputStyle
    : {
        width: adjustableNumberWidthCh(
          ...(hasCompanionMax || hasFractionLeading ? [widthValue] : widthValues)
        ),
        ...inputStyle
      };

  const valueInput = (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      value={displayText}
      onChange={handleInputChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      aria-label={
        hasCompanionMax && !isEmpty
          ? `${ariaLabel}, ${clamped} of ${companionMax}`
          : hasFractionLeading
            ? `${ariaLabel}, ${fractionLeading} of ${clamped} spent`
            : ariaLabel
      }
      className="adjustable-number__input"
      style={inputWidthStyle}
    />
  );

  return (
    <div className={rootClass} style={style}>
      {hasFractionLeading ? (
        <div
          className="adjustable-number__value-pane"
          style={{ minWidth: companionMaxPaneWidthCh(fractionLeading, clamped) }}
        >
          <span
            className="adjustable-number__fraction-leading"
            aria-hidden
            style={{ width: adjustableNumberWidthCh(fractionLeading), ...fractionLeadingStyle }}
          >
            {fractionLeading}
          </span>
          <span className="adjustable-number__fraction-sep" aria-hidden>
            /
          </span>
          {valueInput}
        </div>
      ) : hasCompanionMax ? (
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
