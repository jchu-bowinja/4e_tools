/** Measure an element's natural width without persisting layout overrides. */
export function measureNaturalWidth(el: HTMLElement): number {
  const prevWidth = el.style.width;
  const prevMinWidth = el.style.minWidth;
  el.style.width = "max-content";
  el.style.minWidth = "0";
  const width = el.getBoundingClientRect().width;
  el.style.width = prevWidth;
  el.style.minWidth = prevMinWidth;
  return width;
}

/** Synchronous label-width estimate before DOM measure (avoids narrow first paint). */
export function estimateLabelWidthFromStrings(
  labels: string[],
  fontSize: string,
  paddingCss = "0.12rem 0.3rem 0.12rem 0.2rem"
): number {
  if (labels.length === 0) return 0;
  if (typeof document === "undefined") {
    const longest = labels.reduce((max, label) => Math.max(max, label.length), 0);
    return longest * 7.5 + 20;
  }
  const probe = document.createElement("span");
  probe.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;font-weight:600;font-size:${fontSize};padding:${paddingCss};`;
  document.body.appendChild(probe);
  let max = 0;
  for (const label of labels) {
    probe.textContent = label;
    max = Math.max(max, probe.getBoundingClientRect().width);
  }
  document.body.removeChild(probe);
  return max;
}
