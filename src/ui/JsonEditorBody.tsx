import type { CSSProperties, RefObject } from "react";

const searchInputStyle: CSSProperties = {
  minWidth: 260,
  border: "1px solid var(--panel-border)",
  borderRadius: "0.28rem",
  padding: "0.22rem 0.3rem",
  backgroundColor: "var(--surface-0)",
  color: "var(--text-primary)"
};

const searchStatusStyle: CSSProperties = { fontSize: "0.8rem", color: "var(--text-secondary)" };

const textareaStyleBase: CSSProperties = {
  padding: "0.55rem",
  borderRadius: "0.32rem",
  border: "1px solid var(--panel-border)",
  backgroundColor: "var(--surface-1)",
  color: "var(--text-primary)",
  overflow: "auto",
  width: "100%",
  boxSizing: "border-box",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  fontSize: "0.76rem",
  lineHeight: 1.35
};

export type JsonEditorBodyProps = {
  value: string;
  readOnly: boolean;
  onChange?: (value: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  textareaAriaLabel?: string;
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  onSearchEnter: () => void;
  searchStatusText: string;
  onSearchPrevious: () => void;
  onSearchNext: () => void;
  searchNavDisabled: boolean;
  onCopy: () => void;
  /** Grow textarea in a flex column (monster center pane). */
  fillColumn?: boolean;
  toolbarGap?: string;
};

export function JsonEditorBody({
  value,
  readOnly,
  onChange,
  textareaRef,
  textareaAriaLabel = "JSON",
  searchInput,
  onSearchInputChange,
  onSearchEnter,
  searchStatusText,
  onSearchPrevious,
  onSearchNext,
  searchNavDisabled,
  onCopy,
  fillColumn = false,
  toolbarGap = "0.4rem"
}: JsonEditorBodyProps): JSX.Element {
  return (
    <div
      style={
        fillColumn
          ? { display: "flex", flexDirection: "column", minHeight: 0, flex: 1, gap: "0.5rem" }
          : undefined
      }
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: toolbarGap, alignItems: "center", flexShrink: 0 }}>
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
        <span style={searchStatusStyle}>{searchStatusText}</span>
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
        aria-label={textareaAriaLabel}
        style={{
          ...textareaStyleBase,
          margin: fillColumn ? 0 : "0.5rem 0 0 0",
          height: fillColumn ? undefined : "44rem",
          minHeight: "12rem",
          flex: fillColumn ? 1 : undefined,
          resize: fillColumn ? "none" : "vertical"
        }}
      />
    </div>
  );
}
