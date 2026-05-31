import { afterEach, describe, expect, it, vi } from "vitest";
import { positionFixedTooltip, positionRulesEntitySelectPanel } from "../../src/ui/glossaryTooltipPosition";

const layout = { panelWidth: 340, maxHeightVh: 50 };

function mockRect(overrides: Partial<DOMRect>): DOMRectReadOnly {
  return {
    x: 0,
    y: 0,
    width: 100,
    height: 25,
    top: 0,
    left: 0,
    right: 100,
    bottom: 25,
    toJSON: () => ({}),
    ...overrides
  };
}

function mockViewport(width: number, height: number): void {
  vi.stubGlobal("window", {
    innerWidth: width,
    innerHeight: height
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("positionFixedTooltip", () => {
  it("places below the trigger when there is more room below", () => {
    mockViewport(1024, 800);
    const pos = positionFixedTooltip(mockRect({ top: 100, bottom: 125, left: 50 }), layout);
    expect(pos).toEqual({ top: 133, left: 50 });
  });

  it("places above the trigger when there is more room above", () => {
    mockViewport(1024, 800);
    const pos = positionFixedTooltip(mockRect({ top: 700, bottom: 725, left: 50 }), layout);
    expect(pos).toEqual({ top: 692, left: 50, transform: "translateY(-100%)" });
  });

  it("does not overlap the trigger when both sides are tight (old clamp path)", () => {
    mockViewport(800, 400);
    const trigger = mockRect({ top: 200, bottom: 225, left: 20 });
    const pos = positionFixedTooltip(trigger, layout);

    if (pos.transform === "translateY(-100%)") {
      expect(pos.top).toBeLessThanOrEqual(trigger.top - 8);
    } else {
      expect(pos.top).toBeGreaterThanOrEqual(trigger.bottom + 8);
    }
  });

  it("clamps horizontal position inside the viewport", () => {
    mockViewport(400, 800);
    const pos = positionFixedTooltip(mockRect({ top: 100, bottom: 125, left: 5 }), layout);
    expect(pos.left).toBe(12);
  });
});

describe("positionRulesEntitySelectPanel", () => {
  it("opens below with a readable min height when space allows", () => {
    mockViewport(1024, 800);
    const pos = positionRulesEntitySelectPanel(mockRect({ top: 100, bottom: 125, left: 50, width: 200 }));
    expect(pos.top).toBe(131);
    expect(pos.transform).toBeUndefined();
    expect(pos.maxHeight).toBeGreaterThanOrEqual(96);
    expect(pos.maxHeight).toBeLessThanOrEqual(320);
    expect(pos.width).toBeGreaterThanOrEqual(280);
  });

  it("opens above when the trigger is near the bottom", () => {
    mockViewport(1024, 800);
    const pos = positionRulesEntitySelectPanel(mockRect({ top: 700, bottom: 725, left: 50, width: 200 }));
    expect(pos.transform).toBe("translateY(-100%)");
    expect(pos.maxHeight).toBeGreaterThanOrEqual(96);
    expect(pos.maxHeight).toBeLessThanOrEqual(320);
  });
});
