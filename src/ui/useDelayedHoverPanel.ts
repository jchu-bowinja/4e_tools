import { useCallback, useEffect, useRef, useState } from "react";
import type { FocusEvent, MouseEvent } from "react";
import { positionFixedTooltip } from "./glossaryTooltipPosition";
import {
  GLOSSARY_TOOLTIP_CLOSE_DELAY_MS,
  GLOSSARY_TOOLTIP_OPEN_DELAY_MS,
  STANDARD_GLOSSARY_TOOLTIP_LAYOUT,
  type GlossaryTooltipLayout
} from "./glossaryTooltip";

export type HoverPanelPosition = {
  top: number;
  left: number;
  transform?: "translateY(-100%)";
};

/**
 * Delayed open/close floating panel positioning (shared by glossary tooltips and rich info panels).
 */
export function useDelayedHoverPanel(options?: {
  layout?: GlossaryTooltipLayout;
  resetDeps?: unknown[];
}): {
  showPanel: boolean;
  panelPos: HoverPanelPosition | null;
  startHover: (event: MouseEvent<HTMLElement> | FocusEvent<HTMLElement>) => void;
  leaveHover: () => void;
  cancelPendingClose: () => void;
  hideNow: () => void;
} {
  const layout = options?.layout ?? STANDARD_GLOSSARY_TOOLTIP_LAYOUT;
  const resetDeps = options?.resetDeps ?? [];
  const [showPanel, setShowPanel] = useState(false);
  const [panelPos, setPanelPos] = useState<HoverPanelPosition | null>(null);
  const openTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  const cancelCloseTimer = useCallback((): void => {
    if (closeTimerRef.current != null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const hideNow = useCallback((): void => {
    cancelCloseTimer();
    if (openTimerRef.current != null) {
      window.clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
    setShowPanel(false);
    setPanelPos(null);
  }, [cancelCloseTimer]);

  useEffect(() => {
    return () => {
      if (openTimerRef.current != null) window.clearTimeout(openTimerRef.current);
      if (closeTimerRef.current != null) window.clearTimeout(closeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    function onWindowKeyDown(event: KeyboardEvent): void {
      if (event.key !== "Escape") return;
      hideNow();
    }
    window.addEventListener("keydown", onWindowKeyDown);
    return () => window.removeEventListener("keydown", onWindowKeyDown);
  }, [hideNow]);

  useEffect(() => {
    hideNow();
  }, resetDeps);

  const startHover = useCallback(
    (event: MouseEvent<HTMLElement> | FocusEvent<HTMLElement>): void => {
      cancelCloseTimer();
      const rect = event.currentTarget.getBoundingClientRect();
      setPanelPos(positionFixedTooltip(rect, layout));
      if (openTimerRef.current != null) {
        window.clearTimeout(openTimerRef.current);
      }
      if (event.type === "focus") {
        setShowPanel(true);
        openTimerRef.current = null;
        return;
      }
      openTimerRef.current = window.setTimeout(() => {
        setShowPanel(true);
        openTimerRef.current = null;
      }, GLOSSARY_TOOLTIP_OPEN_DELAY_MS);
    },
    [cancelCloseTimer, layout]
  );

  const leaveHover = useCallback((): void => {
    cancelCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      hideNow();
    }, GLOSSARY_TOOLTIP_CLOSE_DELAY_MS);
  }, [cancelCloseTimer, hideNow]);

  return {
    showPanel,
    panelPos,
    startHover,
    leaveHover,
    cancelPendingClose: cancelCloseTimer,
    hideNow
  };
}
