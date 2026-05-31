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

export type RulesEntitySelectPanelPosition = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  transform?: "translateY(-100%)";
};

const RULES_ENTITY_SELECT_GAP_PX = 6;
const RULES_ENTITY_SELECT_MIN_WIDTH_PX = 280;
const RULES_ENTITY_SELECT_PREFERRED_MIN_HEIGHT_PX = 180;
const RULES_ENTITY_SELECT_MAX_HEIGHT_PX = 320;
const RULES_ENTITY_SELECT_ABSOLUTE_MIN_HEIGHT_PX = 96;

/**
 * `position: fixed` placement for builder race/class dropdowns (portaled list).
 * Uses viewport space beside the trigger so the list is not clipped by scroll parents.
 */
export function positionRulesEntitySelectPanel(triggerRect: DOMRectReadOnly): RulesEntitySelectPanelPosition {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(
    Math.max(triggerRect.width, RULES_ENTITY_SELECT_MIN_WIDTH_PX),
    vw - VIEWPORT_MARGIN * 2
  );
  const left = Math.max(VIEWPORT_MARGIN, Math.min(triggerRect.left, vw - width - VIEWPORT_MARGIN));

  const belowTop = triggerRect.bottom + RULES_ENTITY_SELECT_GAP_PX;
  const spaceBelow = vh - VIEWPORT_MARGIN - belowTop;
  const aboveAnchorTop = triggerRect.top - RULES_ENTITY_SELECT_GAP_PX;
  const spaceAbove = aboveAnchorTop - VIEWPORT_MARGIN;

  const openBelow = spaceBelow >= spaceAbove;
  const available = openBelow ? spaceBelow : spaceAbove;
  const capped = Math.min(RULES_ENTITY_SELECT_MAX_HEIGHT_PX, available);
  const maxHeight =
    capped >= RULES_ENTITY_SELECT_PREFERRED_MIN_HEIGHT_PX
      ? Math.min(RULES_ENTITY_SELECT_MAX_HEIGHT_PX, capped)
      : Math.max(RULES_ENTITY_SELECT_ABSOLUTE_MIN_HEIGHT_PX, capped);

  if (openBelow) {
    return { top: belowTop, left, width, maxHeight };
  }

  return { top: aboveAnchorTop, left, width, maxHeight, transform: "translateY(-100%)" };
}
