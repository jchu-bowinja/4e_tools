import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { formatScoreComponentDisplay, formatScoreTotalDisplay, ScoreModCell } from "./scoreTableCells";

export type StatScoreColumnDef = {
  key: string;
  header: string | string[];
  /** Grid track width; defaults from header text length. */
  width?: string;
};

function defaultStatColumnWidth(header: string | string[]): string {
  const lines = Array.isArray(header) ? header : [header];
  const longest = lines.reduce((max, line) => Math.max(max, line.length), 0);
  if (longest <= 3) return "2rem";
  if (longest <= 5) return "2.35rem";
  if (longest <= 6) return "2.55rem";
  return "2.75rem";
}

export type StatScoreRowDef = {
  rowKey: string;
  label: string;
  total: number;
  signedTotal?: boolean;
  values: Record<string, number | null | undefined>;
  glossaryKey?: string;
};

function HeaderStack({ lines, className }: { lines: string[]; className?: string }) {
  return (
    <span className={className ? `${className} stat-score-table__hdr--stack` : "stat-score-table__hdr stat-score-table__hdr--stack"}>
      {lines.map((line) => (
        <span key={line}>{line}</span>
      ))}
    </span>
  );
}

function stripeStyle(stripe: string): CSSProperties {
  return stripe === "transparent" ? {} : { backgroundColor: stripe, borderRadius: "0.2rem" };
}

/** Opaque row background for stat label overlap (extends with overflowing text). */
function labelRowBgStyle(stripe: string): CSSProperties {
  const bg = stripe === "transparent" ? "var(--surface-0)" : stripe;
  return {
    backgroundColor: bg,
    ["--stat-row-bg" as string]: bg,
    borderRadius: "0.2rem"
  };
}

function measureNaturalWidth(el: HTMLElement): number {
  const prevWidth = el.style.width;
  const prevMinWidth = el.style.minWidth;
  el.style.width = "max-content";
  el.style.minWidth = "0";
  const width = el.getBoundingClientRect().width;
  el.style.width = prevWidth;
  el.style.minWidth = prevMinWidth;
  return width;
}

export type StatScoreTableProps = {
  columns: StatScoreColumnDef[];
  rows: StatScoreRowDef[];
  rowStripe?: boolean;
  fontSize?: string;
  /** Default "Bonus"; pass `null` to hide the bonus column header. */
  bonusHeader?: string | null;
  /** Default "Stat"; pass `null` to hide the stat column header. */
  statHeader?: string | null;
  /**
   * Keep the total score and row label readable when component columns crowd the layout
   * (same principle as the skills modifier table).
   */
  prioritizeStatLabel?: boolean;
  /** When false, only total and row label are shown (no component columns). */
  showComponents?: boolean;
  renderLabel?: (row: StatScoreRowDef, stripe: string) => ReactNode;
};

export function StatScoreTable({
  columns,
  rows,
  rowStripe = true,
  fontSize = "0.76rem",
  bonusHeader = "Bonus",
  statHeader = "Stat",
  prioritizeStatLabel = false,
  showComponents = true,
  renderLabel
}: StatScoreTableProps) {
  const tableRef = useRef<HTMLDivElement>(null);
  const [labelBlockWidth, setLabelBlockWidth] = useState<number | null>(null);

  const compCols = columns.map((col) => col.width ?? defaultStatColumnWidth(col.header)).join(" ");

  useLayoutEffect(() => {
    if (!prioritizeStatLabel) return;
    const root = tableRef.current;
    if (!root) return;

    const measure = () => {
      const nodes = root.querySelectorAll<HTMLElement>(".stat-score-table__stat-label-text, .stat-score-table__stat-label");
      if (nodes.length === 0) return;
      let max = 0;
      for (const node of nodes) {
        max = Math.max(max, measureNaturalWidth(node));
      }
      setLabelBlockWidth((prev) => (prev !== null && Math.abs(prev - max) < 0.5 ? prev : max));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, [rows, fontSize, renderLabel, prioritizeStatLabel]);

  const tableStyle: CSSProperties = {
    fontSize,
    fontVariantNumeric: "tabular-nums",
    minWidth: 0,
    width: "100%",
    ["--stat-score-comp-cols" as string]: compCols,
    ...(prioritizeStatLabel && labelBlockWidth != null && labelBlockWidth > 0
      ? { ["--stat-label-block-width" as string]: `${labelBlockWidth}px` }
      : {})
  };

  return (
    <div
      ref={tableRef}
      className={`stat-score-table${prioritizeStatLabel ? " stat-score-table--prioritize-stat" : ""}${showComponents ? "" : " stat-score-table--no-components"}`}
      style={tableStyle}
    >
      <div className="stat-score-table__header">
        <span
          className="stat-score-table__bonus-hdr stat-score-table__hdr"
          style={{ paddingRight: "var(--skill-bonus-name-gap, 0.4rem)" }}
          aria-hidden={bonusHeader === null}
        >
          {bonusHeader !== null ? <HeaderStack lines={[bonusHeader]} /> : null}
        </span>
        <span className="stat-score-table__stat-hdr stat-score-table__hdr" aria-hidden={statHeader === null}>
          {statHeader !== null ? statHeader : null}
        </span>
        {showComponents ? (
          <div className="stat-score-table__breakdown-hdr">
            {columns.map((col) => (
              <HeaderStack
                key={col.key}
                className="stat-score-table__hdr"
                lines={Array.isArray(col.header) ? col.header : [col.header]}
              />
            ))}
          </div>
        ) : null}
      </div>
      {rows.map((row, idx) => {
        const stripe =
          rowStripe && idx % 2 === 0 ? "var(--table-stripe-even)" : rowStripe ? "var(--table-stripe-odd)" : "transparent";
        const totalText = formatScoreTotalDisplay(row.total, row.signedTotal ?? false);
        const labelInner = renderLabel ? (
          renderLabel(row, stripe)
        ) : (
          <span
            className="stat-score-table__stat-label-text"
            style={{ fontWeight: 600, color: "var(--text-primary)", padding: "0.12rem 0.2rem" }}
          >
            {row.label}
          </span>
        );
        const labelNode = prioritizeStatLabel ? (
          <span className="stat-score-table__stat-label" style={{ minWidth: 0, ...labelRowBgStyle(stripe) }}>
            <span className="stat-score-table__stat-label-text">{labelInner}</span>
          </span>
        ) : (
          <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", ...stripeStyle(stripe) }}>
            {labelInner}
          </span>
        );

        return (
          <div key={row.rowKey} className="stat-score-table__row">
            <span className="stat-score-table__bonus" style={stripeStyle(stripe)}>
              <ScoreModCell value={totalText} emphasize />
            </span>
            <span className="stat-score-table__stat" style={{ minWidth: 0, paddingLeft: "0.1rem", ...labelRowBgStyle(stripe) }}>
              {labelNode}
            </span>
            {showComponents ? (
              <div className="stat-score-table__breakdown">
                {columns.map((col) => (
                  <span key={col.key} className="stat-score-table__comp" style={stripeStyle(stripe)}>
                    <ScoreModCell value={formatScoreComponentDisplay(row.values[col.key])} />
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
