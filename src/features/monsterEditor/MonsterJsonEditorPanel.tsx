import type { RefObject } from "react";
import { JsonEditorBody } from "../../ui/JsonEditorBody";

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
  fillColumn?: boolean;
}): JSX.Element {
  return (
    <JsonEditorBody
      value={value}
      readOnly={readOnly}
      onChange={onChange}
      textareaRef={textareaRef}
      textareaAriaLabel="Monster JSON"
      searchInput={searchInput}
      onSearchInputChange={onSearchInputChange}
      onSearchEnter={onSearchEnter}
      searchStatusText={searchStatusText}
      onSearchPrevious={onSearchPrevious}
      onSearchNext={onSearchNext}
      searchNavDisabled={searchNavDisabled}
      onCopy={onCopy}
      fillColumn={fillColumn}
      toolbarGap="0.35rem"
    />
  );
}
