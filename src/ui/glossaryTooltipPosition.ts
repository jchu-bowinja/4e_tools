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
 * Chooses `top` / `left` for a `position: fixed` tooltip beside the trigger.
 * Picks the side (above or below) with more viewport space and always leaves a gap
 * so the panel does not cover the trigger; the panel's own `maxHeight` handles overflow.
 */
export function positionFixedTooltip(triggerRect: DOMRectReadOnly, layout: FixedTooltipLayout): FixedTooltipPosition {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const { panelWidth } = layout;
  const safeMaxLeft = Math.max(VIEWPORT_MARGIN, w - panelWidth - VIEWPORT_MARGIN);
  const left = Math.max(VIEWPORT_MARGIN, Math.min(triggerRect.left, safeMaxLeft));

  const minTop = VIEWPORT_MARGIN;
  const maxBottom = h - VIEWPORT_MARGIN;

  const belowTop = triggerRect.bottom + GAP;
  const spaceBelow = maxBottom - belowTop;
  const aboveAnchorTop = triggerRect.top - GAP;
  const spaceAbove = aboveAnchorTop - minTop;

  if (spaceBelow >= spaceAbove) {
    return { top: belowTop, left };
  }

  return { top: aboveAnchorTop, left, transform: "translateY(-100%)" };
}
