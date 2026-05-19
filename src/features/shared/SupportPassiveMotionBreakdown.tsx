import type { CSSProperties } from "react";
import type { PassiveOtherBonuses } from "../../rules/supportStatAdds";
import { CollapsibleDisclosure } from "../../ui/CollapsibleDisclosure";
import { disclosureSummaryStyle } from "../../ui/disclosureStyles";

export function supportPassiveMotionHasAny(o: PassiveOtherBonuses): boolean {
  return o.initiative !== 0 || o.speed !== 0 || o.healingSurgesPerDay !== 0;
}

/** Initiative / speed / surge count from feat, theme, paragon path, epic destiny statAdds (matches derived totals). */
export function SupportPassiveMotionBreakdown(props: {
  o: PassiveOtherBonuses;
  summaryStyle?: CSSProperties;
}): JSX.Element | null {
  const { o, summaryStyle } = props;
  if (!supportPassiveMotionHasAny(o)) return null;
  return (
    <CollapsibleDisclosure
      style={{ marginTop: "0.45rem", fontSize: "0.78rem", color: "var(--text-secondary)" }}
      summary="Feat / theme / path / destiny (movement)"
      summaryStyle={{ ...disclosureSummaryStyle, ...summaryStyle }}
      bodyStyle={{ marginTop: "0.25rem" }}
    >
      <p style={{ margin: 0, color: "var(--text-muted)" }}>
        Flat bonuses included in Speed, Initiative, and healing surge count above (always-on statAdds only).
      </p>
      <div style={{ marginTop: "0.35rem", display: "grid", gap: "0.15rem", fontVariantNumeric: "tabular-nums" }}>
        {o.initiative !== 0 && (
          <span>
            Initiative {o.initiative >= 0 ? "+" : ""}
            {o.initiative}
          </span>
        )}
        {o.speed !== 0 && (
          <span>
            Speed {o.speed >= 0 ? "+" : ""}
            {o.speed}
          </span>
        )}
        {o.healingSurgesPerDay !== 0 && (
          <span>
            Healing surges / day {o.healingSurgesPerDay >= 0 ? "+" : ""}
            {o.healingSurgesPerDay}
          </span>
        )}
      </div>
    </CollapsibleDisclosure>
  );
}
