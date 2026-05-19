import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { CollapsibleDisclosure } from "./CollapsibleDisclosure";
import { jsonDisclosureSummaryStyle } from "./disclosureStyles";
import { findCaseInsensitiveMatches, scrollTextareaToMatch } from "./jsonSearch";

export type JsonCollapsiblePanelProps = {
  title: ReactNode;
  jsonText: string;
  shellStyle?: CSSProperties;
  defaultOpen?: boolean;
  readOnly?: boolean;
  onJsonChange?: (value: string) => void;
};

export function JsonCollapsiblePanel({
  title,
  jsonText,
  shellStyle,
  defaultOpen,
  readOnly = true,
  onJsonChange
}: JsonCollapsiblePanelProps): JSX.Element {
  const [jsonSearchInput, setJsonSearchInput] = useState("");
  const [jsonSearchQuery, setJsonSearchQuery] = useState("");
  const [jsonSearchResultIdx, setJsonSearchResultIdx] = useState(0);
  const [jsonSearchJumpTick, setJsonSearchJumpTick] = useState(0);
  const jsonTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const jsonSearchMatches = useMemo(
    () => findCaseInsensitiveMatches(jsonText, jsonSearchQuery),
    [jsonText, jsonSearchQuery]
  );

  useEffect(() => {
    if (!jsonSearchQuery.trim() || jsonSearchMatches.length === 0) return;
    const textarea = jsonTextareaRef.current;
    if (!textarea) return;
    const idx = jsonSearchMatches[Math.min(jsonSearchResultIdx, jsonSearchMatches.length - 1)] ?? 0;
    scrollTextareaToMatch(textarea, jsonText, idx);
  }, [jsonSearchJumpTick, jsonSearchMatches, jsonSearchQuery, jsonSearchResultIdx, jsonText]);

  return (
    <CollapsibleDisclosure
      style={shellStyle}
      open={defaultOpen}
      summary={title}
      summaryStyle={jsonDisclosureSummaryStyle}
      bodyStyle={{ marginTop: "0.45rem" }}
    >
      <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
        <input
          value={jsonSearchInput}
          onChange={(event) => setJsonSearchInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            const committed = jsonSearchInput.trim();
            setJsonSearchQuery(committed);
            setJsonSearchResultIdx(0);
            setJsonSearchJumpTick((prev) => prev + 1);
          }}
          placeholder="Search JSON..."
          style={{
            minWidth: 260,
            border: "1px solid var(--panel-border)",
            borderRadius: "0.28rem",
            padding: "0.22rem 0.3rem"
          }}
        />
        <button
          type="button"
          disabled={jsonSearchMatches.length === 0}
          onClick={() =>
            setJsonSearchResultIdx((prev) => {
              const nextIdx =
                jsonSearchMatches.length === 0 ? 0 : (prev - 1 + jsonSearchMatches.length) % jsonSearchMatches.length;
              setJsonSearchJumpTick((tick) => tick + 1);
              return nextIdx;
            })
          }
        >
          Previous
        </button>
        <button
          type="button"
          disabled={jsonSearchMatches.length === 0}
          onClick={() =>
            setJsonSearchResultIdx((prev) => {
              const nextIdx = jsonSearchMatches.length === 0 ? 0 : (prev + 1) % jsonSearchMatches.length;
              setJsonSearchJumpTick((tick) => tick + 1);
              return nextIdx;
            })
          }
        >
          Next
        </button>
        <span style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>
          {jsonSearchQuery.trim()
            ? jsonSearchMatches.length > 0
              ? `${Math.min(jsonSearchResultIdx + 1, jsonSearchMatches.length)} of ${jsonSearchMatches.length}`
              : "0 matches"
            : "Type and press Enter"}
        </span>
        <button
          type="button"
          onClick={() => {
            if (!navigator.clipboard?.writeText) {
              alert("Clipboard API unavailable in this browser.");
              return;
            }
            void navigator.clipboard.writeText(jsonText);
          }}
          style={{ marginLeft: "auto" }}
        >
          Copy Contents
        </button>
      </div>
      <textarea
        ref={jsonTextareaRef}
        value={jsonText}
        readOnly={readOnly}
        onChange={onJsonChange ? (event) => onJsonChange(event.target.value) : undefined}
        style={{
          margin: "0.5rem 0 0 0",
          padding: "0.5rem",
          borderRadius: "0.3rem",
          border: "1px solid var(--panel-border)",
          backgroundColor: "var(--surface-1)",
          color: "var(--text-primary)",
          overflow: "auto",
          height: "44rem",
          minHeight: "12rem",
          width: "100%",
          boxSizing: "border-box",
          resize: "vertical",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
          fontSize: "0.76rem",
          lineHeight: 1.35
        }}
      />
    </CollapsibleDisclosure>
  );
}
