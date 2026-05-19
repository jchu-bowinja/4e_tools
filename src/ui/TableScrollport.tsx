import { forwardRef, type CSSProperties, type ReactNode } from "react";

export type TableScrollportProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
};

/** Horizontal scroll + width contract for data tables (see docs/ui-bible.md). */
export const TableScrollport = forwardRef<HTMLDivElement, TableScrollportProps>(function TableScrollport(
  { children, className, style },
  ref
) {
  return (
    <div ref={ref} className={className ? "table-scrollport " + className : "table-scrollport"} style={style}>
      {children}
    </div>
  );
});
