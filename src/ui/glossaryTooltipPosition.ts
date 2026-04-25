const VIEWPORT_MARGIN = 12;
const GAP = 8;

export type FixedTooltipLayout = {
  /** `width` in px for the `position: fixed` panel. */
  panelWidth: number;
  /** `maxHeight` in vh, matching the panel (e.g. 48 for `48vh`). */
  maxHeightVh: number;
};

export type FixedTooltipPosition = {
  top: number;
  left: number;
  /**
   * When set, apply to the panel so a short box sits flush above the trigger (avoids
   * reserving a full `maxHeight` of vertical gap). Ignored for placement below the trigger.
   */
  transform?: "translateY(-100%)";
};

/**
 * Chooses `top` / `left` for a `position: fixed` tooltip so it stays in the window.
 * If there is not enough room below the trigger, places it above when that fits; otherwise clamps.
 */
export function positionFixedTooltip(triggerRect: DOMRectReadOnly, layout: FixedTooltipLayout): FixedTooltipPosition {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const { panelWidth, maxHeightVh } = layout;
  const panelMaxHeightPx = h * (maxHeightVh / 100);
  const safeMaxLeft = Math.max(VIEWPORT_MARGIN, w - panelWidth - VIEWPORT_MARGIN);
  const left = Math.max(VIEWPORT_MARGIN, Math.min(triggerRect.left, safeMaxLeft));

  const minTop = VIEWPORT_MARGIN;
  const maxTop = Math.max(minTop, h - VIEWPORT_MARGIN - panelMaxHeightPx);

  const belowTop = triggerRect.bottom + GAP;
  if (belowTop <= maxTop) {
    return { top: belowTop, left };
  }

  const canFitAboveAtMaxHeight = triggerRect.top - GAP - panelMaxHeightPx >= minTop;
  if (canFitAboveAtMaxHeight) {
    return { top: triggerRect.top - GAP, left, transform: "translateY(-100%)" };
  }

  return { top: Math.max(minTop, Math.min(belowTop, maxTop)), left };
}
