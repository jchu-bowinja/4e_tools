import { useCallback, useState } from "react";
import type { FocusEvent, MouseEvent } from "react";
import type { HoverPanelPosition } from "./useDelayedHoverPanel";
import { useDelayedHoverPanel } from "./useDelayedHoverPanel";

export type GlossaryHoverPanelPosition = HoverPanelPosition;

/**
 * Shared floating glossary panel: delayed open, delayed close, Escape to dismiss.
 * Used by Character Builder, Character Sheet, and Monster Editor.
 */
export function useGlossaryTooltip(options: {
  tooltipId: string;
  /** Clear hover when these values change (e.g. selected monster id). */
  resetDeps?: unknown[];
}): {
  showPanel: boolean;
  hoverKey: string | null;
  panelPos: GlossaryHoverPanelPosition | null;
  startHover: (event: MouseEvent<HTMLElement> | FocusEvent<HTMLElement>, key: string) => void;
  leaveHover: () => void;
  cancelPendingClose: () => void;
  hoverA11y: (key: string) => {
    onMouseEnter: (event: MouseEvent<HTMLElement>) => void;
    onMouseLeave: () => void;
    onFocus: (event: FocusEvent<HTMLElement>) => void;
    onBlur: () => void;
    tabIndex: number;
    "aria-describedby"?: string;
  };
} {
  const { tooltipId, resetDeps = [] } = options;
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const panel = useDelayedHoverPanel({ resetDeps });

  const startHover = useCallback(
    (event: MouseEvent<HTMLElement> | FocusEvent<HTMLElement>, key: string): void => {
      const switchingHoverTarget = panel.showPanel && hoverKey !== null && hoverKey !== key;
      if (switchingHoverTarget) {
        panel.hideNow();
      }
      setHoverKey(key);
      panel.startHover(event);
    },
    [hoverKey, panel]
  );

  const leaveHover = useCallback((): void => {
    setHoverKey(null);
    panel.leaveHover();
  }, [panel]);

  const hoverA11y = useCallback(
    (key: string) => {
      const active = panel.showPanel && hoverKey === key;
      return {
        onMouseEnter: (event: MouseEvent<HTMLElement>) => startHover(event, key),
        onMouseLeave: leaveHover,
        onFocus: (event: FocusEvent<HTMLElement>) => startHover(event, key),
        onBlur: leaveHover,
        tabIndex: 0,
        "aria-describedby": active ? tooltipId : undefined
      };
    },
    [hoverKey, leaveHover, panel.showPanel, startHover, tooltipId]
  );

  return {
    showPanel: panel.showPanel,
    hoverKey,
    panelPos: panel.panelPos,
    startHover,
    leaveHover,
    cancelPendingClose: panel.cancelPendingClose,
    hoverA11y
  };
}
