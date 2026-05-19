import { type ComponentPropsWithoutRef, type ReactNode } from "react";
import type { SkillSheetRow } from "../rules/skillCalculator";

const P = "score-breakdown-table";

export type SkillModifierNameContentProps = {
  row: SkillSheetRow;
  /** Extra badges after name / (T), still left of the ability code (e.g. auto, off-list). */
  trailing?: ReactNode;
} & Omit<ComponentPropsWithoutRef<"span">, "children">;

/** Skill name, then (T), with ability code right-aligned in the name column. */
export function SkillModifierNameContent({ row, trailing, className, style, ...rest }: SkillModifierNameContentProps) {
  return (
    <span
      className={className ? `${className} ${P}__label-text` : `${P}__label-text`}
      style={style}
      {...rest}
    >
      <span className={`${P}__label-leading`}>
        <span className={`${P}__label-title`}>{row.name}</span>
        {row.trained ? <strong className={`${P}__label-trained`}> (T)</strong> : null}
        {trailing}
      </span>
      {row.abilityCode ? <span className={`${P}__label-abil`}>{row.abilityCode}</span> : null}
    </span>
  );
}
