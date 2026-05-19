import type { CSSProperties } from "react";
import { getFeatTagPillStyle } from "./featPowerFilters";

const pillBaseStyle: CSSProperties = {
  display: "inline-block",
  padding: "0.08rem 0.35rem",
  borderRadius: "999px",
  fontSize: "0.7rem",
  fontWeight: 600,
  whiteSpace: "nowrap"
};

export function FeatTagPill(props: { tag: string }): JSX.Element {
  const pill = getFeatTagPillStyle(props.tag);
  return <span style={{ ...pillBaseStyle, ...pill }}>{props.tag}</span>;
}
