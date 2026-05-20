import { useLayoutEffect, useRef, type CSSProperties } from "react";

export type BuilderTabCarouselItem<T extends string> = {
  id: T;
  label: string;
  status: "complete" | "incomplete";
};

type Props<T extends string> = {
  tabs: BuilderTabCarouselItem<T>[];
  activeTab: T;
  onSelect: (id: T) => void;
  renderStatus: (status: "complete" | "incomplete") => string;
  className?: string;
  style?: CSSProperties;
};

/** Narrowest slot for inactive tabs before label becomes unreadable. */
const MIN_COMPRESSED_TAB_PX = 42;
/** Asymmetric hysteresis avoids flicker at the boundary (e.g. scrollbar width toggling). */
const COMPRESS_ENTER_PX = 20;
const COMPRESS_EXIT_PX = 36;

function TabButtonContent<T extends string>(props: {
  tab: BuilderTabCarouselItem<T>;
  renderStatus: (status: "complete" | "incomplete") => string;
  statusComplete: boolean;
}): JSX.Element {
  const { tab, renderStatus, statusComplete } = props;
  return (
    <>
      <div className="builder-tab-carousel__label">{tab.label}</div>
      <div
        className="builder-tab-carousel__status"
        style={{ color: statusComplete ? "var(--status-success)" : "var(--text-muted)" }}
      >
        {renderStatus(tab.status)}
      </div>
    </>
  );
}

export function BuilderTabCarousel<T extends string>({
  tabs,
  activeTab,
  onSelect,
  renderStatus,
  className,
  style
}: Props<T>): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const compressedRef = useRef(false);
  const lastCompressedWidthRef = useRef<number | null>(null);

  const activeIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.id === activeTab)
  );

  useLayoutEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    const track = trackRef.current;
    if (!container || !measure || !track) return;

    let frame = 0;

    const setCompressed = (next: boolean): void => {
      if (compressedRef.current === next) return;
      compressedRef.current = next;
      container.classList.toggle("builder-tab-carousel--compressed", next);
      if (!next) {
        container.style.removeProperty("--builder-tab-compressed-width");
        lastCompressedWidthRef.current = null;
      }
    };

    const update = (): void => {
      const available = container.getBoundingClientRect().width;
      if (available < 1) return;

      const measureButtons = measure.querySelectorAll<HTMLButtonElement>("button.builder-tab-carousel__tab");
      const naturalWidths = Array.from(measureButtons, (btn) => btn.offsetWidth);
      if (naturalWidths.length !== tabs.length) return;

      const gapPx = Number.parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap) || 7.2;
      const totalGaps = Math.max(0, tabs.length - 1) * gapPx;
      const totalNatural = naturalWidths.reduce((sum, w) => sum + w, 0) + totalGaps;
      const overflow = totalNatural - available;

      const wasCompressed = compressedRef.current;
      const shouldCompress = wasCompressed
        ? overflow > -COMPRESS_EXIT_PX
        : overflow > COMPRESS_ENTER_PX;

      setCompressed(shouldCompress);
      if (!shouldCompress) return;

      const activeNatural = naturalWidths[activeIndex] ?? naturalWidths[0] ?? 0;
      const inactiveCount = Math.max(1, tabs.length - 1);
      const forInactive = available - activeNatural - totalGaps;
      const compressedPx = Math.max(MIN_COMPRESSED_TAB_PX, forInactive / inactiveCount);
      const rounded = Math.round(compressedPx);

      if (lastCompressedWidthRef.current === rounded) return;
      lastCompressedWidthRef.current = rounded;
      container.style.setProperty("--builder-tab-compressed-width", `${rounded}px`);
    };

    const scheduleUpdate = (): void => {
      if (frame !== 0) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        frame = 0;
        update();
      });
    };

    scheduleUpdate();
    const observer = new ResizeObserver(scheduleUpdate);
    observer.observe(container);

    return () => {
      observer.disconnect();
      if (frame !== 0) cancelAnimationFrame(frame);
      compressedRef.current = false;
      lastCompressedWidthRef.current = null;
    };
  }, [tabs, activeIndex]);

  const rootClass = ["builder-tab-carousel", className].filter(Boolean).join(" ");

  return (
    <div ref={containerRef} className={rootClass} style={style}>
      <div ref={measureRef} className="builder-tab-carousel__measure" aria-hidden>
        <div className="builder-tab-carousel__track builder-tab-carousel__track--measure">
          {tabs.map((tab) => (
            <button key={tab.id} type="button" tabIndex={-1} disabled className="builder-tab-carousel__tab">
              <TabButtonContent tab={tab} renderStatus={renderStatus} statusComplete={tab.status === "complete"} />
            </button>
          ))}
        </div>
      </div>
      <div ref={trackRef} className="builder-tab-carousel__track" role="tablist">
        {tabs.map((tab) => {
          const selected = tab.id === activeTab;
          const statusComplete = tab.status === "complete";
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              className={`builder-tab-carousel__tab${selected ? " builder-tab-carousel__tab--active" : ""}`}
              onClick={() => onSelect(tab.id)}
            >
              <TabButtonContent tab={tab} renderStatus={renderStatus} statusComplete={statusComplete} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
