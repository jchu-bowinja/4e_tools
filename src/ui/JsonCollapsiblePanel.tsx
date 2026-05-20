import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { CollapsibleDisclosure } from "./CollapsibleDisclosure";
import { jsonDisclosureSummaryStyle } from "./disclosureStyles";
import { JsonEditorBody } from "./JsonEditorBody";
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

  const commitSearch = () => {
    const committed = jsonSearchInput.trim();
    setJsonSearchQuery(committed);
    setJsonSearchResultIdx(0);
    setJsonSearchJumpTick((prev) => prev + 1);
  };

  const searchStatusText = jsonSearchQuery.trim()
    ? jsonSearchMatches.length > 0
      ? `${Math.min(jsonSearchResultIdx + 1, jsonSearchMatches.length)} of ${jsonSearchMatches.length}`
      : "0 matches"
    : "Type and press Enter";

  return (
    <CollapsibleDisclosure
      style={shellStyle}
      open={defaultOpen}
      summary={title}
      summaryStyle={jsonDisclosureSummaryStyle}
      bodyStyle={{ marginTop: "0.45rem" }}
    >
      <JsonEditorBody
        value={jsonText}
        readOnly={readOnly}
        onChange={onJsonChange}
        textareaRef={jsonTextareaRef}
        searchInput={jsonSearchInput}
        onSearchInputChange={setJsonSearchInput}
        onSearchEnter={commitSearch}
        searchStatusText={searchStatusText}
        onSearchPrevious={() =>
          setJsonSearchResultIdx((prev) => {
            const nextIdx =
              jsonSearchMatches.length === 0 ? 0 : (prev - 1 + jsonSearchMatches.length) % jsonSearchMatches.length;
            setJsonSearchJumpTick((tick) => tick + 1);
            return nextIdx;
          })
        }
        onSearchNext={() =>
          setJsonSearchResultIdx((prev) => {
            const nextIdx = jsonSearchMatches.length === 0 ? 0 : (prev + 1) % jsonSearchMatches.length;
            setJsonSearchJumpTick((tick) => tick + 1);
            return nextIdx;
          })
        }
        searchNavDisabled={jsonSearchMatches.length === 0}
        onCopy={() => {
          if (!navigator.clipboard?.writeText) {
            alert("Clipboard API unavailable in this browser.");
            return;
          }
          void navigator.clipboard.writeText(jsonText);
        }}
      />
    </CollapsibleDisclosure>
  );
}
