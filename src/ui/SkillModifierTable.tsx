import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { SkillSheetRow } from "../rules/skillCalculator";
import {
  formatSkillArmorCell,
  formatSkillComponentCell,
  formatSkillMiscCell,
  formatSkillTotalCell
} from "../rules/skillCalculator";

/** Wide-layout grid template (exported for tests or layout tooling). */
export const SKILL_MODIFIER_TABLE_COLUMNS =
  "minmax(2.35rem, max-content) minmax(0, 1fr) 1.85rem 1.85rem 2.15rem 3.15rem 1.95rem";

import { ScoreModCell } from "./scoreTableCells";

function HeaderStack({ lines }: { lines: string[] }) {
  return (
    <span className="skill-modifier-table__hdr skill-modifier-table__hdr--stack">
      {lines.map((line) => (
        <span key={line}>{line}</span>
      ))}
    </span>
  );
}

function stripeStyle(stripe: string): CSSProperties {
  return stripe === "transparent" ? {} : { backgroundColor: stripe, borderRadius: "0.2rem" };
}

/** Opaque row background for skill name overlap (extends with overflowing text). */
function nameRowBgStyle(stripe: string): CSSProperties {
  const bg = stripe === "transparent" ? "var(--surface-0)" : stripe;
  return {
    backgroundColor: bg,
    ["--skill-row-bg" as string]: bg,
    borderRadius: "0.2rem"
  };
}

export type SkillModifierTableProps = {
  rows: SkillSheetRow[];
  rowStripe?: boolean;
  fontSize?: string;
  renderSkillName?: (row: SkillSheetRow, stripe: string) => ReactNode;
};

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

export function SkillModifierTable({ rows, rowStripe = true, fontSize = "0.78rem", renderSkillName }: SkillModifierTableProps) {
  const tableRef = useRef<HTMLDivElement>(null);
  const [nameBlockWidth, setNameBlockWidth] = useState<number | null>(null);

  useLayoutEffect(() => {
    const root = tableRef.current;
    if (!root) return;

    const measure = () => {
      const nodes = root.querySelectorAll<HTMLElement>(".skill-modifier-table__name-text, .skill-modifier-table__name-label");
      if (nodes.length === 0) return;
      let max = 0;
      for (const node of nodes) {
        max = Math.max(max, measureNaturalWidth(node));
      }
      setNameBlockWidth((prev) => (prev !== null && Math.abs(prev - max) < 0.5 ? prev : max));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, [rows, fontSize, renderSkillName]);

  const tableStyle: CSSProperties = {
    fontSize,
    ...(nameBlockWidth != null && nameBlockWidth > 0
      ? ({ ["--skill-name-block-width" as string]: `${nameBlockWidth}px` } as CSSProperties)
      : {})
  };

  return (
    <div ref={tableRef} className="skill-modifier-table" style={tableStyle}>
      <div className="skill-modifier-table__header">
        <span className="skill-modifier-table__bonus-hdr skill-modifier-table__hdr">
          <HeaderStack lines={["Bonus"]} />
        </span>
        <span className="skill-modifier-table__name-hdr skill-modifier-table__hdr">Skill</span>
        <div className="skill-modifier-table__breakdown-hdr">
          <HeaderStack lines={["Abil"]} />
          <HeaderStack lines={["½", "Lvl"]} />
          <HeaderStack lines={["Trnd", "(+5)"]} />
          <HeaderStack lines={["Armor", "Penalty"]} />
          <HeaderStack lines={["Misc"]} />
        </div>
      </div>
      {rows.map((row, idx) => {
        const stripe =
          rowStripe && idx % 2 === 0 ? "var(--table-stripe-even)" : rowStripe ? "var(--table-stripe-odd)" : "transparent";
        return (
          <div key={row.skillId} className="skill-modifier-table__row">
            <SkillModifierTableRow row={row} stripe={stripe} renderSkillName={renderSkillName} />
          </div>
        );
      })}
    </div>
  );
}

export type SkillModifierTableRowProps = {
  row: SkillSheetRow;
  stripe?: string;
  renderSkillName?: (row: SkillSheetRow, stripe: string) => ReactNode;
};

export function SkillModifierTableRow({ row, stripe = "transparent", renderSkillName }: SkillModifierTableRowProps) {
  const stripeBg = stripeStyle(stripe);

  const nameNode = renderSkillName ? (
    renderSkillName(row, stripe)
  ) : (
    <span
      className="skill-modifier-table__name-text"
      style={{
        fontWeight: 600,
        color: "var(--text-primary)",
        padding: "0.12rem 0.2rem",
        ...nameRowBgStyle(stripe)
      }}
    >
      {row.name}
      {row.abilityCode ? (
        <span style={{ marginLeft: "0.35rem", fontWeight: 700, fontSize: "0.68rem", color: "var(--text-secondary)" }}>{row.abilityCode}</span>
      ) : null}
      {row.trained ? <strong style={{ color: "var(--status-success)", fontWeight: 700 }}> (T)</strong> : null}
    </span>
  );

  return (
    <>
      <span className="skill-modifier-table__bonus" style={stripeBg}>
        <ScoreModCell value={formatSkillTotalCell(row.modifier)} emphasize />
      </span>
      <span className="skill-modifier-table__name" style={{ minWidth: 0, ...nameRowBgStyle(stripe) }}>
        {nameNode}
      </span>
      <div className="skill-modifier-table__breakdown">
        <span className="skill-modifier-table__comp" style={stripeBg}>
          <ScoreModCell value={formatSkillComponentCell(row.abilityMod)} />
        </span>
        <span className="skill-modifier-table__comp" style={stripeBg}>
          <ScoreModCell value={formatSkillComponentCell(row.halfLevel)} />
        </span>
        <span className="skill-modifier-table__comp" style={stripeBg}>
          <ScoreModCell value={formatSkillComponentCell(row.trainedBonus)} />
        </span>
        <span className="skill-modifier-table__comp" style={stripeBg}>
          <ScoreModCell value={formatSkillArmorCell(row)} />
        </span>
        <span className="skill-modifier-table__comp" style={stripeBg}>
          <ScoreModCell value={formatSkillMiscCell(row.flatBonus)} />
        </span>
      </div>
    </>
  );
}
