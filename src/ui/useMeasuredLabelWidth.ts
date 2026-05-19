import { useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { measureNaturalWidth } from "./tableLayout";

export type UseMeasuredLabelWidthOptions = {
  enabled: boolean;
  /** CSS custom property, e.g. `--skill-name-block-width`. */
  cssVarName: string;
  /** Selectors passed to `querySelectorAll` on the scrollport root. */
  measureSelectors: string;
  estimatedMinWidth: number;
  /** Skip state updates when width changes less than this (px). */
  stabilizeThreshold?: number;
  deps?: readonly unknown[];
};

export type UseMeasuredLabelWidthResult = {
  ref: RefObject<HTMLDivElement>;
  measuredWidth: number | null;
  cssVarStyle: CSSProperties;
};

export function useMeasuredLabelWidth({
  enabled,
  cssVarName,
  measureSelectors,
  estimatedMinWidth,
  stabilizeThreshold = 0,
  deps = []
}: UseMeasuredLabelWidthOptions): UseMeasuredLabelWidthResult {
  const ref = useRef<HTMLDivElement>(null);
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(() =>
    enabled && estimatedMinWidth > 0 ? estimatedMinWidth : null
  );

  useLayoutEffect(() => {
    if (!enabled) return;
    const root = ref.current;
    if (!root) return;

    const measure = () => {
      if (estimatedMinWidth > 0) {
        root.style.setProperty(cssVarName, `${estimatedMinWidth}px`);
      }
      const nodes = root.querySelectorAll<HTMLElement>(measureSelectors);
      let max = estimatedMinWidth;
      for (const node of nodes) {
        max = Math.max(max, measureNaturalWidth(node));
      }
      if (max > 0) {
        root.style.setProperty(cssVarName, `${max}px`);
      }
      setMeasuredWidth((prev) => {
        if (max <= 0) return null;
        if (prev !== null && stabilizeThreshold > 0 && Math.abs(prev - max) < stabilizeThreshold) {
          return prev;
        }
        return max;
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, [enabled, cssVarName, measureSelectors, estimatedMinWidth, stabilizeThreshold, ...deps]);

  const width =
    measuredWidth ?? (enabled && estimatedMinWidth > 0 ? estimatedMinWidth : null);
  const cssVarStyle: CSSProperties =
    enabled && width != null && width > 0 ? ({ [cssVarName]: `${width}px` } as CSSProperties) : {};

  return { ref, measuredWidth: width, cssVarStyle };
}
