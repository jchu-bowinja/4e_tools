import type { CSSProperties, RefObject } from "react";

const searchInputStyle: CSSProperties = {
  minWidth: 260,
  border: "1px solid var(--panel-border)",
  borderRadius: "0.28rem",
  padding: "0.22rem 0.3rem",
  backgroundColor: "var(--surface-0)",
  color: "var(--text-primary)"
};

const metaSecondary: CSSProperties = { fontSize: "0.78rem", color: "var(--text-secondary)" };

export function MonsterJsonEditorPanel({
  value,
  readOnly,
  onChange,
  textareaRef,
  searchInput,
  onSearchInputChange,
  onSearchEnter,
  searchStatusText,
  onSearchPrevious,
  onSearchNext,
  searchNavDisabled,
  onCopy,
  fillColumn = false
}: {
  value: string;
  readOnly: boolean;
  onChange?: (value: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  onSearchEnter: () => void;
  searchStatusText: string;
  onSearchPrevious: () => void;
  onSearchNext: () => void;
  searchNavDisabled: boolean;
  onCopy: () => void;
  /** Use flex growth in the center column instead of a fixed tall textarea. */
  fillColumn?: boolean;
}): JSX.Element {
  return (
    <div
      style={
        fillColumn
          ? { display: "flex", flexDirection: "column", minHeight: 0, flex: 1, gap: "0.5rem" }
          : { marginTop: "0.5rem" }
      }
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", alignItems: "center", flexShrink: 0 }}>
        <input
          value={searchInput}
          onChange={(event) => onSearchInputChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            onSearchEnter();
          }}
          placeholder="Search JSON..."
          aria-label="Search JSON"
          style={searchInputStyle}
        />
        <button type="button" disabled={searchNavDisabled} onClick={onSearchPrevious}>
          Previous
        </button>
        <button type="button" disabled={searchNavDisabled} onClick={onSearchNext}>
          Next
        </button>
        <span style={metaSecondary}>{searchStatusText}</span>
        <button type="button" onClick={onCopy} style={{ marginLeft: "auto" }}>
          Copy Contents
        </button>
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        readOnly={readOnly}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        spellCheck={false}
        aria-label="Monster JSON"
        style={{
          margin: fillColumn ? 0 : "0.55rem 0 0 0",
          padding: "0.55rem",
          borderRadius: "0.32rem",
          border: "1px solid var(--panel-border)",
          backgroundColor: "var(--surface-1)",
          color: "var(--text-primary)",
          overflow: "auto",
          height: fillColumn ? undefined : "44rem",
          minHeight: fillColumn ? "12rem" : "12rem",
          flex: fillColumn ? 1 : undefined,
          width: "100%",
          boxSizing: "border-box",
          resize: fillColumn ? "none" : "vertical",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
          fontSize: "0.76rem",
          lineHeight: 1.35
        }}
      />
    </div>
  );
}
