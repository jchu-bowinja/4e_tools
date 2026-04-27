import { useCallback, useEffect, useRef, useState } from "react";
import type { FocusEvent, MouseEvent } from "react";
import { positionFixedTooltip } from "./glossaryTooltipPosition";
import {
  GLOSSARY_TOOLTIP_CLOSE_DELAY_MS,
  GLOSSARY_TOOLTIP_OPEN_DELAY_MS,
  STANDARD_GLOSSARY_TOOLTIP_LAYOUT
} from "./glossaryTooltip";

export type GlossaryHoverPanelPosition = {
  top: number;
  left: number;
  transform?: "translateY(-100%)";
};

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
  const [showPanel, setShowPanel] = useState(false);
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [panelPos, setPanelPos] = useState<GlossaryHoverPanelPosition | null>(null);
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
    setHoverKey(null);
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
    (event: MouseEvent<HTMLElement> | FocusEvent<HTMLElement>, key: string): void => {
      cancelCloseTimer();
      const rect = event.currentTarget.getBoundingClientRect();
      setPanelPos(positionFixedTooltip(rect, STANDARD_GLOSSARY_TOOLTIP_LAYOUT));
      const switchingHoverTarget = showPanel && hoverKey !== null && hoverKey !== key;
      if (switchingHoverTarget) {
        setShowPanel(false);
      }
      setHoverKey(key);
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
    [cancelCloseTimer, hoverKey, showPanel]
  );

  const leaveHover = useCallback((): void => {
    cancelCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      hideNow();
    }, GLOSSARY_TOOLTIP_CLOSE_DELAY_MS);
  }, [cancelCloseTimer, hideNow]);

  const hoverA11y = useCallback(
    (key: string) => {
      const active = showPanel && hoverKey === key;
      return {
        onMouseEnter: (event: MouseEvent<HTMLElement>) => startHover(event, key),
        onMouseLeave: leaveHover,
        onFocus: (event: FocusEvent<HTMLElement>) => startHover(event, key),
        onBlur: leaveHover,
        tabIndex: 0,
        "aria-describedby": active ? tooltipId : undefined
      };
    },
    [hoverKey, leaveHover, showPanel, startHover, tooltipId]
  );

  return {
    showPanel,
    hoverKey,
    panelPos,
    startHover,
    leaveHover,
    /** When the cursor moves onto the floating panel, cancel the scheduled hide. */
    cancelPendingClose: cancelCloseTimer,
    hoverA11y
  };
}
