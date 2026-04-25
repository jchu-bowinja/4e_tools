export function findCaseInsensitiveMatches(text: string, query: string): number[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const haystack = text.toLowerCase();
  const matches: number[] = [];
  let start = 0;
  while (start < haystack.length) {
    const idx = haystack.indexOf(needle, start);
    if (idx === -1) break;
    matches.push(idx);
    start = idx + Math.max(1, needle.length);
  }
  return matches;
}

export function scrollTextareaToMatch(textarea: HTMLTextAreaElement, text: string, matchStart: number): void {
  const prefix = text.slice(0, Math.max(0, matchStart));
  const lineNumber = prefix.split("\n").length - 1;
  const computed = window.getComputedStyle(textarea);
  const parsedLineHeight = Number.parseFloat(computed.lineHeight);
  const fallbackLineHeight = 16;
  const lineHeight = Number.isFinite(parsedLineHeight) && parsedLineHeight > 0 ? parsedLineHeight : fallbackLineHeight;
  const targetTop = Math.max(0, (lineNumber - 2) * lineHeight);
  textarea.scrollTop = targetTop;
}
