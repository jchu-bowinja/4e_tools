import type { ReactNode } from "react";
import { STANDARD_GLOSSARY_TOOLTIP_PANEL_STYLE } from "./glossaryTooltip";
import type { HoverPanelPosition } from "./useDelayedHoverPanel";

export type FloatingHoverPanelProps = {
  show: boolean;
  position: HoverPanelPosition | null;
  children: ReactNode;
  id?: string;
  role?: "tooltip" | "dialog";
  widthPx?: number;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
};

export function FloatingHoverPanel({
  show,
  position,
  children,
  id,
  role = "tooltip",
  widthPx,
  onMouseEnter,
  onMouseLeave
}: FloatingHoverPanelProps): JSX.Element | null {
  if (!show || !position) return null;

  return (
    <div
      id={id}
      role={role}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        position: "fixed",
        top: position.top,
        left: position.left,
        transform: position.transform ?? "none",
        ...STANDARD_GLOSSARY_TOOLTIP_PANEL_STYLE,
        ...(widthPx != null ? { width: `${widthPx}px` } : {})
      }}
    >
      {children}
    </div>
  );
}
