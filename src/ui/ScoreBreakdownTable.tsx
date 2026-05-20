import { type CSSProperties, type ReactNode } from "react";
import { formatScoreComponentDisplay, formatScoreTotalDisplay, ScoreModCell } from "./scoreTableCells";
import { TableScrollport } from "./TableScrollport";
import { estimateLabelWidthFromStrings } from "./tableLayout";
import { useMeasuredLabelWidth } from "./useMeasuredLabelWidth";

export type ScoreBreakdownColumnDef = {
  key: string;
  header: string | string[];
  /** Grid track width; defaults from header text length. */
  width?: string;
};

export type ScoreBreakdownRowDef = {
  rowKey: string;
  label: string;
  total: number;
  signedTotal?: boolean;
  values: Record<string, number | null | undefined>;
  glossaryKey?: string;
};

export type ScoreBreakdownVariant = "skill" | "stat";

const P = "score-breakdown-table";

function defaultColumnWidth(header: string | string[]): string {
  const lines = Array.isArray(header) ? header : [header];
  const longest = lines.reduce((max, line) => Math.max(max, line.length), 0);
  if (longest <= 3) return "2rem";
  if (longest <= 5) return "2.35rem";
  if (longest <= 6) return "2.55rem";
  return "2.75rem";
}

function HeaderStack({ lines, className }: { lines: string[]; className?: string }) {
  return (
    <span className={className ? `${className} ${P}__hdr ${P}__hdr--stack` : `${P}__hdr ${P}__hdr--stack`}>
      {lines.map((line) => (
        <span key={line}>{line}</span>
      ))}
    </span>
  );
}

function stripeStyle(stripe: string): CSSProperties {
  return stripe === "transparent" ? {} : { backgroundColor: stripe, borderRadius: "0.2rem" };
}

function labelRowBgStyle(stripe: string): CSSProperties {
  const bg = stripe === "transparent" ? "var(--surface-0)" : stripe;
  return {
    backgroundColor: bg,
    ["--score-breakdown-row-bg" as string]: bg,
    borderRadius: "0.2rem"
  };
}

function estimateLabelMinWidth(
  rows: ScoreBreakdownRowDef[],
  labelHeader: string | null,
  fontSize: string,
  labelEstimatePadding: string
): number {
  const labels = rows.map((row) => row.label);
  if (labelHeader) labels.push(labelHeader);
  return estimateLabelWidthFromStrings(labels, fontSize, labelEstimatePadding);
}

export type ScoreBreakdownTableProps = {
  variant?: ScoreBreakdownVariant;
  columns: ScoreBreakdownColumnDef[];
  rows: ScoreBreakdownRowDef[];
  rowStripe?: boolean;
  fontSize?: string;
  /** Default "Bonus"; pass `null` to hide the bonus column header. */
  bonusHeader?: string | null;
  /** Default "Stat"; pass `null` to hide the label column header. */
  labelHeader?: string | null;
  /** Measure and enforce a shared label column (skills always; stat defenses / motion). */
  prioritizeLabel?: boolean;
  /** Denser rows; with `prioritizeLabel` on stat tables, uses inner sync grid + subgrid. */
  compact?: boolean;
  showComponents?: boolean;
  renderLabel?: (row: ScoreBreakdownRowDef, stripe: string) => ReactNode;
  className?: string;
  formatTotalValue?: (row: ScoreBreakdownRowDef) => string;
  formatComponentValue?: (row: ScoreBreakdownRowDef, columnKey: string) => string;
  /** When defined, replaces the default `ScoreModCell` for that column (return `undefined` to use default). */
  renderComponentCell?: (row: ScoreBreakdownRowDef, columnKey: string, stripe: string) => ReactNode | undefined;
  /** Passed to `estimateLabelWidthFromStrings` for first-paint label width. */
  labelEstimatePadding?: string;
};

export function ScoreBreakdownTable({
  variant = "stat",
  columns,
  rows,
  rowStripe = true,
  fontSize = variant === "skill" ? "0.78rem" : "0.76rem",
  bonusHeader = "Bonus",
  labelHeader = variant === "skill" ? null : "Stat",
  prioritizeLabel = variant === "skill",
  compact = false,
  showComponents = true,
  renderLabel,
  className,
  formatTotalValue,
  formatComponentValue,
  renderComponentCell,
  labelEstimatePadding = variant === "skill" ? "0.12rem 0.2rem" : "0.12rem 0.3rem 0.12rem 0.2rem"
}: ScoreBreakdownTableProps) {
  const measureSelectors = `.${P}__label-text, .${P}__label-affordance, .${P}__label-hdr, .${P}__label-wrap`;

  const estimatedLabelMinWidth = prioritizeLabel
    ? estimateLabelMinWidth(rows, labelHeader, fontSize, labelEstimatePadding)
    : 0;

  const { ref, cssVarStyle } = useMeasuredLabelWidth({
    enabled: prioritizeLabel,
    cssVarName: "--score-breakdown-label-width",
    measureSelectors,
    estimatedMinWidth: estimatedLabelMinWidth,
    stabilizeThreshold: variant === "skill" ? 0.5 : 0,
    deps: [rows, fontSize, renderLabel, labelHeader, variant]
  });

  const compCols = columns
    .map((col) => {
      const width = col.width ?? defaultColumnWidth(col.header);
      return `minmax(${width}, ${width})`;
    })
    .join(" ");

  const isCompactPrioritize = variant === "stat" && prioritizeLabel && compact;
  const fillLabelColumn = isCompactPrioritize;

  const rootClassName = [
    P,
    `${P}--${variant}`,
    prioritizeLabel && `${P}--prioritize-label`,
    compact && `${P}--compact`,
    !showComponents && `${P}--no-components`,
    className
  ]
    .filter(Boolean)
    .join(" ");

  const tableBody = (
    <>
      <div className={`${P}__header`}>
        <span
          className={`${P}__bonus-hdr ${P}__hdr`}
          style={variant === "stat" ? { paddingRight: "var(--score-breakdown-bonus-label-gap, 0.4rem)" } : undefined}
          aria-hidden={bonusHeader === null}
        >
          {bonusHeader !== null ? <HeaderStack lines={[bonusHeader]} /> : null}
        </span>
        <span className={`${P}__label-hdr ${P}__hdr`} aria-hidden={labelHeader === null}>
          {labelHeader !== null ? labelHeader : null}
        </span>
        {showComponents ? (
          <div className={`${P}__breakdown-hdr`}>
            {columns.map((col) => (
              <HeaderStack
                key={col.key}
                className={`${P}__hdr`}
                lines={Array.isArray(col.header) ? col.header : [col.header]}
              />
            ))}
          </div>
        ) : null}
      </div>
      {rows.map((row, idx) => {
        const stripe = !rowStripe
          ? "transparent"
          : idx % 2 === 0
            ? "var(--table-stripe-even)"
            : "var(--table-stripe-odd)";
        const totalText = formatTotalValue
          ? formatTotalValue(row)
          : formatScoreTotalDisplay(row.total, row.signedTotal ?? false);
        const labelInner = renderLabel ? (
          renderLabel(row, stripe)
        ) : (
          <span
            className={`${P}__label-text`}
            style={{ fontWeight: 600, color: "var(--text-primary)", padding: "0.12rem 0.2rem" }}
          >
            {row.label}
          </span>
        );
        const labelNode = prioritizeLabel ? (
          <span className={`${P}__label-wrap`} style={{ minWidth: 0 }}>
            <span className={`${P}__label-text`} style={labelRowBgStyle(stripe)}>
              {labelInner}
            </span>
          </span>
        ) : (
          <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", ...stripeStyle(stripe) }}>
            {labelInner}
          </span>
        );

        return (
          <div key={row.rowKey} className={`${P}__row`}>
            <span className={`${P}__bonus`} style={stripeStyle(stripe)}>
              <ScoreModCell value={totalText} emphasize />
            </span>
            <span
              className={`${P}__label`}
              style={{
                minWidth: 0,
                paddingLeft: variant === "stat" ? "0.1rem" : undefined,
                ...(prioritizeLabel ? (fillLabelColumn ? stripeStyle(stripe) : {}) : labelRowBgStyle(stripe))
              }}
            >
              {labelNode}
            </span>
            {showComponents ? (
              <div className={`${P}__breakdown`}>
                {columns.map((col) => {
                  const customCell = renderComponentCell?.(row, col.key, stripe);
                  return (
                    <span key={col.key} className={`${P}__comp`} style={stripeStyle(stripe)}>
                      {customCell !== undefined ? (
                        customCell
                      ) : (
                        <ScoreModCell
                          value={
                            formatComponentValue
                              ? formatComponentValue(row, col.key)
                              : formatScoreComponentDisplay(row.values[col.key])
                          }
                        />
                      )}
                    </span>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </>
  );

  const scrollStyle: CSSProperties = {
    fontSize,
    fontVariantNumeric: "tabular-nums",
    ...(variant === "stat" ? { ["--score-breakdown-comp-cols" as string]: compCols } : {}),
    ...cssVarStyle
  };

  return (
    <TableScrollport ref={ref} className={rootClassName} style={scrollStyle}>
      {isCompactPrioritize ? <div className={`${P}__sync-grid`}>{tableBody}</div> : tableBody}
    </TableScrollport>
  );
}
